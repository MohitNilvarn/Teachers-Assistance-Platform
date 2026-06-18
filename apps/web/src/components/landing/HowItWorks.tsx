import { motion } from "framer-motion"
import { useState } from "react"
import { Upload, FileText, CheckCircle } from "lucide-react"

const steps = [
    {
        number: 1,
        title: "Upload Your Content",
        subtitle: "Upload lecture recordings or paste your transcript directly.",
        icon: Upload,
        content: {
            heading: "Drag, drop, and go",
            description: "Support for audio, video, PDF, and plain text. Simply upload your teaching materials and our AI begins processing immediately.",
            features: ["MP3, MP4, WAV, PDF supported", "Drag & drop or paste text", "Batch upload multiple files", "Automatic language detection"],
        },
    },
    {
        number: 2,
        title: "AI Generates Assets",
        subtitle: "Notes, assignments, and flashcards — created instantly.",
        icon: FileText,
        content: {
            heading: "Structured, intelligent output",
            description: "Our AI extracts key concepts, organizes content hierarchically, and generates multiple learning assets tailored to your curriculum.",
            features: ["Structured lecture notes", "Quiz & essay questions", "Spaced-repetition flashcards", "Key concept summaries"],
        },
    },
    {
        number: 3,
        title: "Review & Share",
        subtitle: "Edit, customize, and distribute to students instantly.",
        icon: CheckCircle,
        content: {
            heading: "Full control, zero friction",
            description: "Review AI-generated content, make edits with our rich editor, and share directly with students through your preferred LMS or export formats.",
            features: ["Rich text editor", "Export to PDF, DOCX", "LMS integration ready", "Student sharing links"],
        },
    },
]

