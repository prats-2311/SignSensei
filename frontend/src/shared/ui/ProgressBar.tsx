import { motion } from "framer-motion";
import { cn } from "../lib/cn";

interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  className?: string;
  color?: string;
}

export function ProgressBar({ value, max = 100, className, color = "#58cc02" }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={cn(
        "h-4 w-full overflow-hidden rounded-full bg-slate-200",
        className
      )}
    >
      <motion.div
        className="h-full rounded-full transition-all"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      >
        <div className="h-full w-full bg-white/20 opacity-30 rounded-full mt-1 ml-2 transform scale-x-90 origin-left" />
      </motion.div>
    </div>
  );
}
