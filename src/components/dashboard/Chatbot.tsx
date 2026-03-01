import { useState, useRef, useEffect } from "react"
import { MessageSquare, X, Send, Sparkles, Bot, User } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

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

    const handleSend = () => {
        if (!input.trim()) return

        const userMsg: Message = { role: "user", text: input.trim(), timestamp: new Date() }
        setMessages(prev => [...prev, userMsg])
        setInput("")
        setIsTyping(true)

        // Simulate bot response
        setTimeout(() => {
            setIsTyping(false)
            setMessages(prev => [
                ...prev,
                {
                    role: "bot",
                    text: "I'm a demo assistant for now. Once connected, I'll be able to help you with course content, explain concepts from your lectures, and generate study materials!",
                    timestamp: new Date(),
                },
            ])
        }, 1200)
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
                        className="absolute bottom-[72px] right-0 w-[380px] bg-white border border-[#E0D8F0] shadow-2xl shadow-[#7C5CFC]/15 rounded-2xl overflow-hidden flex flex-col"
                        style={{ height: "520px" }}
                    >
                        {/* Header */}
                        <div className="bg-[#2D1B69] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                    <Sparkles className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="font-bold text-sm">TAP Assistant</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-[10px] text-[#B8A9D4] font-medium">Online</span>
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
                        <div className="flex-1 px-4 py-4 overflow-y-auto space-y-4 bg-[#F0ECFA]/20">
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
                                                ? "bg-[#7C5CFC] text-white shadow-sm"
                                                : "bg-[#E8E0F5] text-[#6B5B8D]"
                                        }`}>
                                            {msg.role === "bot" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                        </div>
                                        <div>
                                            <div className={`px-4 py-2.5 text-[13px] leading-relaxed ${
                                                msg.role === "user"
                                                    ? "bg-[#7C5CFC] text-white rounded-2xl rounded-br-lg shadow-sm"
                                                    : "bg-white border border-[#E0D8F0] text-[#5B4A82] rounded-2xl rounded-bl-lg shadow-sm"
                                            }`}>
                                                {msg.text}
                                            </div>
                                            <p className={`text-[9px] text-[#B8A9D4] mt-1 ${msg.role === "user" ? "text-right" : "text-left"} px-1`}>
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
                                    <div className="w-7 h-7 rounded-lg bg-[#7C5CFC] flex items-center justify-center flex-shrink-0">
                                        <Bot className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <div className="bg-white border border-[#E0D8F0] rounded-2xl rounded-bl-lg px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-[#7C5CFC] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-1.5 h-1.5 bg-[#7C5CFC] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-1.5 h-1.5 bg-[#7C5CFC] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="px-4 py-3 bg-white border-t border-[#E0D8F0] flex-shrink-0">
                            <div className="flex items-center gap-2 bg-[#F0ECFA]/40 rounded-xl border border-[#E0D8F0] focus-within:border-[#7C5CFC] focus-within:ring-2 focus-within:ring-[#7C5CFC]/500/10 transition-all px-3">
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                                    placeholder="Ask anything..."
                                    className="flex-1 py-2.5 bg-transparent text-[13px] text-[#3D2B7A] placeholder:text-[#B8A9D4] focus:outline-none"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="w-8 h-8 rounded-lg bg-[#7C5CFC] text-white flex items-center justify-center hover:bg-[#6B4FDB] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-[#7C5CFC]/20 flex-shrink-0"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <p className="text-[9px] text-[#B8A9D4] text-center mt-2">TAP AI may produce inaccurate information</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Action Button */}
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="h-14 w-14 rounded-2xl bg-[#7C5CFC] text-white shadow-lg shadow-[#7C5CFC]/20 hover:shadow-xl hover:shadow-[#7C5CFC]/30 flex items-center justify-center transition-all duration-200 relative"
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
