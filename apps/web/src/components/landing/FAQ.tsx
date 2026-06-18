import { motion } from "framer-motion"
import { useState } from "react"
import { Rocket, Settings, HelpCircle, ChevronDown } from "lucide-react"

const categories = [
    {
        id: "general",
        title: "Getting Started",
        subtitle: "Common questions about the platform.",
        icon: Rocket,
    },
    {
        id: "features",
        title: "Features & Usage",
        subtitle: "How to make the most of TAP.",
        icon: Settings,
    },
    {
        id: "support",
        title: "Help & Support",
        subtitle: "What kind of support we provide.",
        icon: HelpCircle,
    },
]

const faqItems = [
    {
        category: "general",
        question: "How do I get started with TAP?",
        answer: "Simply create an account, upload your lecture recordings or paste your transcript, and our AI will generate structured notes, assignments, and flashcards within minutes.",
    },
    {
        category: "general",
        question: "What file formats are supported?",
        answer: "TAP supports MP3, MP4, WAV audio/video files, PDF documents, and plain text. We also support direct YouTube video links for lecture recordings.",
    },
    {
        category: "general",
        question: "Is there a free tier available?",
        answer: "Yes, TAP offers a generous free tier that includes up to 10 lecture conversions per month. Premium plans are available for institutions and power users who need unlimited access.",
    },
    {
        category: "general",
        question: "How accurate is the AI-generated content?",
        answer: "Our AI achieves over 95% accuracy in content extraction and summarization. All generated content is fully editable, so you can refine and customize the output to match your exact requirements.",
    },
    {
        category: "features",
        question: "Can I customize the generated content?",
        answer: "Absolutely. Every piece of generated content — notes, assignments, flashcards — can be edited using our built-in rich text editor. You can adjust formatting, add annotations, and restructure content as needed.",
    },
    {
        category: "features",
        question: "Does TAP support multiple languages?",
        answer: "TAP currently supports English, Spanish, French, German, and Mandarin, with automatic language detection. Additional languages are being added regularly based on user demand.",
    },
    {
        category: "features",
        question: "Can I integrate TAP with my LMS?",
        answer: "Yes, TAP integrates seamlessly with Google Classroom, Canvas, Moodle, and Blackboard. You can export content directly to your preferred learning management system with one click.",
    },
    {
        category: "features",
        question: "How does the flashcard generation work?",
        answer: "Our AI identifies key concepts, definitions, and relationships from your lecture content, then generates spaced-repetition flashcards optimized for student retention. Cards can be exported to Anki or studied directly in TAP.",
    },
    {
        category: "support",
        question: "Where can I get help if I encounter issues?",
        answer: "You can reach our support team via email at support@tap.edu, through our in-app help center, or on our community Discord server. We typically respond within 2 hours during business hours.",
    },
    {
        category: "support",
        question: "Do you offer training for institutions?",
        answer: "Yes, we provide dedicated onboarding sessions and training workshops for educational institutions. Contact our enterprise team to schedule a personalized demo and training plan.",
    },
    {
        category: "support",
        question: "How do I report a bug or request a feature?",
        answer: "We welcome feedback through our in-app feedback button, our GitHub discussions page, or by emailing feedback@tap.edu. Feature requests are reviewed and prioritized based on community demand.",
    },
]

function AccordionItem({ question, answer, isOpen, onToggle }: {
    question: string
    answer: string
    isOpen: boolean
    onToggle: () => void
}) {
    return (
        <div className="border-b border-[#1e1e21] last:border-b-0">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between py-5 px-1 text-left group cursor-pointer bg-transparent border-none"
                aria-expanded={isOpen}
            >
                <span className={`text-[15px] font-medium tracking-[-0.01em] transition-colors duration-200 ${
                    isOpen ? "text-[#f0ede8]" : "text-[#7a7770] group-hover:text-[#f0ede8]"
                }`}>
                    {question}
                </span>
                <ChevronDown className={`h-4 w-4 text-[#5a5650] shrink-0 ml-4 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                }`} />
            </button>
            <div
                className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
                style={{
                    maxHeight: isOpen ? "200px" : "0px",
                    opacity: isOpen ? 1 : 0,
                }}
            >
                <p className="text-[14px] text-[#7a7770] font-light leading-[1.7] pb-5 px-1">
                    {answer}
                </p>
            </div>
        </div>
    )
}

export function FAQ() {
    const [activeCategory, setActiveCategory] = useState("general")
    const [openItem, setOpenItem] = useState<number | null>(0)

    const filteredItems = faqItems.filter((item) => item.category === activeCategory)

    const handleCategoryChange = (categoryId: string) => {
        setActiveCategory(categoryId)
        setOpenItem(0)
    }

    return (
        <section id="faq" className="relative bg-[#0a0a0b] overflow-hidden">
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
                            <span className="text-[#f0ede8]">Have questions? </span>
                            <span className="text-[#3a3935]">We're here to help</span>
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.15, duration: 0.6 }}
                            className="text-[16px] text-[#7a7770] max-w-lg mx-auto font-light leading-[1.6] tracking-[-0.01em]"
                        >
                            Get answers to the most common questions about TAP.
                        </motion.p>
                    </div>

                    {/* Two-column layout: Tabs + Accordion */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2, duration: 0.6 }}
                        className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-8"
                    >
                        {/* Category Tabs */}
                        <div className="flex flex-row xl:flex-col gap-3">
                            {categories.map((cat) => {
                                const isActive = activeCategory === cat.id
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleCategoryChange(cat.id)}
                                        className={`flex-1 xl:flex-none flex items-center gap-4 p-5 rounded-2xl text-left transition-all duration-300 cursor-pointer border bg-transparent relative overflow-hidden ${
                                            isActive
                                                ? "border-transparent -translate-y-0.5"
                                                : "border-[#1e1e21] hover:border-[#2a2a2d] hover:-translate-y-0.5"
                                        }`}
                                        style={isActive ? { background: "#111113" } : {}}
                                    >
                                        {/* Gradient border for active */}
                                        {isActive && (
                                            <div
                                                className="absolute inset-0 rounded-2xl pointer-events-none"
                                                style={{
                                                    padding: "1px",
                                                    background: "var(--landing-gradient)",
                                                    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                                                    WebkitMaskComposite: "xor",
                                                    maskComposite: "exclude",
                                                }}
                                            />
                                        )}

                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                                            isActive ? "bg-white/[0.06]" : "bg-white/[0.03]"
                                        }`}>
                                            <cat.icon className={`h-4 w-4 transition-colors duration-300 ${
                                                isActive ? "text-[#D76D77]" : "text-[#5a5650]"
                                            }`} />
                                        </div>
                                        <div className="min-w-0 hidden sm:block">
                                            <p className={`text-[14px] font-semibold tracking-[-0.01em] transition-colors duration-200 ${
                                                isActive ? "text-[#f0ede8]" : "text-[#7a7770]"
                                            }`}>
                                                {cat.title}
                                            </p>
                                            <p className="text-[12px] text-[#5a5650] font-light mt-0.5 hidden xl:block">
                                                {cat.subtitle}
                                            </p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Accordion List */}
                        <div className="bg-[#111113] border border-[#1e1e21] rounded-2xl p-6 md:p-8">
                            <motion.div
                                key={activeCategory}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                            >
                                {filteredItems.map((item, index) => (
                                    <AccordionItem
                                        key={`${activeCategory}-${index}`}
                                        question={item.question}
                                        answer={item.answer}
                                        isOpen={openItem === index}
                                        onToggle={() => setOpenItem(openItem === index ? null : index)}
                                    />
                                ))}
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
