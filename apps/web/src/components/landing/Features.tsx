import { motion } from "framer-motion"
import { FileText, BookOpen, Layers, BarChart3, ArrowUpRight } from "lucide-react"

const features = [
    {
        icon: FileText,
        title: "Smart Note Generation",
        description: "Convert audio, video, or text into structured, easy-to-read lecture notes in seconds.",
        iconColor: "#FF8585",
    },
    {
        icon: BookOpen,
        title: "Automated Assignments",
        description: "Generate quizzes, essay questions, and homework assignments directly from your course content.",
        iconColor: "#7BE1A4",
    },
    {
        icon: Layers,
        title: "Interactive Flashcards",
        description: "Create study decks automatically to help students retain information more effectively.",
        iconColor: "#FFD97B",
    },
    {
        icon: BarChart3,
        title: "Course Analytics",
        description: "Track student engagement and learning outcomes with real-time insights and detailed reports.",
        iconColor: "#979BFF",
    },
]

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
        },
    },
}

const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94],
        },
    },
}

export function Features() {
    return (
        <section id="features" className="relative bg-[#0a0a0b] overflow-hidden">
            {/* Top separator — subtle gradient line */}
            <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(215,109,119,0.15), transparent)" }} />

            <div className="landing-section">
                <div className="max-w-[1200px] mx-auto px-6">
                    {/* Section Header */}
                    <div className="text-center mb-16 md:mb-20">
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="text-[2.5rem] sm:text-[3rem] md:text-[3.8rem] font-semibold tracking-[-0.03em] leading-[1.05] mb-5"
                        >
                            <span className="text-[#f0ede8]">Powerful features </span>
                            <span className="text-[#3a3935]">for modern educators</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.15, duration: 0.6 }}
                            className="text-[16px] text-[#7a7770] max-w-lg mx-auto font-light leading-[1.6] tracking-[-0.01em]"
                        >
                            Explore the tools and design choices that make teaching efficient.
                        </motion.p>
                    </div>

                    {/* Feature Cards Grid */}
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-80px" }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
                    >
                        {features.map((feature, index) => (
                            <motion.article
                                key={index}
                                variants={itemVariants}
                                className="group relative flex flex-col bg-[#111113] border border-[#1e1e21] rounded-2xl p-8 pb-6 transition-all duration-500 hover:-translate-y-1 cursor-default"
                            >
                                {/* Gradient border on hover */}
                                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                     style={{
                                         padding: "1px",
                                         background: "var(--landing-gradient)",
                                         mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                         WebkitMaskComposite: "xor",
                                         maskComposite: "exclude",
                                     }}
                                />

                                {/* Icon */}
                                <div className="h-12 w-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-8 group-hover:bg-white/[0.06] transition-colors duration-300">
                                    <feature.icon className="h-5 w-5" style={{ color: feature.iconColor }} />
                                </div>

                                {/* Text */}
                                <h3 className="text-[17px] font-semibold text-[#f0ede8] mb-3 tracking-[-0.01em]">
                                    {feature.title}
                                </h3>
                                <p className="text-[14px] text-[#7a7770] leading-[1.6] font-light flex-1">
                                    {feature.description}
                                </p>

                                {/* Arrow */}
                                <div className="mt-8">
                                    <ArrowUpRight className="h-4 w-4 text-[#3a3935] group-hover:text-[#D76D77] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-300" />
                                </div>
                            </motion.article>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
