import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { useState } from "react"
import { GraduationCap, School, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react"
import { api } from "../../lib/api"

export default function LoginPage() {
    const navigate = useNavigate()
    const [role, setRole] = useState<"student" | "teacher">("student")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setIsLoading(true)

        if (!email.includes("@") || !email.includes(".")) {
            setError("Please enter a valid email address")
            setIsLoading(false)
            return
        }

        try {
            const data = await api.login({ email, password, role })

            sessionStorage.setItem("token", data.access_token)
            if (data.refresh_token) {
                sessionStorage.setItem("refresh_token", data.refresh_token)
            }
            if (data.user) {
                sessionStorage.setItem("user", JSON.stringify(data.user))
                sessionStorage.setItem("role", data.user.role)
            }

            navigate("/dashboard")
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "An error occurred"
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left panel — dark branding matching landing page premium */}
            <div className="hidden lg:flex lg:w-[45%] bg-[#0a0a0b] relative overflow-hidden items-center justify-center p-12">
                {/* Animated background elements matching landing page */}
                <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.06]"
                     style={{ background: "radial-gradient(ellipse at center, #D76D77, transparent 70%)" }} />
                <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-[0.04]"
                     style={{ background: "radial-gradient(ellipse at center, #ffca7b, transparent 70%)" }} />
                {/* Enhanced grid pattern matching landing page */}
                <div className="absolute inset-0 opacity-[0.02]"
                     style={{
                         backgroundImage: `linear-gradient(rgba(240,237,232,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(240,237,232,0.3) 1px, transparent 1px)`,
                         backgroundSize: "60px 60px"
                     }} />

                <div className="relative z-10 max-w-md">
                    <Link to="/" className="flex items-center gap-3 mb-12">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                             style={{ background: "linear-gradient(135deg, #3a1c71, #D76D77, #ffca7b)" }}>
                            <span className="text-white font-bold text-lg">T</span>
                        </div>
                    </Link>

                    <h2 className="text-[2.5rem] font-semibold text-[#f0ede8] tracking-[-0.03em] leading-[1.1] mb-4">
                        Welcome back to
                        <span className="block text-[#3a3935]">your workspace</span>
                    </h2>
                    <p className="text-[15px] text-[#5a5650] font-light leading-[1.6]">
                        Sign in to access your lectures, notes, assignments, and flashcards — all powered by AI.
                    </p>

                    {/* Enhanced decorative cards with landing page styling */}
                    <div className="mt-16 space-y-3">
                        {["Smart Note Generation", "Automated Assignments", "Interactive Flashcards"].map((f, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
                                <div className="h-2 w-2 rounded-full" style={{ background: ["#D76D77", "#ffca7b", "#979BFF"][i] }} />
                                <span className="text-[13px] text-[#7a7770] font-light">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
                {/* Back to home link */}
                <Link to="/" className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-[#71717a] hover:text-[#18181b] transition-colors font-medium">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to home
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="w-full max-w-[400px]"
                >
                    {/* Mobile logo */}
                    <div className="lg:hidden mb-8 text-center">
                        <Link to="/" className="inline-flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                                 style={{ background: "linear-gradient(135deg, #3a1c71, #D76D77, #ffca7b)" }}>
                                <span className="text-white font-bold text-sm">T</span>
                            </div>
                            <span className="text-xl font-semibold text-[#18181b]">TAP</span>
                        </Link>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-[1.75rem] font-semibold text-[#18181b] tracking-[-0.02em]">Sign in</h1>
                        <p className="text-[14px] text-[#71717a] mt-1.5 font-light">
                            Continue to your dashboard
                        </p>
                    </div>

                    {/* Enhanced Role Selection */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <button
                            type="button"
                            onClick={() => setRole("student")}
                            className={`cursor-pointer rounded-2xl border-2 p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 ${role === "student"
                                ? "border-[#D76D77] bg-[#D76D77]/8 text-[#18181b] shadow-lg shadow-[#D76D77]/20"
                                : "border-[#e5e5ea] bg-white text-[#71717a] hover:border-[#d2d2d7] hover:bg-[#fafafa]"
                                }`}
                        >
                            <GraduationCap className={`h-6 w-6 ${role === "student" ? "text-[#D76D77]" : ""}`} />
                            <span className="text-[14px] font-semibold">Student</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRole("teacher")}
                            className={`cursor-pointer rounded-2xl border-2 p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 ${role === "teacher"
                                ? "border-[#D76D77] bg-[#D76D77]/8 text-[#18181b] shadow-lg shadow-[#D76D77]/20"
                                : "border-[#e5e5ea] bg-white text-[#71717a] hover:border-[#d2d2d7] hover:bg-[#fafafa]"
                                }`}
                        >
                            <School className={`h-6 w-6 ${role === "teacher" ? "text-[#D76D77]" : ""}`} />
                            <span className="text-[14px] font-semibold">Teacher</span>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-[13px] font-medium">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#3f3f46]">Email</label>
                            <Input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[13px] font-semibold text-[#3f3f46]">Password</label>
                                <Link to="#" className="text-[12px] text-[#D76D77] hover:text-[#c05a64] transition-colors font-medium">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-11 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-[12px] text-[#71717a] hover:text-[#3f3f46] transition-colors"
                                    aria-label="Toggle password visibility"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-3 w-3" />
                                    ) : (
                                        <Eye className="h-3 w-3" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <Button type="submit" variant="gradient" className="w-full h-12 mt-4" disabled={isLoading}>
                            {isLoading ? "Signing in..." : `Sign In as ${role === "student" ? "Student" : "Teacher"}`}
                        </Button>
                    </form>

                    <p className="text-center text-[13px] text-[#71717a] mt-8">
                        Don't have an account?{" "}
                        <Link to="/signup" className="text-[#D76D77] hover:text-[#c05a64] font-semibold transition-colors">
                            Sign up
                        </Link>
                    </p>
                </motion.div>
            </div>
        </div>
    )
}
