import { Sidebar } from "../ui/Sidebar"
import { Outlet, useLocation } from "react-router-dom"
import { Chatbot } from "./Chatbot"
import { Search, Bell, Command } from "lucide-react"

function getBreadcrumbs(pathname: string) {
    const parts = pathname.split("/").filter(Boolean)
    const crumbs: { label: string; path: string }[] = []

    if (parts[0] === "dashboard") {
        crumbs.push({ label: "Dashboard", path: "/dashboard" })

        if (parts[1] === "subject") {
            crumbs.push({ label: "Subject", path: pathname })
        } else if (parts[1] === "course") {
            crumbs.push({ label: "Course", path: `/dashboard/course/${parts[2]}` })
            if (parts[3] === "unit") {
                crumbs.push({ label: `Unit ${parts[4]}`, path: `/dashboard/course/${parts[2]}/unit/${parts[4]}` })
                if (parts[5] === "lecture") {
                    crumbs.push({ label: "Lecture", path: pathname })
                }
            }
        } else if (parts[1] === "notes") {
            crumbs.push({ label: "Notes", path: "/dashboard/notes" })
        } else if (parts[1] === "assignments") {
            crumbs.push({ label: "Assignments", path: "/dashboard/assignments" })
        } else if (parts[1] === "flashcards") {
            crumbs.push({ label: "Flashcards", path: "/dashboard/flashcards" })
        }
    }

    return crumbs
}

export function DashboardLayout() {
    const location = useLocation()
    const crumbs = getBreadcrumbs(location.pathname)

    return (
        <div className="h-screen bg-[#f8f8fa] text-foreground flex overflow-hidden">
            <Sidebar />
            <div className="flex-1 ml-[var(--sidebar-width)] flex flex-col h-full overflow-hidden">
                {/* Fixed Top Header */}
                <header className="h-[var(--header-height)] flex items-center justify-between px-8 bg-white/90 backdrop-blur-xl border-b border-[#eaeaec] flex-shrink-0 z-30">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2">
                        {crumbs.map((crumb, i) => (
                            <div key={crumb.path} className="flex items-center gap-2">
                                {i > 0 && (
                                    <span className="text-[#c4c4c8] text-xs">/</span>
                                )}
                                <span className={`text-[13px] font-medium ${i === crumbs.length - 1 ? "text-[#18181b]" : "text-[#a1a1aa]"}`}>
                                    {crumb.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-1.5">
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-[#71717a] hover:text-[#18181b] hover:bg-[#f5f5f7] transition-all border border-transparent hover:border-[#e5e5ea]">
                            <Search className="h-4 w-4" />
                            <span className="hidden lg:inline text-[13px]">Search</span>
                            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[#a1a1aa] bg-[#f5f5f7] rounded-md border border-[#e5e5ea]">
                                <Command className="h-2.5 w-2.5" />K
                            </kbd>
                        </button>
                        <button className="relative p-2 rounded-xl text-[#71717a] hover:text-[#18181b] hover:bg-[#f5f5f7] transition-all">
                            <Bell className="h-[17px] w-[17px]" />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ring-2 ring-white bg-[#c2185b]" />
                        </button>
                    </div>
                </header>

                {/* Scrollable Main Content */}
                <main className="flex-1 min-h-0 px-8 py-6 overflow-y-auto">
                    <div className="max-w-6xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
            <Chatbot />
        </div>
    )
}
