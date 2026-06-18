# File: app/services/realtime_transcription.py
"""
Real-time transcription service using Deepgram WebSocket API.
Uses raw websockets library for reliable streaming.
"""
import asyncio
import base64
import json
from typing import Optional, Callable, List
import websockets

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("TAP.RealtimeTranscription")

# Deepgram WebSocket URL
DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"


class RealtimeTranscriptionSession:
    """
    Manages a real-time transcription session with Deepgram.
    Uses raw websockets for maximum reliability.
    
    Usage:
        session = RealtimeTranscriptionSession(on_transcript=callback)
        await session.start()
        await session.send_audio(audio_bytes)
        transcript = await session.stop()
    """
    
    def __init__(
        self,
        on_transcript: Optional[Callable] = None,
        language: str = "en",
        model: str = "nova-2",
    ):
        """
        Initialize a transcription session.
        
        Args:
            on_transcript: Async callback for transcript updates (text, is_final)
            language: Language code (default: "en")
            model: Deepgram model (default: "nova-2")
        """
        self.on_transcript = on_transcript
        self.language = language
        self.model = model
        
        self._ws = None
        self._full_transcript: List[str] = []
        self._is_running = False
        self._receive_task = None
        self._lock = asyncio.Lock()
        
    async def start(self) -> bool:
        """
        Start the Deepgram WebSocket connection.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if not settings.DEEPGRAM_API_KEY:
                logger.error("DEEPGRAM_API_KEY not configured")
                return False
            
            logger.info("Starting Deepgram connection...")
            
            # Build WebSocket URL with query parameters
            ws_url = (
                f"{DEEPGRAM_WS_URL}"
                f"?model={self.model}"
                f"&language={self.language}"
                f"&encoding=linear16"
                f"&sample_rate=16000"
                f"&channels=1"
                f"&punctuate=true"
                f"&interim_results=true"
                f"&smart_format=true"
            )
            
            # Connect with API key in header
            headers = {
                "Authorization": f"Token {settings.DEEPGRAM_API_KEY}"
            }
            
            self._ws = await websockets.connect(
                ws_url,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=20,
            )
            
            self._is_running = True
            
            # Start background task to receive messages
            self._receive_task = asyncio.create_task(self._receive_messages())
            
            logger.info("Deepgram connection started successfully")
            return True
                
        except Exception as e:
            logger.error(f"Error starting Deepgram connection: {str(e)}")
            return False
    
    async def _receive_messages(self):
        """Background task to receive and process transcript messages."""
        try:
            async for message in self._ws:
                try:
                    data = json.loads(message)
                    
                    # Check for transcript in the response
                    if data.get("type") == "Results":
                        channel = data.get("channel", {})
                        alternatives = channel.get("alternatives", [])
                        
                        if alternatives:
                            transcript = alternatives[0].get("transcript", "")
                            is_final = data.get("is_final", False)
                            
                            if transcript:
                                if is_final:
                                    self._full_transcript.append(transcript)
                                    logger.debug(f"Final: {transcript[:50]}...")
                                
                                # Call the callback
                                if self.on_transcript:
                                    try:
                                        await self.on_transcript(transcript, is_final)
                                    except Exception as e:
                                        logger.error(f"Callback error: {str(e)}")
                                        
                except json.JSONDecodeError:
                    logger.warning(f"Non-JSON message: {message[:100]}")
                except Exception as e:
                    logger.error(f"Error processing message: {str(e)}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("Deepgram connection closed")
        except Exception as e:
            logger.error(f"Receive error: {str(e)}")
        finally:
            self._is_running = False
    
    async def send_audio(self, audio_data: bytes) -> bool:
        """
        Send audio data to Deepgram for transcription.
        
        Args:
            audio_data: Raw audio bytes (PCM 16-bit, 16kHz, mono)
            
        Returns:
            True if sent successfully, False otherwise
        """
        if not self._is_running or not self._ws:
            return False
            
        try:
            await self._ws.send(audio_data)
            return True
        except Exception as e:
            logger.error(f"Error sending audio: {str(e)}")
            return False
    
    async def stop(self) -> str:
        """
        Stop the transcription session and return the full transcript.
        
        Returns:
            Complete transcript text
        """
        async with self._lock:
            self._is_running = False
            
            # Cancel receive task
            if self._receive_task:
                self._receive_task.cancel()
                try:
                    await self._receive_task
                except asyncio.CancelledError:
                    pass
            
            # Close WebSocket
            if self._ws:
                try:
                    await self._ws.close()
                except Exception as e:
                    logger.warning(f"Error closing WebSocket: {str(e)}")
            
            # Combine all transcript parts
            full_text = " ".join(self._full_transcript)
            logger.info(f"Session ended. Transcript length: {len(full_text)} chars")
            
            return full_text
    
    def get_current_transcript(self) -> str:
        """Get the current accumulated transcript."""
        return " ".join(self._full_transcript)
    
    @property
    def is_running(self) -> bool:
        """Check if the session is active."""
        return self._is_running


def decode_audio_base64(base64_data: str) -> bytes:
    """
    Decode base64 audio data to bytes.
    
    Args:
        base64_data: Base64 encoded audio string
        
    Returns:
        Raw audio bytes
    """
    try:
        return base64.b64decode(base64_data)
    except Exception as e:
        logger.error(f"Error decoding base64 audio: {str(e)}")
        return b""
