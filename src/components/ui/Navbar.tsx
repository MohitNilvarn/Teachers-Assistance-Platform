import { Button } from "./Button"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Menu, X, Sparkles } from "lucide-react"
import { useState } from "react"

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-[#E0D8F0]">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-[#2D1B69] flex items-center justify-center shadow-lg shadow-[#7C5CFC]/15">
                        <Sparkles className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                        <span className="text-xl font-bold text-[#2D1B69]">TAP</span>
                        <span className="hidden sm:inline text-xs text-[#B8A9D4] ml-1.5 font-medium">Teaching Assistant</span>
                    </div>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    <Link to="#" className="text-sm font-medium text-[#9B8BB8] hover:text-[#2D1B69] transition-colors">
                        Features
                    </Link>
                    <Link to="#" className="text-sm font-medium text-[#9B8BB8] hover:text-[#2D1B69] transition-colors">
                        How it Works
                    </Link>
                    <Link to="#" className="text-sm font-medium text-[#9B8BB8] hover:text-[#2D1B69] transition-colors">
                        Pricing
                    </Link>
                    <div className="flex items-center gap-3">
                        <Link to="/login">
                            <Button variant="ghost" className="text-[#5B4A82] hover:bg-[#F0ECFA] rounded-xl font-semibold">
                                Sign In
                            </Button>
                        </Link>
                        <Link to="/signup">
                            <Button className="bg-[#2D1B69] text-white hover:bg-[#6B4FDB] rounded-xl font-semibold shadow-md shadow-[#7C5CFC]/15">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 text-[#5B4A82] rounded-xl hover:bg-[#F0ECFA] transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:hidden absolute top-16 left-0 w-full bg-white/95 backdrop-blur-xl border-b border-[#E0D8F0] p-5 flex flex-col gap-1 shadow-xl"
                >
                    <Link to="#" className="text-sm font-medium text-[#5B4A82] py-2.5 px-3 rounded-xl hover:bg-[#F0ECFA]/30 transition-colors">
                        Features
                    </Link>
                    <Link to="#" className="text-sm font-medium text-[#5B4A82] py-2.5 px-3 rounded-xl hover:bg-[#F0ECFA]/30 transition-colors">
                        How it Works
                    </Link>
                    <Link to="#" className="text-sm font-medium text-[#5B4A82] py-2.5 px-3 rounded-xl hover:bg-[#F0ECFA]/30 transition-colors">
                        Pricing
                    </Link>
                    <div className="flex flex-col gap-2 pt-4 mt-2 border-t border-[#E0D8F0]">
                        <Link to="/login">
                            <Button variant="ghost" className="w-full justify-start text-[#5B4A82] hover:bg-[#F0ECFA] rounded-xl font-semibold">
                                Sign In
                            </Button>
                        </Link>
                        <Link to="/signup">
                            <Button className="w-full bg-[#2D1B69] text-white hover:bg-[#6B4FDB] rounded-xl font-semibold shadow-md shadow-[#7C5CFC]/15">
                                Get Started
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            )}
        </nav>
    )
}
