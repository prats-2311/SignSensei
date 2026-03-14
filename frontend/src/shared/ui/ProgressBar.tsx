import { motion } from "framer-motion";
import { cn } from "../lib/cn";

type ProgressBarSize = 'sm' | 'md' | 'lg';

interface ProgressBarProps {
  value: number; // 0 to max
  max?: number;
  className?: string;
  color?: string;
  size?: ProgressBarSize;
  label?: string;
  animated?: boolean;
}

const sizeMap: Record<ProgressBarSize, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-4',
};

export function ProgressBar({
  value,
  max = 100,
  className,
  color,
  size = 'md',
  label,
  animated = true,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = color ?? 'var(--color-primary)';

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-white/10",
        sizeMap[size],
        className
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? `Progress: ${Math.round(percentage)}%`}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          backgroundColor: barColor,
          boxShadow: `0 0 8px ${barColor}80`,
        }}
        initial={{ width: 0 }}
        animate={{ width: animated ? `${percentage}%` : `${percentage}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      />
    </div>
  );
}
