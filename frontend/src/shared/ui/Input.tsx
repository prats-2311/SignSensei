import React from 'react';
import { cn } from '../lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  error?: string;
  label?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ rightElement, leftElement, error, label, className, containerClassName, id, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-muted-foreground">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && (
            <div className="absolute left-4 text-muted-foreground pointer-events-none">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-2xl border px-4 py-3',
              'bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
              'transition-all duration-200',
              'text-base font-medium',
              leftElement && 'pl-10',
              rightElement && 'pr-12',
              error && 'border-destructive/50 focus:ring-destructive/30',
              props.disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center">{rightElement}</div>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
