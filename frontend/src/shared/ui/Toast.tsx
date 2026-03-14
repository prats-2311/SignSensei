import { create } from 'zustand';
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/cn';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Hook for triggering toasts from any component */
export function useToast() {
  const { addToast } = useToastStore();
  return {
    success: (message: string, duration?: number) =>
      addToast({ type: 'success', message, duration }),
    error: (message: string, duration?: number) =>
      addToast({ type: 'error', message, duration }),
    warning: (message: string, duration?: number) =>
      addToast({ type: 'warning', message, duration }),
    info: (message: string, duration?: number) =>
      addToast({ type: 'info', message, duration }),
  };
}

const toastConfig: Record<ToastType, { icon: React.ReactNode; styles: string }> = {
  success: {
    icon: <CheckCircle className="w-5 h-5 text-green-400" />,
    styles: 'border-green-500/30 bg-green-500/10',
  },
  error: {
    icon: <XCircle className="w-5 h-5 text-red-400" />,
    styles: 'border-red-500/30 bg-red-500/10',
  },
  warning: {
    icon: <AlertCircle className="w-5 h-5 text-yellow-400" />,
    styles: 'border-yellow-500/30 bg-yellow-500/10',
  },
  info: {
    icon: <Info className="w-5 h-5 text-blue-400" />,
    styles: 'border-blue-500/30 bg-blue-500/10',
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore();
  const config = toastConfig[toast.type];
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'flex items-start gap-3 px-4 py-3',
        'rounded-2xl border shadow-xl shadow-black/40',
        'backdrop-blur-xl bg-white/5',
        config.styles,
        'max-w-sm w-full'
      )}
      role="alert"
      aria-live="assertive"
    >
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <p className="text-sm font-medium text-foreground flex-1">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

/** Render this once at the app root */
export function ToastController() {
  const { toasts } = useToastStore();

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 items-center pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2 items-center">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
