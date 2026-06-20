import { BookOpen, CheckSquare, Sparkles, PenLine, Loader2, FileText, Mic, ArrowUpRight } from "lucide-react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { api } from "../../lib/api"
import type { RecentContentItem, RecentLectureItem } from "../../types"

const FADE_UP = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }
const STAGGER = { visible: { transition: { staggerChildren: 0.06 } } }

type SourceItem = {
    id: string
    kind: "note" | "assignment" | "lecture"
    title: string
    lecture_id: string
    course_id: string
    unit_number: number
    course_name: string
    created_at: string
}

export default function GenerateAssignments() {
    const [isGenerating, setIsGenerating] = useState(false)
    const [selectedType, setSelectedType] = useState<"mcq" | "essay">("mcq")
    const [recentAssignments, setRecentAssignments] = useState<RecentContentItem[]>([])
    const [sourceItems, setSourceItems] = useState<SourceItem[]>([])
    const [selectedSourceId, setSelectedSourceId] = useState("")
    const [loading, setLoading] = useState(true)
    const role = sessionStorage.getItem("role")
    const isStudent = role === "student"
    const navigate = useNavigate()

    useEffect(() => {
        if (isStudent) {
            api.getRecentAssignments()
                .then((data) => setRecentAssignments(data.items))
                .catch(() => {})
                .finally(() => setLoading(false))
            return
        }

        async function loadSources() {
            try {
                const [notes, assignments, lectures] = await Promise.all([
                    api.getRecentNotes().catch(() => ({ items: [] as RecentContentItem[] })),
                    api.getRecentAssignments().catch(() => ({ items: [] as RecentContentItem[] })),
                    api.getRecentLectures().catch(() => ({ items: [] as RecentLectureItem[] })),
                ])

                const merged: SourceItem[] = [
                    ...notes.items.map((item) => ({
                        id: `note-${item.id}`,
                        kind: "note" as const,
                        title: item.title || item.lecture_title || "Recent note",
                        lecture_id: item.lecture_id,
                        course_id: item.course_id,
                        unit_number: item.unit_number,
                        course_name: item.course_name,
                        created_at: item.created_at,
                    })),
                    ...assignments.items.map((item) => ({
                        id: `assignment-${item.id}`,
                        kind: "assignment" as const,
                        title: item.title || item.lecture_title || "Recent assignment",
                        lecture_id: item.lecture_id,
                        course_id: item.course_id,
                        unit_number: item.unit_number,
                        course_name: item.course_name,
                        created_at: item.created_at,
                    })),
                    ...lectures.items.map((item) => ({
                        id: `lecture-${item.id}`,
                        kind: "lecture" as const,
                        title: item.title || "Recent lecture",
                        lecture_id: item.lecture_id,
                        course_id: item.course_id,
                        unit_number: item.unit_number,
                        course_name: item.course_name,
                        created_at: item.created_at,
                    })),
                ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                setSourceItems(merged)
                setSelectedSourceId(prev => prev || merged[0]?.id || "")
            } finally {
                setLoading(false)
            }
        }

        loadSources()
    }, [isStudent])

    const selectedSource = sourceItems.find((item) => item.id === selectedSourceId) || null

    const handleGenerate = async () => {
        if (!selectedSource) return
        setIsGenerating(true)
        try {
            await api.generateContent(selectedSource.lecture_id, ["assignment"])
            navigate(`/dashboard/course/${selectedSource.course_id}/unit/${selectedSource.unit_number}/lecture/${selectedSource.lecture_id}`)
        } catch {
            // Let the preview stay visible; the route remains usable.
        } finally {
            setIsGenerating(false)
        }
    }

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }

    if (isStudent) {
        return (
            <motion.div initial="hidden" animate="visible" variants={STAGGER} className="space-y-8">
                <motion.div variants={FADE_UP}>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">My Assignments</h1>
                    <p className="text-[#999] mt-1 text-[14px]">Complete your pending quizzes and homework.</p>
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
                ) : recentAssignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                             style={{ background: "#f0f0f5" }}>
                            <CheckSquare className="h-6 w-6 text-[#999]" />
                        </div>
                        <p className="text-sm text-[#999] font-medium">No assignments generated yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentAssignments.map((item) => (
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
                                            <CheckSquare className="h-4 w-4" />
                                            Start Quiz
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
                            <BookOpen className="h-5 w-5 text-white/80" />
                        </div>
                        <div>
                            <span className="text-[11px] font-mono text-white/40 tracking-widest uppercase">Content Generation</span>
                            <h1 className="text-2xl font-bold tracking-tight mt-0.5">Create Assignments</h1>
                            <p className="text-white/40 text-[14px] mt-1">Generate quizzes and homework from your lecture content.</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                        <div className="h-1" style={{ background: "#1a1a2e" }} />
                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-[14px] font-bold text-[#1a1a1a]">Recent Sources</h2>
                                <span className="text-[11px] font-mono text-[#999]">Notes · Assignments · Lectures</span>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-5 w-5 animate-spin text-[#1a1a2e]" />
                                </div>
                            ) : sourceItems.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#eaeae8] bg-[#faf9f7] p-6 text-center">
                                    <p className="text-sm font-medium text-[#1a1a1a]">No recent sources available</p>
                                    <p className="text-[12px] text-[#999] mt-1">Generate a lecture, note, or assignment first.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 max-h-[280px] overflow-y-auto pr-1">
                                    {sourceItems.map((item) => {
                                        const isSelected = item.id === selectedSourceId
                                        const icon = item.kind === "note" ? FileText : item.kind === "assignment" ? CheckSquare : Mic
                                        const kindLabel = item.kind === "note" ? "Note" : item.kind === "assignment" ? "Assignment" : "Lecture"

                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => setSelectedSourceId(item.id)}
                                                className={`text-left rounded-xl border p-4 transition-all group ${
                                                    isSelected
                                                        ? "border-[#1a1a2e] bg-[#faf9f7] shadow-sm"
                                                        : "border-[#eaeaec] bg-white hover:border-[#d2d2d7] hover:shadow-sm"
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#f0f0f5]">
                                                        {icon({ className: "h-5 w-5 text-[#6b6b6b]" })}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#1a1a2e] border border-[#e5e5ea]">
                                                                {kindLabel}
                                                            </span>
                                                            <span className="text-[11px] text-[#999] font-mono truncate">{item.course_name}</span>
                                                        </div>
                                                        <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">{item.title}</p>
                                                        <p className="text-[11px] text-[#999] mt-0.5">Unit {item.unit_number}</p>
                                                    </div>
                                                    <ArrowUpRight className="h-4 w-4 text-[#ccc] group-hover:text-[#c2185b] transition-colors flex-shrink-0" />
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            <div className="rounded-xl border border-[#eaeaec] bg-[#faf9f7] p-4">
                                <p className="text-[11px] font-mono text-[#999] uppercase tracking-widest">Selected Source</p>
                                {selectedSource ? (
                                    <div className="mt-2">
                                        <p className="text-[15px] font-bold text-[#1a1a1a] truncate">{selectedSource.title}</p>
                                        <p className="text-[12px] text-[#6b6b6b] mt-0.5 truncate">{selectedSource.course_name} · Unit {selectedSource.unit_number}</p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-[#999] mt-2">Choose a recent note, assignment, or lecture.</p>
                                )}
                            </div>

                            <div>
                                <label className="text-[13px] font-semibold text-[#1a1a1a] mb-1.5 block">Assignment Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setSelectedType("mcq")}
                                        className={`rounded-xl p-4 text-center transition-all border-2 ${
                                            selectedType === "mcq"
                                                ? "border-[#c2185b] bg-[#faf9f7]"
                                                : "border-[#eaeae8] bg-white hover:border-[#ddd]"
                                        }`}
                                    >
                                        <CheckSquare className={`mx-auto mb-2 h-5 w-5 ${selectedType === "mcq" ? "text-[#c2185b]" : "text-[#999]"}`} />
                                        <span className="text-[13px] font-semibold text-[#1a1a1a]">Multiple Choice</span>
                                    </button>
                                    <button
                                        onClick={() => setSelectedType("essay")}
                                        className={`rounded-xl p-4 text-center transition-all border-2 ${
                                            selectedType === "essay"
                                                ? "border-[#c2185b] bg-[#faf9f7]"
                                                : "border-[#eaeae8] bg-white hover:border-[#ddd]"
                                        }`}
                                    >
                                        <PenLine className={`mx-auto mb-2 h-5 w-5 ${selectedType === "essay" ? "text-[#c2185b]" : "text-[#999]"}`} />
                                        <span className="text-[13px] font-semibold text-[#1a1a1a]">Essay Questions</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !selectedSource}
                                className="w-full text-white py-3.5 rounded-xl font-semibold text-[14px] shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98]"
                                style={{ background: "#1a1a2e" }}
                            >
                                {isGenerating ? "Generating..." : <><Sparkles className="h-4 w-4" /> Generate Assignment</>}
                            </button>
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden h-full">
                        <div className="p-6 space-y-5">
                            <h2 className="text-[14px] font-bold text-[#1a1a1a]">Quick Preview</h2>

                            {selectedSource ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl bg-[#faf9f7] border border-[#eaeaec] p-5">
                                        <p className="text-[11px] font-mono uppercase tracking-widest text-[#999]">Source</p>
                                        <h3 className="text-[18px] font-bold text-[#1a1a1a] mt-2 truncate">{selectedSource.title}</h3>
                                        <p className="text-[13px] text-[#6b6b6b] mt-1 truncate">{selectedSource.course_name} · Unit {selectedSource.unit_number}</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/dashboard/course/${selectedSource.course_id}/unit/${selectedSource.unit_number}/lecture/${selectedSource.lecture_id}`)}
                                            className="inline-flex items-center gap-2 mt-4 text-[13px] font-semibold text-[#c2185b] hover:gap-3 transition-all"
                                        >
                                            Open lecture
                                            <ArrowUpRight className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="rounded-xl border border-[#eaeaec] p-4">
                                        <p className="text-[11px] font-mono uppercase tracking-widest text-[#999]">Mode</p>
                                        <p className="text-[14px] font-semibold text-[#1a1a1a] mt-1">
                                            {selectedType === "mcq" ? "Multiple Choice" : "Essay Questions"}
                                        </p>
                                        <p className="text-[12px] text-[#999] mt-1">
                                            Assignments will be generated from the selected recent source.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[360px] text-center">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                                         style={{ background: "#f0f0f5" }}>
                                        <BookOpen className="h-6 w-6 text-[#999]" />
                                    </div>
                                    <p className="text-sm text-[#999] font-medium">Pick a recent source to preview it here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
