import { Upload, FileText, Mic, Sparkles, BookOpen, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../../lib/api"
import type { RecentContentItem } from "../../types"

const FADE_UP = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const STAGGER = { visible: { transition: { staggerChildren: 0.08 } } }

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
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#2D1B69]">My Lecture Notes</h1>
                    <p className="text-[#9B8BB8] mt-1">Access and review your generated notes.</p>
                </motion.div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-[#7C5CFC]" />
                    </div>
                ) : recentNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-14 h-14 rounded-xl bg-[#F0ECFA] flex items-center justify-center mb-3">
                            <FileText className="h-6 w-6 text-[#B8A9D4]" />
                        </div>
                        <p className="text-sm text-[#B8A9D4] font-medium">No notes generated yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {recentNotes.map((item) => (
                            <motion.div key={item.id} variants={FADE_UP} whileHover={{ y: -4 }}>
                                <div
                                    onClick={() => navigate(`/dashboard/lectures/${item.lecture_id}`)}
                                    className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm hover:shadow-md hover:border-[#E0D8F0] transition-all duration-300 overflow-hidden cursor-pointer group"
                                >
                                    <div className="h-1.5 bg-[#7C5CFC]" />
                                    <div className="p-5">
                                        <h3 className="text-lg font-bold text-[#2D1B69] group-hover:text-[#2D1B69] transition-colors truncate">{item.title || item.lecture_title}</h3>
                                        <p className="text-xs text-[#9B8BB8] mt-0.5 truncate">{item.course_name}</p>
                                        <p className="text-xs text-[#B8A9D4] mt-1.5">Generated on {formatDate(item.created_at)}</p>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-[#5B4A82] mt-4 group-hover:gap-3 transition-all">
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
            {/* Hero */}
            <motion.div variants={FADE_UP} className="relative rounded-2xl bg-[#2D1B69] p-7 shadow-lg shadow-[#7C5CFC]/15 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
                <div className="relative z-10 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10 flex-shrink-0">
                        <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Generate Lecture Notes</h1>
                        <p className="text-[#B8A9D4] text-sm mt-1">Upload your lecture recording or paste text to generate structured notes.</p>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                        <div className="h-1.5 bg-[#7C5CFC]" />
                        <div className="p-6 space-y-6">
                            <h2 className="text-lg font-bold text-[#2D1B69]">Input Source</h2>

                            <div className="border-2 border-dashed border-[#E0D8F0] rounded-xl p-10 text-center hover:border-[#D8CEF0] hover:bg-[#F0ECFA]/30 transition-all cursor-pointer group">
                                <div className="w-14 h-14 rounded-xl bg-[#F0ECFA] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                    <Upload className="h-6 w-6 text-[#9B8BB8]" />
                                </div>
                                <p className="font-semibold text-[#5B4A82]">Upload Audio or Video</p>
                                <p className="text-xs text-[#B8A9D4] mt-1">MP3, WAV, MP4 (Max 500MB)</p>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-[#E0D8F0]" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-3 text-[#B8A9D4] font-semibold">Or</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-[#5B4A82] mb-1.5 block">Paste Transcript</label>
                                <textarea
                                    className="w-full h-40 rounded-xl border border-[#E0D8F0] bg-[#F0ECFA]/40 p-3.5 text-sm text-[#3D2B7A] placeholder:text-[#B8A9D4] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC] resize-none transition-all"
                                    placeholder="Paste your lecture text here..."
                                />
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full bg-[#7C5CFC] text-white py-3 rounded-xl font-semibold text-sm shadow-md shadow-[#7C5CFC]/15 hover:bg-[#6B4FDB] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden h-full opacity-60">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-[#2D1B69] mb-1">Preview</h2>
                        </div>
                        <div className="flex flex-col items-center justify-center h-[400px]">
                            <div className="w-14 h-14 rounded-xl bg-[#F0ECFA] flex items-center justify-center mb-3">
                                <BookOpen className="h-6 w-6 text-[#B8A9D4]" />
                            </div>
                            <p className="text-sm text-[#B8A9D4] font-medium">Generated notes will appear here</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
