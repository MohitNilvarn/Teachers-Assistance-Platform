# File: app/api/v1/realtime.py
"""
Real-time transcription WebSocket endpoint.

Allows teachers to stream audio from their microphone
and receive real-time transcription, with automatic
content generation when the session ends.
"""
import json
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
from bson import ObjectId

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from fastapi.responses import HTMLResponse

from app.core.config import settings
from app.core.logger import get_logger
from app.core.dependencies import verify_token_from_string
from app.db.mongodb import get_database
from app.services.realtime_transcription import RealtimeTranscriptionSession, decode_audio_base64
from app.ai.graph import run_content_generation

logger = get_logger("TAP.Realtime")
router = APIRouter()


async def save_lecture_from_transcript(
    course_id: str,
    teacher_id: str,
    title: str,
    transcript: str,
) -> str:
    """
    Save a new lecture from a real-time transcription session.
    
    Returns:
        The created lecture ID
    """
    db = get_database()
    
    lecture_doc = {
        "course_id": course_id,
        "teacher_id": teacher_id,
        "title": title,
        "description": f"Live recorded lecture: {title}",
        "audio_url": None,  # No stored audio for live sessions
        "transcript": transcript,
        "transcript_segments": [],  # Deepgram doesn't provide segments in same format
        "duration_seconds": 0,  # Unknown for live sessions
        "is_transcribed": True,
        "is_live_recorded": True,
        "transcription_status": "completed",  # Required for generate endpoint
        "generation_status": "generating",  # Must match Lecture enum
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await db.lectures.insert_one(lecture_doc)
    lecture_id = str(result.inserted_id)
    
    logger.info(f"Saved lecture {lecture_id} from live transcript ({len(transcript)} chars)")
    return lecture_id


@router.websocket("/realtime/transcribe/{course_id}")
async def realtime_transcribe(
    websocket: WebSocket,
    course_id: str,
    token: str = Query(..., description="JWT authentication token"),
):
    """
    WebSocket endpoint for real-time audio transcription.
    
    **Connection:**
    ```
    ws://host/api/v1/realtime/transcribe/{course_id}?token=YOUR_JWT_TOKEN
    ```
    
    **Client → Server Messages:**
    - `{"type": "audio", "data": "<base64_audio>"}` - Send audio chunk
    - `{"type": "stop", "title": "Lecture Title"}` - End session
    
    **Server → Client Messages:**
    - `{"type": "connected", "message": "..."}` - Connection established
    - `{"type": "transcript", "text": "...", "is_final": bool}` - Transcript update
    - `{"type": "complete", "lecture_id": "...", "message": "..."}` - Session complete
    - `{"type": "error", "message": "..."}` - Error occurred
    """
    
    # Verify authentication
    try:
        user = await verify_token_from_string(token)
        if not user:
            await websocket.close(code=4001, reason="Invalid token")
            return
        
        # Check if teacher
        user_role = user.get("user_metadata", {}).get("role", "student")
        if user_role != "teacher":
            await websocket.close(code=4003, reason="Teachers only")
            return
            
        teacher_id = user.get("id", "unknown")
        logger.info(f"Authenticated teacher {teacher_id} for real-time transcription")
        
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        await websocket.close(code=4001, reason="Authentication failed")
        return
    
    # Verify course exists
    try:
        db = get_database()
        course = await db.courses.find_one({"_id": ObjectId(course_id)})
        if not course:
            await websocket.close(code=4004, reason="Course not found")
            return
    except Exception as e:
        logger.error(f"Course lookup error: {str(e)}")
        await websocket.close(code=4004, reason="Invalid course ID")
        return
    
    # Accept WebSocket connection
    await websocket.accept()
    logger.info(f"WebSocket connected for course {course_id}")
    
    # Send connection confirmation
    await websocket.send_json({
        "type": "connected",
        "message": "Connected to real-time transcription service",
        "course_id": course_id,
    })
    
    # Create transcription session
    session: Optional[RealtimeTranscriptionSession] = None
    
    async def on_transcript(text: str, is_final: bool):
        """Callback to send transcript updates to client."""
        try:
            await websocket.send_json({
                "type": "transcript",
                "text": text,
                "is_final": is_final,
            })
        except Exception as e:
            logger.error(f"Error sending transcript: {str(e)}")
    
    try:
        # Initialize Deepgram session
        session = RealtimeTranscriptionSession(on_transcript=on_transcript)
        started = await session.start()
        
        if not started:
            await websocket.send_json({
                "type": "error",
                "message": "Failed to start transcription service. Check DEEPGRAM_API_KEY.",
            })
            await websocket.close()
            return
        
        await websocket.send_json({
            "type": "ready",
            "message": "Transcription service ready. Start sending audio.",
        })
        
        # Message handling loop
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                msg_type = message.get("type", "")
                
                if msg_type == "audio":
                    # Decode and send audio to Deepgram
                    audio_data = decode_audio_base64(message.get("data", ""))
                    if audio_data:
                        await session.send_audio(audio_data)
                
                elif msg_type == "stop":
                    # End session and generate content
                    title = message.get("title", "Untitled Lecture")
                    logger.info(f"Stopping session for lecture: {title}")
                    
                    # Get final transcript
                    transcript = await session.stop()
                    
                    if not transcript or len(transcript.strip()) < 50:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Transcript too short to generate content (minimum 50 characters)",
                        })
                        break
                    
                    # Save lecture
                    lecture_id = await save_lecture_from_transcript(
                        course_id=course_id,
                        teacher_id=teacher_id,
                        title=title,
                        transcript=transcript,
                    )
                    
                    # Send initial completion
                    await websocket.send_json({
                        "type": "processing",
                        "message": "Generating notes, assignments, and flashcards...",
                        "lecture_id": lecture_id,
                    })
                    
                    # Run content generation
                    try:
                        result = await asyncio.to_thread(
                            run_content_generation,
                            lecture_id=lecture_id,
                            course_id=course_id,
                            transcript=transcript,
                            lecture_title=title,
                            content_types=["notes", "assignment", "flashcards"],
                        )
                        
                        await websocket.send_json({
                            "type": "complete",
                            "message": "Content generated successfully!",
                            "lecture_id": lecture_id,
                            "generated": {
                                "notes": result.get("notes") is not None,
                                "assignment": result.get("assignment") is not None,
                                "flashcards": result.get("flashcards") is not None,
                            },
                        })
                        
                    except Exception as e:
                        logger.error(f"Content generation error: {str(e)}")
                        await websocket.send_json({
                            "type": "complete",
                            "message": "Lecture saved but content generation failed. You can regenerate from the lecture page.",
                            "lecture_id": lecture_id,
                            "error": str(e),
                        })
                    
                    break
                
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON message",
                })
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for course {course_id}")
        
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Server error: {str(e)}",
            })
        except:
            pass
            
    finally:
        # Clean up session
        if session and session.is_running:
            try:
                await session.stop()
            except:
                pass
        logger.info(f"Cleaned up session for course {course_id}")


