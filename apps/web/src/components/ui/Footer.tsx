import { Link } from "react-router-dom"

const footerLinks = {
    product: [
        { label: "Features", href: "#features" },
        { label: "How it Works", href: "#how-it-works" },
        { label: "Pricing", href: "#" },
        { label: "Roadmap", href: "#" },
    ],
    company: [
        { label: "About", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#" },
    ],
    legal: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms of Service", href: "#" },
        { label: "Cookie Policy", href: "#" },
    ],
}

export function Footer() {
    return (
        <footer className="bg-[#0a0a0b] border-t border-[#1e1e21]">
            <div className="max-w-[1200px] mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
                    {/* Brand column */}
                    <div className="md:col-span-4 space-y-5">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                                 style={{ background: "var(--landing-gradient)" }}>
                                <span className="text-white font-bold text-sm">T</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-[17px] font-semibold text-[#f0ede8] tracking-[-0.01em]">TAP</span>
                                <span className="text-[11px] text-[#5a5650] font-medium tracking-[0.04em] uppercase">Teaching Assistant</span>
                            </div>
                        </Link>
                        <p className="text-[14px] text-[#5a5650] font-light leading-[1.65] max-w-xs">
                            Empowering educators with AI-driven tools for better teaching and learning outcomes.
                        </p>
                    </div>

                    {/* Product */}
                    <div className="md:col-span-2 md:col-start-6">
                        <h4 className="text-[12px] font-semibold text-[#7a7770] tracking-[0.06em] uppercase mb-5">Product</h4>
                        <ul className="space-y-3">
                            {footerLinks.product.map((link) => (
                                <li key={link.label}>
                                    <a href={link.href} className="text-[14px] text-[#5a5650] hover:text-[#f0ede8] transition-colors duration-200 font-light">
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company */}
                    <div className="md:col-span-2">
                        <h4 className="text-[12px] font-semibold text-[#7a7770] tracking-[0.06em] uppercase mb-5">Company</h4>
                        <ul className="space-y-3">
                            {footerLinks.company.map((link) => (
                                <li key={link.label}>
                                    <a href={link.href} className="text-[14px] text-[#5a5650] hover:text-[#f0ede8] transition-colors duration-200 font-light">
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal */}
                    <div className="md:col-span-2">
                        <h4 className="text-[12px] font-semibold text-[#7a7770] tracking-[0.06em] uppercase mb-5">Legal</h4>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link) => (
                                <li key={link.label}>
                                    <a href={link.href} className="text-[14px] text-[#5a5650] hover:text-[#f0ede8] transition-colors duration-200 font-light">
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-16 pt-8 border-t border-[#1e1e21] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[13px] text-[#3a3935] font-light">
                        © {new Date().getFullYear()} Teacher Assistance Platform. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-[13px] text-[#3a3935] hover:text-[#7a7770] transition-colors font-light">
                            Twitter
                        </a>
                        <a href="#" className="text-[13px] text-[#3a3935] hover:text-[#7a7770] transition-colors font-light">
                            GitHub
                        </a>
                        <a href="#" className="text-[13px] text-[#3a3935] hover:text-[#7a7770] transition-colors font-light">
                            Discord
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
