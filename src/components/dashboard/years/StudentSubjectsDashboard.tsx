import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
    GraduationCap, Loader2, BookOpen, ArrowRight,
} from "lucide-react"
import { api } from "../../../lib/api"
import type { Course } from "../../../types"

interface Props {
    year: string
}

export default function StudentSubjectsDashboard({ year }: Props) {
    const [courses, setCourses] = useState<Course[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                await api.autoEnrollByYear().catch(() => {})
                const data = await api.getCoursesByYear(year)
                setCourses(data.courses)
            } catch {
                try {
                    const data = await api.getCourses()
                    setCourses(data.courses.filter(c => c.year === year))
                } catch { /* noop */ }
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [year])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-[#7C5CFC]" />
                    <p className="text-sm text-[#B8A9D4] font-medium">Loading subjects...</p>
                </div>
            </div>
        )
    }

    if (courses.length === 0) {
        return (
            <div className="text-center py-14">
                <div className="w-14 h-14 mx-auto rounded-xl bg-[#F0ECFA] flex items-center justify-center mb-3">
                    <GraduationCap className="h-7 w-7 text-[#9B8BB8]" />
                </div>
                <p className="font-semibold text-[#5B4A82]">No courses available yet</p>
                <p className="text-sm text-[#B8A9D4] mt-1">Your teachers haven't created courses for {year} yet.</p>
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
                        <div className="w-1 h-6 rounded-full bg-[#7C5CFC]" />
                        <h3 className="text-lg font-bold tracking-tight text-[#2D1B69]">
                            Semester {sem}
                        </h3>
                        <span className="text-[11px] font-medium bg-[#F0ECFA] text-[#7C5CFC] px-2 py-0.5 rounded-md">
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
                                        <div className="bg-white rounded-xl border border-[#E0D8F0] hover:border-[#D8CEF0] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                            {/* Top Accent */}
                                            <div className="h-1 bg-[#7C5CFC]" />

                                            <div className="p-5">
                                                {/* Icon + Code */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="w-10 h-10 rounded-lg bg-[#7C5CFC] flex items-center justify-center group-hover:bg-[#6B4FDB] transition-colors shadow-sm shadow-[#7C5CFC]/15">
                                                        <GraduationCap className="w-5 h-5 text-white" />
                                                    </div>
                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F0ECFA] text-[#7C5CFC] border border-[#D8CEF0]">
                                                        {course.subject_code || course.code}
                                                    </span>
                                                </div>

                                                {/* Title */}
                                                <h4 className="text-[15px] font-semibold text-[#2D1B69] mb-2 group-hover:text-[#5B4A82] transition-colors line-clamp-2 leading-snug">
                                                    {course.name}
                                                </h4>

                                                {/* Stats */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className="flex items-center gap-1.5 text-[12px] text-[#9B8BB8]">
                                                        <BookOpen className="h-3.5 w-3.5" />
                                                        {totalUnits} unit{totalUnits !== 1 ? "s" : ""}
                                                    </span>
                                                </div>

                                                {/* Unit Pills */}
                                                <div className="flex flex-wrap gap-1 mb-4">
                                                    {course.units.slice(0, 3).map((unit) => (
                                                        <span
                                                            key={unit.number}
                                                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#F0ECFA]/50 text-[#7C5CFC] border border-[#E0D8F0]"
                                                        >
                                                            U{unit.number}: {unit.title.length > 16 ? unit.title.slice(0, 16) + "..." : unit.title}
                                                        </span>
                                                    ))}
                                                    {course.units.length > 3 && (
                                                        <span className="text-[10px] font-medium text-[#B8A9D4] px-1.5 py-0.5">
                                                            +{course.units.length - 3}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* CTA */}
                                                <div className="flex items-center justify-between pt-3 border-t border-[#E8E0F5]">
                                                    <span className="text-[13px] font-medium text-[#9B8BB8] group-hover:text-[#5B4A82] transition-colors">
                                                        View Units
                                                    </span>
                                                    <div className="w-7 h-7 rounded-md bg-[#F0ECFA] flex items-center justify-center group-hover:bg-[#7C5CFC] transition-all duration-200">
                                                        <ArrowRight className="h-3.5 w-3.5 text-[#9B8BB8] group-hover:text-white transition-colors" />
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
