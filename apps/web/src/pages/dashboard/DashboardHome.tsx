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
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
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
                const firstName = parsedUser.first_name || parsedUser.user_metadata?.first_name || "User"
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

    const totalSubjects = courses.length
    const totalUnits = courses.reduce((sum, c) => sum + c.units.length, 0)

    return (
        <motion.div className="min-h-[calc(100vh-4rem)] space-y-8" initial="initial" animate="animate" variants={STAGGER}>

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
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <span className="inline-flex items-center gap-2 text-[11px] font-mono text-white/40 tracking-widest uppercase">
                                <span className="w-6 h-px bg-white/20" />
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kolkata" })}
                            </span>
                            {yearLabel && (
                                <span className="text-[11px] font-mono text-white/50 bg-white/[0.06] px-2.5 py-1 rounded-lg border border-white/[0.06]">
                                    <GraduationCap className="h-3 w-3 inline mr-1.5 -mt-0.5" />
                                    {yearLabel}
                                </span>
                            )}
                        </div>

                        <p className="text-white/50 text-sm font-mono">{greeting},</p>
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1 leading-tight">{userName}</h1>
                        <p className="text-white/40 text-[14px] mt-3 max-w-xl leading-relaxed">
                            {totalSubjects > 0
                                ? `${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""} enrolled · ${totalUnits} unit${totalUnits !== 1 ? "s" : ""} to explore`
                                : "Access your subjects, notes, flashcards, and assignments"}
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* ── Quick Access Cards ── */}
            <motion.div variants={FADE_UP}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { icon: FileText, title: "Notes", href: "/dashboard/notes", sub: totalSubjects > 0 ? `From ${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""}` : "No subjects yet" },
                        { icon: BookOpen, title: "Assignments", href: "/dashboard/assignments", sub: totalSubjects > 0 ? `From ${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""}` : "No subjects yet" },
                        { icon: Layers, title: "Flashcards", href: "/dashboard/flashcards", sub: totalSubjects > 0 ? `From ${totalSubjects} subject${totalSubjects !== 1 ? "s" : ""}` : "No subjects yet" },
                    ].map((item) => (
                        <a key={item.title} href={item.href}
                           className="group bg-white rounded-2xl border border-[#eaeaec] hover:shadow-md transition-all duration-300 overflow-hidden">
                            <div className="p-5 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#f0f0f5]">
                                    <item.icon className="h-5 w-5 text-[#6b6b6b] group-hover:text-[#c2185b] transition-colors" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[15px] font-semibold text-[#1a1a1a]">{item.title}</h3>
                                    <p className="text-[12px] text-[#999] mt-0.5">{item.sub}</p>
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-[#ccc] group-hover:text-[#c2185b] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </div>
                        </a>
                    ))}
                </div>
            </motion.div>

            {/* Subjects */}
            {isStudent && userYear && <StudentSubjectsDashboard year={userYear} />}

            {/* Fallback */}
            {(!isStudent || !userYear) && (
                <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-[#f0f0f5]">
                        <GraduationCap className="h-8 w-8 text-[#999]" />
                    </div>
                    <p className="font-semibold text-[#1a1a1a] text-lg">No year information found</p>
                    <p className="text-sm text-[#999] mt-2 max-w-md mx-auto">
                        Contact your administrator to set up your profile and access your learning journey.
                    </p>
                </div>
            )}
        </motion.div>
    )
}