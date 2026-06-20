import { Upload, FileText, Mic, Sparkles, BookOpen, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../../lib/api"
import type { RecentContentItem } from "../../types"

const FADE_UP = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const STAGGER = { visible: { transition: { staggerChildren: 0.06 } } }

export default function GenerateNotes() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [recentNotes, setRecentNotes] = useState<RecentContentItem[]>([])
    const [loading, setLoading] = useState(true)
    const role = sessionStorage.getItem("role")
    const isStudent = role === "student"
    const navigate = useNavigate()

    useEffect(() => {
        api.getRecentNotes()
            .then((data) => setRecentNotes(data.items))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const handleGenerate = () => {
        setIsGenerating(true)
        setTimeout(() => setIsGenerating(false), 2000)
    }

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }

    if (isStudent) {
        return (
            <motion.div initial="hidden" animate="visible" variants={STAGGER} className="space-y-8">
                <motion.div variants={FADE_UP}>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">My Lecture Notes</h1>
                    <p className="text-[#999] mt-1 text-[14px]">Access and review your generated notes.</p>
                </motion.div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-xl blur-xl opacity-20"
                                 style={{ background: "#1a1a2e" }} />
                            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                                 style={{ background: "#1a1a2e" }}>
                                <Loader2 className="h-5 w-5 animate-spin text-white" />
                            </div>
                        </div>
                    </div>
                ) : recentNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                             style={{ background: "#f0f0f5" }}>
                            <FileText className="h-6 w-6 text-[#999]" />
                        </div>
                        <p className="text-sm text-[#999] font-medium">No notes generated yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentNotes.map((item) => (
                            <motion.div key={item.id} variants={FADE_UP} whileHover={{ y: -3 }}>
                                <div
                                    onClick={() => navigate(`/dashboard/course/${item.course_id}/unit/${item.unit_number}/lecture/${item.lecture_id}`)}
                                    className="bg-white rounded-2xl border border-[#eaeaec] hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer group"
                                >
                                    <div className="h-1" style={{ background: "#1a1a2e" }} />
                                    <div className="p-5">
                                        <h3 className="text-[15px] font-bold text-[#1a1a1a] truncate">{item.title || item.lecture_title}</h3>
                                        <p className="text-[12px] text-[#999] mt-0.5 truncate">{item.course_name}</p>
                                        <p className="text-[11px] text-[#ccc] mt-1.5 font-mono">{formatDate(item.created_at)}</p>
                                        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#6b6b6b] mt-4 group-hover:text-[#c2185b] group-hover:gap-3 transition-all">
                                            <FileText className="h-4 w-4" />
                                            View Notes
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>
        )
    }

    return (
        <motion.div initial="hidden" animate="visible" variants={STAGGER} className="space-y-8">
            {/* Hero Banner */}
            <motion.div variants={FADE_UP}>
                <div className="relative overflow-hidden rounded-2xl text-white"
                     style={{ background: "#0f0c1e" }}>
                    <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                         style={{
                             backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.1) 39px, rgba(255,255,255,0.1) 40px),
                                               repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.1) 39px, rgba(255,255,255,0.1) 40px)`,
                         }} />
                    <div className="relative z-10 px-7 py-7 flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center border border-white/10 flex-shrink-0">
                            <FileText className="h-5 w-5 text-white/80" />
                        </div>
                        <div>
                            <span className="text-[11px] font-mono text-white/40 tracking-widest uppercase">Content Generation</span>
                            <h1 className="text-2xl font-bold tracking-tight mt-0.5">Generate Lecture Notes</h1>
                            <p className="text-white/40 text-[14px] mt-1">Upload your lecture recording or paste text to generate structured notes.</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                        <div className="h-1" style={{ background: "#1a1a2e" }} />
                        <div className="p-6 space-y-6">
                            <h2 className="text-[14px] font-bold text-[#1a1a1a]">Input Source</h2>

                            <div className="border-2 border-dashed border-[#eaeae8] rounded-xl p-10 text-center hover:border-[#c2185b]/30 hover:bg-[#faf9f7] transition-all cursor-pointer group">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform"
                                     style={{ background: "#f0f0f5" }}>
                                    <Upload className="h-5 w-5 text-[#6b6b6b]" />
                                </div>
                                <p className="font-semibold text-[#1a1a1a] text-[14px]">Upload Audio or Video</p>
                                <p className="text-[11px] text-[#999] mt-1 font-mono">MP3, WAV, MP4 (Max 500MB)</p>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-[#eaeae8]" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-3 text-[#999] font-mono text-[10px]">Or</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[13px] font-semibold text-[#1a1a1a] mb-1.5 block">Paste Transcript</label>
                                <textarea
                                    className="w-full h-40 rounded-xl border border-[#eaeae8] bg-[#faf9f7] p-3.5 text-sm text-[#1a1a1a] placeholder:text-[#ccc] focus:outline-none focus:ring-2 focus:ring-[#c2185b]/20 focus:border-[#c2185b] resize-none transition-all"
                                    placeholder="Paste your lecture text here..."
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full text-white py-3.5 rounded-xl font-semibold text-[14px] shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
                                style={{ background: "#1a1a2e" }}
                            >
                                {isGenerating ? (
                                    <><Mic className="h-4 w-4 animate-pulse" /> Processing...</>
                                ) : (
                                    <><Sparkles className="h-4 w-4" /> Generate Notes</>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden h-full opacity-50">
                        <div className="p-6">
                            <h2 className="text-[14px] font-bold text-[#1a1a1a]">Preview</h2>
                        </div>
                        <div className="flex flex-col items-center justify-center h-[400px]">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                                 style={{ background: "#f0f0f5" }}>
                                <BookOpen className="h-6 w-6 text-[#999]" />
                            </div>
                            <p className="text-sm text-[#999] font-medium">Generated notes will appear here</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
