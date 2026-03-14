import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';


interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-desc"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative z-10 w-full max-w-sm bg-[#1a1830] border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60 overflow-hidden"
          >
            {/* Warning accent bar */}
            {confirmVariant === 'danger' && (
              <div className="h-1 w-full bg-gradient-to-r from-red-500 to-orange-500" />
            )}

            <div className="px-6 pt-6 pb-6 flex flex-col gap-4">
              {/* Icon + Title */}
              <div className="flex items-start gap-4">
                {confirmVariant === 'danger' && (
                  <div className="p-2.5 rounded-2xl bg-red-500/15 border border-red-500/25 shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                )}
                <div>
                  <h2 id="confirm-title" className="text-lg font-bold text-foreground">
                    {title}
                  </h2>
                  <p id="confirm-desc" className="text-sm text-muted-foreground mt-1">
                    {message}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={onClose}
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
                  className="flex-1"
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
