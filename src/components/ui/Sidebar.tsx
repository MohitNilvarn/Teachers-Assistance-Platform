import { Link, useLocation } from "react-router-dom"
import { cn } from "../../lib/utils"
import {
    LayoutDashboard, LogOut, GraduationCap,
    BookOpen, ChevronLeft,
    Mic, FileText, Layers,
} from "lucide-react"
import { useState, useEffect } from "react"

interface SidebarItem {
    icon: typeof LayoutDashboard
    label: string
    href: string
}

interface SidebarSection {
    title: string
    items: SidebarItem[]
}

const teacherSections: SidebarSection[] = [
    {
        title: "Overview",
        items: [
            { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
        ],
    },
    {
        title: "Teaching",
        items: [
            { icon: Mic, label: "Lectures", href: "/dashboard" },
            { icon: FileText, label: "Notes", href: "/dashboard/notes" },
            { icon: BookOpen, label: "Assignments", href: "/dashboard/assignments" },
            { icon: Layers, label: "Flashcards", href: "/dashboard/flashcards" },
        ],
    },
]

const studentSections: SidebarSection[] = [
    {
        title: "Overview",
        items: [
            { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
        ],
    },
    {
        title: "Learning",
        items: [
            { icon: FileText, label: "Notes", href: "/dashboard/notes" },
            { icon: BookOpen, label: "Assignments", href: "/dashboard/assignments" },
            { icon: Layers, label: "Flashcards", href: "/dashboard/flashcards" },
        ],
    },
]

export function Sidebar() {
    const location = useLocation()
    const role = sessionStorage.getItem("role") || "student"
    const sections = role === "teacher" ? teacherSections : studentSections
    const [collapsed, setCollapsed] = useState(false)
    const [userName, setUserName] = useState("User")
    const [, setUserEmail] = useState("")

    useEffect(() => {
        const storedUser = sessionStorage.getItem("user")
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser)
                const first = parsed.first_name || parsed.user_metadata?.first_name || "User"
                const last = parsed.last_name || parsed.user_metadata?.last_name || ""
                setUserName(`${first} ${last}`.trim())
                setUserEmail(parsed.email || "")
            } catch { /* noop */ }
        }
    }, [])

    const isActive = (href: string) => {
        if (href === "/dashboard") {
            return location.pathname === "/dashboard" ||
                location.pathname.startsWith("/dashboard/course/") ||
                location.pathname.startsWith("/dashboard/subject/")
        }
        return location.pathname === href || location.pathname.startsWith(href + "/")
    }

    const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

    return (
        <div className={cn(
            "h-screen bg-[#2D1B69] flex flex-col fixed left-0 top-0 z-40 transition-all duration-300",
            collapsed ? "w-[64px]" : "w-[var(--sidebar-width)]"
        )}>
            {/* Logo */}
            <div className={cn(
                "flex items-center h-[var(--header-height)] border-b border-white/10",
                collapsed ? "px-3 justify-center" : "px-5 gap-3"
            )}>
                <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center text-white flex-shrink-0">
                    <span className="text-sm font-black tracking-tight">T</span>
                </div>
                {!collapsed && (
                    <div className="flex-1 min-w-0">
                        <span className="text-base font-extrabold tracking-tight text-white">TAP</span>
                        <p className="text-[10px] text-white/50 font-medium -mt-0.5 truncate">Teaching Assistant</p>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        "p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white flex-shrink-0",
                        collapsed && "mx-auto mt-2"
                    )}
                >
                    <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
                </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
                {sections.map((section) => (
                    <div key={section.title}>
                        {!collapsed && (
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 mb-1.5">
                                {section.title}
                            </p>
                        )}
                        <div className="space-y-0.5">
                            {section.items.map((item) => {
                                const active = isActive(item.href)
                                return (
                                    <Link
                                        key={item.href + item.label}
                                        to={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 group relative",
                                            collapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2",
                                            active
                                                ? "bg-white/15 text-white border-l-[3px] border-[#7C5CFC]"
                                                : "text-white/60 hover:text-white hover:bg-white/10"
                                        )}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        <item.icon className={cn("h-[17px] w-[17px] flex-shrink-0", active ? "text-white" : "text-white/50 group-hover:text-white")} />
                                        {!collapsed && <span className="truncate">{item.label}</span>}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* User Profile */}
            <div className="border-t border-white/10 p-2.5">
                <div className={cn(
                    "flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer",
                    collapsed && "justify-center"
                )}>
                    <div className="w-8 h-8 rounded-full bg-[#7C5CFC] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {initials}
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-white truncate">{userName}</p>
                            <p className="text-[11px] text-white/50 truncate flex items-center gap-1">
                                <GraduationCap className="h-3 w-3 flex-shrink-0" />
                                {role === "teacher" ? "Teacher" : "Student"}
                            </p>
                        </div>
                    )}
                </div>
                <button
                    onClick={async () => {
                        await import("../../lib/api").then(m => m.api.logout())
                        window.location.href = "/login"
                    }}
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 w-full rounded-lg text-[13px] font-medium text-white/50 hover:text-red-300 hover:bg-red-500/15 transition-all duration-150 mt-0.5",
                        collapsed && "justify-center"
                    )}
                    title={collapsed ? "Sign Out" : undefined}
                >
                    <LogOut className="h-[17px] w-[17px] flex-shrink-0" />
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>
        </div>
    )
}
