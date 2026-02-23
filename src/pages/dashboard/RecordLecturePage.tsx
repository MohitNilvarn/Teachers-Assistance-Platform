import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mic, MicOff, Square, ArrowLeft, Loader2, AlertCircle,
  CheckCircle2, Radio, Clock
} from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { createRealtimeConnection } from "../../lib/api"

type SessionState = "idle" | "connecting" | "recording" | "stopping" | "processing" | "complete" | "error"

interface TranscriptChunk {
  text: string
  is_final: boolean
  timestamp: number
}

export default function RecordLecturePage() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()

  const [state, setState] = useState<SessionState>("idle")
  const [title, setTitle] = useState("")
  const [error, setError] = useState("")
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([])
  const [interimText, setInterimText] = useState("")
  const [lectureId, setLectureId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [generationResult, setGenerationResult] = useState<Record<string, boolean> | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  // Use a ref to track current state inside closures (WebSocket handlers)
  const stateRef = useRef<SessionState>("idle")

  // Helper that sets both the React state AND the ref (so closures see latest)
  const setSessionState = useCallback((next: SessionState) => {
    stateRef.current = next
    setState(next)
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcriptChunks, interimText])

  // Elapsed timer
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0")
    const s = (seconds % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const getFinalTranscript = () =>
    transcriptChunks.filter(c => c.is_final).map(c => c.text).join(" ")

  const startRecording = useCallback(async () => {
    if (!courseId) return
    if (!title.trim()) {
      setError("Please enter a lecture title before recording")
      return
    }

    setError("")
    setSessionState("connecting")

    try {
      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // Connect WebSocket
      const ws = createRealtimeConnection(courseId)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[WS] Connection opened")
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log("[WS] Received:", msg.type, msg)

          switch (msg.type) {
            case "connected":
              break

            case "ready":
              startAudioCapture(stream)
              setSessionState("recording")
              break

            case "transcript":
              if (msg.is_final && msg.text) {
                setTranscriptChunks(prev => [
                  ...prev,
                  { text: msg.text, is_final: true, timestamp: Date.now() },
                ])
                setInterimText("")
              } else if (msg.text) {
                setInterimText(msg.text)
              }
              break

            case "processing":
              setSessionState("processing")
              if (msg.lecture_id) setLectureId(msg.lecture_id)
              break

            case "complete":
              setSessionState("complete")
              if (msg.lecture_id) setLectureId(msg.lecture_id)
              if (msg.generated) setGenerationResult(msg.generated)
              break

            case "error":
              setError(msg.message || "An error occurred")
              // Transition to error from ANY non-terminal state
              if (!["complete", "error"].includes(stateRef.current)) {
                setSessionState("error")
              }
              break

            case "pong":
              break

            default:
              console.log("[WS] Unknown message type:", msg.type)
              break
          }
        } catch {
          // non-JSON message, ignore
        }
      }

      ws.onerror = (ev) => {
        console.error("[WS] Error:", ev)
        setError("WebSocket connection failed. Check that the backend is running.")
        setSessionState("error")
        cleanupMedia()
      }

      ws.onclose = (event) => {
        console.log("[WS] Closed:", event.code, event.reason, "state:", stateRef.current)
        const cur = stateRef.current
        // If we're in a waiting state and the WS closes unexpectedly → error
        if (["connecting", "recording", "stopping"].includes(cur)) {
          if (event.code !== 1000) {
            setError(`Connection closed: ${event.reason || "Server disconnected"}`)
          }
          setSessionState("error")
        }
        cleanupMedia()
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access in your browser settings.")
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.")
      } else {
        setError(err.message || "Failed to start recording")
      }
      setSessionState("error")
      cleanupMedia()
    }
  }, [courseId, title, setSessionState])

  const startAudioCapture = (stream: MediaStream) => {
    try {
      // Use Web Audio API to capture raw PCM (linear16) audio
      // This matches the Deepgram config: encoding=linear16, sample_rate=16000
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const inputSampleRate = audioContext.sampleRate
      const outputSampleRate = 16000

      // Buffer size 4096 gives ~85ms at 48kHz, good balance of latency vs efficiency
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (event) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return

        const inputData = event.inputBuffer.getChannelData(0)

        // Downsample from browser sample rate to 16kHz if needed
        let pcmFloat: Float32Array
        if (inputSampleRate !== outputSampleRate) {
          const ratio = inputSampleRate / outputSampleRate
          const newLength = Math.round(inputData.length / ratio)
          pcmFloat = new Float32Array(newLength)
          for (let i = 0; i < newLength; i++) {
            pcmFloat[i] = inputData[Math.round(i * ratio)]
          }
        } else {
          pcmFloat = inputData
        }

        // Convert float32 [-1,1] → int16 (linear16)
        const int16 = new Int16Array(pcmFloat.length)
        for (let i = 0; i < pcmFloat.length; i++) {
          const s = Math.max(-1, Math.min(1, pcmFloat[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        // Encode to base64 (chunk-safe, no spread operator)
        const bytes = new Uint8Array(int16.buffer)
        let binary = ""
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)

        wsRef.current.send(JSON.stringify({ type: "audio", data: base64 }))
      }

      source.connect(processor)
      processor.connect(audioContext.destination) // required for ScriptProcessorNode to fire
      console.log("[Audio] Capturing PCM16 @", outputSampleRate, "Hz (input", inputSampleRate, "Hz)")
    } catch (err) {
      console.error("Audio capture error:", err)
      setError("Failed to start audio capture")
      setSessionState("error")
    }
  }

  const cleanupMedia = () => {
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch { /* ignore */ }
      audioContextRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const cleanupAll = () => {
    cleanupMedia()
    if (wsRef.current) {
      try { wsRef.current.close() } catch { /* ignore */ }
      wsRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopRecording = useCallback((force = false) => {
    if (!force && stateRef.current !== "recording") return

    setSessionState("stopping")
    cleanupMedia()

    // Send stop message with title
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "stop",
        title: title.trim() || "Untitled Lecture",
      }))
    } else {
      // WebSocket already closed — cannot send stop, go to error
      setError("Connection lost before stopping. Please try again.")
      setSessionState("error")
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [title, setSessionState])

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-black/5 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Record Live Lecture</h1>
          <p className="text-sm text-muted-foreground">
            Stream audio to Deepgram for real-time transcription and AI content generation
          </p>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Controls Card */}
      <Card className="border-black/5 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-red-500" />
            Recording Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title input */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Lecture Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={state !== "idle" && state !== "error"}
              placeholder="e.g. Introduction to Machine Learning"
              className="w-full rounded-md border border-input bg-transparent p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50"
            />
          </div>

          {/* Status + Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIndicator state={state} />
              <span className="text-sm font-medium text-foreground capitalize">
                {state === "idle" ? "Ready to record" :
                 state === "connecting" ? "Connecting..." :
                 state === "recording" ? "Recording" :
                 state === "stopping" ? "Stopping..." :
                 state === "processing" ? "Generating content..." :
                 state === "complete" ? "Complete!" :
                 "Error"}
              </span>
            </div>
            {(state === "recording" || state === "stopping") && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatTime(elapsed)}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            {(state === "idle" || state === "error") && (
              <Button
                className="bg-black text-white hover:bg-black/90 flex-1"
                onClick={startRecording}
              >
                <Mic className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            )}
            {state === "connecting" && (
              <Button disabled className="flex-1">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Connecting...
              </Button>
            )}
            {state === "recording" && (
              <Button
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => stopRecording()}
              >
                <Square className="h-4 w-4 mr-2" />
                Stop & Generate
              </Button>
            )}
            {(state === "stopping" || state === "processing") && (
              <Button disabled className="flex-1">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {state === "stopping" ? "Stopping..." : "Generating content..."}
              </Button>
            )}
            {state === "complete" && (
              <div className="flex gap-3 flex-1">
                <Button
                  className="bg-black text-white hover:bg-black/90 flex-1"
                  onClick={() => navigate(`/dashboard/lectures/${lectureId}`)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  View Lecture
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setState("idle")
                    setTranscriptChunks([])
                    setInterimText("")
                    setElapsed(0)
                    setTitle("")
                    setLectureId(null)
                    setGenerationResult(null)
                    setError("")
                  }}
                >
                  Record Another
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generation Result */}
      <AnimatePresence>
        {state === "complete" && generationResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Content Generated Successfully</span>
                </div>
                <div className="flex gap-4">
                  {Object.entries(generationResult).map(([key, generated]) => (
                    <div key={key} className="flex items-center gap-1.5 text-sm">
                      {generated ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className={generated ? "text-green-700" : "text-yellow-700"}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Transcript */}
      <Card className="border-black/5 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Live Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 bg-black/2 rounded-lg font-mono text-sm leading-relaxed">
            {transcriptChunks.length === 0 && !interimText ? (
              <p className="text-muted-foreground italic">
                {state === "recording"
                  ? "Listening... Start speaking to see the transcript."
                  : "Transcript will appear here once recording starts."}
              </p>
            ) : (
              <>
                {transcriptChunks.filter(c => c.is_final).map((chunk, i) => (
                  <span key={i} className="text-foreground">{chunk.text} </span>
                ))}
                {interimText && (
                  <span className="text-muted-foreground italic">{interimText}</span>
                )}
              </>
            )}
            <div ref={transcriptEndRef} />
          </div>
          {transcriptChunks.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {getFinalTranscript().split(/\s+/).filter(Boolean).length} words transcribed
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatusIndicator({ state }: { state: SessionState }) {
  if (state === "recording") {
    return (
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
      </span>
    )
  }
  if (state === "connecting" || state === "stopping" || state === "processing") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }
  if (state === "complete") {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />
  }
  if (state === "error") {
    return <AlertCircle className="h-4 w-4 text-destructive" />
  }
  return <MicOff className="h-4 w-4 text-muted-foreground" />
}
