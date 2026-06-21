import { useState, useRef, useEffect } from "react"
import { MessageSquare, X, Send, Sparkles, Bot, User } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "react-router-dom"
import { api } from "../../lib/api"
import { LatexRenderer } from "../ui/LatexRenderer"

interface Message {
    role: "user" | "bot"
    text: string
    timestamp: Date
}

export function Chatbot() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "bot",
            text: "Hi! I'm your TAP AI assistant. I can help you with navigating the platform, understanding your subjects, or answering questions about your coursework.",
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const location = useLocation()

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isTyping])

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 200)
        }
    }, [isOpen])

    const handleSend = async () => {
        if (!input.trim() || isTyping) return

        const userMsg: Message = { role: "user", text: input.trim(), timestamp: new Date() }
        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput("")
        setIsTyping(true)

        // Extract IDs from URL path since useParams() fails in layout
        const pathParts = location.pathname.split("/")
        let currentCourseId = undefined
        let currentLectureId = undefined
        
        const courseIdx = pathParts.indexOf("course")
        if (courseIdx !== -1 && courseIdx + 1 < pathParts.length) {
            currentCourseId = pathParts[courseIdx + 1]
        } else {
            const subjectIdx = pathParts.indexOf("subject")
            if (subjectIdx !== -1 && subjectIdx + 1 < pathParts.length) {
                currentCourseId = pathParts[subjectIdx + 1]
            }
        }
        
        const lectureIdx = pathParts.indexOf("lecture")
        if (lectureIdx !== -1 && lectureIdx + 1 < pathParts.length) {
            currentLectureId = pathParts[lectureIdx + 1]
        }

        try {
            const historyForApi = newMessages.map(m => ({
                role: m.role === "bot" ? "assistant" : "user",
                content: m.text
            }))
            
            const response = await api.askChatbot({
                query: userMsg.text,
                course_id: currentCourseId,
                lecture_id: currentLectureId,
                history: historyForApi.slice(0, -1)
            })

            setMessages(prev => [
                ...prev,
                {
                    role: "bot",
                    text: response.response,
                    timestamp: new Date(),
                },
            ])
        } catch (error) {
            console.error(error)
            setMessages(prev => [
                ...prev,
                {
                    role: "bot",
                    text: "Sorry, I encountered an error. Please try again.",
                    timestamp: new Date(),
                },
            ])
        } finally {
            setIsTyping(false)
        }
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="absolute bottom-[72px] right-0 w-[380px] bg-white border border-[#e5e5ea] shadow-2xl shadow-[#000000]/15 rounded-2xl overflow-hidden flex flex-col"
                        style={{ height: "520px" }}
                    >
                        {/* Header */}
                        <div className="text-white px-5 py-4 flex items-center justify-between flex-shrink-0 bg-[#0f0f10]">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#1a1a2e]">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="font-bold text-sm">TAP Assistant</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-[10px] text-[#86868b] font-medium">Online</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4 bg-[#f5f5f7]/20">
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                                        {/* Avatar */}
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            msg.role === "bot"
                                                ? "bg-[#000000] text-white shadow-sm"
                                                : "bg-[#E8E0F5] text-[#3f3f46]"
                                        }`}>
                                            {msg.role === "bot" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                        </div>
                                        <div>
                                            <div className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                                                msg.role === "user"
                                                    ? "bg-[#000000] text-white rounded-2xl rounded-br-lg shadow-sm"
                                                    : "bg-white border border-[#e5e5ea] text-[#3f3f46] rounded-2xl rounded-bl-lg shadow-sm"
                                            }`}>
                                                {msg.role === "bot" ? (
                                                    <div className="prose prose-sm prose-p:my-1 prose-ul:my-1 max-w-none">
                                                        <LatexRenderer text={msg.text} />
                                                    </div>
                                                ) : (
                                                    msg.text
                                                )}
                                            </div>
                                            <p className={`text-[9px] text-[#86868b] mt-1 ${msg.role === "user" ? "text-right" : "text-left"} px-1`}>
                                                {formatTime(msg.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Typing Indicator */}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-end gap-2"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-[#000000] flex items-center justify-center flex-shrink-0">
                                        <Bot className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <div className="bg-white border border-[#e5e5ea] rounded-2xl rounded-bl-lg px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-[#000000] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-1.5 h-1.5 bg-[#000000] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-1.5 h-1.5 bg-[#000000] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="px-4 py-3 bg-white border-t border-[#e5e5ea] flex-shrink-0">
                            <div className="flex items-center gap-2 bg-[#f5f5f7]/40 rounded-xl border border-[#e5e5ea] focus-within:border-[#000000] focus-within:ring-2 focus-within:ring-[#000000]/500/10 transition-all px-3">
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                                    placeholder="Ask anything..."
                                    className="flex-1 py-2.5 bg-transparent text-[13px] text-[#27272a] placeholder:text-[#86868b] focus:outline-none"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="w-8 h-8 rounded-lg text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex-shrink-0 bg-[#1a1a2e] hover:bg-[#2a2a4e]"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <p className="text-[9px] text-[#86868b] text-center mt-2">TAP AI may produce inaccurate information</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Action Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="h-14 w-14 rounded-2xl text-white shadow-lg shadow-[#1a1a2e]/20 hover:shadow-xl hover:shadow-[#1a1a2e]/30 flex items-center justify-center transition-all duration-200 relative bg-[#1a1a2e] hover:bg-[#2a2a4e]"
            >
                {isOpen ? (
                    <X className="h-5 w-5" />
                ) : (
                    <>
                        <MessageSquare className="h-5 w-5" />
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full ring-2 ring-white" />
                    </>
                )}
            </motion.button>
        </div>
    )
}
