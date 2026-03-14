import React from 'react';
import { cn } from '../lib/cn';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'base' | 'elevated' | 'surface';
  onClick?: () => void;
  hover?: boolean;
  as?: React.ElementType;
}

const variantStyles = {
  base: 'bg-white/5 backdrop-blur-md border border-white/10',
  elevated: 'bg-white/[0.08] backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/40',
  surface: 'bg-white/[0.03] border border-white/5',
};

export function GlassCard({
  children,
  className,
  variant = 'base',
  onClick,
  hover = false,
  as: Component = 'div',
  ...props
}: GlassCardProps & React.HTMLAttributes<HTMLElement>) {
  return (
    <Component
      onClick={onClick}
      className={cn(
        'rounded-3xl',
        variantStyles[variant],
        hover && 'cursor-pointer transition-all duration-200 hover:bg-white/[0.12] hover:border-white/20 hover:shadow-primary/10',
        onClick && 'cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

interface GlassCardHeaderProps {
  children: React.ReactNode;
  className?: string;
  accent?: string; // CSS color for the top accent line
}

export function GlassCardHeader({ children, className, accent }: GlassCardHeaderProps) {
  return (
    <div className={cn('relative px-6 pt-5 pb-3', className)}>
      {accent && (
        <div
          className="absolute top-0 left-6 right-6 h-0.5 rounded-full"
          style={{ background: accent }}
        />
      )}
      {children}
    </div>
  );
}

export function GlassCardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn('text-lg font-bold text-foreground', className)}>{children}</h3>
  );
}

export function GlassCardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('px-6 pb-5 pt-2', className)}>{children}</div>;
}
