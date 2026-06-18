import * as React from "react"

import { cn } from "../../lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass" | "gradient"
    size?: "default" | "sm" | "lg" | "icon"
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", style, ...props }, ref) => {
        const Comp = "button"

        const variants: Record<string, string> = {
            default: "bg-[#18181b] text-white hover:bg-[#27272a] shadow-md shadow-black/10 active:scale-[0.98]",
            destructive: "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/20",
            outline: "border border-[#e5e5ea] bg-white text-[#18181b] hover:bg-[#f5f5f7] hover:border-[#d2d2d7] shadow-sm",
            secondary: "bg-[#f5f5f7] text-[#18181b] hover:bg-[#ebebed] border border-[#e5e5ea] shadow-sm",
            ghost: "text-[#3f3f46] hover:bg-[#f5f5f7] hover:text-[#18181b]",
            link: "text-[#18181b] underline-offset-4 hover:underline",
            glass: "bg-white/90 backdrop-blur-lg border border-[#e5e5ea] text-[#18181b] hover:bg-white shadow-sm",
            gradient: "bg-[#1a1a2e] text-white shadow-lg hover:shadow-xl hover:bg-[#2a2a4e] hover:scale-[1.02] active:scale-[0.98]",
        }

        const sizes: Record<string, string> = {
            default: "h-10 px-5 py-2",
            sm: "h-9 rounded-lg px-3.5 text-[13px]",
            lg: "h-12 rounded-xl px-8 text-[15px]",
            icon: "h-10 w-10",
        }

        const gradientStyle = style

        return (
            <Comp
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c2185b]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    variants[variant],
                    sizes[size],
                    className
                )}
                style={gradientStyle}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
