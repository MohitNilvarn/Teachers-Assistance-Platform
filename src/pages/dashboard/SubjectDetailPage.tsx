import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    ArrowLeft, GraduationCap,
    Loader2, AlertCircle, ArrowRight,
} from "lucide-react"
import { api } from "../../lib/api"
import type { Course } from "../../types"

const FADE_UP = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }
const STAGGER = { visible: { transition: { staggerChildren: 0.05 } } }

export default function SubjectDetailPage() {
    const { courseId } = useParams<{ courseId: string }>()
    const [course, setCourse] = useState<Course | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        if (!courseId) return
        async function load() {
            setLoading(true)
            try {
                const data = await api.getCourses()
                const found = data.courses.find(c => c.id === courseId)
                if (found) {
                    setCourse(found)
                } else {
                    setError("Course not found")
                }
            } catch (err: any) {
                setError(err.message || "Failed to load course")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [courseId])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-[#7C5CFC]" />
                    <p className="text-sm text-[#B8A9D4] font-medium">Loading subject...</p>
                </div>
            </div>
        )
    }

    if (!course) {
        return (
            <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 flex items-center justify-center mb-3 border border-red-100">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <p className="font-semibold text-[#5B4A82]">{error || "Subject not found"}</p>
                <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#9B8BB8] font-medium mt-3 hover:text-[#7C5CFC] transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
                </Link>
            </div>
        )
    }

    return (
        <motion.div initial="hidden" animate="visible" variants={STAGGER} className="space-y-6">
            {/* Hero Banner */}
            <motion.div variants={FADE_UP} className="relative rounded-2xl bg-[#2D1B69] p-6 overflow-hidden shadow-lg shadow-[#7C5CFC]/15">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.06] rounded-full -translate-y-1/2 translate-x-1/3" />

                <div className="relative z-10">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-4 transition-colors"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
                    </Link>

                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 flex-shrink-0">
                            <GraduationCap className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold tracking-tight text-white">
                                {course.name}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-[11px] font-semibold bg-white/10 text-white/80 px-2 py-0.5 rounded-md border border-white/10">
                                    {course.subject_code || course.code}
                                </span>
                                {course.semester && (
                                    <span className="text-[11px] text-white/70">
                                        Semester {course.semester}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-5 mt-5 pt-4 border-t border-white/15">
                        <div>
                            <p className="text-xl font-bold text-white">{course.units.length}</p>
                            <p className="text-[11px] text-white/70">Units</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Section Header */}
            <motion.div variants={FADE_UP} className="flex items-center gap-2.5">
                <div className="w-1 h-6 rounded-full bg-[#7C5CFC]" />
                <h2 className="text-lg font-bold tracking-tight text-[#2D1B69]">Course Units</h2>
                <span className="text-[11px] font-medium bg-[#F0ECFA] text-[#7C5CFC] px-2 py-0.5 rounded-md">
                    {course.units.length}
                </span>
            </motion.div>

            {/* Units - Direct navigation, no accordion */}
            <div className="grid grid-cols-1 gap-3">
                {course.units.map((unit) => (
                    <motion.div key={unit.number} variants={FADE_UP}>
                        <Link
                            to={`/dashboard/course/${courseId}/unit/${unit.number}`}
                            className="block group"
                        >
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-[#E0D8F0] hover:border-[#D8CEF0] shadow-sm hover:shadow-md transition-all duration-200">
                                {/* Unit Number */}
                                <div className="w-11 h-11 rounded-lg bg-[#7C5CFC] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 group-hover:bg-[#6B4FDB] transition-colors shadow-sm shadow-[#7C5CFC]/15">
                                    {unit.number}
                                </div>

                                {/* Unit Title */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[15px] font-semibold text-[#2D1B69] group-hover:text-[#5B4A82] transition-colors truncate">
                                        {unit.title}
                                    </h3>
                                    <p className="text-[12px] text-[#B8A9D4] mt-0.5">
                                        Unit {unit.number}
                                    </p>
                                </div>

                                {/* Arrow */}
                                <div className="w-8 h-8 rounded-md bg-[#F0ECFA] flex items-center justify-center group-hover:bg-[#7C5CFC] transition-all duration-200 flex-shrink-0">
                                    <ArrowRight className="h-4 w-4 text-[#9B8BB8] group-hover:text-white transition-colors" />
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}
