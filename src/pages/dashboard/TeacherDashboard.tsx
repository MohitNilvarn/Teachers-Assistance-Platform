import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    BookOpen, Users, Loader2, AlertCircle,
    GraduationCap, FileText, Layers, Mic, Sparkles,
    TrendingUp, ArrowUpRight,
    CheckCircle2, Clock, Zap, Radio,
} from "lucide-react"
import { Button } from "../../components/ui/Button"
import { api } from "../../lib/api"
import type { TeacherDashboardData, Subject } from "../../types"

const STATUS_COLOR: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    pending: "bg-[#F0ECFA] text-[#7C5CFC]",
    transcribing: "bg-amber-50 text-amber-600 border border-amber-200",
    generating: "bg-[#F0ECFA] text-[#7C5CFC] border border-[#D8CEF0]",
    failed: "bg-red-50 text-red-600 border border-red-200",
    not_started: "bg-[#F5F0FF] text-[#B8A9D4]",
}

const FADE_UP = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 },
}

const STAGGER = {
    animate: { transition: { staggerChildren: 0.06 } },
}

export default function TeacherDashboard() {
    const [data, setData] = useState<TeacherDashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    // Subject selection state
    const [yearPick, setYearPick] = useState("")
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [subjectPick, setSubjectPick] = useState("")
    const [selecting, setSelecting] = useState(false)

    const fetchDashboard = async () => {
        try {
            setLoading(true)
            const result = await api.teacherDashboard()
            setData(result)
        } catch (err: any) {
            setError(err.message || "Failed to load dashboard")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDashboard()
    }, [])

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
        } catch (err: any) {
            setError(err.message || "Failed to select subject")
        } finally {
            setSelecting(false)
        }
    }

    // -- Loading state --
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-[#F0ECFA] flex items-center justify-center">
                            <Loader2 className="h-7 w-7 animate-spin text-[#9B8BB8]" />
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-[#5B4A82]">Loading dashboard</p>
                        <p className="text-xs text-[#B8A9D4] mt-0.5">Fetching your course data...</p>
                    </div>
                </div>
            </div>
        )
    }

    // -- Onboarding: no subject yet --
    if (data && !data.has_subject) {
        return (
            <div className="max-w-xl mx-auto mt-12 space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                >
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-[#2D1B69] flex items-center justify-center mb-6 shadow-xl shadow-[#7C5CFC]/20">
                        <GraduationCap className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#2D1B69]">Welcome to TAP</h1>
                    <p className="text-[#9B8BB8] mt-2 text-[15px] max-w-md mx-auto leading-relaxed">
                        Set up your subject to start recording lectures and generating AI-powered content for your students.
                    </p>
                </motion.div>

                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                    </motion.div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-lg shadow-[#7C5CFC]/15 overflow-hidden">
                        <div className="h-1 bg-[#7C5CFC]" />
                        <div className="p-7 space-y-5">
                            <div>
                                <label className="text-sm font-semibold text-[#5B4A82] mb-2 block">
                                    Academic Year
                                </label>
                                <select
                                    className="flex h-12 w-full rounded-xl border border-[#E0D8F0] bg-[#F0ECFA]/40 px-4 py-2 text-sm text-[#2D1B69] font-medium focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC] focus:bg-white transition-all"
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
                                    <label className="text-sm font-semibold text-[#5B4A82] mb-2 block">Subject</label>
                                    <select
                                        className="flex h-12 w-full rounded-xl border border-[#E0D8F0] bg-[#F0ECFA]/40 px-4 py-2 text-sm text-[#2D1B69] font-medium focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]/20 focus:border-[#7C5CFC] focus:bg-white transition-all"
                                        value={subjectPick}
                                        onChange={e => setSubjectPick(e.target.value)}
                                    >
                                        <option value="">Choose your subject</option>
                                        {subjects.map(s => (
                                            <option key={s.code} value={s.code}>
                                                {s.name} ({s.code}) — Sem {s.semester}
                                            </option>
                                        ))}
                                    </select>
                                </motion.div>
                            )}

                            <Button
                                onClick={handleSelectSubject}
                                className="w-full h-12 bg-[#7C5CFC] text-white hover:bg-[#6B4FDB] rounded-xl font-semibold shadow-lg shadow-[#7C5CFC]/15 transition-all duration-200"
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

                {/* Features Preview */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { icon: Mic, label: "Record", desc: "Live lectures" },
                            { icon: Zap, label: "Generate", desc: "AI content" },
                            { icon: Users, label: "Share", desc: "With students" },
                        ].map((f) => (
                            <div key={f.label} className="text-center p-4 rounded-2xl bg-[#F0ECFA]/50 border border-[#E0D8F0]">
                                <f.icon className="h-5 w-5 mx-auto text-[#9B8BB8] mb-2" />
                                <p className="text-xs font-bold text-[#5B4A82]">{f.label}</p>
                                <p className="text-[10px] text-[#B8A9D4] mt-0.5">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        )
    }

    // -- Dashboard with subject + units --
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
            {/* Welcome Banner */}
            <motion.div variants={FADE_UP}>
                <div className="relative overflow-hidden rounded-2xl bg-[#2D1B69] p-8 text-white shadow-xl shadow-[#7C5CFC]/15">
                    {/* Decorative */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
                    <div className="absolute top-6 right-12 w-16 h-16 border border-white/10 rounded-2xl rotate-12" />

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="space-y-2">
                            <p className="text-[#B8A9D4] text-sm font-medium">{greeting}</p>
                            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                                {course?.name}
                            </h1>
                            <div className="flex items-center gap-3 mt-3">
                                <span className="text-[12px] font-bold bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                                    {course?.subject_code}
                                </span>
                                <span className="text-sm text-[#B8A9D4]">
                                    {course?.year} · Semester {course?.semester}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <motion.div variants={FADE_UP}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={Users} label="Students" value={String(course?.enrolled_students || 0)} change="Enrolled" />
                    <StatCard icon={Mic} label="Lectures" value={String(totalLectures)} change="Total" />
                    <StatCard icon={CheckCircle2} label="Generated" value={String(completedLectures)} change={`${progressPercent}% done`} />
                    <StatCard icon={Clock} label="Pending" value={String(pendingLectures)} change="To process" />
                </div>
            </motion.div>

            {error && (
                <motion.div variants={FADE_UP} className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError("")} className="text-xs font-semibold underline flex-shrink-0">Dismiss</button>
                </motion.div>
            )}

            {/* Course Progress Overview */}
            {totalLectures > 0 && (
                <motion.div variants={FADE_UP}>
                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#F0ECFA] flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-[#5B4A82]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#2D1B69]">Content Generation Progress</h3>
                                    <p className="text-[12px] text-[#B8A9D4]">AI content status across all units</p>
                                </div>
                            </div>
                            <span className="text-2xl font-extrabold text-[#5B4A82] tabular-nums">{progressPercent}%</span>
                        </div>
                        <div className="h-2.5 bg-[#F0ECFA] rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                                className="h-full bg-[#7C5CFC] rounded-full"
                            />
                        </div>
                        <div className="flex items-center justify-between mt-3">
                            <span className="text-[11px] text-[#B8A9D4]">{completedLectures} of {totalLectures} lectures generated</span>
                            <div className="flex items-center gap-4 text-[11px]">
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#7C5CFC]" />Generated</span>
                                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E0D8F0]" />Remaining</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Units Section */}
            <motion.div variants={FADE_UP}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-8 rounded-full bg-[#7C5CFC]" />
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight text-[#2D1B69]">Course Units</h2>
                            <p className="text-sm text-[#B8A9D4] mt-0.5">{course?.units.length || 0} units in this course</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {course?.units.map((unit, idx) => {
                        const completedCount = unit.lectures.filter(l => l.generation_status === "completed").length
                        const unitProgress = unit.lecture_count > 0 ? Math.round((completedCount / unit.lecture_count) * 100) : 0

                        return (
                            <motion.div
                                key={unit.number}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.06 }}
                            >
                                <Link to={`/dashboard/course/${course.course_id}/unit/${unit.number}`} className="block group">
                                    <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm hover:shadow-xl hover:border-[#D8CEF0] transition-all duration-300 overflow-hidden">
                                        <div className="h-1 bg-[#7C5CFC]" />

                                        <div className="p-5">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="w-11 h-11 rounded-xl bg-[#7C5CFC] flex items-center justify-center text-white font-bold text-base shadow-lg shadow-[#7C5CFC]/15 group-hover:scale-105 transition-transform duration-300">
                                                    {unit.number}
                                                </div>
                                                <ArrowUpRight className="h-4 w-4 text-[#C4B8E0] group-hover:text-[#9B8BB8] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                                            </div>

                                            <h3 className="text-[15px] font-bold text-[#2D1B69] mb-3 group-hover:text-[#3D2B7A] transition-colors line-clamp-2 leading-snug">
                                                {unit.title}
                                            </h3>

                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="text-[12px] text-[#9B8BB8] flex items-center gap-1.5 bg-[#F0ECFA]/40 px-2 py-1 rounded-md">
                                                    <Mic className="h-3 w-3" />
                                                    {unit.lecture_count} lecture{unit.lecture_count !== 1 ? "s" : ""}
                                                </span>
                                                {completedCount > 0 && (
                                                    <span className="text-[12px] text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {completedCount} ready
                                                    </span>
                                                )}
                                            </div>

                                            {/* Progress bar */}
                                            {unit.lecture_count > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between text-[10px] font-semibold text-[#B8A9D4] mb-1.5">
                                                        <span>Progress</span>
                                                        <span className="tabular-nums text-[#5B4A82]">{unitProgress}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-[#F0ECFA] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-[#7C5CFC] rounded-full transition-all duration-700 ease-out"
                                                            style={{ width: `${unitProgress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Recent lectures preview */}
                                            {unit.lectures.length > 0 ? (
                                                <div className="space-y-1.5 pt-4 mt-4 border-t border-[#E0D8F0]">
                                                    {unit.lectures.slice(0, 2).map(lec => (
                                                        <div key={lec.id} className="flex items-center justify-between text-[12px] py-1">
                                                            <span className="truncate text-[#6B5B8D] font-medium max-w-[45%]">{lec.title}</span>
                                                            <div className="flex gap-1.5">
                                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${STATUS_COLOR[lec.transcription_status]}`}>
                                                                    {lec.transcription_status === "completed" ? "Transcribed" : lec.transcription_status}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${STATUS_COLOR[lec.generation_status]}`}>
                                                                    {lec.generation_status === "completed" ? "Generated" : lec.generation_status.replace("_", " ")}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {unit.lectures.length > 2 && (
                                                        <p className="text-[10px] text-[#B8A9D4] font-medium">+{unit.lectures.length - 2} more</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-[12px] text-[#B8A9D4] pt-4 mt-4 border-t border-[#E0D8F0]">
                                                    <Radio className="h-3 w-3" />
                                                    No lectures yet — click to add
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

            {/* Quick Actions */}
            <motion.div variants={FADE_UP}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 rounded-full bg-[#7C5CFC]" />
                    <div>
                        <h2 className="text-2xl font-extrabold tracking-tight text-[#2D1B69]">Quick Actions</h2>
                        <p className="text-sm text-[#B8A9D4] mt-0.5">Generate content for your students</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { icon: FileText, title: "Generate Notes", desc: "AI-powered lecture summaries" },
                        { icon: BookOpen, title: "Create Assignments", desc: "Auto-generate question sets" },
                        { icon: Layers, title: "Build Flashcards", desc: "Smart review decks" },
                    ].map((action) => (
                            <motion.div key={action.title} whileHover={{ y: -2 }} className="cursor-pointer group">
                                <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm hover:shadow-lg hover:border-[#D8CEF0] transition-all duration-300 overflow-hidden">
                                    <div className="p-5 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-[#F0ECFA] group-hover:bg-[#7C5CFC] flex items-center justify-center transition-all duration-300 flex-shrink-0">
                                            <action.icon className="h-6 w-6 text-[#5B4A82] group-hover:text-white transition-colors duration-300" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold text-[#2D1B69] text-sm block">{action.title}</span>
                                            <span className="text-[12px] text-[#B8A9D4] mt-0.5 block">{action.desc}</span>
                                        </div>
                                        <ArrowUpRight className="h-4 w-4 text-[#C4B8E0] group-hover:text-[#2D1B69] transition-colors flex-shrink-0" />
                                    </div>
                                </div>
                            </motion.div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    )
}

// -- Stat Card Component --
function StatCard({ icon: Icon, label, value, change }: {
    icon: typeof Users; label: string; value: string; change: string
}) {
    return (
        <div className="bg-white rounded-2xl border border-[#E0D8F0] shadow-sm p-5 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#F0ECFA] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[#9B8BB8]" />
                </div>
            </div>
            <p className="text-2xl font-extrabold text-[#2D1B69] tabular-nums">{value}</p>
            <p className="text-[12px] text-[#9B8BB8] font-medium mt-0.5">{label}</p>
            <p className="text-[11px] text-[#B8A9D4] mt-1">{change}</p>
        </div>
    )
}