export function HowItWorks() {
    const [activeStep, setActiveStep] = useState(0)

    return (
        <section id="how-it-works" className="relative bg-[#0a0a0b] overflow-hidden">
            {/* Separator */}
            <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(215,109,119,0.1), transparent)" }} />

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
                            <span className="text-[#f0ede8]">Get started quickly </span>
                            <span className="text-[#3a3935]">in just 3 steps</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.15, duration: 0.6 }}
                            className="text-[16px] text-[#7a7770] max-w-lg mx-auto font-light leading-[1.6] tracking-[-0.01em]"
                        >
                            A fast and frustration-free way to transform your teaching materials.
                        </motion.p>
                    </div>

                    {/* Tab Navigation — Dockit HeroTabs Pattern */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                    >
                        <div className="border-t-2 border-[#1e1e21] flex flex-col md:flex-row">
                            {steps.map((step, index) => (
                                <button
                                    key={index}
                                    onClick={() => setActiveStep(index)}
                                    onKeyDown={(e) => {
                                        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                                            e.preventDefault()
                                            setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))
                                        }
                                        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                                            e.preventDefault()
                                            setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))
                                        }
                                    }}
                                    className={`flex-1 text-left px-5 py-6 flex items-start gap-4 transition-all duration-300 relative cursor-pointer border-none bg-transparent group ${
                                        activeStep === index ? "opacity-100" : "opacity-50 hover:opacity-75"
                                    }`}
                                    role="tab"
                                    aria-selected={activeStep === index}
                                    tabIndex={activeStep === index ? 0 : -1}
                                >
                                    {/* Active indicator — gradient top line */}
                                    <div
                                        className={`absolute top-[-2px] left-0 right-0 h-[2px] transition-opacity duration-300 ${
                                            activeStep === index ? "opacity-100" : "opacity-0"
                                        }`}
                                        style={{ background: "var(--landing-gradient)" }}
                                    />

                                    {/* Step number */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transition-all duration-300 ${
                                        activeStep === index
                                            ? "bg-[#f0ede8] text-[#0a0a0b]"
                                            : "bg-[#1e1e21] text-[#7a7770]"
                                    }`}>
                                        {step.number}
                                    </div>

                                    {/* Text */}
                                    <div className="min-w-0">
                                        <p className="text-[15px] font-semibold text-[#f0ede8] mb-1 tracking-[-0.01em]">
                                            {step.title}
                                        </p>
                                        <p className="text-[13px] text-[#7a7770] leading-[1.45] font-light">
                                            {step.subtitle}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Content Panel */}
                        <div className="mt-8 rounded-2xl bg-[#111113] border border-[#1e1e21] overflow-hidden">
                            <div className="p-8 md:p-12">
                                <motion.div
                                    key={activeStep}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center"
                                >
                                    {/* Left — Text content */}
                                    <div>
                                        <div className="inline-flex items-center gap-2 mb-6">
                                            {(() => {
                                                const StepIcon = steps[activeStep].icon
                                                return <StepIcon className="h-5 w-5 text-[#D76D77]" />
                                            })()}
                                            <span className="text-[12px] font-medium text-[#D76D77] tracking-[0.06em] uppercase">
                                                Step {steps[activeStep].number}
                                            </span>
                                        </div>
                                        <h3 className="text-[1.75rem] md:text-[2rem] font-semibold text-[#f0ede8] tracking-[-0.02em] leading-[1.15] mb-4">
                                            {steps[activeStep].content.heading}
                                        </h3>
                                        <p className="text-[15px] text-[#7a7770] font-light leading-[1.65] mb-8">
                                            {steps[activeStep].content.description}
                                        </p>
                                        <ul className="space-y-3">
                                            {steps[activeStep].content.features.map((feature, i) => (
                                                <li key={i} className="flex items-center gap-3 text-[14px] text-[#7a7770]">
                                                    <div className="h-1 w-1 rounded-full bg-[#D76D77] shrink-0" />
                                                    <span className="font-light">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Right — Visual mockup */}
                                    <div className="relative">
                                        <div className="rounded-xl bg-[#0d0d0f] border border-white/[0.04] p-6 min-h-[260px] flex flex-col justify-center">
                                            {activeStep === 0 && (
                                                <div className="space-y-4">
                                                    <div className="border-2 border-dashed border-[#1e1e21] rounded-xl p-8 text-center transition-colors hover:border-[#D76D77]/30">
                                                        <Upload className="h-8 w-8 text-[#3a3935] mx-auto mb-3" />
                                                        <p className="text-[13px] text-[#5a5650] font-light">Drop files here or click to browse</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {["lecture.mp4", "notes.pdf"].map((f, i) => (
                                                            <div key={i} className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.04] rounded-lg px-3 py-2">
                                                                <div className="h-2 w-2 rounded-full bg-[#7BE1A4]" />
                                                                <span className="text-[11px] text-[#7a7770] truncate">{f}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {activeStep === 1 && (
                                                <div className="space-y-3">
                                                    {["Lecture Notes", "Quiz Questions", "Flashcard Deck"].map((item, i) => (
                                                        <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.04] rounded-lg px-4 py-3 group/item hover:border-[#D76D77]/20 transition-colors">
                                                            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                                                                 style={{ background: `rgba(${i === 0 ? "215,109,119" : i === 1 ? "255,217,123" : "151,155,255"},0.1)` }}>
                                                                <FileText className="h-3.5 w-3.5" style={{ color: i === 0 ? "#D76D77" : i === 1 ? "#FFD97B" : "#979BFF" }} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13px] text-[#f0ede8] font-medium">{item}</p>
                                                                <div className="h-1 w-full bg-[#1e1e21] rounded-full mt-1.5 overflow-hidden">
                                                                    <div className="h-full rounded-full transition-all duration-1000"
                                                                         style={{
                                                                             width: `${100 - i * 20}%`,
                                                                             background: "var(--landing-gradient)"
                                                                         }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {activeStep === 2 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <div className="flex-1 h-8 bg-white/[0.03] border border-white/[0.04] rounded-lg flex items-center px-3">
                                                            <div className="h-1.5 w-20 bg-[#3a3935] rounded" />
                                                        </div>
                                                        <div className="h-8 px-4 rounded-lg flex items-center text-[11px] font-medium text-white"
                                                             style={{ background: "var(--landing-gradient)" }}>
                                                            Share
                                                        </div>
                                                    </div>
                                                    {["PDF Export", "Google Classroom", "Direct Link"].map((item, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.04] rounded-lg px-4 py-3">
                                                            <span className="text-[13px] text-[#7a7770] font-light">{item}</span>
                                                            <CheckCircle className="h-4 w-4 text-[#7BE1A4]" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
