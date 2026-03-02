import { Layers, Sparkles, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../../lib/api"
import type { RecentContentItem } from "../../types"

const FADE_UP = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const STAGGER = { visible: { transition: { staggerChildren: 0.08 } } }

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
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#2D1B69]">My Flashcards</h1>
                    <p className="text-[#9B8BB8] mt-1">Review your study decks.</p>
                </motion.div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-[#7C5CFC]" />
                    </div>
                ) : recentFlashcards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-14 h-14 rounded-xl bg-[#F0ECFA] flex items-center justify-center mb-3">
                            <Layers className="h-6 w-6 text-[#B8A9D4]" />
                        </div>
                        <p className="text-sm text-[#B8A9D4] font-medium">No flashcards generated yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {recentFlashcards.map((item) => {
                            const cardCount = item.content?.cards?.length ?? 0
                            return (
                                <motion.div key={item.id} variants={FADE_UP} whileHover={{ y: -4 }}>
                                    <div
                                        onClick={() => navigate(`/dashboard/lectures/${item.lecture_id}`)}
                                        className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm hover:shadow-md hover:border-[#E0D8F0] transition-all duration-300 overflow-hidden cursor-pointer group"
                                    >
                                        <div className="h-1.5 bg-[#7C5CFC]" />
                                        <div className="p-5">
                                            <h3 className="text-lg font-bold text-[#2D1B69] group-hover:text-[#2D1B69] transition-colors truncate">{item.title || item.lecture_title}</h3>
                                            <p className="text-xs text-[#9B8BB8] mt-0.5 truncate">{item.course_name}</p>
                                            <p className="text-xs text-[#B8A9D4] mt-1.5">{cardCount} Cards &middot; {formatDate(item.created_at)}</p>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-[#5B4A82] mt-4 group-hover:gap-3 transition-all">
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
            {/* Hero */}
            <motion.div variants={FADE_UP} className="relative rounded-2xl bg-[#2D1B69] p-7 shadow-lg shadow-[#7C5CFC]/15 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-white/5 rounded-full translate-y-1/2" />
                <div className="relative z-10 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10 flex-shrink-0">
                        <Layers className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Generate Flashcards</h1>
                        <p className="text-[#B8A9D4] text-sm mt-1">Create study decks from your notes for better retention.</p>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                        <div className="h-1.5 bg-[#7C5CFC]" />
                        <div className="p-6 space-y-6">
                            <h2 className="text-lg font-bold text-[#2D1B69]">Deck Settings</h2>

                            <div>
                                <label className="text-sm font-semibold text-[#5B4A82] mb-1.5 block">Source Material</label>
                                <select className="w-full rounded-xl border border-[#E0D8F0] bg-[#F0ECFA]/40 p-3 text-sm text-[#3D2B7A] focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC] transition-all">
                                    <option>Select a lecture note...</option>
                                    <option>Introduction to React</option>
                                    <option>Advanced TypeScript Patterns</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-[#5B4A82] mb-1.5 block">Number of Cards</label>
                                <input type="range" min="5" max="50" className="w-full accent-[#7C5CFC]" />
                                <div className="flex justify-between text-[10px] text-[#B8A9D4] mt-1 font-medium">
                                    <span>5</span>
                                    <span>50</span>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full bg-[#7C5CFC] text-white py-3 rounded-xl font-semibold text-sm shadow-md shadow-[#7C5CFC]/15 hover:bg-[#6B4FDB] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {isGenerating ? "Generating..." : <><Sparkles className="h-4 w-4" /> Create Deck</>}
                            </button>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden h-full opacity-60">
                        <div className="p-6">
                            <h2 className="text-lg font-bold text-[#2D1B69]">Preview</h2>
                        </div>
                        <div className="flex flex-col items-center justify-center h-[400px]">
                            <div className="w-14 h-14 rounded-xl bg-[#F0ECFA] flex items-center justify-center mb-3">
                                <Layers className="h-6 w-6 text-[#B8A9D4]" />
                            </div>
                            <p className="text-sm text-[#B8A9D4] font-medium">Generated flashcards will appear here</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
