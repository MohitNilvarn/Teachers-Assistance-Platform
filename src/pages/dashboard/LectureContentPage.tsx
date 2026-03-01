import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    ArrowLeft, FileText, BookOpen, Layers, Loader2, AlertCircle, CheckCircle2,
    PenLine, Lightbulb, Target, Hash, Star, ChevronRight, Sigma,
    Calculator, GitBranch,
} from "lucide-react"
import { api } from "../../lib/api"
import type { GeneratedContent } from "../../types"
import { LatexRenderer, LatexBlock } from "../../components/ui/LatexRenderer"

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

                // Try to get lecture details for title
                try {
                    const lec = await api.getLecture(lectureId!)
                    setLectureTitle(lec.title)
                } catch { /* ignore */ }
            } catch (err: any) {
                setError(err.message || "Failed to load content")
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
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-[#B8A9D4]" />
                    <p className="text-sm text-[#B8A9D4] font-medium">Loading content...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative rounded-2xl bg-[#2D1B69] p-6 overflow-hidden shadow-lg shadow-[#7C5CFC]/15">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />

                <div className="relative z-10">
                    <Link
                        to={`/dashboard/course/${courseId}/unit/${unitNumber}`}
                        className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Unit
                    </Link>

                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 flex-shrink-0">
                            <FileText className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold tracking-tight text-white">
                                {lectureTitle || "Lecture Content"}
                            </h1>
                            <p className="text-sm text-[#B8A9D4] mt-1">
                                Notes, assignments, and flashcards
                            </p>
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

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-[#F0ECFA]/50 p-1 rounded-lg w-fit border border-[#D8CEF0]">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                                isActive
                                    ? "bg-[#7C5CFC] text-white shadow-sm shadow-[#7C5CFC]/15"
                                    : "text-[#B8A9D4] hover:text-[#7C5CFC]"
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                            {tab.data && (
                                <CheckCircle2 className={`h-3.5 w-3.5 ${isActive ? "text-white/60" : "text-[#C4B8E0]"}`} />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Content Area */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
            >
                {activeTab === "notes" && <NotesViewer content={notes} />}
                {activeTab === "assignment" && <AssignmentViewer content={assignment} />}
                {activeTab === "flashcards" && <FlashcardsViewer content={flashcards} />}
            </motion.div>
        </div>
    )
}

// Section theme
const SECTION_THEME = {
    accent: "bg-[#7C5CFC]",
    bg: "bg-[#F0ECFA]/50",
    text: "text-[#5B4A82]",
    badge: "bg-[#7C5CFC] text-white",
    border: "border-[#D8CEF0]",
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Notes Viewer Ã¢â€â‚¬Ã¢â€â‚¬
function NotesViewer({ content }: { content: GeneratedContent | null }) {
    if (!content) {
        return (
            <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-xl bg-[#E8E0F5] flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-[#B8A9D4]" />
                    </div>
                    <p className="font-semibold text-[#5B4A82] text-lg">No notes generated yet</p>
                    <p className="text-sm text-[#B8A9D4] mt-1">Notes will appear here once the teacher generates them.</p>
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
    const diagramDescription = data?.summary_diagram_description || ""

    return (
        <div className="space-y-6">
            {/* Title & Summary Card */}
            <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                <div className="h-1 bg-[#7C5CFC]" />
                <div className="p-6 md:p-8">
                    <h2 className="text-2xl font-bold text-[#2D1B69] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#7C5CFC] flex items-center justify-center flex-shrink-0">
                            <FileText className="h-5 w-5 text-white" />
                        </div>
                        {title}
                    </h2>

                    {summary && (
                        <div className="mt-4 p-4 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B8A9D4] mb-1.5">Summary</p>
                            <LatexBlock text={summary} className="text-[#5B4A82] leading-relaxed text-[15px]" />
                        </div>
                    )}

                    {overview && (
                        <div className="mt-4 p-4 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-1.5">Overview</p>
                            <LatexBlock text={overview} className="text-[#5B4A82] leading-relaxed text-[15px]" />
                        </div>
                    )}
                </div>
            </div>

            {/* Sections */}
            {Array.isArray(sections) && sections.length > 0 && sections.map((section: any, idx: number) => {
                const theme = SECTION_THEME
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
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden"
                    >
                        <div className={`h-1.5 ${theme.accent}`} />
                        <div className="p-6">
                            {/* Section Header */}
                            {(section.title || section.heading) && (
                                <div className="flex items-center gap-3 mb-4">
                                    <span className={`w-8 h-8 rounded-lg ${theme.badge} flex items-center justify-center text-sm font-bold flex-shrink-0`}>
                                        {idx + 1}
                                    </span>
                                    <h3 className="text-lg font-bold text-[#2D1B69]">
                                        {section.title || section.heading}
                                    </h3>
                                </div>
                            )}

                            {/* Main Content — LaTeX aware */}
                            {sectionContent && (
                                <LatexBlock
                                    text={sectionContent}
                                    className="text-[#5B4A82] leading-relaxed text-[15px] mb-4"
                                />
                            )}

                            {/* Subsections */}
                            {Array.isArray(subsections) && subsections.length > 0 && (
                                <div className="space-y-3 mb-4">
                                    {subsections.map((sub: any, sIdx: number) => (
                                        <div key={sIdx} className={`pl-4 border-l-2 ${theme.border}`}>
                                            {sub.subheading && (
                                                <h4 className={`font-semibold ${theme.text} text-sm mb-1`}>{sub.subheading}</h4>
                                            )}
                                            {sub.explanation && (
                                                <LatexBlock text={sub.explanation} className="text-[#6B5B8D] text-sm leading-relaxed" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Formulas */}
                            {Array.isArray(formulas) && formulas.length > 0 && (
                                <div className={`mt-4 p-4 rounded-xl bg-[#F0ECFA]/60 border ${theme.border}`}>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.text} mb-3 flex items-center gap-1.5`}>
                                        <Sigma className="h-3.5 w-3.5" /> Key Formulas
                                    </p>
                                    <div className="space-y-3">
                                        {formulas.map((f: any, fIdx: number) => (
                                            <div key={fIdx} className="bg-white rounded-lg p-3 border border-[#E0D8F0] shadow-sm">
                                                <p className="text-xs font-semibold text-[#3D2B7A] mb-1">{f.name}</p>
                                                <LatexBlock text={f.expression} className="text-[#2D1B69] text-sm my-1" />
                                                {f.description && (
                                                    <LatexRenderer text={f.description} className="text-xs text-[#9B8BB8] mt-1 leading-relaxed" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Derivations */}
                            {Array.isArray(derivations) && derivations.length > 0 && (
                                <div className="mt-4 p-4 rounded-xl bg-[#F5F0FF] border border-[#E0D8F0]">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-3 flex items-center gap-1.5">
                                        <GitBranch className="h-3.5 w-3.5" /> Derivations
                                    </p>
                                    {derivations.map((d: any, dIdx: number) => (
                                        <div key={dIdx} className="mb-4 last:mb-0">
                                            {d.title && <p className="text-sm font-semibold text-[#3D2B7A] mb-2">{d.title}</p>}
                                            {Array.isArray(d.steps) && (
                                                <div className="space-y-2 pl-3 border-l-2 border-[#C4B8E0]">
                                                    {d.steps.map((step: string, sIdx: number) => (
                                                        <div key={sIdx} className="flex items-start gap-2">
                                                            <span className="w-5 h-5 rounded-md bg-[#E8E0F5] text-[#5B4A82] flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{sIdx + 1}</span>
                                                            <LatexBlock text={step} className="text-sm text-[#5B4A82] leading-relaxed" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {d.result && (
                                                <div className="mt-2 p-2 rounded-lg bg-[#F0ECFA] border border-[#D8CEF0]">
                                                    <p className="text-[10px] font-bold text-[#7C5CFC] mb-0.5">Result:</p>
                                                    <LatexBlock text={d.result} className="text-sm text-[#2D1B69] font-medium" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Numerical Examples */}
                            {Array.isArray(numericalExamples) && numericalExamples.length > 0 && (
                                <div className="mt-4 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/60">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-3 flex items-center gap-1.5">
                                        <Calculator className="h-3.5 w-3.5" /> Worked Examples
                                    </p>
                                    {numericalExamples.map((ex: any, eIdx: number) => (
                                        <div key={eIdx} className="mb-4 last:mb-0 bg-white rounded-lg p-3 border border-emerald-100 shadow-sm">
                                            {ex.problem && (
                                                <LatexBlock text={ex.problem} className="text-sm text-[#3D2B7A] font-medium mb-2" />
                                            )}
                                            {Array.isArray(ex.solution_steps) && (
                                                <div className="space-y-1.5 pl-3 border-l-2 border-emerald-300">
                                                    {ex.solution_steps.map((step: string, sIdx: number) => (
                                                        <div key={sIdx} className="flex items-start gap-2">
                                                            <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{sIdx + 1}</span>
                                                            <LatexBlock text={step} className="text-sm text-[#5B4A82]" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {ex.answer && (
                                                <div className="mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                                                    <p className="text-[10px] font-bold text-emerald-700 mb-0.5">Answer:</p>
                                                    <LatexRenderer text={ex.answer} className="text-sm text-[#2D1B69] font-semibold" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Key Points */}
                            {Array.isArray(keyPoints) && keyPoints.length > 0 && (
                                <div className={`mt-4 p-4 rounded-xl ${theme.bg} border ${theme.border}`}>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider ${theme.text} mb-2`}>Key Points</p>
                                    <ul className="space-y-1.5">
                                        {keyPoints.map((point: string, pIdx: number) => (
                                            <li key={pIdx} className="flex items-start gap-2 text-sm text-[#5B4A82]">
                                                <CheckCircle2 className={`h-4 w-4 ${theme.text} flex-shrink-0 mt-0.5`} />
                                                <LatexRenderer text={point} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Examples */}
                            {Array.isArray(examples) && examples.length > 0 && (
                                <div className="mt-4 p-4 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-2">Examples</p>
                                    <ul className="space-y-1.5">
                                        {examples.map((ex: string, eIdx: number) => (
                                            <li key={eIdx} className="flex items-start gap-2 text-sm text-[#5B4A82]">
                                                <Lightbulb className="h-4 w-4 text-[#9B8BB8] flex-shrink-0 mt-0.5" />
                                                <LatexRenderer text={ex} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Applications */}
                            {Array.isArray(applications) && applications.length > 0 && (
                                <div className="mt-4 p-4 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-2">Real-World Applications</p>
                                    <ul className="space-y-1.5">
                                        {applications.map((app: string, aIdx: number) => (
                                            <li key={aIdx} className="flex items-start gap-2 text-sm text-[#5B4A82]">
                                                <Target className="h-4 w-4 text-[#9B8BB8] flex-shrink-0 mt-0.5" />
                                                <LatexRenderer text={app} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )
            })}

            {/* Key Takeaways */}
            {Array.isArray(keyTakeaways) && keyTakeaways.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-[#3D2B7A]" />
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-[#2D1B69] flex items-center gap-2 mb-4">
                            <Star className="h-5 w-5 text-[#6B5B8D]" />
                            Key Takeaways
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {keyTakeaways.map((takeaway: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                                    <span className="w-6 h-6 rounded-lg bg-[#7C5CFC] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {idx + 1}
                                    </span>
                                    <LatexRenderer text={takeaway} className="text-sm text-[#5B4A82] leading-relaxed" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Important Formulas (NEW — engineering) */}
            {Array.isArray(importantFormulas) && importantFormulas.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-[#3D2B7A]" />
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-[#2D1B69] flex items-center gap-2 mb-4">
                            <Sigma className="h-5 w-5 text-[#7C5CFC]" />
                            Important Formulas
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {importantFormulas.map((f: any, idx: number) => (
                                <div key={idx} className="p-4 rounded-xl bg-[#F0ECFA]/60 border border-[#D8CEF0] shadow-sm">
                                    <p className="text-xs font-bold text-[#5B4A82] mb-1.5">{f.name}</p>
                                    <LatexBlock text={f.expression} className="text-[#2D1B69] my-2" />
                                    {f.conditions && (
                                        <LatexRenderer text={f.conditions} className="text-xs text-[#9B8BB8] leading-relaxed" />
                                    )}
                                    {f.units && (
                                        <p className="text-[10px] text-[#B8A9D4] mt-1 font-medium">Units: {f.units}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Important Concepts */}
            {Array.isArray(importantConcepts) && importantConcepts.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-[#3D2B7A]" />
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-[#2D1B69] flex items-center gap-2 mb-4">
                            <Lightbulb className="h-5 w-5 text-[#6B5B8D]" />
                            Important Concepts
                        </h3>
                        <div className="space-y-3">
                            {importantConcepts.map((c: any, idx: number) => (
                                <div key={idx} className="p-4 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                                    <h4 className="font-semibold text-[#3D2B7A] text-sm">{c.concept}</h4>
                                    {c.explanation && <LatexBlock text={c.explanation} className="text-sm text-[#6B5B8D] mt-1 leading-relaxed" />}
                                    {Array.isArray(c.related_topics) && c.related_topics.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {c.related_topics.map((rt: string, rIdx: number) => (
                                                <span key={rIdx} className="text-[10px] bg-[#E8E0F5] text-[#6B5B8D] px-2 py-0.5 rounded-md font-medium">
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

            {/* Vocabulary */}
            {Array.isArray(vocabulary) && vocabulary.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-[#3D2B7A]" />
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-[#2D1B69] flex items-center gap-2 mb-4">
                            <Hash className="h-5 w-5 text-[#6B5B8D]" />
                            Vocabulary
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {vocabulary.map((v: any, idx: number) => (
                                <div key={idx} className="p-3 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                                    <span className="font-semibold text-[#3D2B7A] text-sm">{v.term}</span>
                                    {v.definition && <LatexBlock text={v.definition} className="text-sm text-[#6B5B8D] mt-0.5 leading-relaxed" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Practice Questions */}
            {Array.isArray(practiceQuestions) && practiceQuestions.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-[#3D2B7A]" />
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-[#2D1B69] flex items-center gap-2 mb-4">
                            <PenLine className="h-5 w-5 text-[#6B5B8D]" />
                            Practice Questions
                        </h3>
                        <div className="space-y-2">
                            {practiceQuestions.map((q: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-[#F0ECFA]/40 border border-[#E0D8F0]">
                                    <span className="w-6 h-6 rounded-lg bg-[#7C5CFC] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {idx + 1}
                                    </span>
                                    <LatexRenderer text={q} className="text-sm text-[#5B4A82] leading-relaxed" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Further Reading */}
            {Array.isArray(furtherReading) && furtherReading.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="p-6">
                        <h3 className="text-sm font-bold text-[#9B8BB8] flex items-center gap-2 mb-3">
                            <BookOpen className="h-4 w-4" />
                            Further Reading
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {furtherReading.map((topic: string, idx: number) => (
                                <span key={idx} className="text-xs bg-[#E8E0F5] text-[#6B5B8D] px-3 py-1.5 rounded-lg font-medium border border-[#E0D8F0]">
                                    {topic}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Diagram Description */}
            {diagramDescription && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="p-6">
                        <h3 className="text-sm font-bold text-[#9B8BB8] flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4" />
                            Conceptual Diagram
                        </h3>
                        <p className="text-sm text-[#6B5B8D] leading-relaxed bg-[#F0ECFA]/40 p-4 rounded-xl border border-[#E0D8F0] italic">
                            {diagramDescription}
                        </p>
                    </div>
                </div>
            )}

            {/* Fallback for unknown data structures */}
            {(!Array.isArray(sections) || sections.length === 0) && !keyTakeaways.length && !vocabulary.length && typeof data === "object" && (
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                    <div className="p-6">
                        <pre className="whitespace-pre-wrap text-sm text-[#5B4A82] bg-[#F0ECFA]/40 p-4 rounded-xl border border-[#E0D8F0]">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Assignment Viewer (Subjective Questions) Ã¢â€â‚¬Ã¢â€â‚¬
function AssignmentViewer({ content }: { content: GeneratedContent | null }) {
    const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({})

    if (!content) {
        return (
            <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-[#F0ECFA]/40 flex items-center justify-center mb-4">
                        <BookOpen className="h-8 w-8 text-[#B8A9D4]" />
                    </div>
                    <p className="font-bold text-[#5B4A82] text-lg">No assignment generated yet</p>
                    <p className="text-sm text-[#B8A9D4] mt-1">Assignments will appear here once generated.</p>
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

    const DIFFICULTY_COLORS: Record<string, string> = {
        easy: "bg-emerald-50 text-emerald-700 border-emerald-200",
        medium: "bg-[#F0ECFA]/40 text-[#5B4A82] border-[#E0D8F0]",
        hard: "bg-[#7C5CFC] text-white border-[#7C5CFC]",
    }

    const TYPE_ICONS: Record<string, typeof PenLine> = {
        short_answer: PenLine,
        explain: Lightbulb,
        analytical: Target,
        long_answer: FileText,
        application: Star,
        numerical: Calculator,
        derivation: GitBranch,
    }

    const TYPE_COLORS: Record<string, string> = {
        short_answer: "bg-[#F0ECFA]/40 text-[#6B5B8D] border-[#E0D8F0]",
        explain: "bg-[#F0ECFA]/40 text-[#6B5B8D] border-[#E0D8F0]",
        analytical: "bg-[#F0ECFA]/40 text-[#6B5B8D] border-[#E0D8F0]",
        long_answer: "bg-[#F0ECFA]/40 text-[#6B5B8D] border-[#E0D8F0]",
        application: "bg-[#F0ECFA]/40 text-[#6B5B8D] border-[#E0D8F0]",
        numerical: "bg-emerald-50 text-emerald-700 border-emerald-200",
        derivation: "bg-blue-50 text-blue-700 border-blue-200",
    }

    return (
        <div className="space-y-5">
            {/* Assignment Header Card */}
            <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                <div className="h-1.5 bg-[#3D2B7A]" />
                <div className="p-6">
                    <h2 className="text-xl font-bold text-[#2D1B69] flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#7C5CFC] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#7C5CFC]/15">
                            <BookOpen className="h-5 w-5 text-white" />
                        </div>
                        {title}
                    </h2>
                    {description && (
                        <p className="text-sm text-[#6B5B8D] mt-3 leading-relaxed">{description}</p>
                    )}
                    {questions.length > 0 && (
                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-xs font-semibold text-[#6B5B8D] bg-[#F0ECFA]/40 px-3 py-1.5 rounded-lg border border-[#E0D8F0]">
                                {questions.length} question{questions.length !== 1 ? "s" : ""}
                            </span>
                            <button
                                onClick={() => {
                                    const allShown = questions.every((_: any, i: number) => showAnswers[i])
                                    const newState: Record<number, boolean> = {}
                                    questions.forEach((_: any, i: number) => { newState[i] = !allShown })
                                    setShowAnswers(newState)
                                }}
                                className="text-xs font-semibold text-[#6B5B8D] hover:text-[#5B4A82] hover:bg-[#F0ECFA]/30 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                {questions.every((_: any, i: number) => showAnswers[i]) ? "Hide All Answers" : "Show All Answers"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
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
                        const TypeIcon = TYPE_ICONS[qType] || PenLine

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="rounded-2xl border border-[#E0D8F0] bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                            >
                                {/* Accent bar */}
                                <div className="flex">
                                    <div className="w-1.5 bg-[#3D2B7A] rounded-l-2xl flex-shrink-0" />
                                    <div className="flex-1">
                                        {/* Question */}
                                        <div className="p-5">
                                            {/* Tags Row */}
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                <span className="text-xs font-bold text-white bg-[#7C5CFC] px-2.5 py-1 rounded-lg shadow-sm shadow-[#7C5CFC]/15">
                                                    Q{idx + 1}
                                                </span>
                                                {qType && (
                                                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1 ${TYPE_COLORS[qType] || "bg-[#F0ECFA]/40 text-[#6B5B8D] border-[#E0D8F0]"}`}>
                                                        <TypeIcon className="h-2.5 w-2.5" />
                                                        {qType.replace(/_/g, " ")}
                                                    </span>
                                                )}
                                                {difficulty && (
                                                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border ${DIFFICULTY_COLORS[difficulty.toLowerCase()] || "bg-[#F0ECFA]/40 text-[#6B5B8D] border-[#E0D8F0]"}`}>
                                                        {difficulty}
                                                    </span>
                                                )}
                                                {marks && (
                                                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[#F0ECFA]/40 text-[#6B5B8D] border border-[#E0D8F0] flex items-center gap-0.5">
                                                        <Hash className="h-2.5 w-2.5" />
                                                        {marks} marks
                                                    </span>
                                                )}
                                                {topic && (
                                                    <span className="text-[10px] font-medium text-[#9B8BB8] bg-[#F0ECFA]/40 px-2.5 py-1 rounded-lg border border-[#E0D8F0]">
                                                        {topic}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Question Text */}
                                            <LatexBlock
                                                text={q.question || q.text || q.prompt || (typeof q === "string" ? q : JSON.stringify(q))}
                                                className="text-[#2D1B69] font-medium leading-relaxed text-[15px]"
                                            />

                                            {/* Given Data (for numerical questions) */}
                                            {Array.isArray(givenData) && givenData.length > 0 && (
                                                <div className="mt-3 p-3 rounded-lg bg-[#F5F0FF] border border-[#E0D8F0]">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-1.5">Given</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {givenData.map((d: string, dIdx: number) => (
                                                            <LatexRenderer key={dIdx} text={d} className="text-sm text-[#5B4A82] bg-white px-2.5 py-1 rounded-md border border-[#E0D8F0]" />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Formula Required */}
                                            {formulaRequired && (
                                                <div className="mt-2 p-2 rounded-lg bg-[#F0ECFA]/60 border border-[#D8CEF0]">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#7C5CFC] mb-0.5">Formula</p>
                                                    <LatexBlock text={formulaRequired} className="text-sm text-[#3D2B7A]" />
                                                </div>
                                            )}

                                            {minWords && (
                                                <p className="text-[11px] text-[#B8A9D4] mt-2 italic">
                                                    Minimum {minWords} words expected
                                                </p>
                                            )}
                                        </div>

                                        {/* Answer Toggle */}
                                        {(expectedAnswer || keywords.length > 0 || rubric || solutionSteps.length > 0 || formulaRequired) && (
                                            <div className="border-t border-[#E0D8F0]">
                                                <button
                                                    onClick={() => toggleAnswer(idx)}
                                                    className={`w-full px-5 py-3 text-left text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                                        isAnswerShown
                                                            ? "text-[#5B4A82] bg-[#F0ECFA]/40"
                                                            : "text-[#6B5B8D] hover:bg-[#F0ECFA]/30/50"
                                                    }`}
                                                >
                                                    <Lightbulb className="h-3.5 w-3.5" />
                                                    {isAnswerShown ? "Hide Answer Guide" : "Show Answer Guide"}
                                                    <ChevronRight className={`h-3 w-3 ml-auto transition-transform duration-200 ${isAnswerShown ? "rotate-90" : ""}`} />
                                                </button>

                                                {isAnswerShown && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        className="px-5 pb-5 space-y-3"
                                                    >
                                                        {expectedAnswer && (
                                                            <div className="bg-[#F0ECFA]/40 rounded-xl p-4 border border-[#E0D8F0]">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-1.5">Expected Answer</p>
                                                                <LatexBlock text={expectedAnswer} className="text-sm text-[#3D2B7A] leading-relaxed" />
                                                            </div>
                                                        )}

                                                        {Array.isArray(keywords) && keywords.length > 0 && (
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-2">Key Terms</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {keywords.map((kw: string, kIdx: number) => (
                                                                        <span key={kIdx} className="text-xs bg-[#F0ECFA]/40 text-[#5B4A82] px-2.5 py-1 rounded-lg border border-[#E0D8F0] font-medium">
                                                                            {kw}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {Array.isArray(solutionSteps) && solutionSteps.length > 0 && (
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-2">Solution Steps</p>
                                                                <div className="space-y-2">
                                                                    {solutionSteps.map((step: string, sIdx: number) => (
                                                                        <div key={sIdx} className="flex items-start gap-2.5">
                                                                            <span className="w-5 h-5 rounded-md bg-[#E8E0F5] text-[#5B4A82] flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{sIdx + 1}</span>
                                                                            <LatexBlock text={step} className="text-sm text-[#5B4A82] leading-relaxed" />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {rubric && (
                                                            <div className="bg-[#F0ECFA]/40 rounded-xl p-4 border border-[#E0D8F0]">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B8BB8] mb-1.5">Marking Rubric</p>
                                                                <LatexBlock text={rubric} className="text-sm text-[#3D2B7A] leading-relaxed" />
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
                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm p-6">
                        <pre className="whitespace-pre-wrap text-sm text-[#5B4A82] bg-[#F0ECFA]/40 p-4 rounded-xl border border-[#E0D8F0]">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                ) : (
                    <p className="text-[#6B5B8D]">{String(data)}</p>
                )}
        </div>
    )
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Flashcards Viewer Ã¢â€â‚¬Ã¢â€â‚¬

function FlashcardsViewer({ content }: { content: GeneratedContent | null }) {
    const [flipped, setFlipped] = useState<Record<number, boolean>>({})

    if (!content) {
        return (
            <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden">
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-[#F0ECFA]/40 flex items-center justify-center mb-4">
                        <Layers className="h-8 w-8 text-[#B8A9D4]" />
                    </div>
                    <p className="font-bold text-[#5B4A82] text-lg">No flashcards generated yet</p>
                    <p className="text-sm text-[#B8A9D4] mt-1">Flashcards will appear here once generated.</p>
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
                <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E0D8F0] shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#7C5CFC] flex items-center justify-center shadow-md shadow-[#7C5CFC]/15">
                            <Layers className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <span className="text-sm font-bold text-[#2D1B69]">{cards.length} Flashcard{cards.length !== 1 ? "s" : ""}</span>
                            <p className="text-[11px] text-[#B8A9D4]">
                                {Object.values(flipped).filter(Boolean).length} of {cards.length} revealed
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                const allFlipped = cards.every((_: any, i: number) => flipped[i])
                                const newState: Record<number, boolean> = {}
                                cards.forEach((_: any, i: number) => { newState[i] = !allFlipped })
                                setFlipped(newState)
                            }}
                            className="text-xs font-semibold text-[#6B5B8D] hover:text-[#5B4A82] hover:bg-[#F0ECFA]/30 px-3 py-1.5 rounded-lg transition-colors border border-[#E0D8F0]"
                        >
                            {cards.every((_: any, i: number) => flipped[i]) ? "Hide All" : "Reveal All"}
                        </button>
                        <span className="text-[10px] text-[#B8A9D4] hidden sm:block">Click card to flip</span>
                    </div>
                </div>
            )}

            {Array.isArray(cards) && cards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {cards.map((card: any, idx: number) => {
                        const front = card.front || card.question || card.term || (typeof card === "string" ? card : "")
                        const back = card.back || card.answer || card.definition || ""
                        const formula = card.formula || ""
                        const isFlipped = flipped[idx] || false

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                onClick={() => toggleFlip(idx)}
                                className="cursor-pointer"
                                whileTap={{ scale: 0.97 }}
                                whileHover={{ y: -3 }}
                            >
                                <div className={`rounded-2xl border transition-all duration-300 min-h-[200px] flex flex-col overflow-hidden ${
                                    isFlipped
                                        ? "bg-[#F0ECFA]/30 border-[#E0D8F0] shadow-lg shadow-[#7C5CFC]/10"
                                        : "bg-white border-[#E0D8F0] shadow-sm hover:shadow-xl hover:border-[#E0D8F0]"
                                }`}>
                                    <div className={`h-1.5 transition-all duration-300 ${
                                        isFlipped
                                            ? "bg-[#7C5CFC]"
                                            : "bg-[#3D2B7A]"
                                    }`} />
                                    <div className="flex-1 p-6 flex flex-col justify-between">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md transition-all ${
                                                isFlipped
                                                    ? "text-[#5B4A82] bg-[#E0D8F0]"
                                                    : "text-[#B8A9D4] bg-[#F0ECFA]/40"
                                            }`}>
                                                {isFlipped ? "Ã¢Å“Â¦ Answer" : "Question"}
                                            </span>
                                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                                                isFlipped
                                                    ? "bg-[#7C5CFC] text-white shadow-[#7C5CFC]/15"
                                                    : "bg-[#F0ECFA] text-[#6B5B8D]"
                                            }`}>
                                                {idx + 1}
                                            </span>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center justify-center py-2 gap-2">
                                            <LatexBlock
                                                text={isFlipped ? back : front}
                                                className={`text-[15px] font-medium leading-relaxed text-center ${
                                                    isFlipped ? "text-[#2D1B69]" : "text-[#3D2B7A]"
                                                }`}
                                            />
                                            {/* Show formula badge on flipped side if present */}
                                            {isFlipped && formula && (
                                                <div className="mt-1 px-3 py-1.5 rounded-lg bg-[#F0ECFA] border border-[#D8CEF0]">
                                                    <LatexRenderer text={formula} className="text-sm text-[#3D2B7A] font-medium" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-center mt-3">
                                            <span className={`text-[9px] font-medium transition-all ${
                                                isFlipped ? "text-[#B8A9D4]" : "text-[#C4B8E0]"
                                            }`}>
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
                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm overflow-hidden p-6">
                    <pre className="whitespace-pre-wrap text-sm text-[#5B4A82] bg-[#F0ECFA]/40 p-4 rounded-xl border border-[#E0D8F0]">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            ) : (
                <p className="text-[#6B5B8D]">{String(data)}</p>
            )}
        </div>
    )
}
