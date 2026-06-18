import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    BookOpen, Users, Loader2, AlertCircle,
    GraduationCap, FileText, Layers, Mic, Sparkles,
    ArrowUpRight, CheckCircle2, Clock, Radio,
} from "lucide-react"
import { Button } from "../../components/ui/Button"
import { api } from "../../lib/api"
import type { TeacherDashboardData, Subject } from "../../types"

const FADE_UP = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
}

const STAGGER = {
    animate: { transition: { staggerChildren: 0.06 } },
}

export default function TeacherDashboard() {
    const [data, setData] = useState<TeacherDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [yearPick, setYearPick] = useState("")
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [subjectPick, setSubjectPick] = useState("")
    const [selecting, setSelecting] = useState(false)

    const fetchDashboard = async () => {
        try {
            setLoading(true)
            const result = await api.teacherDashboard()
            setData(result)
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Failed to load dashboard"
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchDashboard() }, [])

    useEffect(() => {
        if (yearPick) {
            api.getSubjects(yearPick).then(setSubjects).catch(() => setSubjects([]))
        }
    }, [yearPick])

    const handleSelectSubject = async () => {
        if (!subjectPick) return
        setSelecting(true)
        setError("")
        try {
            await api.teacherSelectSubject(subjectPick)
            await fetchDashboard()
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Failed to select subject"
            setError(message)
        } finally {
            setSelecting(false)
        }
    }

    // ── Loading ──
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-2xl blur-2xl opacity-20 bg-[#1a1a2e]" />
                        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center bg-[#1a1a2e]">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                    </div>
                    <p className="text-sm font-medium text-[#1a1a1a]">Loading dashboard</p>
                    <p className="text-xs text-[#999]">Fetching course data...</p>
                </div>
            </div>
        )
    }

    // ── Onboarding ──
    if (data && !data.has_subject) {
        return (
            <div className="max-w-xl mx-auto mt-12 space-y-8">
                <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                    <div className="relative mx-auto w-20 h-20 mb-6">
                        <div className="absolute inset-0 rounded-2xl blur-2xl opacity-30 bg-[#1a1a2e]" />
                        <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center bg-[#1a1a2e]">
                            <GraduationCap className="h-10 w-10 text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">Welcome to TAP</h1>
                    <p className="text-[#6b6b6b] mt-2 text-[15px] max-w-md mx-auto leading-relaxed">
                        Set up your subject to start recording lectures and generating AI-powered content.
                    </p>
                </motion.div>

                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                    </motion.div>
                )}

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <div className="bg-white rounded-2xl border border-[#eaeaec] shadow-sm overflow-hidden">
                        <div className="h-1 bg-[#1a1a2e]" />
                        <div className="p-7 space-y-5">
                            <div>
                                <label className="text-[13px] font-semibold text-[#1a1a1a] mb-2 block">Academic Year</label>
                                <select
                                    className="flex h-12 w-full rounded-xl border border-[#eaeae8] bg-[#faf9f7] px-4 py-2 text-sm text-[#1a1a1a] font-medium focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e] focus:bg-white transition-all"
                                    value={yearPick}
                                    onChange={e => { setYearPick(e.target.value); setSubjectPick("") }}
                                >
                                    <option value="">Select Year</option>
                                    <option value="FE">First Year (FE)</option>
                                    <option value="SE">Second Year (SE)</option>
                                    <option value="TE">Third Year (TE)</option>
                                    <option value="BE">Fourth Year (BE)</option>
                                </select>
                            </div>

                            {yearPick && subjects.length > 0 && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                                    <label className="text-[13px] font-semibold text-[#1a1a1a] mb-2 block">Subject</label>
                                    <select
                                        className="flex h-12 w-full rounded-xl border border-[#eaeae8] bg-[#faf9f7] px-4 py-2 text-sm text-[#1a1a1a] font-medium focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]/20 focus:border-[#1a1a2e] focus:bg-white transition-all"
                                        value={subjectPick}
                                        onChange={e => setSubjectPick(e.target.value)}
                                    >
                                        <option value="">Choose your subject</option>
                                        {subjects.map(s => (
                                            <option key={s.code} value={s.code}>
                                                {s.name} ({s.code}) · Sem {s.semester}
                                            </option>
                                        ))}
                                    </select>
                                </motion.div>
                            )}

                            <Button
                                onClick={handleSelectSubject}
                                className="w-full h-12 rounded-xl font-semibold shadow-md transition-all text-white border-0 bg-[#1a1a2e] hover:bg-[#2a2a4e]"
                                disabled={!subjectPick || selecting}
                            >
                                {selecting ? (
                                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Setting up...</>
                                ) : (
                                    <><Sparkles className="h-4 w-4 mr-2" />Start Teaching</>
                                )}
                            </Button>
                        </div>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { icon: Mic, label: "Record", desc: "Live lectures" },
                            { icon: Sparkles, label: "Generate", desc: "AI content" },
                            { icon: Users, label: "Share", desc: "With students" },
                        ].map((f, i) => (
                            <div key={f.label} className="text-center p-4 rounded-2xl bg-white border border-[#eaeaec]">
                                <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center bg-[#f0f0f5]">
                                    <f.icon className="h-5 w-5 text-[#6b6b6b]" />
                                </div>
                                <p className="text-xs font-semibold text-[#1a1a1a]">{f.label}</p>
                                <p className="text-[10px] text-[#999] mt-0.5">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        )
    }

    // ── Main Dashboard ──
    const course = data?.courses[0]
    const totalLectures = course?.units.reduce((sum, u) => sum + u.lecture_count, 0) || 0
    const completedLectures = course?.units.reduce(
        (sum, u) => sum + u.lectures.filter(l => l.generation_status === "completed").length, 0
    ) || 0
    const pendingLectures = totalLectures - completedLectures
    const progressPercent = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0

    const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }))
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

    return (
        <motion.div className="space-y-8" initial="initial" animate="animate" variants={STAGGER}>

            {/* ── Welcome Banner — Editorial Style ── */}
            <motion.div variants={FADE_UP}>
                <div className="relative overflow-hidden rounded-2xl text-white bg-[#0f0c1e]">

                    {/* Grid overlay */}
                    <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                         style={{
                             backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.1) 39px, rgba(255,255,255,0.1) 40px),
                                               repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.1) 39px, rgba(255,255,255,0.1) 40px)`,
                         }} />

                    {/* Subtle accent circle */}
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] rounded-full -translate-y-1/3 translate-x-1/3 pointer-events-none opacity-[0.06] bg-[#c2185b]" />

                    <div className="relative z-10 px-8 py-8">
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                            <div>
                                <span className="inline-flex items-center gap-2 text-[11px] font-mono text-white/40 tracking-widest uppercase mb-3">
                                    <span className="w-6 h-px bg-white/20" />
                                    {greeting}
                                </span>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{course?.name}</h1>
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <span className="text-[12px] font-mono font-medium bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 text-white/80">
                                        {course?.subject_code}
                                    </span>
                                    <span className="text-[12px] font-mono text-white/50 bg-white/[0.05] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                                        {course?.year} · Sem {course?.semester}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-white/40 text-[11px] font-mono">Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Stat Cards — Clean monochromatic ── */}
            <motion.div variants={FADE_UP}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { icon: Users, label: "Students", value: String(course?.enrolled_students || 0), sub: "Enrolled" },
                        { icon: Mic, label: "Lectures", value: String(totalLectures), sub: "Total" },
                        { icon: CheckCircle2, label: "Generated", value: String(completedLectures), sub: `${progressPercent}% done` },
                        { icon: Clock, label: "Pending", value: String(pendingLectures), sub: "To process" },
                    ].map(({ icon: Icon, label, value, sub }, i) => (
                        <motion.div key={label}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white rounded-2xl border border-[#eaeaec] p-5 group hover:shadow-md transition-all duration-300">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-[#f0f0f5]">
                                <Icon className="h-5 w-5 text-[#6b6b6b]" />
                            </div>
                            <p className="text-2xl font-bold text-[#1a1a1a] tabular-nums">{value}</p>
                            <p className="text-[13px] font-medium text-[#1a1a1a] mt-0.5">{label}</p>
                            <p className="text-[11px] text-[#999] font-mono mt-0.5">{sub}</p>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {error && (
                <motion.div variants={FADE_UP} className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="text-xs font-semibold underline">Dismiss</button>
                </motion.div>
            )}



            {/* ── Course Units ── */}
            <motion.div variants={FADE_UP}>
                <div className="flex items-center gap-3 mb-5">
                    <span className="inline-flex items-center gap-2 text-[11px] font-mono text-[#999] tracking-widest uppercase">
                        <span className="w-6 h-px bg-[#ddd]" />
                        Units
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {course?.units.map((unit, idx) => {
                        const completedCount = unit.lectures.filter(l => l.generation_status === "completed").length
                        const unitProgress = unit.lecture_count > 0 ? Math.round((completedCount / unit.lecture_count) * 100) : 0

                        return (
                            <motion.div key={unit.number}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}>
                                <Link to={`/dashboard/course/${course.course_id}/unit/${unit.number}`} className="block group">
                                    <div className="bg-white rounded-2xl border border-[#eaeaec] overflow-hidden hover:shadow-md transition-all duration-300">
                                        {/* Accent bar */}
                                        <div className="h-1 bg-[#1a1a2e]" />

                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-mono font-bold text-[14px] group-hover:scale-105 transition-transform bg-[#1a1a2e]">
                                                    {String(unit.number).padStart(2, "0")}
                                                </div>
                                                <ArrowUpRight className="h-4 w-4 text-[#ccc] group-hover:text-[#c2185b] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                            </div>

                                            <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-3 line-clamp-2 leading-snug tracking-tight">
                                                {unit.title}
                                            </h3>

                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-lg bg-[#faf9f7] text-[#6b6b6b] border border-[#eaeae8]">
                                                    {unit.lecture_count} lecture{unit.lecture_count !== 1 ? "s" : ""}
                                                </span>
                                                {completedCount > 0 && (
                                                    <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        {completedCount} ready
                                                    </span>
                                                )}
                                            </div>

                                            {unit.lecture_count > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                                                        <span className="text-[#999]">Progress</span>
                                                        <span className="font-bold text-[#6b6b6b]">{unitProgress}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-[#f5f5f3] rounded-full overflow-hidden">
                                                        <div
                                                             className="h-full rounded-full transition-all duration-700 bg-[#1a1a2e]"
                                                             style={{ width: `${unitProgress}%` }} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Lecture previews */}
                                            {unit.lectures.length > 0 ? (
                                                <div className="space-y-1.5 pt-4 mt-4 border-t border-[#f0f0f0]">
                                                    {unit.lectures.slice(0, 2).map(lec => (
                                                        <div key={lec.id} className="flex items-center justify-between text-[12px]">
                                                            <span className="truncate text-[#3a3a3a] font-medium max-w-[55%]">{lec.title}</span>
                                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold ${
                                                                lec.generation_status === "completed"
                                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                    : "bg-[#faf9f7] text-[#999] border border-[#eaeae8]"
                                                            }`}>
                                                                {lec.generation_status === "completed" ? "Done" : lec.generation_status.replace("_", " ")}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {unit.lectures.length > 2 && (
                                                        <p className="text-[10px] text-[#999] font-mono">+{unit.lectures.length - 2} more</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-[12px] text-[#999] pt-4 mt-4 border-t border-[#f0f0f0]">
                                                    <Radio className="h-3 w-3" />
                                                    No lectures yet
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        )
                    })}
                </div>
            </motion.div>

            {/* ── Quick Actions ── */}
            <motion.div variants={FADE_UP}>
                <div className="flex items-center gap-3 mb-5">
                    <span className="inline-flex items-center gap-2 text-[11px] font-mono text-[#999] tracking-widest uppercase">
                        <span className="w-6 h-px bg-[#ddd]" />
                        Quick Actions
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { icon: FileText, title: "Generate Notes", desc: "AI-powered lecture summaries" },
                        { icon: BookOpen, title: "Create Assignments", desc: "Auto-generate question sets" },
                        { icon: Layers, title: "Build Flashcards", desc: "Smart review decks" },
                    ].map((action) => (
                        <motion.div key={action.title} whileHover={{ y: -2 }} className="cursor-pointer group">
                            <div className="bg-white rounded-2xl border border-[#eaeaec] hover:shadow-md transition-all duration-300 overflow-hidden">
                                <div className="p-5 flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#f0f0f5]">
                                        <action.icon className="h-5 w-5 text-[#6b6b6b] group-hover:text-[#c2185b] transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-semibold text-[#1a1a1a] text-[14px] block">{action.title}</span>
                                        <span className="text-[12px] text-[#999] block">{action.desc}</span>
                                    </div>
                                    <ArrowUpRight className="h-4 w-4 text-[#ccc] group-hover:text-[#c2185b] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    )
}
