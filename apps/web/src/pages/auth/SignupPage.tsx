import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { GraduationCap, School, AlertCircle, ArrowLeft } from "lucide-react"
import { api } from "../../lib/api"
import type { Subject } from "../../types"

export default function SignupPage() {
    const navigate = useNavigate()
    const [role, setRole] = useState<"student" | "teacher">("student")
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        year: "",
        subject_code: "",
    })
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // When role=teacher and a year is chosen, fetch subjects for that year
    useEffect(() => {
        if (role === "teacher" && formData.year) {
            api.getSubjects(formData.year)
                .then(setSubjects)
                .catch(() => setSubjects([]))
        } else {
            setSubjects([])
            setFormData(prev => ({ ...prev, subject_code: "" }))
        }
    }, [role, formData.year])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setIsLoading(true)

        if (!formData.email.includes("@") || !formData.email.includes(".")) {
            setError("Please enter a valid email address")
            setIsLoading(false)
            return
        }

        if (role === "teacher" && !formData.subject_code) {
            setError("Please select a year and subject")
            setIsLoading(false)
            return
        }

        try {
            const payload: Record<string, unknown> = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email,
                password: formData.password,
                role,
            }

            if (role === "student") {
                payload.year = formData.year || undefined
            } else {
                // Teachers store year + subject
                payload.year = formData.year || undefined
                payload.subject_code = formData.subject_code || undefined
            }

            await api.signup(payload)
            navigate("/login")
        } catch (err: Error | unknown) {
            const message = err instanceof Error ? err.message : "Signup failed"
            setError(message)
        } finally {
            setIsLoading(false)
        }
    }

    const selectClasses = "flex h-11 w-full rounded-xl border border-[#e5e5ea] bg-[#fafafa] px-4 py-2 text-sm text-[#18181b] ring-offset-background placeholder:text-[#a1a1aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D76D77]/20 focus-visible:border-[#D76D77]/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 hover:border-[#d2d2d7] appearance-none cursor-pointer"

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left panel — dark branding */}
            <div className="hidden lg:flex lg:w-[45%] bg-[#0a0a0b] relative overflow-hidden items-center justify-center p-12">
                {/* Background glows */}
                <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.06]"
                     style={{ background: "radial-gradient(ellipse at center, #3a1c71, transparent 70%)" }} />
                <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full opacity-[0.05]"
                     style={{ background: "radial-gradient(ellipse at center, #ffca7b, transparent 70%)" }} />
                {/* Grid pattern */}
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
                        <span className="text-xl font-semibold text-[#f0ede8] tracking-[-0.01em]">TAP</span>
                    </Link>

                    <h2 className="text-[2.5rem] font-semibold text-[#f0ede8] tracking-[-0.03em] leading-[1.1] mb-4">
                        Join thousands of
                        <span className="block text-[#3a3935]">modern educators</span>
                    </h2>
                    <p className="text-[15px] text-[#5a5650] font-light leading-[1.6]">
                        Create your account and start transforming lectures into structured learning assets in minutes.
                    </p>

                    {/* Stats */}
                    <div className="mt-16 grid grid-cols-3 gap-4">
                        {[
                            { value: "10k+", label: "Educators" },
                            { value: "95%", label: "Accuracy" },
                            { value: "50k+", label: "Notes Generated" },
                        ].map((stat, i) => (
                            <div key={i} className="text-center px-3 py-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                                <p className="text-lg font-semibold text-[#f0ede8]">{stat.value}</p>
                                <p className="text-[11px] text-[#5a5650] mt-0.5 font-light">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative overflow-y-auto">
                {/* Back to home link */}
                <Link to="/" className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] text-[#71717a] hover:text-[#18181b] transition-colors font-medium">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to home
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="w-full max-w-[400px] my-16 lg:my-0"
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
                        <h1 className="text-[1.75rem] font-semibold text-[#18181b] tracking-[-0.02em]">Create an account</h1>
                        <p className="text-[14px] text-[#71717a] mt-1.5 font-light">
                            Join TAP to revolutionize your learning experience
                        </p>
                    </div>

                    {/* Role Selection */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            type="button"
                            onClick={() => setRole("student")}
                            className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${role === "student"
                                ? "border-[#D76D77] bg-[#D76D77]/5 text-[#18181b] shadow-sm shadow-[#D76D77]/10"
                                : "border-[#e5e5ea] bg-white text-[#71717a] hover:border-[#d2d2d7] hover:bg-[#fafafa]"
                                }`}
                        >
                            <GraduationCap className={`h-5 w-5 ${role === "student" ? "text-[#D76D77]" : ""}`} />
                            <span className="text-[13px] font-semibold">Student</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setRole("teacher")}
                            className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${role === "teacher"
                                ? "border-[#D76D77] bg-[#D76D77]/5 text-[#18181b] shadow-sm shadow-[#D76D77]/10"
                                : "border-[#e5e5ea] bg-white text-[#71717a] hover:border-[#d2d2d7] hover:bg-[#fafafa]"
                                }`}
                        >
                            <School className={`h-5 w-5 ${role === "teacher" ? "text-[#D76D77]" : ""}`} />
                            <span className="text-[13px] font-semibold">Teacher</span>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2.5 text-red-600 text-[13px] font-medium">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-semibold text-[#3f3f46]">First Name</label>
                                <Input
                                    name="first_name"
                                    placeholder="John"
                                    value={formData.first_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-semibold text-[#3f3f46]">Last Name</label>
                                <Input
                                    name="last_name"
                                    placeholder="Doe"
                                    value={formData.last_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-[#3f3f46]">Email</label>
                            <Input
                                name="email"
                                type="email"
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        {role === "student" && (
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-semibold text-[#3f3f46]">Year</label>
                                <select
                                    name="year"
                                    className={selectClasses}
                                    value={formData.year}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="" disabled>Select Year</option>
                                    <option value="FE">First Year (FE)</option>
                                    <option value="SE">Second Year (SE)</option>
                                    <option value="TE">Third Year (TE)</option>
                                    <option value="BE">Fourth Year (BE)</option>
                                </select>
                            </div>
                        )}

                        {role === "teacher" && (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#3f3f46]">Select Year</label>
                                    <select
                                        name="year"
                                        className={selectClasses}
                                        value={formData.year}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="" disabled>Select Year</option>
                                        <option value="FE">First Year (FE)</option>
                                        <option value="SE">Second Year (SE)</option>
                                        <option value="TE">Third Year (TE)</option>
                                        <option value="BE">Fourth Year (BE)</option>
                                    </select>
                                </div>

                                {formData.year && subjects.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-semibold text-[#3f3f46]">Select Subject</label>
                                        <select
                                            name="subject_code"
                                            className={selectClasses}
                                            value={formData.subject_code}
                                            onChange={handleChange}
                                            required
                                        >
                                            <option value="" disabled>Choose your subject</option>
                                            {subjects.map((s) => (
                                                <option key={s.code} value={s.code}>
                                                    {s.name} ({s.code}) — Sem {s.semester}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-[#3f3f46]">Password</label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <Button type="submit" variant="gradient" className="w-full h-11 mt-2" disabled={isLoading}>
                            {isLoading ? "Creating Account..." : `Create ${role === "student" ? "Student" : "Teacher"} Account`}
                        </Button>
                    </form>

                    <p className="text-center text-[13px] text-[#71717a] mt-6">
                        Already have an account?{" "}
                        <Link to="/login" className="text-[#D76D77] hover:text-[#c05a64] font-semibold transition-colors">
                            Sign in
                        </Link>
                    </p>
                </motion.div>
            </div>
        </div>
    )
}
