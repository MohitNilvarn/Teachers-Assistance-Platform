import { useEffect, useState, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    ArrowLeft, Plus, Upload, Mic, FileText, BookOpen, Layers,
    Loader2, AlertCircle, CheckCircle2, Clock, Play, RefreshCw,
    Radio, Square, MicOff, Hash, Trash2, File as FileIcon,
} from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { api } from "../../lib/api"
import type { UnitDetail, UnitLectureDetail } from "../../types"

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
    pending:       { className: "bg-[#f5f5f7] text-[#000000]", label: "Pending" },
    transcribing:  { className: "bg-[#f5f5f7]/50 text-[#000000] border border-[#d2d2d7]",    label: "Transcribing\u2026" },
    completed:     { className: "bg-emerald-50 text-emerald-700 border border-emerald-200",  label: "Done" },
    failed:        { className: "bg-red-50 text-red-600 border border-red-200",      label: "Failed" },
    not_started:   { className: "bg-[#fafafa] text-[#86868b]",    label: "Not Started" },
    generating:    { className: "bg-[#f5f5f7]/50 text-[#000000] border border-[#d2d2d7]",    label: "Generating\u2026" },
}

export default function UnitDetailPage() {
    const { courseId, unitNumber } = useParams<{ courseId: string; unitNumber: string }>()
    const [unit, setUnit] = useState<UnitDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    // New lecture form
    const [showForm, setShowForm] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [newDesc, setNewDesc] = useState("")
    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [creating, setCreating] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Action loading per lecture
    const [actionLoading, setActionLoading] = useState<Record<string, string>>({})

    // Real-time transcription state
    const [isRecording, setIsRecording] = useState(false)
    const [liveTranscript, setLiveTranscript] = useState("")
    const [liveTitle, setLiveTitle] = useState("")
    const [showLiveForm, setShowLiveForm] = useState(false)
    const [liveStatus, setLiveStatus] = useState<"idle" | "connecting" | "recording" | "processing">("idle")
    const wsRef = useRef<WebSocket | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const processorRef = useRef<ScriptProcessorNode | null>(null)

    // Knowledge Base state
    const [materials, setMaterials] = useState<Array<{id:string;filename:string;file_type:string;processing_status:string;processing_error?:string;created_at:string}>>([])
    const [materialsLoading, setMaterialsLoading] = useState(false)
    const [showUploadMaterial, setShowUploadMaterial] = useState(false)
    const [uploadingMaterial, setUploadingMaterial] = useState(false)
    const [selectedMaterialFile, setSelectedMaterialFile] = useState<File | null>(null)
    const materialFileInputRef = useRef<HTMLInputElement>(null)

    const role = sessionStorage.getItem("role")

    const fetchUnit = async () => {
        if (!courseId || !unitNumber) return
        try {
            setLoading(true)
            const result = await api.getUnitDetail(courseId, Number(unitNumber))
            setUnit(result)
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Failed to load unit"
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const fetchMaterials = async (isPolling = false) => {
        if (!courseId || !unitNumber) return
        try {
            if (!isPolling) setMaterialsLoading(true)
            const result = await api.getUnitMaterials(courseId, Number(unitNumber))
            setMaterials(result.materials || [])
        } catch (err: Error | unknown) {
            // Silently fail for materials - they're optional
            if (!isPolling) setMaterials([])
        } finally {
            if (!isPolling) setMaterialsLoading(false)
        }
    }

    useEffect(() => {
        fetchUnit()
        fetchMaterials()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, unitNumber])

    // Poll for materials that are still processing
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>
        const hasProcessing = materials.some(m => m.processing_status === "processing")
        
        if (hasProcessing) {
            interval = setInterval(() => {
                fetchMaterials(true)
            }, 3000)
        }
        
        return () => {
            if (interval) clearInterval(interval)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [materials])

    const handleCreate = async () => {
        if (!courseId || !unitNumber || !audioFile) return
        // Auto-generate title if empty
        const resolvedTitle = newTitle.trim() || `Lecture ${(unit?.total_lectures ?? 0) + 1}`
        setCreating(true)
        setError("")
        try {
            await api.createLecture(
                courseId,
                { title: resolvedTitle, unit_number: Number(unitNumber), description: newDesc.trim() || undefined },
                audioFile,
            )
            setNewTitle("")
            setNewDesc("")
            setAudioFile(null)
            setShowForm(false)
            await fetchUnit()
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Failed to create lecture"
            setError(message)
        } finally {
            setCreating(false)
        }
    }

    const handleTranscribe = async (lectureId: string) => {
        setActionLoading(prev => ({ ...prev, [lectureId]: "transcribing" }))
        try {
            await api.transcribeLecture(lectureId)
            await fetchUnit()
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Transcription failed"
            setError(message)
        } finally {
            setActionLoading(prev => { const n = { ...prev }; delete n[lectureId]; return n })
        }
    }

    const handleGenerate = async (lectureId: string, alreadyGenerated = false) => {
        setActionLoading(prev => ({ ...prev, [lectureId]: "generating" }))
        try {
            await api.generateContent(lectureId, ["notes", "assignment", "flashcards"], alreadyGenerated)
            await fetchUnit()
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Content generation failed"
            setError(message)
        } finally {
            setActionLoading(prev => { const n = { ...prev }; delete n[lectureId]; return n })
        }
    }

    const handleUploadMaterial = async () => {
        if (!courseId || !unitNumber || !selectedMaterialFile) return
        
        setUploadingMaterial(true)
        setError("")
        try {
            await api.uploadUnitMaterial(courseId, Number(unitNumber), selectedMaterialFile)
            setShowUploadMaterial(false)
            setSelectedMaterialFile(null)
            if (materialFileInputRef.current) materialFileInputRef.current.value = ""
            await fetchMaterials()
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Failed to upload material"
            setError(message)
        } finally {
            setUploadingMaterial(false)
        }
    }

    const handleDeleteMaterial = async (materialId: string) => {
        if (!window.confirm("Delete this material?")) return
        setError("")
        try {
            await api.deleteMaterial(materialId)
            await fetchMaterials()
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete material"
            setError(message)
        }
    }

    // -- Real-time transcription --
    const startRecording = async () => {
        if (!courseId || !unitNumber) return

        // Auto-generate title if not provided
        const resolvedTitle = liveTitle.trim() || `Lecture ${(unit?.total_lectures ?? 0) + 1}`
        setLiveTitle(resolvedTitle)

        setLiveStatus("connecting")
        setLiveTranscript("")
        setError("")

        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaStreamRef.current = stream

            // Create WebSocket
            const ws = api.createRealtimeTranscriptionSocket(courseId, Number(unitNumber))
            wsRef.current = ws

            ws.onopen = () => {
                setLiveStatus("recording")
                setIsRecording(true)

                // Set up audio processing
                const audioContext = new AudioContext({ sampleRate: 16000 })
                audioContextRef.current = audioContext
                const source = audioContext.createMediaStreamSource(stream)
                const processor = audioContext.createScriptProcessor(4096, 1, 1)
                processorRef.current = processor

                processor.onaudioprocess = (e) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        const audioData = e.inputBuffer.getChannelData(0)
                        // Convert float32 to int16
                        const int16 = new Int16Array(audioData.length)
                        for (let i = 0; i < audioData.length; i++) {
                            int16[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768))
                        }
                        // Convert to base64
                        const bytes = new Uint8Array(int16.buffer)
                        let binary = ""
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i])
                        }
                        const base64 = btoa(binary)
                        ws.send(JSON.stringify({ type: "audio", data: base64 }))
                    }
                }

                source.connect(processor)
                processor.connect(audioContext.destination)
            }

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data)
                if (msg.type === "transcript" && msg.is_final) {
                    setLiveTranscript(prev => prev + " " + msg.text)
                } else if (msg.type === "complete") {
                    setLiveStatus("idle")
                    setIsRecording(false)
                    setShowLiveForm(false)
                    setLiveTitle("")
                    setLiveTranscript("")
                    fetchUnit()
                } else if (msg.type === "processing") {
                    setLiveStatus("processing")
                } else if (msg.type === "error") {
                    setError(msg.message || "Transcription error")
                    stopRecording()
                }
            }

            ws.onerror = () => {
                setError("WebSocket connection failed. Check your connection.")
                stopRecording()
            }

            ws.onclose = () => {
                setIsRecording(false)
                if (liveStatus === "recording") setLiveStatus("idle")
            }
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Failed to access microphone"
            setError(message)
            setLiveStatus("idle")
        }
    }

    const stopRecording = () => {
        // Stop WebSocket with title
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "stop", title: liveTitle.trim() || `Lecture ${(unit?.total_lectures ?? 0) + 1}` }))
            setLiveStatus("processing")
        }

        // Stop audio processing
        if (processorRef.current) {
            processorRef.current.disconnect()
            processorRef.current = null
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop())
            mediaStreamRef.current = null
        }
    }

    const cancelRecording = () => {
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        if (processorRef.current) {
            processorRef.current.disconnect()
            processorRef.current = null
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop())
            mediaStreamRef.current = null
        }
        setIsRecording(false)
        setLiveStatus("idle")
        setLiveTranscript("")
    }

    // -- Loading --
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#000000] flex items-center justify-center shadow-sm shadow-[#000000]/20">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                    <p className="text-sm text-[#86868b] font-medium">Loading unit...</p>
                </div>
            </div>
        )
    }

    if (!unit) {
        return (
            <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 flex items-center justify-center mb-4 border border-red-100">
                    <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <p className="font-bold text-lg text-[#3f3f46]">{error || "Unit not found."}</p>
                <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#3f3f46] font-medium mt-3 hover:text-[#000000] transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Hero Banner */}
            <div className="relative rounded-2xl bg-[#18181b] p-7 overflow-hidden shadow-lg shadow-[#000000]/15">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.07] rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/[0.07] rounded-full translate-y-1/2" />
                <div className="absolute top-4 right-4 w-16 h-16 border border-white/15 rounded-xl rotate-12" />

                <div className="relative z-10">
                    <Link
                        to={courseId ? `/dashboard/subject/${courseId}` : "/dashboard"}
                        className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Subject
                    </Link>

                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/15 flex-shrink-0 text-white font-extrabold text-xl">
                            {unit.unit_number}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                                {unit.unit_title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                <span className="text-xs font-bold bg-white/15 text-white/90 px-2.5 py-1 rounded-lg backdrop-blur-sm border border-white/10">
                                    {unit.subject_code}
                                </span>
                                <span className="text-xs font-medium text-white/70">
                                    {unit.course_name}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 mt-6 pt-5 border-t border-white/15">
                        <div>
                            <p className="text-2xl font-extrabold text-white">{unit.total_lectures}</p>
                            <p className="text-[11px] text-white/70 font-medium">Lectures</p>
                        </div>
                        <div>
                            <p className="text-2xl font-extrabold text-emerald-300">
                                {unit.lectures.filter(l => l.generation_status === "completed").length}
                            </p>
                            <p className="text-[11px] text-white/70 font-medium">With Content</p>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError("")} className="ml-auto underline text-xs font-medium">Dismiss</button>
                </div>
            )}

            {/* Add Lecture � Teachers only */}
            {role === "teacher" && (
            <div>
                {!showForm ? (
                    <div className="flex gap-3">
                        <Button
                            onClick={() => setShowForm(true)}
                            className="bg-[#000000] text-white hover:bg-[#1d1d1f] rounded-xl font-semibold shadow-sm shadow-[#000000]/20 h-10"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Lecture
                        </Button>
                        {role === "teacher" && (
                            <Button
                                onClick={() => setShowLiveForm(true)}
                                variant="outline"
                                className="border-[#a1a1aa] text-[#3f3f46] hover:bg-[#f5f5f7] rounded-xl font-semibold h-10"
                                disabled={showLiveForm || isRecording}
                            >
                                <Radio className="h-4 w-4 mr-2" />
                                Begin Lecture
                            </Button>
                        )}
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-lg p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Plus className="h-5 w-5 text-[#000000]" />
                                <h3 className="text-lg font-bold text-[#18181b]">Create Lecture</h3>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-[#3f3f46] mb-1.5 block">Title <span className="text-[#86868b] font-normal">(auto-generated if empty)</span></label>
                                <Input
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder={`e.g. Lecture ${(unit?.total_lectures ?? 0) + 1}`}
                                    className="rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-[#3f3f46] mb-1.5 block">Description</label>
                                <Input
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    placeholder="Optional description"
                                    className="rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-[#3f3f46] mb-1.5 block">Audio File *</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={e => setAudioFile(e.target.files?.[0] || null)}
                                />
                                <Button
                                    variant="outline"
                                    className="border-dashed border-2 rounded-xl w-full justify-start text-[#71717a] hover:text-[#3f3f46] hover:border-[#000000] hover:bg-[#f5f5f7]"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {audioFile ? audioFile.name : "Choose audio file"}
                                </Button>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={handleCreate}
                                    disabled={!audioFile || creating}
                                    className="bg-[#000000] text-white hover:bg-[#1d1d1f] rounded-xl font-semibold shadow-sm shadow-[#000000]/20"
                                >
                                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    {creating ? "Creating�" : "Create Lecture"}
                                </Button>
                                <Button variant="ghost" className="rounded-xl" onClick={() => { setShowForm(false); setNewTitle(""); setNewDesc(""); setAudioFile(null) }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
            )}

            {/* Live Transcription Panel */}
            {showLiveForm && role === "teacher" && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="bg-white rounded-2xl border-2 border-[#d2d2d7] shadow-lg overflow-hidden">
                        <div className="h-1.5 bg-[#000000]" />
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Radio className="h-5 w-5 text-[#000000]" />
                                <h3 className="text-lg font-bold text-[#18181b]">Begin Lecture</h3>
                                {isRecording && (
                                    <span className="ml-2 flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-xs text-red-600 font-bold">LIVE</span>
                                    </span>
                                )}
                            </div>
                        <div>
                            <label className="text-sm font-semibold text-[#3f3f46] mb-1.5 block">Lecture Title <span className="text-[#86868b] font-normal">(auto-generated if empty)</span></label>
                            <Input
                                value={liveTitle}
                                onChange={e => setLiveTitle(e.target.value)}
                                placeholder={`e.g. Lecture ${(unit?.total_lectures ?? 0) + 1}`}
                                disabled={isRecording || liveStatus === "processing"}
                                className="rounded-xl"
                            />
                        </div>

                        {liveTranscript && (
                            <div className="bg-[#f5f5f7]/50 border border-[#d2d2d7] rounded-xl p-4 max-h-48 overflow-y-auto">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#000000] mb-2">Live Transcript</p>
                                <p className="text-sm text-[#3f3f46] whitespace-pre-wrap leading-relaxed">{liveTranscript.trim()}</p>
                            </div>
                        )}

                        <div className="flex gap-3 items-center">
                            {liveStatus === "idle" && (
                                <>
                                    <Button
                                        onClick={startRecording}
                                        className="bg-[#000000] text-white hover:bg-[#1d1d1f] rounded-xl font-semibold shadow-sm shadow-[#000000]/20"
                                    >
                                        <Mic className="h-4 w-4 mr-2" />
                                        Start Recording
                                    </Button>
                                    <Button variant="ghost" className="rounded-xl" onClick={() => { setShowLiveForm(false); setLiveTitle("") }}>
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {liveStatus === "connecting" && (
                                <Button disabled className="bg-[#000000] text-white rounded-xl">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Connecting...
                                </Button>
                            )}
                            {liveStatus === "recording" && (
                                <>
                                    <Button
                                        onClick={stopRecording}
                                        className="bg-red-600 text-white hover:bg-red-700 rounded-xl font-semibold"
                                    >
                                        <Square className="h-4 w-4 mr-2" />
                                        Stop & Generate Content
                                    </Button>
                                    <Button variant="ghost" className="rounded-xl" onClick={cancelRecording}>
                                        <MicOff className="h-4 w-4 mr-2" />
                                        Cancel
                                    </Button>
                                    <span className="text-xs text-[#86868b] italic">Speak clearly into your microphone...</span>
                                </>
                            )}
                            {liveStatus === "processing" && (
                                <Button disabled className="bg-[#000000] text-white rounded-xl">
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Generating content...
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                </motion.div>
            )}

            {/* Knowledge Base Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#000000]/10 flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-[#000000]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#18181b]">Knowledge Base</h2>
                            <p className="text-xs text-[#86868b]">Study materials for this unit</p>
                        </div>
                    </div>
                    {role === "teacher" && (
                        <Button
                            onClick={() => setShowUploadMaterial(!showUploadMaterial)}
                            className="bg-[#000000] text-white hover:bg-[#1d1d1f] rounded-xl font-semibold text-sm h-10"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Material
                        </Button>
                    )}
                </div>

                {showUploadMaterial && role === "teacher" && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Upload className="h-5 w-5 text-[#000000]" />
                                <h3 className="text-lg font-bold text-[#18181b]">Upload Material</h3>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-[#3f3f46] mb-2 block">File (PDF, DOCX, PPTX)</label>
                                <input
                                    ref={materialFileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.pptx,.doc"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        setSelectedMaterialFile(file || null)
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    className="border-dashed border-2 rounded-xl w-full justify-start text-[#71717a] hover:text-[#3f3f46] hover:border-[#000000] hover:bg-[#f5f5f7]"
                                    onClick={() => materialFileInputRef.current?.click()}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {selectedMaterialFile?.name || "Choose file"}
                                </Button>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button
                                    onClick={handleUploadMaterial}
                                    disabled={!selectedMaterialFile || uploadingMaterial}
                                    className="bg-[#000000] text-white hover:bg-[#1d1d1f] rounded-xl font-semibold shadow-sm shadow-[#000000]/20"
                                >
                                    {uploadingMaterial ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                    {uploadingMaterial ? "Uploading..." : "Upload"}
                                </Button>
                                <Button variant="ghost" className="rounded-xl" onClick={() => {
                                    setShowUploadMaterial(false)
                                    setSelectedMaterialFile(null)
                                    if (materialFileInputRef.current) materialFileInputRef.current.value = ""
                                }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {materialsLoading ? (
                    <div className="bg-white rounded-2xl border border-[#e5e5ea] p-8 flex items-center justify-center">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-[#000000]" />
                            <p className="text-sm text-[#86868b] font-medium">Loading materials...</p>
                        </div>
                    </div>
                ) : materials.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-[#d2d2d7] flex flex-col items-center justify-center py-12">
                        <div className="w-14 h-14 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mb-3">
                            <FileIcon className="h-6 w-6 text-[#71717a]" />
                        </div>
                        <p className="font-semibold text-[#3f3f46]">No materials yet</p>
                        <p className="text-sm text-[#71717a] mt-1">
                            {role === "teacher" ? "Upload study materials to build the knowledge base" : "No materials have been added to this unit"}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {materials.map((material) => (
                            <motion.div
                                key={material.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-4 flex items-center justify-between hover:border-[#d2d2d7] transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-[#f5f5f7] flex items-center justify-center flex-shrink-0">
                                            <FileIcon className="h-5 w-5 text-[#000000]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-semibold text-[#18181b] truncate">{material.filename}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-[#f5f5f7] text-[#000000]">
                                                    {material.file_type?.toUpperCase()}
                                                </span>
                                                {material.processing_status === "processing" ? (
                                                    <span className="text-[10px] text-[#86868b] flex items-center gap-1">
                                                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Processing...
                                                    </span>
                                                ) : material.processing_status === "completed" ? (
                                                    <span className="text-[10px] text-emerald-600 font-semibold">✓ Ready</span>
                                                ) : material.processing_error ? (
                                                    <span className="text-[10px] text-red-600">Error: {material.processing_error}</span>
                                                ) : null}
                                                <span className="text-[10px] text-[#86868b]">
                                                    {new Date(material.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {role === "teacher" && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg ml-2"
                                            onClick={() => handleDeleteMaterial(material.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Lectures List */}
            {unit.lectures.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-[#d2d2d7] flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mb-4">
                        <Mic className="h-8 w-8 text-[#71717a]" />
                    </div>
                    <p className="font-bold text-lg text-[#3f3f46]">No lectures yet</p>
                    <p className="text-sm text-[#71717a] mt-1">Create your first lecture to get started.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {unit.lectures.map((lec, idx) => (
                        <LectureCard
                            key={lec.id}
                            lecture={lec}
                            index={idx}
                            actionLoading={actionLoading[lec.id]}
                            onTranscribe={() => handleTranscribe(lec.id)}
                            onGenerate={() => handleGenerate(lec.id, lec.generation_status === "completed")}
                            isTeacher={role === "teacher"}
                            courseId={courseId}
                            unitNumber={unitNumber}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// -- Lecture Card Sub-component --

interface LectureCardProps {
    lecture: UnitLectureDetail
    index: number
    actionLoading?: string
    onTranscribe: () => void
    onGenerate: () => void
    isTeacher?: boolean
    courseId?: string
    unitNumber?: string
}

function LectureCard({ lecture, index, actionLoading, onTranscribe, onGenerate, isTeacher, courseId, unitNumber }: LectureCardProps) {
    const tBadge = STATUS_BADGE[lecture.transcription_status] || STATUS_BADGE.pending
    const gBadge = STATUS_BADGE[lecture.generation_status] || STATUS_BADGE.not_started

    const canTranscribe = lecture.audio_filename && lecture.transcription_status !== "transcribing"
    const canGenerate = lecture.transcription_status === "completed" && lecture.generation_status !== "generating"

    const canViewContent = lecture.generation_status === "completed"

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
        >
            <div className="bg-white rounded-2xl border border-[#e5e5ea] shadow-sm hover:shadow-md hover:border-[#d2d2d7] transition-all duration-300 overflow-hidden group/card">
                <div className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Info */}
                        <div className="flex-1 min-w-0 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] flex items-center justify-center text-sm font-bold text-[#000000] flex-shrink-0">
                                <Hash className="h-3 w-3 mr-0.5" />{index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-[#18181b] truncate">{lecture.title}</h3>
                                {lecture.description && (
                                    <p className="text-sm text-[#71717a] mt-0.5 truncate">{lecture.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${tBadge.className}`}>
                                        Transcription: {tBadge.label}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${gBadge.className}`}>
                                        Content: {gBadge.label}
                                    </span>
                                    <span className="text-[10px] text-[#86868b] flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5" />
                                        {new Date(lecture.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Content Badges � clickable links to view content */}
                        {canViewContent && courseId && unitNumber && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {lecture.has_notes && (
                                    <Link
                                        to={`/dashboard/course/${courseId}/unit/${unitNumber}/lecture/${lecture.id}`}
                                        className="flex items-center gap-1.5 text-xs bg-[#f5f5f7] text-[#3f3f46] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#e5e5ea] transition-colors border border-[#d2d2d7]"
                                    >
                                        <FileText className="h-3 w-3" /> Notes
                                    </Link>
                                )}
                                {lecture.has_assignment && (
                                    <Link
                                        to={`/dashboard/course/${courseId}/unit/${unitNumber}/lecture/${lecture.id}`}
                                        className="flex items-center gap-1.5 text-xs bg-[#f5f5f7] text-[#3f3f46] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#e5e5ea] transition-colors border border-[#d2d2d7]"
                                    >
                                        <BookOpen className="h-3 w-3" /> Assignment
                                    </Link>
                                )}
                                {lecture.has_flashcards && (
                                    <Link
                                        to={`/dashboard/course/${courseId}/unit/${unitNumber}/lecture/${lecture.id}`}
                                        className="flex items-center gap-1.5 text-xs bg-[#f5f5f7] text-[#3f3f46] px-3 py-1.5 rounded-lg font-semibold hover:bg-[#e5e5ea] transition-colors border border-[#d2d2d7]"
                                    >
                                        <Layers className="h-3 w-3" /> Flashcards
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* Non-clickable badges when not ready */}
                        {!canViewContent && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {lecture.has_notes && (
                                    <span className="flex items-center gap-1 text-xs bg-[#fafafa] text-[#86868b] px-2.5 py-1 rounded-lg font-medium border border-[#E8E0F5]">
                                        <FileText className="h-3 w-3" /> Notes
                                    </span>
                                )}
                                {lecture.has_assignment && (
                                    <span className="flex items-center gap-1 text-xs bg-[#fafafa] text-[#86868b] px-2.5 py-1 rounded-lg font-medium border border-[#E8E0F5]">
                                        <BookOpen className="h-3 w-3" /> Assignment
                                    </span>
                                )}
                                {lecture.has_flashcards && (
                                    <span className="flex items-center gap-1 text-xs bg-[#fafafa] text-[#86868b] px-2.5 py-1 rounded-lg font-medium border border-[#E8E0F5]">
                                        <Layers className="h-3 w-3" /> Flashcards
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Actions � Teachers only */}
                        {isTeacher && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {canTranscribe && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!!actionLoading}
                                    onClick={onTranscribe}
                                    className="text-xs rounded-lg font-semibold"
                                >
                                    {actionLoading === "transcribing"
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                        : lecture.transcription_status === "completed"
                                            ? <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                            : <Play className="h-3.5 w-3.5 mr-1" />
                                    }
                                    {lecture.transcription_status === "completed" ? "Re-transcribe" : "Transcribe"}
                                </Button>
                            )}
                            {canGenerate && (
                                <Button
                                    size="sm"
                                    className="bg-[#000000] text-white hover:bg-[#1d1d1f] text-xs rounded-lg font-semibold shadow-sm shadow-[#000000]/15"
                                    disabled={!!actionLoading}
                                    onClick={onGenerate}
                                >
                                    {actionLoading === "generating"
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                        : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                    }
                                    {lecture.generation_status === "completed" ? "Regenerate" : "Generate Content"}
                                </Button>
                            )}
                        </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