# Test page for development
@router.get("/realtime/test", response_class=HTMLResponse)
async def realtime_test_page():
    """
    Serve a test HTML page for real-time transcription.
    For development/testing purposes only.
    """
    html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TAP - Real-time Transcription Test</title>
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --success: #22c55e;
            --danger: #ef4444;
            --warning: #f59e0b;
            --bg-dark: #0f172a;
            --bg-card: #1e293b;
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --border: #334155;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, var(--bg-dark) 0%, #1a1a2e 100%);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        h1 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, var(--primary) 0%, #a855f7 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .subtitle {
            color: var(--text-muted);
            margin-bottom: 2rem;
        }
        
        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
        }
        
        input[type="text"] {
            width: 100%;
            padding: 0.75rem 1rem;
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 0.875rem;
            transition: border-color 0.2s;
        }
        
        input[type="text"]:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        .btn-group {
            display: flex;
            gap: 1rem;
            margin-top: 1.5rem;
        }
        
        button {
            flex: 1;
            padding: 0.875rem 1.5rem;
            border: none;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-primary {
            background: var(--primary);
            color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
            background: var(--primary-dark);
            transform: translateY(-1px);
        }
        
        .btn-danger {
            background: var(--danger);
            color: white;
        }
        
        .btn-danger:hover:not(:disabled) {
            background: #dc2626;
        }
        
        .status {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .status-disconnected { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
        .status-connecting { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
        .status-connected { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .status-recording { background: rgba(239, 68, 68, 0.2); color: var(--danger); animation: pulse 1.5s infinite; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .transcript-box {
            background: var(--bg-dark);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1rem;
            min-height: 200px;
            max-height: 400px;
            overflow-y: auto;
            font-size: 0.875rem;
            line-height: 1.6;
            white-space: pre-wrap;
        }
        
        .transcript-interim {
            color: var(--text-muted);
            font-style: italic;
        }
        
        .transcript-final {
            color: var(--text);
        }
        
        .mic-icon {
            width: 20px;
            height: 20px;
        }
        
        .logs {
            font-family: 'Fira Code', monospace;
            font-size: 0.75rem;
            color: var(--text-muted);
            max-height: 150px;
            overflow-y: auto;
        }
        
        .log-entry {
            padding: 0.25rem 0;
            border-bottom: 1px solid var(--border);
        }
        
        .log-error { color: var(--danger); }
        .log-success { color: var(--success); }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎙️ Real-time Transcription Test</h1>
        <p class="subtitle">Test the Deepgram-powered live transcription feature</p>
        
        <div class="card">
            <div class="form-group">
                <label>JWT Token (from Supabase auth)</label>
                <input type="text" id="token" placeholder="eyJhbGc..." />
            </div>
            <div class="form-group">
                <label>Course ID</label>
                <input type="text" id="courseId" placeholder="60a7e5c8f..." />
            </div>
            <div class="form-group">
                <label>Lecture Title</label>
                <input type="text" id="lectureTitle" value="Test Lecture" />
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                <span id="status" class="status status-disconnected">● Disconnected</span>
            </div>
            
            <div class="btn-group">
                <button id="startBtn" class="btn-primary" onclick="startRecording()">
                    <svg class="mic-icon" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                    Start Recording
                </button>
                <button id="stopBtn" class="btn-danger" onclick="stopRecording()" disabled>
                    <svg class="mic-icon" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z"/>
                    </svg>
                    Stop & Generate
                </button>
            </div>
        </div>
        
        <div class="card">
            <label>Live Transcript</label>
            <div id="transcript" class="transcript-box">
                <span class="transcript-interim">Waiting for speech...</span>
            </div>
        </div>
        
        <div class="card">
            <label>Connection Logs</label>
            <div id="logs" class="logs"></div>
        </div>
    </div>
    
    <script>
        let ws = null;
        let mediaRecorder = null;
        let audioContext = null;
        let processor = null;
        let source = null;
        let stream = null;
        let finalTranscript = '';
        
        function log(message, type = 'info') {
            const logs = document.getElementById('logs');
            const entry = document.createElement('div');
            entry.className = 'log-entry' + (type === 'error' ? ' log-error' : type === 'success' ? ' log-success' : '');
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logs.appendChild(entry);
            logs.scrollTop = logs.scrollHeight;
        }
        
        function setStatus(status, text) {
            const el = document.getElementById('status');
            el.className = 'status status-' + status;
            el.textContent = '● ' + text;
        }
        
        function updateTranscript(text, isFinal) {
            const el = document.getElementById('transcript');
            if (isFinal) {
                finalTranscript += text + ' ';
                el.innerHTML = `<span class="transcript-final">${finalTranscript}</span>`;
            } else {
                el.innerHTML = `<span class="transcript-final">${finalTranscript}</span><span class="transcript-interim">${text}</span>`;
            }
            el.scrollTop = el.scrollHeight;
        }
        
        async function startRecording() {
            const token = document.getElementById('token').value.trim();
            const courseId = document.getElementById('courseId').value.trim();
            
            if (!token || !courseId) {
                alert('Please enter Token and Course ID');
                return;
            }
            
            finalTranscript = '';
            document.getElementById('transcript').innerHTML = '<span class="transcript-interim">Connecting...</span>';
            
            try {
                // Connect WebSocket
                setStatus('connecting', 'Connecting...');
                log('Connecting to WebSocket...');
                
                const wsUrl = `ws://${window.location.host}/api/v1/realtime/transcribe/${courseId}?token=${token}`;
                ws = new WebSocket(wsUrl);
                
                ws.onopen = async () => {
                    log('WebSocket connected', 'success');
                };
                
                ws.onmessage = async (event) => {
                    const msg = JSON.parse(event.data);
                    log(`Received: ${msg.type}`);
                    
                    if (msg.type === 'connected') {
                        setStatus('connected', 'Connected');
                    } else if (msg.type === 'ready') {
                        setStatus('recording', 'Recording');
                        log('Starting audio capture...');
                        await startAudioCapture();
                    } else if (msg.type === 'transcript') {
                        updateTranscript(msg.text, msg.is_final);
                    } else if (msg.type === 'processing') {
                        setStatus('connecting', 'Generating content...');
                        log(msg.message);
                    } else if (msg.type === 'complete') {
                        setStatus('connected', 'Complete');
                        log(`Done! Lecture ID: ${msg.lecture_id}`, 'success');
                        alert(`Success! Lecture saved with ID: ${msg.lecture_id}`);
                        cleanup();
                    } else if (msg.type === 'error') {
                        log(`Error: ${msg.message}`, 'error');
                    }
                };
                
                ws.onerror = (error) => {
                    log('WebSocket error', 'error');
                    setStatus('disconnected', 'Error');
                };
                
                ws.onclose = () => {
                    log('WebSocket closed');
                    setStatus('disconnected', 'Disconnected');
                    cleanup();
                };
                
                document.getElementById('startBtn').disabled = true;
                document.getElementById('stopBtn').disabled = false;
                
            } catch (error) {
                log(`Error: ${error.message}`, 'error');
                setStatus('disconnected', 'Error');
            }
        }
        
        async function startAudioCapture() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000,
                        echoCancellation: true,
                        noiseSuppression: true,
                    } 
                });
                
                audioContext = new AudioContext({ sampleRate: 16000 });
                source = audioContext.createMediaStreamSource(stream);
                processor = audioContext.createScriptProcessor(4096, 1, 1);
                
                processor.onaudioprocess = (e) => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmData = convertFloat32ToInt16(inputData);
                        const base64 = arrayBufferToBase64(pcmData.buffer);
                        ws.send(JSON.stringify({ type: 'audio', data: base64 }));
                    }
                };
                
                source.connect(processor);
                processor.connect(audioContext.destination);
                
                log('Audio capture started', 'success');
                
            } catch (error) {
                log(`Microphone error: ${error.message}`, 'error');
            }
        }
        
        function convertFloat32ToInt16(float32Array) {
            const int16Array = new Int16Array(float32Array.length);
            for (let i = 0; i < float32Array.length; i++) {
                const s = Math.max(-1, Math.min(1, float32Array[i]));
                int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            return int16Array;
        }
        
        function arrayBufferToBase64(buffer) {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }
        
        function stopRecording() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const title = document.getElementById('lectureTitle').value.trim() || 'Untitled Lecture';
                log(`Stopping recording: ${title}`);
                ws.send(JSON.stringify({ type: 'stop', title: title }));
                setStatus('connecting', 'Processing...');
            }
            
            // Stop audio capture
            if (processor) processor.disconnect();
            if (source) source.disconnect();
            if (stream) stream.getTracks().forEach(t => t.stop());
        }
        
        function cleanup() {
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
            
            if (processor) { processor.disconnect(); processor = null; }
            if (source) { source.disconnect(); source = null; }
            if (audioContext) { audioContext.close(); audioContext = null; }
            if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
        }
    </script>
</body>
</html>
    """
    return HTMLResponse(content=html_content)
