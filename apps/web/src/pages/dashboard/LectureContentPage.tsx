import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    ArrowLeft, FileText, BookOpen, Layers, Loader2, AlertCircle, CheckCircle2,
    PenLine, Lightbulb, Target, Hash, Star, ChevronRight, Sigma,
    Calculator, GitBranch, Search, ImageIcon, X, ExternalLink, RefreshCw,
} from "lucide-react"
import { api } from "../../lib/api"
import type { GeneratedContent } from "../../types"
import { LatexRenderer, LatexBlock } from "../../components/ui/LatexRenderer"

/* eslint-disable @typescript-eslint/no-explicit-any */

type Tab = "notes" | "assignment" | "flashcards"

export default function LectureContentPage() {
    const { courseId, unitNumber, lectureId } = useParams<{
        courseId: string
        unitNumber: string
        lectureId: string
    }>()
    const [activeTab, setActiveTab] = useState<Tab>("notes")
    const [notes, setNotes] = useState<GeneratedContent | null>(null)
    const [assignment, setAssignment] = useState<GeneratedContent | null>(null)
    const [flashcards, setFlashcards] = useState<GeneratedContent | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [lectureTitle, setLectureTitle] = useState("")

    useEffect(() => {
        if (!lectureId) return
        async function load() {
            setLoading(true)
            setError("")
            try {
                const [n, a, f] = await Promise.all([
                    api.getNotes(lectureId!).catch(() => null),
                    api.getAssignment(lectureId!).catch(() => null),
                    api.getFlashcards(lectureId!).catch(() => null),
                ])
                setNotes(n)
                setAssignment(a)
                setFlashcards(f)
                try {
                    const lec = await api.getLecture(lectureId!)
                    setLectureTitle(lec.title)
                } catch { /* ignore */ }
            } catch (err: Error | unknown) {
                const message = err instanceof Error ? err.message : "Failed to load content"
                setError(message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [lectureId])

    const tabs: { key: Tab; label: string; icon: typeof FileText; data: GeneratedContent | null }[] = [
        { key: "notes", label: "Notes", icon: FileText, data: notes },
        { key: "assignment", label: "Assignment", icon: BookOpen, data: assignment },
        { key: "flashcards", label: "Flashcards", icon: Layers, data: flashcards },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-2xl blur-2xl opacity-20"
                             style={{ background: "#1a1a2e" }} />
                        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                             style={{ background: "#1a1a2e" }}>
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                    </div>
                    <p className="text-sm font-medium text-[#18181b]">Loading content</p>
                    <p className="text-xs text-[#999]">Fetching lecture materials...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* ── Editorial Hero Banner ── */}
            <div className="relative overflow-hidden rounded-2xl"
                 style={{ background: "#0f0c1e" }}>

                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                     style={{
                         backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.1) 39px, rgba(255,255,255,0.1) 40px),
                                           repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.1) 39px, rgba(255,255,255,0.1) 40px)`,
                     }} />

                <div className="relative z-10 px-8 py-8">
                    <Link
                        to={`/dashboard/course/${courseId}/unit/${unitNumber}`}
                        className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 text-[13px] font-medium mb-6 transition-colors group"
                    >
                        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        Back to Unit
                    </Link>

                    <div className="flex items-start gap-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/10 bg-white/[0.08] backdrop-blur-sm">
                            <FileText className="h-5 w-5 text-white/80" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="inline-flex items-center gap-2 text-[11px] font-mono text-white/40 tracking-widest uppercase mb-2">
                                <span className="w-6 h-px bg-white/20" />
                                Lecture Content
                            </span>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
                                {lectureTitle || "Lecture Content"}
                            </h1>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Tab Navigation — Pill style ── */}
            <div className="flex gap-1.5 p-1.5 rounded-xl bg-white border border-[#eaeaec] w-fit shadow-sm">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                                isActive
                                    ? "text-white shadow-md"
                                    : "text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-[#f5f5f3]"
                            }`}
                            style={isActive ? { background: "#1a1a2e" } : undefined}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                            {tab.data && (
                                <CheckCircle2 className={`h-3 w-3 ${isActive ? "text-white/50" : "text-[#ccc]"}`} />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Content Area ── */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
                {activeTab === "notes" && <NotesViewer content={notes} lectureId={lectureId || ""} />}
                {activeTab === "assignment" && <AssignmentViewer content={assignment} />}
                {activeTab === "flashcards" && <FlashcardsViewer content={flashcards} />}
            </motion.div>
        </div>
    )
}

// ═══════════════════════════════════════════════
// NOTES VIEWER — Editorial Enterprise Design
// ═══════════════════════════════════════════════

function NotesViewer({ content, lectureId }: { content: GeneratedContent | null; lectureId: string }) {
    if (!content) {
        return (
            <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                         style={{ background: "#f0f0f5" }}>
                        <FileText className="h-7 w-7 text-[#999]" />
                    </div>
                    <p className="font-semibold text-[#1a1a1a] text-lg">No notes generated yet</p>
                    <p className="text-sm text-[#999] mt-1.5 max-w-sm text-center">
                        Notes will appear here once the teacher generates them from the lecture recording.
                    </p>
                </div>
            </div>
        )
    }

    const data = content.content
    const title = data?.title || data?.topic || "Lecture Notes"
    const summary = data?.summary || ""
    const overview = data?.overview || ""
    const sections = data?.sections || data?.key_points || data?.notes || []
    const keyTakeaways = data?.key_takeaways || []
    const importantConcepts = data?.important_concepts || []
    const importantFormulas = data?.important_formulas || []
    const vocabulary = data?.vocabulary || []
    const practiceQuestions = data?.practice_questions || []
    const furtherReading = data?.further_reading || []
    const fetchedDiagrams = data?.fetched_diagrams || []
    const diagramSpecs = data?.diagrams || []

    return (
        <div className="space-y-6">
            {/* ── Title & Summary ── */}
            <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                <div className="h-1" style={{ background: "#1a1a2e" }} />
                <div className="p-8">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                             style={{ background: "#1a1a2e" }}>
                            <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <span className="text-[11px] font-mono text-[#999] tracking-widest uppercase">Generated Notes</span>
                            <h2 className="text-xl font-bold text-[#1a1a1a] tracking-tight mt-0.5">{title}</h2>
                        </div>
                    </div>

                    {summary && (
                        <div className="p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#999] block mb-2">Summary</span>
                            <LatexBlock text={String(summary)} className="text-[#3a3a3a] leading-[1.8] text-[15px]" />
                        </div>
                    )}

                    {overview && !summary && (
                        <div className="p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#999] block mb-2">Overview</span>
                            <LatexBlock text={String(overview)} className="text-[#3a3a3a] leading-[1.8] text-[15px]" />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Sections ── */}
            {Array.isArray(sections) && sections.length > 0 && sections.map((section: any, idx: number) => {
                const sectionContent = section.content || section.text || section.description || ""
                const keyPoints = section.key_points || section.points || section.bullet_points || []
                const subsections = section.subsections || []
                const formulas = section.formulas || []
                const derivations = section.derivations || []
                const numericalExamples = section.numerical_examples || []
                const examples = section.examples || []
                const applications = section.applications || []

                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04, duration: 0.35 }}
                        className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden"
                    >
                        <div className="flex">
                            {/* Accent bar */}
                            <div className="w-1 flex-shrink-0 rounded-l-2xl"
                                 style={{ background: "#1a1a2e" }} />

                            <div className="flex-1 p-7">
                                {/* Section header */}
                                {(section.title || section.heading) && (
                                    <div className="flex items-start gap-4 mb-5">
                                        <span className="text-[13px] font-mono font-bold text-[#c2185b] tabular-nums mt-0.5">
                                            {String(idx + 1).padStart(2, "0")}
                                        </span>
                                        <h3 className="text-lg font-bold text-[#1a1a1a] tracking-tight leading-snug">
                                            {section.title || section.heading}
                                        </h3>
                                    </div>
                                )}

                                {/* Section content */}
                                {sectionContent && (
                                    <LatexBlock text={sectionContent} className="text-[#3a3a3a] leading-[1.8] text-[15px] mb-5" />
                                )}

                                {/* Subsections */}
                                {Array.isArray(subsections) && subsections.length > 0 && (
                                    <div className="space-y-4 mb-5">
                                        {subsections.map((sub: any, sIdx: number) => (
                                            <div key={sIdx} className="pl-5 border-l-2 border-[#eaeae8]">
                                                {sub.subheading && (
                                                    <h4 className="font-semibold text-[#1a1a1a] text-[14px] mb-1.5">{sub.subheading}</h4>
                                                )}
                                                {sub.explanation && (
                                                    <LatexBlock text={sub.explanation} className="text-[#3a3a3a] text-[14px] leading-[1.75]" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Formulas */}
                                {Array.isArray(formulas) && formulas.length > 0 && (
                                    <div className="mt-5 p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Sigma className="h-4 w-4 text-[#c2185b]" />
                                            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#999]">Key Formulas</span>
                                        </div>
                                        <div className="space-y-3">
                                            {formulas.map((f: any, fIdx: number) => (
                                                <div key={fIdx} className="bg-white rounded-lg p-4 border border-[#eaeae8]">
                                                    <p className="text-[13px] font-semibold text-[#1a1a1a] mb-1.5">{f.name}</p>
                                                    <LatexBlock text={f.expression} className="text-[#1a1a1a] text-[15px] my-2" />
                                                    {f.description && (
                                                        <LatexRenderer text={f.description} className="text-[13px] text-[#6b6b6b] leading-relaxed" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Derivations */}
                                {Array.isArray(derivations) && derivations.length > 0 && (
                                    <div className="mt-5 p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                        <div className="flex items-center gap-2 mb-4">
                                            <GitBranch className="h-4 w-4 text-[#1a1a2e]" />
                                            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#999]">Derivations</span>
                                        </div>
                                        {derivations.map((d: any, dIdx: number) => (
                                            <div key={dIdx} className="mb-5 last:mb-0">
                                                {d.title && <p className="text-[14px] font-semibold text-[#1a1a1a] mb-3">{d.title}</p>}
                                                {Array.isArray(d.steps) && (
                                                    <div className="space-y-2.5 pl-4 border-l-2 border-[#c2185b]/20">
                                                        {d.steps.map((step: string, sIdx: number) => (
                                                            <div key={sIdx} className="flex items-start gap-3">
                                                                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 mt-0.5 text-[#c2185b] bg-[#c2185b]/10">
                                                                    {sIdx + 1}
                                                                </span>
                                                                <LatexBlock text={step} className="text-[14px] text-[#3a3a3a] leading-relaxed" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {d.result && (
                                                    <div className="mt-3 p-3 rounded-lg bg-white border border-[#c2185b]/20">
                                                        <span className="text-[10px] font-mono font-bold text-[#c2185b] uppercase tracking-wider">Result</span>
                                                        <LatexBlock text={d.result} className="text-[14px] text-[#1a1a1a] font-medium mt-1" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Numerical Examples */}
                                {Array.isArray(numericalExamples) && numericalExamples.length > 0 && (
                                    <div className="mt-5 p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Calculator className="h-4 w-4 text-[#c2185b]" />
                                            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#999]">Worked Examples</span>
                                        </div>
                                        {numericalExamples.map((ex: any, eIdx: number) => (
                                            <div key={eIdx} className="mb-5 last:mb-0 bg-white rounded-lg p-4 border border-[#eaeae8]">
                                                {ex.problem && (
                                                    <LatexBlock text={ex.problem} className="text-[14px] text-[#1a1a1a] font-medium mb-3" />
                                                )}
                                                {Array.isArray(ex.solution_steps) && (
                                                    <div className="space-y-2 pl-4 border-l-2 border-[#c2185b]/20">
                                                        {ex.solution_steps.map((step: string, sIdx: number) => (
                                                            <div key={sIdx} className="flex items-start gap-3">
                                                                <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0 mt-0.5 text-[#c2185b] bg-[#c2185b]/10">
                                                                    {sIdx + 1}
                                                                </span>
                                                                <LatexBlock text={step} className="text-[13px] text-[#3a3a3a]" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {ex.answer && (
                                                    <div className="mt-3 p-3 rounded-lg border border-[#c2185b]/15 bg-[#c2185b]/[0.03]">
                                                        <span className="text-[10px] font-mono font-bold text-[#c2185b] uppercase tracking-wider">Answer</span>
                                                        <LatexRenderer text={ex.answer} className="text-[14px] text-[#1a1a1a] font-semibold mt-0.5" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Key Points */}
                                {Array.isArray(keyPoints) && keyPoints.length > 0 && (
                                    <div className="mt-5 p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                        <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#999] block mb-3">Key Points</span>
                                        <ul className="space-y-2">
                                            {keyPoints.map((point: string, pIdx: number) => (
                                                <li key={pIdx} className="flex items-start gap-2.5 text-[14px] text-[#3a3a3a]">
                                                    <CheckCircle2 className="h-4 w-4 text-[#c2185b] flex-shrink-0 mt-0.5" />
                                                    <LatexRenderer text={point} />
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Examples */}
                                {Array.isArray(examples) && examples.length > 0 && (
                                    <div className="mt-5 p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                        <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#999] block mb-3">Examples</span>
                                        <ul className="space-y-2">
                                            {examples.map((ex: string, eIdx: number) => (
                                                <li key={eIdx} className="flex items-start gap-2.5 text-[14px] text-[#3a3a3a]">
                                                    <Lightbulb className="h-4 w-4 text-[#e8a849] flex-shrink-0 mt-0.5" />
                                                    <LatexRenderer text={ex} />
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Applications */}
                                {Array.isArray(applications) && applications.length > 0 && (
                                    <div className="mt-5 p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                        <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#999] block mb-3">Real-World Applications</span>
                                        <ul className="space-y-2">
                                            {applications.map((app: string, aIdx: number) => (
                                                <li key={aIdx} className="flex items-start gap-2.5 text-[14px] text-[#3a3a3a]">
                                                    <Target className="h-4 w-4 text-[#1a1a2e] flex-shrink-0 mt-0.5" />
                                                    <LatexRenderer text={app} />
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )
            })}

            {/* ── Key Takeaways ── */}
            {Array.isArray(keyTakeaways) && keyTakeaways.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="h-1" style={{ background: "#1a1a2e" }} />
                    <div className="p-7">
                        <div className="flex items-center gap-3 mb-5">
                            <Star className="h-5 w-5 text-[#c2185b]" />
                            <h3 className="text-lg font-bold text-[#1a1a1a] tracking-tight">Key Takeaways</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {keyTakeaways.map((takeaway: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono font-bold flex-shrink-0 text-white"
                                          style={{ background: "#1a1a2e" }}>
                                        {idx + 1}
                                    </span>
                                    <LatexRenderer text={takeaway} className="text-[14px] text-[#3a3a3a] leading-relaxed" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Important Formulas ── */}
            {Array.isArray(importantFormulas) && importantFormulas.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="h-1" style={{ background: "#c2185b" }} />
                    <div className="p-7">
                        <div className="flex items-center gap-3 mb-5">
                            <Sigma className="h-5 w-5 text-[#1a1a2e]" />
                            <h3 className="text-lg font-bold text-[#1a1a1a] tracking-tight">Important Formulas</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {importantFormulas.map((f: any, idx: number) => (
                                <div key={idx} className="p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                    <p className="text-[13px] font-semibold text-[#1a1a1a] mb-2">{f.name}</p>
                                    <LatexBlock text={f.expression} className="text-[#1a1a1a] my-2 text-[15px]" />
                                    {f.conditions && (
                                        <LatexRenderer text={f.conditions} className="text-[13px] text-[#6b6b6b] leading-relaxed" />
                                    )}
                                    {f.units && (
                                        <p className="text-[11px] font-mono text-[#999] mt-2">Units: {f.units}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Important Concepts ── */}
            {Array.isArray(importantConcepts) && importantConcepts.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="h-1" style={{ background: "#1a1a2e" }} />
                    <div className="p-7">
                        <div className="flex items-center gap-3 mb-5">
                            <Lightbulb className="h-5 w-5 text-[#e8a849]" />
                            <h3 className="text-lg font-bold text-[#1a1a1a] tracking-tight">Important Concepts</h3>
                        </div>
                        <div className="space-y-3">
                            {importantConcepts.map((c: any, idx: number) => (
                                <div key={idx} className="p-5 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                    <h4 className="font-semibold text-[#1a1a1a] text-[14px]">{c.concept}</h4>
                                    {c.explanation && <LatexBlock text={c.explanation} className="text-[14px] text-[#3a3a3a] mt-2 leading-[1.75]" />}
                                    {Array.isArray(c.related_topics) && c.related_topics.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {c.related_topics.map((rt: string, rIdx: number) => (
                                                <span key={rIdx} className="text-[10px] font-mono px-2.5 py-1 rounded-md font-medium border"
                                                      style={{ background: "rgba(26,26,46,0.05)", borderColor: "rgba(26,26,46,0.12)", color: "#1a1a2e" }}>
                                                    {rt}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Vocabulary ── */}
            {Array.isArray(vocabulary) && vocabulary.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="p-7">
                        <div className="flex items-center gap-3 mb-5">
                            <Hash className="h-5 w-5 text-[#6b6b6b]" />
                            <h3 className="text-lg font-bold text-[#1a1a1a] tracking-tight">Vocabulary</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {vocabulary.map((v: any, idx: number) => (
                                <div key={idx} className="p-4 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                    <span className="font-semibold text-[#1a1a1a] text-[14px]">{v.term}</span>
                                    {v.definition && <LatexBlock text={v.definition} className="text-[13px] text-[#6b6b6b] mt-1.5 leading-relaxed" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Practice Questions ── */}
            {Array.isArray(practiceQuestions) && practiceQuestions.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="p-7">
                        <div className="flex items-center gap-3 mb-5">
                            <PenLine className="h-5 w-5 text-[#6b6b6b]" />
                            <h3 className="text-lg font-bold text-[#1a1a1a] tracking-tight">Practice Questions</h3>
                        </div>
                        <div className="space-y-2.5">
                            {practiceQuestions.map((q: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-[#faf9f7] border border-[#eaeae8]">
                                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono font-bold flex-shrink-0 text-white"
                                          style={{ background: "#1a1a2e" }}>
                                        {idx + 1}
                                    </span>
                                    <LatexRenderer text={q} className="text-[14px] text-[#3a3a3a] leading-relaxed" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Further Reading ── */}
            {Array.isArray(furtherReading) && furtherReading.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="p-7">
                        <div className="flex items-center gap-3 mb-4">
                            <BookOpen className="h-5 w-5 text-[#6b6b6b]" />
                            <h3 className="text-[14px] font-semibold text-[#6b6b6b]">Further Reading</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {furtherReading.map((topic: string, idx: number) => (
                                <span key={idx} className="text-[12px] px-3 py-1.5 rounded-lg font-medium border"
                                      style={{ background: "rgba(215,109,119,0.05)", borderColor: "rgba(215,109,119,0.15)", color: "#6b6b6b" }}>
                                    {topic}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Conceptual Diagrams — Pre-fetched from backend ── */}
            {(fetchedDiagrams.length > 0 || diagramSpecs.length > 0) && (
                <DiagramsViewer
                    fetchedDiagrams={fetchedDiagrams}
                    diagramSpecs={diagramSpecs}
                    lectureId={lectureId}
                    topic={title}
                />
            )}

            {/* ── Fallback for unknown data ── */}
            {(!Array.isArray(sections) || sections.length === 0) && !keyTakeaways.length && !vocabulary.length && !importantFormulas.length && !importantConcepts.length && typeof data === "object" && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="p-7">
                        <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#999] block mb-3">Raw Content</span>
                        <pre className="whitespace-pre-wrap text-[13px] text-[#3a3a3a] bg-[#faf9f7] p-5 rounded-xl border border-[#eaeae8] font-mono leading-relaxed overflow-x-auto">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════
// DIAGRAMS VIEWER — Pre-fetched + Fallback Search
// ═══════════════════════════════════════════════

interface DiagramResult {
    url: string
    thumb: string
    title: string
    sourceUrl: string
    width?: number
    height?: number
    format?: string
    description?: string
}

interface FetchedDiagram {
    concept_title: string
    description: string
    relevance: string
    search_queries_used: string[]
    results: DiagramResult[]
    total_found: number
}

interface DiagramSpec {
    title: string
    search_queries: string[]
    description: string
    relevance: string
}

function DiagramsViewer({
    fetchedDiagrams,
    diagramSpecs,
    lectureId,
    topic,
}: {
    fetchedDiagrams: FetchedDiagram[]
    diagramSpecs: DiagramSpec[]
    lectureId: string
    topic: string
}) {
    const [lightbox, setLightbox] = useState<DiagramResult | null>(null)
    const [manualResults, setManualResults] = useState<Record<number, DiagramResult[]>>({})
    const [searching, setSearching] = useState<Record<number, boolean>>({})
    const [searchErrors, setSearchErrors] = useState<Record<number, string>>({})

    // Determine which diagrams to show: pre-fetched from backend, or specs for fallback
    const hasPreFetched = fetchedDiagrams.length > 0 && fetchedDiagrams.some(d => d.results?.length > 0)

    const searchManually = async (specIdx: number, queries: string[]) => {
        setSearching(prev => ({ ...prev, [specIdx]: true }))
        setSearchErrors(prev => ({ ...prev, [specIdx]: "" }))
        try {
            // Use the first search query from the LLM specs
            const query = queries[0] || `${topic} diagram`
            const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=9&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=500`
            const res = await fetch(url)
            if (!res.ok) throw new Error("Search failed")
            const json = await res.json()
            const pages = json.query?.pages || {}
            const imgs: DiagramResult[] = (Object.values(pages) as any[])
                .map((p: any) => {
                    const ii = p.imageinfo?.[0]
                    if (!ii) return null
                    const ext = (ii.url || "").split(".").pop()?.toLowerCase() || ""
                    if (["svg", "png", "jpg", "jpeg", "gif", "webp"].includes(ext) && ii.thumburl) {
                        const rawTitle = p.title || ""
                        return {
                            url: ii.url,
                            thumb: ii.thumburl,
                            title: rawTitle.replace("File:", "").replace(/\.[a-z]+$/i, ""),
                            sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(rawTitle)}`,
                            width: ii.width,
                            height: ii.height,
                            format: ext.toUpperCase(),
                        } as DiagramResult
                    }
                    return null
                })
                .filter(Boolean) as DiagramResult[]
            if (imgs.length === 0) throw new Error("No diagrams found. Try a different query.")
            setManualResults(prev => ({ ...prev, [specIdx]: imgs.slice(0, 6) }))
        } catch (e: any) {
            setSearchErrors(prev => ({ ...prev, [specIdx]: e.message || "Search failed" }))
        } finally {
            setSearching(prev => ({ ...prev, [specIdx]: false }))
        }
    }

    // If we have no pre-fetched results and no specs, show nothing
    if (!hasPreFetched && diagramSpecs.length === 0) return null

    // Determine items to render — prefer pre-fetched, fallback to specs
    const items: { title: string; description: string; relevance: string; results: DiagramResult[]; queries: string[]; idx: number }[] = []

    if (hasPreFetched) {
        fetchedDiagrams.forEach((fd, idx) => {
            items.push({
                title: fd.concept_title,
                description: fd.description,
                relevance: fd.relevance,
                results: fd.results || [],
                queries: fd.search_queries_used || [],
                idx,
            })
        })
    } else {
        diagramSpecs.forEach((spec, idx) => {
            items.push({
                title: spec.title,
                description: spec.description,
                relevance: spec.relevance,
                results: manualResults[idx] || [],
                queries: spec.search_queries || [],
                idx,
            })
        })
    }

    return (
        <div className="space-y-5">
            {items.map((item) => (
                <div key={item.idx} className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="h-1" style={{ background: "#1a1a2e" }} />
                    <div className="p-7">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                                     style={{ background: "#1a1a2e" }}>
                                    <ImageIcon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-bold text-[#1a1a1a]">{item.title}</h3>
                                    {item.relevance && (
                                        <p className="text-[11px] text-[#999] mt-0.5 font-mono">Section: {item.relevance}</p>
                                    )}
                                </div>
                            </div>
                            {/* Manual search button (for specs without pre-fetched results) */}
                            {!hasPreFetched && item.results.length === 0 && !searching[item.idx] && (
                                <button
                                    onClick={() => searchManually(item.idx, item.queries)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.97] flex-shrink-0"
                                    style={{ background: "#1a1a2e" }}
                                >
                                    <Search className="h-3.5 w-3.5" />
                                    Find Diagram
                                </button>
                            )}
                        </div>

                        {/* Description */}
                        {item.description && (
                            <div className="p-3 rounded-lg bg-[#faf9f7] border border-[#eaeae8] mb-4">
                                <p className="text-[13px] text-[#6b6b6b] leading-relaxed">{item.description}</p>
                            </div>
                        )}

                        {/* Loading state */}
                        {searching[item.idx] && (
                            <div className="flex flex-col items-center py-10 gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                     style={{ background: "#1a1a2e" }}>
                                    <Search className="h-4 w-4 text-white animate-pulse" />
                                </div>
                                <p className="text-[13px] font-medium text-[#6b6b6b]">Searching Wikimedia Commons...</p>
                            </div>
                        )}

                        {/* Error */}
                        {searchErrors[item.idx] && !searching[item.idx] && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700 flex items-center gap-2 mb-4">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {searchErrors[item.idx]}
                            </div>
                        )}

                        {/* Diagram results grid */}
                        {item.results.length > 0 && (
                            <div>
                                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#999] block mb-3">
                                    {item.results.length} diagram{item.results.length !== 1 ? "s" : ""} found
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {item.results.map((img, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setLightbox(img)}
                                            className="group relative rounded-xl overflow-hidden border-2 border-[#eaeae8] cursor-pointer transition-all hover:shadow-md hover:border-[#c2185b]/40"
                                        >
                                            <img
                                                src={img.thumb}
                                                alt={img.title}
                                                className="w-full h-36 object-contain bg-[#faf9f7] group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                            />
                                            <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent">
                                                <p className="text-white text-[10px] font-medium truncate">{img.title}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <a
                                                        href={img.sourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="text-white/50 text-[9px] hover:text-white flex items-center gap-0.5"
                                                    >
                                                        <ExternalLink className="h-2.5 w-2.5" /> Source
                                                    </a>
                                                    {img.format && (
                                                        <span className="text-white/30 text-[9px] font-mono">{img.format}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[10px] text-[#bbb] mt-3 text-center font-mono">
                                    Images from <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#6b6b6b]">Wikimedia Commons</a> — Creative Commons
                                </p>
                            </div>
                        )}

                        {/* Empty state for pre-fetched with no results */}
                        {!searching[item.idx] && item.results.length === 0 && hasPreFetched && (
                            <div className="flex flex-col items-center py-6 gap-2">
                                <ImageIcon className="h-6 w-6 text-[#ccc]" />
                                <p className="text-[12px] text-[#999]">No diagrams found for this concept</p>
                                <button
                                    onClick={() => searchManually(item.idx, item.queries)}
                                    className="text-[11px] font-medium text-[#c2185b] hover:underline flex items-center gap-1 mt-1"
                                >
                                    <RefreshCw className="h-3 w-3" /> Try searching again
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.88)" }}
                    onClick={() => setLightbox(null)}
                >
                    <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setLightbox(null)}
                            className="absolute -top-10 right-0 text-white/60 hover:text-white flex items-center gap-1 text-sm"
                        >
                            <X className="h-5 w-5" /> Close
                        </button>
                        <img
                            src={lightbox.url}
                            alt={lightbox.title}
                            className="w-full max-h-[80vh] object-contain rounded-xl bg-white"
                        />
                        <div className="mt-3 flex items-center justify-between">
                            <p className="text-white/70 text-sm">{lightbox.title}</p>
                            <a
                                href={lightbox.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/50 hover:text-white text-xs flex items-center gap-1"
                            >
                                <ExternalLink className="h-3 w-3" /> Source
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════
// ASSIGNMENT VIEWER — Enterprise Design
// ═══════════════════════════════════════════════

function AssignmentViewer({ content }: { content: GeneratedContent | null }) {
    const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({})

    if (!content) {
        return (
            <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                         style={{ background: "#f0f0f5" }}>
                        <BookOpen className="h-7 w-7 text-[#999]" />
                    </div>
                    <p className="font-semibold text-[#1a1a1a] text-lg">No assignment generated yet</p>
                    <p className="text-sm text-[#999] mt-1.5">Assignments will appear here once generated.</p>
                </div>
            </div>
        )
    }

    const data = content.content
    const title = data?.title || "Assignment"
    const description = data?.description || data?.instructions || ""
    const questions = data?.questions || data?.items || data?.problems || []

    const toggleAnswer = (idx: number) => {
        setShowAnswers(prev => ({ ...prev, [idx]: !prev[idx] }))
    }

    const DIFFICULTY_STYLES: Record<string, string> = {
        easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
        medium: "bg-amber-50 text-amber-700 border-amber-200",
        hard: "bg-red-50 text-red-700 border-red-200",
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                <div className="h-1" style={{ background: "#1a1a2e" }} />
                <div className="p-7">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                             style={{ background: "#1a1a2e" }}>
                            <BookOpen className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <span className="text-[11px] font-mono text-[#999] tracking-widest uppercase">Assignment</span>
                            <h2 className="text-xl font-bold text-[#1a1a1a] tracking-tight mt-0.5">{title}</h2>
                            {description && <p className="text-[14px] text-[#6b6b6b] mt-2 leading-relaxed">{description}</p>}
                        </div>
                    </div>
                    {questions.length > 0 && (
                        <div className="flex items-center gap-3 mt-5">
                            <span className="text-[12px] font-mono font-medium text-[#6b6b6b] bg-[#faf9f7] px-3 py-1.5 rounded-lg border border-[#eaeae8]">
                                {questions.length} question{questions.length !== 1 ? "s" : ""}
                            </span>
                            <button
                                onClick={() => {
                                    const allShown = questions.every((_: any, i: number) => showAnswers[i])
                                    const s: Record<number, boolean> = {}
                                    questions.forEach((_: any, i: number) => { s[i] = !allShown })
                                    setShowAnswers(s)
                                }}
                                className="text-[12px] font-medium text-[#c2185b] hover:underline transition-colors">
                                {questions.every((_: any, i: number) => showAnswers[i]) ? "Hide All Answers" : "Show All Answers"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Questions */}
            {Array.isArray(questions) && questions.length > 0 ? (
                questions.map((q: any, idx: number) => {
                    const qType = q.type || q.question_type || ""
                    const difficulty = q.difficulty || ""
                    const topic = q.topic || ""
                    const marks = q.marks || q.points || ""
                    const minWords = q.minimum_words || q.min_words || ""
                    const expectedAnswer = q.expected_answer || q.answer || q.model_answer || ""
                    const keywords = q.keywords || q.key_terms || []
                    const rubric = q.rubric || q.marking_scheme || ""
                    const solutionSteps = q.solution_steps || q.steps || []
                    const givenData = q.given_data || []
                    const formulaRequired = q.formula_required || ""
                    const isAnswerShown = showAnswers[idx] || false

                    return (
                        <motion.div key={idx}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                            <div className="flex">
                                <div className="w-1 flex-shrink-0 rounded-l-2xl"
                                     style={{ background: "#1a1a2e" }} />
                                <div className="flex-1">
                                    <div className="p-6">
                                        {/* Tags */}
                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <span className="text-[12px] font-mono font-bold text-white px-2.5 py-1 rounded-md"
                                                  style={{ background: "#1a1a2e" }}>
                                                Q{idx + 1}
                                            </span>
                                            {qType && (
                                                <span className="text-[10px] font-mono font-medium px-2 py-1 rounded-md bg-[#faf9f7] text-[#6b6b6b] border border-[#eaeae8]">
                                                    {qType.replace(/_/g, " ")}
                                                </span>
                                            )}
                                            {difficulty && (
                                                <span className={`text-[10px] font-mono font-medium px-2 py-1 rounded-md border ${DIFFICULTY_STYLES[difficulty.toLowerCase()] || "bg-[#faf9f7] text-[#6b6b6b] border-[#eaeae8]"}`}>
                                                    {difficulty}
                                                </span>
                                            )}
                                            {marks && (
                                                <span className="text-[10px] font-mono font-medium px-2 py-1 rounded-md bg-[#faf9f7] text-[#6b6b6b] border border-[#eaeae8]">
                                                    {marks} marks
                                                </span>
                                            )}
                                            {topic && (
                                                <span className="text-[10px] font-medium px-2 py-1 rounded-md text-[#999] bg-[#faf9f7] border border-[#eaeae8]">
                                                    {topic}
                                                </span>
                                            )}
                                        </div>

                                        <LatexBlock
                                            text={q.question || q.text || q.prompt || (typeof q === "string" ? q : JSON.stringify(q))}
                                            className="text-[#1a1a1a] font-medium leading-[1.7] text-[15px]"
                                        />

                                        {Array.isArray(givenData) && givenData.length > 0 && (
                                            <div className="mt-3 p-3 rounded-lg bg-[#faf9f7] border border-[#eaeae8]">
                                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#999] block mb-1.5">Given</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {givenData.map((d: string, dIdx: number) => (
                                                        <LatexRenderer key={dIdx} text={d} className="text-[13px] text-[#3a3a3a] bg-white px-2.5 py-1 rounded-md border border-[#eaeae8]" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {formulaRequired && (
                                            <div className="mt-3 p-3 rounded-lg bg-[#faf9f7] border border-[#eaeae8]">
                                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#c2185b] block mb-1">Formula</span>
                                                <LatexBlock text={formulaRequired} className="text-[14px] text-[#1a1a1a]" />
                                            </div>
                                        )}

                                        {minWords && (
                                            <p className="text-[11px] text-[#999] mt-2 font-mono italic">Min {minWords} words</p>
                                        )}
                                    </div>

                                    {/* Answer section */}
                                    {(expectedAnswer || keywords.length > 0 || rubric || solutionSteps.length > 0) && (
                                        <div className="border-t border-[#eaeae8]">
                                            <button onClick={() => toggleAnswer(idx)}
                                                className={`w-full px-6 py-3 text-left text-[12px] font-semibold transition-all flex items-center gap-2 ${
                                                    isAnswerShown ? "text-[#c2185b] bg-[#faf9f7]" : "text-[#6b6b6b] hover:bg-[#faf9f7]"
                                                }`}>
                                                <Lightbulb className="h-3.5 w-3.5" />
                                                {isAnswerShown ? "Hide Answer Guide" : "Show Answer Guide"}
                                                <ChevronRight className={`h-3 w-3 ml-auto transition-transform duration-200 ${isAnswerShown ? "rotate-90" : ""}`} />
                                            </button>

                                            {isAnswerShown && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                                                    className="px-6 pb-6 space-y-3">
                                                    {expectedAnswer && (
                                                        <div className="bg-[#faf9f7] rounded-xl p-4 border border-[#eaeae8]">
                                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#999] block mb-2">Expected Answer</span>
                                                            <LatexBlock text={expectedAnswer} className="text-[14px] text-[#1a1a1a] leading-relaxed" />
                                                        </div>
                                                    )}
                                                    {Array.isArray(keywords) && keywords.length > 0 && (
                                                        <div>
                                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#999] block mb-2">Key Terms</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {keywords.map((kw: string, kIdx: number) => (
                                                                    <span key={kIdx} className="text-[11px] bg-[#faf9f7] text-[#3a3a3a] px-2.5 py-1 rounded-md border border-[#eaeae8] font-medium">
                                                                        {kw}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {Array.isArray(solutionSteps) && solutionSteps.length > 0 && (
                                                        <div>
                                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#999] block mb-2">Solution Steps</span>
                                                            <div className="space-y-2 pl-4 border-l-2 border-[#c2185b]/20">
                                                                {solutionSteps.map((step: string, sIdx: number) => (
                                                                    <div key={sIdx} className="flex items-start gap-2.5">
                                                                        <span className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-mono font-bold flex-shrink-0 mt-0.5 text-[#c2185b] bg-[#c2185b]/10">
                                                                            {sIdx + 1}
                                                                        </span>
                                                                        <LatexBlock text={step} className="text-[13px] text-[#3a3a3a] leading-relaxed" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {rubric && (
                                                        <div className="bg-[#faf9f7] rounded-xl p-4 border border-[#eaeae8]">
                                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#999] block mb-2">Marking Rubric</span>
                                                            <LatexBlock text={rubric} className="text-[14px] text-[#1a1a1a] leading-relaxed" />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )
                })
            ) : typeof data === "object" ? (
                <div className="bg-white rounded-2xl border border-[#eaeaec] p-7">
                    <pre className="whitespace-pre-wrap text-[13px] text-[#3a3a3a] bg-[#faf9f7] p-5 rounded-xl border border-[#eaeae8] font-mono">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            ) : (
                <p className="text-[#3a3a3a]">{String(data)}</p>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════
// FLASHCARDS VIEWER — Enterprise Design
// ═══════════════════════════════════════════════

function FlashcardsViewer({ content }: { content: GeneratedContent | null }) {
    const [flipped, setFlipped] = useState<Record<number, boolean>>({})

    if (!content) {
        return (
            <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                         style={{ background: "#f0f0f5" }}>
                        <Layers className="h-7 w-7 text-[#999]" />
                    </div>
                    <p className="font-semibold text-[#1a1a1a] text-lg">No flashcards generated yet</p>
                    <p className="text-sm text-[#999] mt-1.5">Flashcards will appear here once generated.</p>
                </div>
            </div>
        )
    }

    const data = content.content
    const cards = data?.cards || data?.flashcards || data?.items || []

    const toggleFlip = (idx: number) => {
        setFlipped(prev => ({ ...prev, [idx]: !prev[idx] }))
    }

    return (
        <div className="space-y-5">
            {/* Stats bar */}
            {Array.isArray(cards) && cards.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden">
                    <div className="h-1" style={{ background: "#1a1a2e" }} />
                    <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                                 style={{ background: "#1a1a2e" }}>
                                <Layers className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <span className="text-[14px] font-bold text-[#1a1a1a]">{cards.length} Flashcard{cards.length !== 1 ? "s" : ""}</span>
                                <p className="text-[11px] text-[#999] font-mono">
                                    {Object.values(flipped).filter(Boolean).length} of {cards.length} revealed
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    const allFlipped = cards.every((_: any, i: number) => flipped[i])
                                    const s: Record<number, boolean> = {}
                                    cards.forEach((_: any, i: number) => { s[i] = !allFlipped })
                                    setFlipped(s)
                                }}
                                className="text-[12px] font-medium text-[#c2185b] hover:underline px-3 py-1.5 rounded-lg transition-colors">
                                {cards.every((_: any, i: number) => flipped[i]) ? "Hide All" : "Reveal All"}
                            </button>
                            <span className="text-[10px] text-[#ccc] hidden sm:block font-mono">Click card to flip</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Cards Grid */}
            {Array.isArray(cards) && cards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {cards.map((card: any, idx: number) => {
                        const front = card.front || card.question || card.term || (typeof card === "string" ? card : "")
                        const back = card.back || card.answer || card.definition || ""
                        const formula = card.formula || ""
                        const isFlipped = flipped[idx] || false

                        return (
                            <motion.div key={idx}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                onClick={() => toggleFlip(idx)}
                                className="cursor-pointer"
                                whileTap={{ scale: 0.98 }}
                                whileHover={{ y: -3 }}>
                                <div className={`rounded-2xl border overflow-hidden transition-all duration-300 min-h-[200px] flex flex-col ${
                                    isFlipped
                                        ? "bg-[#faf9f7] border-[#c2185b]/30 shadow-lg"
                                        : "bg-white border-[#eaeaec] shadow-sm hover:shadow-md"
                                }`}>
                                    <div className="h-1 transition-all duration-300"
                                         style={{ background: isFlipped
                                             ? "#c2185b"
                                             : "#1a1a2e"
                                         }} />
                                    <div className="flex-1 p-6 flex flex-col justify-between">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`text-[10px] font-mono uppercase tracking-widest font-bold px-2.5 py-1 rounded-md transition-all ${
                                                isFlipped ? "text-[#c2185b] bg-[#c2185b]/10" : "text-[#999] bg-[#faf9f7]"
                                            }`}>
                                                {isFlipped ? "Answer" : "Question"}
                                            </span>
                                            <span className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-mono font-bold transition-all ${
                                                isFlipped ? "text-white" : "text-[#6b6b6b] bg-[#faf9f7]"
                                            }`} style={isFlipped ? { background: "#1a1a2e" } : undefined}>
                                                {idx + 1}
                                            </span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-2">
                                            <LatexBlock
                                                text={isFlipped ? back : front}
                                                className={`text-[15px] font-medium leading-relaxed text-center ${
                                                    isFlipped ? "text-[#1a1a1a]" : "text-[#3a3a3a]"
                                                }`}
                                            />
                                            {isFlipped && formula && (
                                                <div className="mt-2 px-3 py-1.5 rounded-lg bg-white border border-[#eaeae8]">
                                                    <LatexRenderer text={formula} className="text-[14px] text-[#1a1a1a] font-medium" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-center mt-3">
                                            <span className="text-[9px] font-mono text-[#ccc]">
                                                tap to {isFlipped ? "see question" : "reveal answer"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            ) : typeof data === "object" ? (
                <div className="bg-white rounded-2xl border border-[#eaeaec] p-7">
                    <pre className="whitespace-pre-wrap text-[13px] text-[#3a3a3a] bg-[#faf9f7] p-5 rounded-xl border border-[#eaeae8] font-mono">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            ) : (
                <p className="text-[#3a3a3a]">{String(data)}</p>
            )}
        </div>
    )
}
