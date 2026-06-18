import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { useState, useEffect } from "react"

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <nav
            className={`fixed top-0 w-full z-50 transition-all duration-500 ${
                scrolled
                    ? "bg-[#0a0a0b]/90 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                    : "bg-transparent border-b border-transparent"
            }`}
        >
            <div className="max-w-[1200px] mx-auto px-6 h-[72px] flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center relative overflow-hidden"
                         style={{ background: "var(--landing-gradient)" }}>
                        <span className="text-white font-bold text-sm relative z-10">T</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[17px] font-semibold text-[#f0ede8] tracking-[-0.01em]">TAP</span>
                        <span className="hidden sm:inline text-[11px] text-[#5a5650] font-medium tracking-[0.04em] uppercase">Teaching Assistant</span>
                    </div>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-1">
                    <a href="#features" className="text-[13px] font-medium text-[#7a7770] hover:text-[#f0ede8] transition-colors duration-300 px-4 py-2 rounded-lg">
                        Features
                    </a>
                    <a href="#how-it-works" className="text-[13px] font-medium text-[#7a7770] hover:text-[#f0ede8] transition-colors duration-300 px-4 py-2 rounded-lg">
                        How it Works
                    </a>
                    <a href="#faq" className="text-[13px] font-medium text-[#7a7770] hover:text-[#f0ede8] transition-colors duration-300 px-4 py-2 rounded-lg">
                        FAQ
                    </a>

                    <div className="flex items-center gap-3 ml-6">
                        <Link to="/login">
                            <button className="text-[13px] font-medium text-[#7a7770] hover:text-[#f0ede8] transition-colors duration-300 px-4 py-2">
                                Sign In
                            </button>
                        </Link>
                        <Link to="/signup">
                            <button
                                className="relative text-[13px] font-semibold text-[#f0ede8] px-5 py-2.5 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_20px_rgba(215,109,119,0.2)]"
                                style={{ background: "var(--landing-gradient)", backgroundSize: "200% 200%" }}
                            >
                                Get Started
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 text-[#7a7770] rounded-lg hover:text-[#f0ede8] hover:bg-white/[0.04] transition-all"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Toggle menu"
                >
                    {isOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="md:hidden overflow-hidden bg-[#0a0a0b]/98 backdrop-blur-2xl border-b border-white/[0.06]"
                    >
                        <div className="px-6 py-4 flex flex-col gap-1">
                            <a href="#features" onClick={() => setIsOpen(false)} className="text-[14px] font-medium text-[#7a7770] hover:text-[#f0ede8] py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-all">
                                Features
                            </a>
                            <a href="#how-it-works" onClick={() => setIsOpen(false)} className="text-[14px] font-medium text-[#7a7770] hover:text-[#f0ede8] py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-all">
                                How it Works
                            </a>
                            <a href="#faq" onClick={() => setIsOpen(false)} className="text-[14px] font-medium text-[#7a7770] hover:text-[#f0ede8] py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-all">
                                FAQ
                            </a>
                            <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-white/[0.06]">
                                <Link to="/login" onClick={() => setIsOpen(false)}>
                                    <button className="w-full text-left text-[14px] font-medium text-[#7a7770] hover:text-[#f0ede8] py-3 px-3 rounded-lg hover:bg-white/[0.03] transition-all">
                                        Sign In
                                    </button>
                                </Link>
                                <Link to="/signup" onClick={() => setIsOpen(false)}>
                                    <button
                                        className="w-full text-[14px] font-semibold text-[#f0ede8] py-3 px-3 rounded-xl transition-all"
                                        style={{ background: "var(--landing-gradient)" }}
                                    >
                                        Get Started
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    )
}
