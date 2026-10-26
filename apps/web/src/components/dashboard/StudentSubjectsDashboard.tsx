import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    GraduationCap, Loader2, BookOpen, ArrowRight,
} from "lucide-react"
import { api } from "../../lib/api"
import type { Course, Subject } from "../../types"

interface Props {
    year: string
}

export default function StudentSubjectsDashboard({ year }: Props) {
    const [courses, setCourses] = useState<Course[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                // Auto-enroll triggers course auto-creation for all catalog subjects
                await api.autoEnrollByYear().catch(() => {})

                // Fetch catalog to know valid subject codes
                const [subjects, coursesData] = await Promise.all([
                    api.getSubjects(year).catch(() => [] as Subject[]),
                    api.getCoursesByYear(year)
                        .catch(() => api.getCourses().then(d => ({
                            courses: d.courses.filter(c => c.year === year),
                            total: 0,
                        })))
                        .catch(() => ({ courses: [] as Course[], total: 0 })),
                ])

                // Only show courses that match catalog subject codes
                const catalogCodes = new Set(subjects.map(s => s.code))
                const filtered = coursesData.courses.filter(
                    c => c.subject_code && catalogCodes.has(c.subject_code)
                )

                // Sort by subject code to keep catalog order
                const codeOrder = subjects.map(s => s.code)
                filtered.sort((a, b) => {
                    const ai = codeOrder.indexOf(a.subject_code || "")
                    const bi = codeOrder.indexOf(b.subject_code || "")
                    return ai - bi
                })

                setCourses(filtered)
            } catch { /* noop */ } finally {
                setLoading(false)
            }
        }
        load()
    }, [year])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-[#1a1a2e]" />
                    <p className="text-sm text-[#86868b] font-medium">Loading subjects...</p>
                </div>
            </div>
        )
    }

    if (courses.length === 0) {
        return (
            <div className="text-center py-14">
                <div className="w-14 h-14 mx-auto rounded-xl bg-[#f5f5f7] flex items-center justify-center mb-3">
                    <GraduationCap className="h-7 w-7 text-[#71717a]" />
                </div>
                <p className="font-semibold text-[#3f3f46]">No courses available yet</p>
                <p className="text-sm text-[#86868b] mt-1">Your teachers haven't created courses for {year} yet.</p>
            </div>
        )
    }

    // Group by semester
    const bySemester = courses.reduce<Record<string, Course[]>>((acc, c) => {
        const sem = c.semester || "1"
        if (!acc[sem]) acc[sem] = []
        acc[sem].push(c)
        return acc
    }, {})

    const semesterKeys = Object.keys(bySemester).sort()

    return (
        <div className="space-y-8">
            {semesterKeys.map((sem, semIdx) => (
                <motion.div
                    key={sem}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: semIdx * 0.08 }}
                >
                    {/* Semester Header */}
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-1 h-6 rounded-full bg-[#1a1a2e]" />
                        <h3 className="text-lg font-bold tracking-tight text-[#18181b]">
                            Semester {sem}
                        </h3>
                        <span className="text-[11px] font-medium bg-[#f5f5f7] text-[#1a1a2e] px-2 py-0.5 rounded-md">
                            {bySemester[sem].length}
                        </span>
                    </div>

                    {/* Subject Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {bySemester[sem].map((course, idx) => {
                            const totalUnits = course.units.length

                            return (
                                <motion.div
                                    key={course.id}
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: (semIdx * 0.08) + (idx * 0.05) }}
                                >
                                    <Link
                                        to={`/dashboard/subject/${course.id}`}
                                        className="block group"
                                    >
                                        <div className="bg-white rounded-xl border border-[#e5e5ea] hover:border-[#d2d2d7] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                            {/* Top Accent */}
                                            <div className="h-1 bg-[#1a1a2e]" />

                                            <div className="p-5">
                                                {/* Icon + Code */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="w-10 h-10 rounded-lg bg-[#1a1a2e] flex items-center justify-center group-hover:bg-[#2a2a4e] transition-colors shadow-sm shadow-[#1a1a2e]/15">
                                                        <GraduationCap className="w-5 h-5 text-white" />
                                                    </div>
                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#f5f5f7] text-[#1a1a2e] border border-[#d2d2d7]">
                                                        {course.subject_code || course.code}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h4 className="text-[15px] font-semibold text-[#18181b] mb-2 group-hover:text-[#3f3f46] transition-colors line-clamp-2 leading-snug">
                                                    {course.name}
                                                </h4>

                                                {/* Stats */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className="flex items-center gap-1.5 text-[12px] text-[#71717a]">
                                                        <BookOpen className="h-3.5 w-3.5" />
                                                        {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
                                                    </span>
                                                </div>

                                                {/* Unit Pills */}
                                                <div className="flex flex-wrap gap-1 mb-4">
                                                    {course.units.slice(0, 3).map((unit) => (
                                                        <span
                                                            key={unit.number}
                                                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#f5f5f7]/50 text-[#1a1a2e] border border-[#e5e5ea]"
                                                        >
                                                            U{unit.number}: {unit.title.length > 16 ? unit.title.slice(0, 16) + "..." : unit.title}
                                                        </span>
                                                    ))}
                                                    {course.units.length > 3 && (
                                                        <span className="text-[10px] font-medium text-[#86868b] px-1.5 py-0.5">
                                                            +{course.units.length - 3}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* CTA */}
                                                <div className="flex items-center justify-between pt-3 border-t border-[#E8E0F5]">
                                                    <span className="text-[13px] font-medium text-[#71717a] group-hover:text-[#3f3f46] transition-colors">
                                                        View Units
                                                    </span>
                                                    <div className="w-7 h-7 rounded-md bg-[#f5f5f7] flex items-center justify-center group-hover:bg-[#1a1a2e] transition-all duration-200">
                                                        <ArrowRight className="h-3.5 w-3.5 text-[#71717a] group-hover:text-white transition-colors" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            )
                        })}
                    </div>
                </motion.div>
            ))}
        </div>
    )
}
