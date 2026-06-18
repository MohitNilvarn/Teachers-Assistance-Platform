import { Layers, Sparkles, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../../lib/api"
import type { RecentContentItem } from "../../types"

const FADE_UP = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const STAGGER = { visible: { transition: { staggerChildren: 0.06 } } }

export default function GenerateFlashcards() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [recentFlashcards, setRecentFlashcards] = useState<RecentContentItem[]>([])
    const [loading, setLoading] = useState(true)
    const role = sessionStorage.getItem("role")
    const isStudent = role === "student"
    const navigate = useNavigate()

    useEffect(() => {
        api.getRecentFlashcards()
            .then((data) => setRecentFlashcards(data.items))
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
                    <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">My Flashcards</h1>
                    <p className="text-[#999] mt-1 text-[14px]">Review your study decks.</p>
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
                ) : recentFlashcards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                             style={{ background: "#f0f0f5" }}>
                            <Layers className="h-6 w-6 text-[#999]" />
                        </div>
                        <p className="text-sm text-[#999] font-medium">No flashcards generated yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentFlashcards.map((item) => {
                            const cardCount = item.content?.cards?.length ?? 0
                            return (
                                <motion.div key={item.id} variants={FADE_UP} whileHover={{ y: -3 }}>
                                    <div
                                        onClick={() => navigate(`/dashboard/lectures/${item.lecture_id}`)}
                                        className="bg-white rounded-2xl border border-[#eaeaec] hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer group"
                                    >
                                        <div className="h-1" style={{ background: "#1a1a2e" }} />
                                        <div className="p-5">
                                            <h3 className="text-[15px] font-bold text-[#1a1a1a] truncate">{item.title || item.lecture_title}</h3>
                                            <p className="text-[12px] text-[#999] mt-0.5 truncate">{item.course_name}</p>
                                            <p className="text-[11px] text-[#ccc] mt-1.5 font-mono">{cardCount} Cards · {formatDate(item.created_at)}</p>
                                            <div className="flex items-center gap-2 text-[13px] font-semibold text-[#6b6b6b] mt-4 group-hover:text-[#c2185b] group-hover:gap-3 transition-all">
                                                <Layers className="h-4 w-4" />
                                                Study Now
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
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
                            <Layers className="h-5 w-5 text-white/80" />
                        </div>
                        <div>
                            <span className="text-[11px] font-mono text-white/40 tracking-widest uppercase">Content Generation</span>
                            <h1 className="text-2xl font-bold tracking-tight mt-0.5">Generate Flashcards</h1>
                            <p className="text-white/40 text-[14px] mt-1">Create study decks from your notes for better retention.</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                        <div className="h-1" style={{ background: "#1a1a2e" }} />
                        <div className="p-6 space-y-6">
                            <h2 className="text-[14px] font-bold text-[#1a1a1a]">Deck Settings</h2>

                            <div>
                                <label className="text-[13px] font-semibold text-[#1a1a1a] mb-1.5 block">Source Material</label>
                                <select className="w-full rounded-xl border border-[#eaeae8] bg-[#faf9f7] p-3 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c2185b]/20 focus:border-[#c2185b] transition-all">
                                    <option>Select a lecture note...</option>
                                    <option>Introduction to React</option>
                                    <option>Advanced TypeScript Patterns</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[13px] font-semibold text-[#1a1a1a] mb-1.5 block">Number of Cards</label>
                                <input type="range" min="5" max="50"
                                       className="w-full accent-[#c2185b]"
                                       style={{ accentColor: "#c2185b" }} />
                                <div className="flex justify-between text-[10px] text-[#999] mt-1 font-mono">
                                    <span>5</span>
                                    <span>50</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full text-white py-3.5 rounded-xl font-semibold text-[14px] shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
                                style={{ background: "#1a1a2e" }}
                            >
                                {isGenerating ? "Generating..." : <><Sparkles className="h-4 w-4" /> Create Deck</>}
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
                                <Layers className="h-6 w-6 text-[#999]" />
                            </div>
                            <p className="text-sm text-[#999] font-medium">Generated flashcards will appear here</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
