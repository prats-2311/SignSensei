import React from 'react';
import { cn } from '../lib/cn';

type BadgeVariant = 'xp' | 'streak' | 'gem' | 'star' | 'default';

interface BadgeProps {
  icon: React.ReactNode;
  value: string | number;
  variant?: BadgeVariant;
  className?: string;
  label?: string; // Screen-reader label
}

const variantConfig: Record<BadgeVariant, { glow: string; text: string; bg: string }> = {
  xp: {
    bg: 'bg-purple-500/15 border-purple-500/30',
    text: 'text-purple-300',
    glow: 'shadow-purple-500/20',
  },
  streak: {
    bg: 'bg-orange-500/15 border-orange-500/30',
    text: 'text-orange-300',
    glow: 'shadow-orange-500/20',
  },
  gem: {
    bg: 'bg-blue-400/15 border-blue-400/30',
    text: 'text-blue-300',
    glow: 'shadow-blue-400/20',
  },
  star: {
    bg: 'bg-yellow-400/15 border-yellow-400/30',
    text: 'text-yellow-300',
    glow: 'shadow-yellow-400/20',
  },
  default: {
    bg: 'bg-white/8 border-white/15',
    text: 'text-foreground',
    glow: 'shadow-white/5',
  },
};

export function Badge({ icon, value, variant = 'default', className, label }: BadgeProps) {
  const config = variantConfig[variant];

  return (
    <div
      role="status"
      aria-label={label ?? String(value)}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5',
        'rounded-full border text-sm font-bold',
        'shadow-lg',
        config.bg,
        config.text,
        config.glow,
        className
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

/** Inline minimal badge — for use inside other elements */
export function MicroBadge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  const config = variantConfig[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold',
        config.bg,
        config.text,
        className
      )}
    >
      {children}
    </span>
  );
}
