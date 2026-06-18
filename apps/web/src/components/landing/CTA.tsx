import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

export function CTA() {
    return (
        <section className="relative bg-[#0a0a0b] overflow-hidden">
            {/* Separator */}
            <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(215,109,119,0.1), transparent)" }} />

            <div className="landing-section">
                {/* Background glow */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full opacity-[0.04]"
                         style={{ background: "radial-gradient(ellipse at center, #D76D77, transparent 70%)" }} />
                </div>

                <div className="max-w-[1200px] mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="max-w-2xl mx-auto"
                    >
                        <h2 className="text-[2.5rem] sm:text-[3rem] md:text-[3.8rem] font-semibold tracking-[-0.03em] leading-[1.05] mb-6">
                            <span className="text-[#f0ede8]">Ready to explore </span>
                            <span className="text-[#3a3935]">the TAP experience?</span>
                        </h2>
                        <p className="text-[16px] text-[#7a7770] font-light leading-[1.65] mb-10 max-w-lg mx-auto tracking-[-0.01em]">
                            Discover tips, resources, and guidance to maximize your teaching potential with AI-powered tools.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link to="/signup">
                                <button
                                    className="h-13 px-8 text-[15px] font-semibold text-white rounded-xl inline-flex items-center gap-2 transition-all duration-300 hover:shadow-[0_0_30px_rgba(215,109,119,0.25)] hover:scale-[1.02] active:scale-[0.98]"
                                    style={{ background: "var(--landing-gradient)", backgroundSize: "200% 200%" }}
                                >
                                    Get Started
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </Link>
                            <Link to="/login">
                                <button className="h-13 px-8 text-[15px] font-medium rounded-xl inline-flex items-center gap-2 transition-all duration-300 relative overflow-hidden text-[#f0ede8] bg-transparent border-none hover:text-white landing-gradient-border">
                                    View Documentation
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
