import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.2,
        },
    },
}

const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
}

export function Hero() {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0b]">
            {/* Background Glow */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-[0.03]"
                     style={{ background: "radial-gradient(ellipse at center, #D76D77, transparent 70%)" }} />
                <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.02]"
                     style={{ background: "radial-gradient(ellipse at center, #ffca7b, transparent 70%)" }} />
                <div className="absolute top-1/4 right-1/6 w-[400px] h-[400px] rounded-full opacity-[0.02]"
                     style={{ background: "radial-gradient(ellipse at center, #3a1c71, transparent 70%)" }} />
                {/* Subtle grid pattern */}
                <div className="absolute inset-0 opacity-[0.015]"
                     style={{
                         backgroundImage: `linear-gradient(rgba(240,237,232,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(240,237,232,0.3) 1px, transparent 1px)`,
                         backgroundSize: "80px 80px"
                     }} />
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-[1200px] mx-auto px-6 z-10 text-center pt-24 pb-12"
            >
                {/* Badge */}
                <motion.div variants={itemVariants} className="inline-flex items-center justify-center mb-10">
                    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#D76D77] animate-pulse" />
                        <span className="text-[12px] font-medium text-[#7a7770] tracking-[0.06em] uppercase">AI-Powered Teaching Assistant</span>
                    </div>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    variants={itemVariants}
                    className="text-[3.2rem] sm:text-[4rem] md:text-[4.8rem] lg:text-[5.5rem] font-semibold leading-[0.92] tracking-[-0.04em] mb-8"
                >
                    <span className="text-[#f0ede8] block">Transform Your Lectures</span>
                    <span className="text-[#3a3935] block mt-1">Into Learning Assets</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    variants={itemVariants}
                    className="text-[17px] md:text-lg text-[#7a7770] max-w-xl mx-auto mb-12 font-light leading-[1.65] tracking-[-0.01em]"
                >
                    Instantly generate lecture notes, assignments, and flashcards from your teaching materials. Save time and enhance student engagement.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    variants={itemVariants}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <Link to="/signup">
                        <button
                            className="h-12 px-8 text-[15px] font-semibold text-white rounded-xl inline-flex items-center gap-2 transition-all duration-300 hover:shadow-[0_0_30px_rgba(215,109,119,0.25)] hover:scale-[1.02] active:scale-[0.98]"
                            style={{ background: "var(--landing-gradient)", backgroundSize: "200% 200%" }}
                        >
                            Get Started Free
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </Link>
                    <Link to="/login">
                        <button className="h-12 px-8 text-[15px] font-medium text-[#7a7770] hover:text-[#f0ede8] rounded-xl border border-white/[0.08] hover:border-white/[0.15] bg-transparent hover:bg-white/[0.03] transition-all duration-300 inline-flex items-center gap-2">
                            View Demo
                        </button>
                    </Link>
                </motion.div>

                {/* Dashboard Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 1.2, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mt-20 relative mx-auto max-w-4xl"
                >
                    <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        className="rounded-2xl border border-white/[0.06] bg-[#111113] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                    >
                        {/* Mock Dashboard UI */}
                        <div className="rounded-xl bg-[#0d0d0f] overflow-hidden">
                            {/* Title bar */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.04]">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]/60" />
                                </div>
                                <div className="flex-1 flex justify-center">
                                    <div className="h-5 w-48 rounded-md bg-white/[0.04] flex items-center justify-center">
                                        <span className="text-[10px] text-[#3a3935] font-medium tracking-wider">tap.edu/dashboard</span>
                                    </div>
                                </div>
                            </div>
                            {/* Content area */}
                            <div className="p-6 flex gap-4 min-h-[280px] md:min-h-[340px]">
                                {/* Sidebar */}
                                <div className="hidden md:flex flex-col gap-3 w-44 shrink-0">
                                    <div className="h-8 rounded-lg bg-white/[0.03] border border-white/[0.04]" />
                                    <div className="h-8 rounded-lg bg-[#D76D77]/10 border border-[#D76D77]/20 flex items-center px-3">
                                        <div className="h-2 w-16 rounded bg-[#D76D77]/30" />
                                    </div>
                                    <div className="h-8 rounded-lg bg-white/[0.03] border border-white/[0.04]" />
                                    <div className="h-8 rounded-lg bg-white/[0.03] border border-white/[0.04]" />
                                    <div className="flex-1" />
                                    <div className="h-8 rounded-lg bg-white/[0.02] border border-white/[0.03]" />
                                </div>
                                {/* Main content */}
                                <div className="flex-1 flex flex-col gap-4">
                                    <div className="flex gap-3">
                                        <div className="flex-1 h-20 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
                                            <div className="h-2 w-12 rounded bg-[#3a3935] mb-2" />
                                            <div className="h-5 w-8 rounded bg-[#D76D77]/20" />
                                        </div>
                                        <div className="flex-1 h-20 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
                                            <div className="h-2 w-16 rounded bg-[#3a3935] mb-2" />
                                            <div className="h-5 w-10 rounded bg-[#ffca7b]/20" />
                                        </div>
                                        <div className="hidden sm:block flex-1 h-20 rounded-xl bg-white/[0.03] border border-white/[0.04] p-3">
                                            <div className="h-2 w-14 rounded bg-[#3a3935] mb-2" />
                                            <div className="h-5 w-6 rounded bg-[#3a1c71]/30" />
                                        </div>
                                    </div>
                                    <div className="flex-1 rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
                                        <div className="h-2 w-24 rounded bg-[#3a3935] mb-4" />
                                        <div className="grid grid-cols-4 gap-2 h-32">
                                            {[0.6, 0.8, 0.45, 0.7, 0.9, 0.5, 0.75, 0.85].map((h, i) => (
                                                <div key={i} className="flex flex-col justify-end">
                                                    <div
                                                        className="rounded-t-sm w-full transition-all"
                                                        style={{
                                                            height: `${h * 100}%`,
                                                            background: i % 2 === 0
                                                                ? "linear-gradient(180deg, rgba(215,109,119,0.3), rgba(215,109,119,0.1))"
                                                                : "rgba(255,255,255,0.04)"
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Glow behind the preview */}
                    <div className="absolute -inset-10 -z-10 opacity-30 blur-3xl"
                         style={{ background: "radial-gradient(ellipse at center, rgba(215,109,119,0.08), transparent 70%)" }} />
                </motion.div>
            </motion.div>
        </section>
    )
}
