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

export function Sidebar({ collapsed, onToggle }: { collapsed?: boolean, onToggle?: () => void }) {
    const location = useLocation()
    const role = sessionStorage.getItem("role") || "student"
    const sections = role === "teacher" ? teacherSections : studentSections
    const [internalCollapsed, setInternalCollapsed] = useState(false)
    const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed
    const handleToggle = onToggle || (() => setInternalCollapsed(!internalCollapsed))
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
            "h-screen bg-[#0f0f10] flex flex-col fixed left-0 top-0 z-40 transition-all duration-300 border-r border-white/[0.04]",
            isCollapsed ? "w-[64px]" : "w-[var(--sidebar-width)]"
        )}>
            {/* Logo */}
            <div className={cn(
                "flex items-center h-[var(--header-height)] border-b border-white/[0.06]",
                isCollapsed ? "px-3 justify-center" : "px-5 gap-3"
            )}>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#1a1a2e]">
                    <span className="text-white text-sm font-bold">T</span>
                </div>
                {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                        <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#f0ede8]">TAP</span>
                        <p className="text-[10px] text-[#5a5650] font-medium -mt-0.5 truncate tracking-[0.02em]">Teaching Assistant</p>
                    </div>
                )}
                <button
                    onClick={handleToggle}
                    className={cn(
                        "p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-[#5a5650] hover:text-[#f0ede8] flex-shrink-0",
                        isCollapsed && "mx-auto mt-2"
                    )}
                >
                    <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", isCollapsed && "rotate-180")} />
                </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
                {sections.map((section) => (
                    <div key={section.title}>
                        {!isCollapsed && (
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3a3935] px-3 mb-2">
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
                                            "flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 group relative",
                                            isCollapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5",
                                            active
                                                ? "text-[#f0ede8]"
                                                : "text-[#5a5650] hover:text-[#f0ede8] hover:bg-white/[0.04]"
                                        )}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        {/* Active indicator — gradient left bar */}
                                        {active && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[#c2185b]" />
                                        )}
                                        {active && (
                                            <div className="absolute inset-0 rounded-xl bg-white/[0.06]" />
                                        )}
                                        <item.icon className={cn("h-[17px] w-[17px] flex-shrink-0 relative z-10", active ? "text-[#c2185b]" : "text-[#5a5650] group-hover:text-[#7a7770]")} />
                                        {!isCollapsed && <span className="truncate relative z-10">{item.label}</span>}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* User Profile */}
            <div className="border-t border-white/[0.06] p-2.5">
                <div className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer",
                    isCollapsed && "justify-center"
                )}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 bg-[#1a1a2e]">
                        {initials}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#f0ede8] truncate">{userName}</p>
                            <p className="text-[11px] text-[#5a5650] truncate flex items-center gap-1">
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
                        "flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[13px] font-medium text-[#5a5650] hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 mt-0.5",
                        isCollapsed && "justify-center"
                    )}
                    title={isCollapsed ? "Sign Out" : undefined}
                >
                    <LogOut className="h-[17px] w-[17px] flex-shrink-0" />
                    {!isCollapsed && <span>Sign Out</span>}
                </button>
            </div>
        </div>
    )
}
