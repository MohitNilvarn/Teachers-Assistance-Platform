import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
    FileText, Layers, GraduationCap, Calendar,
    ArrowUpRight, BookOpen,
} from "lucide-react"
import StudentSubjectsDashboard from "../../components/dashboard/years/StudentSubjectsDashboard"
import TeacherDashboard from "./TeacherDashboard"
import { api } from "../../lib/api"
import type { Course } from "../../types"

const FADE_UP = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
}

const STAGGER = {
    animate: { transition: { staggerChildren: 0.06 } },
}

export default function DashboardHome() {
    const [userName, setUserName] = useState("User")
    const [userYear, setUserYear] = useState("")
    const [courses, setCourses] = useState<Course[]>([])
    const role = sessionStorage.getItem("role")

    useEffect(() => {
        const storedUser = sessionStorage.getItem("user")

        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser)

                const firstName = parsedUser.first_name ||
                    parsedUser.user_metadata?.first_name ||
                    "User"

                if (firstName && firstName !== "User") {
                    setUserName(firstName)
                }

                const year = parsedUser.year || parsedUser.user_metadata?.year || ""
                if (year) {
                    setUserYear(year)
                }
            } catch (e) {
                console.error("Error parsing user data:", e)
            }
        }
    }, [])

    // Fetch courses for Quick Access content
    useEffect(() => {
        if (role !== "student" || !userYear) return
        async function loadCourses() {
            try {
                const data = await api.getCoursesByYear(userYear)
                setCourses(data.courses)
            } catch {
                try {
                    const data = await api.getCourses()
                    setCourses(data.courses.filter(c => c.year === userYear))
                } catch { /* noop */ }
            }
        }
        loadCourses()
    }, [role, userYear])

    const isTeacher = role === "teacher"
    const isStudent = role === "student"

    if (isTeacher) {
        return <TeacherDashboard />
    }

    // IST timezone greeting
    const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }))
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
    const yearLabels: Record<string, string> = { FE: "1st Year", SE: "2nd Year", TE: "3rd Year", BE: "4th Year" }
    const yearLabel = yearLabels[userYear] || userYear

    // Calculate content availability from courses
    const totalSubjects = courses.length
    const totalUnits = courses.reduce((sum, c) => sum + c.units.length, 0)

    return (
        <motion.div className="space-y-8" initial="initial" animate="animate" variants={STAGGER}>
            {/* Welcome Section - Clean & Minimal */}
            <motion.div variants={FADE_UP}>
                <div className="relative overflow-hidden rounded-2xl bg-[#2D1B69] p-7 text-white shadow-lg shadow-[#7C5CFC]/15">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/[0.06] rounded-full -translate-y-1/2 translate-x-1/3" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/[0.04] rounded-full translate-y-1/2 -translate-x-1/4" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium text-white/80 border border-white/15 backdrop-blur-sm">
                                <Calendar className="h-3 w-3 inline mr-1 -mt-0.5" />
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata" })}
                            </span>
                            {yearLabel && (
                                <span className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium text-white/80 border border-white/15 backdrop-blur-sm">
                                    <GraduationCap className="h-3 w-3 inline mr-1 -mt-0.5" />
                                    {yearLabel}
                                </span>
                            )}
                        </div>
                        <p className="text-white/70 text-sm">{greeting},</p>
                        <h1 className="text-3xl font-bold tracking-tight mt-0.5">{userName}</h1>
                        <p className="text-white/60 text-sm mt-2 max-w-md">
                            {totalSubjects > 0
                                ? `${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""} enrolled with ${totalUnits} unit${totalUnits !== 1 ? "s" : ""} to explore.`
                                : "Access your subjects, notes, flashcards, and assignments."}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Quick Access - Fetches real data */}
            <motion.div variants={FADE_UP}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <QuickCard
                        icon={FileText}
                        title="Notes"
                        href="/dashboard/notes"
                        available={totalSubjects > 0}
                        subtext={totalSubjects > 0 ? `From ${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""}` : "No subjects yet"}
                    />
                    <QuickCard
                        icon={BookOpen}
                        title="Assignments"
                        href="/dashboard/assignments"
                        available={totalSubjects > 0}
                        subtext={totalSubjects > 0 ? `From ${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""}` : "No subjects yet"}
                    />
                    <QuickCard
                        icon={Layers}
                        title="Flashcards"
                        href="/dashboard/flashcards"
                        available={totalSubjects > 0}
                        subtext={totalSubjects > 0 ? `From ${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""}` : "No subjects yet"}
                    />
                </div>
            </motion.div>

            {/* Subjects from API */}
            {isStudent && userYear && <StudentSubjectsDashboard year={userYear} />}

            {/* Fallback */}
            {(!isStudent || !userYear) && (
                <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-xl bg-[#F0ECFA] flex items-center justify-center mx-auto mb-3">
                        <GraduationCap className="h-7 w-7 text-[#9B8BB8]" />
                    </div>
                    <p className="font-semibold text-[#6B5B8D]">No year information found</p>
                    <p className="text-sm text-[#B8A9D4] mt-1">Contact your administrator to set up your profile.</p>
                </div>
            )}
        </motion.div>
    )
}

// ── Quick Access Card ──
function QuickCard({ icon: Icon, title, href, available, subtext }: {
    icon: typeof FileText
    title: string
    href: string
    available: boolean
    subtext: string
}) {
    return (
        <a
            href={href}
            className="group flex items-center gap-3.5 p-4 rounded-xl bg-white border border-[#E0D8F0] hover:border-[#D8CEF0] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        >
            <div className="w-10 h-10 rounded-lg bg-[#7C5CFC] group-hover:bg-[#6B4FDB] flex items-center justify-center transition-colors flex-shrink-0 shadow-sm shadow-[#7C5CFC]/20">
                <Icon className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[#2D1B69]">{title}</h3>
                <p className="text-[12px] text-[#B8A9D4] mt-0.5 truncate">
                    {available ? subtext : "Unavailable"}
                </p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[#C4B8E0] group-hover:text-[#7C5CFC] transition-colors flex-shrink-0" />
        </a>
    )
}