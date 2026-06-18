/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Instrument Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                display: ['Instrument Serif', 'Georgia', 'serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: "hsl(var(--card))",
                "card-foreground": "hsl(var(--card-foreground))",
                popover: "hsl(var(--popover))",
                "popover-foreground": "hsl(var(--popover-foreground))",
                primary: "hsl(var(--primary))",
                "primary-foreground": "hsl(var(--primary-foreground))",
                secondary: "hsl(var(--secondary))",
                "secondary-foreground": "hsl(var(--secondary-foreground))",
                muted: "hsl(var(--muted))",
                "muted-foreground": "hsl(var(--muted-foreground))",
                accent: "hsl(var(--accent))",
                "accent-foreground": "hsl(var(--accent-foreground))",
                destructive: "hsl(var(--destructive))",
                "destructive-foreground": "hsl(var(--destructive-foreground))",
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                /* Landing page tokens */
                "landing-bg": "var(--landing-bg)",
                "landing-elevated": "var(--landing-bg-elevated)",
                "landing-card": "var(--landing-bg-card)",
                "landing-border": "var(--landing-border)",
                "landing-text": "var(--landing-text-primary)",
                "landing-text-secondary": "var(--landing-text-secondary)",
                "landing-text-muted": "var(--landing-text-muted)",
                "landing-text-faint": "var(--landing-text-faint)",
                "landing-accent-start": "var(--landing-accent-start)",
                "landing-accent-mid": "var(--landing-accent-mid)",
                "landing-accent-end": "var(--landing-accent-end)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            animation: {
                "fade-in": "fadeIn 0.5s ease-out",
                "slide-up": "slideUp 0.5s ease-out",
                "float": "float 6s ease-in-out infinite",
                "gradient-shift": "gradientShift 8s ease infinite",
                "fade-in-up": "fadeInUp 0.6s ease-out forwards",
                "scale-in": "scaleIn 0.5s ease-out forwards",
                "glow-pulse": "glowPulse 4s ease-in-out infinite",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { transform: "translateY(20px)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-12px)" },
                },
                gradientShift: {
                    "0%, 100%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                },
                fadeInUp: {
                    "0%": { opacity: "0", transform: "translateY(24px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                scaleIn: {
                    "0%": { opacity: "0", transform: "scale(0.95)" },
                    "100%": { opacity: "1", transform: "scale(1)" },
                },
                glowPulse: {
                    "0%, 100%": { opacity: "0.4" },
                    "50%": { opacity: "0.8" },
                },
            },
        },
    },
    plugins: [],
}
