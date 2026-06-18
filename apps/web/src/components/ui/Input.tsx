import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-11 w-full rounded-xl border border-[#e5e5ea] bg-[#fafafa] px-4 py-2 text-sm text-[#18181b] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#a1a1aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D76D77]/20 focus-visible:border-[#D76D77]/40 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 hover:border-[#d2d2d7]",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
