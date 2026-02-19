import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../lib/cn";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center rounded-2xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[4px]";
    
    const variants = {
      primary: "bg-[#58cc02] text-white hover:bg-[#46a302] shadow-[#46a302]", // Duolingo Green
      secondary: "bg-[#1cb0f6] text-white hover:bg-[#1899d6] shadow-[#1899d6]", // Duolingo Blue
      outline: "border-2 border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-slate-200",
      danger: "bg-[#ff4b4b] text-white hover:bg-[#d40000] shadow-[#d40000]",
      ghost: "bg-transparent text-slate-500 hover:bg-slate-100 shadow-none active:translate-y-0",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-8 text-base",
      lg: "h-14 px-10 text-lg",
      icon: "h-10 w-10 p-0",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.95 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

export { Button };
