import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { type MascotEmotion, resolveEmotion, randomMessage } from './mascotMessages';

/** Image map — all emotion PNGs in /public/mascot/ */
const emotionImages: Record<string, string> = {
  idle:      '/mascot/idle.png',
  wave:      '/mascot/wave.png',
  celebrate: '/mascot/celebrate.png',
  hopeful:   '/mascot/hopeful.png',
  sad:       '/mascot/sad.png',
  oops:      '/mascot/oops.png',
  hyped:     '/mascot/hyped.png',
  thinking:  '/mascot/thinking.png',
};

/** Framer Motion animation variants per emotion */
const emotionVariants: Record<string, object> = {
  idle: {
    y: [0, -6, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
  wave: {
    rotate: [0, 15, -10, 15, 0],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  celebrate: {
    scale: [1, 1.15, 0.95, 1.1, 1],
    rotate: [0, -5, 5, -3, 0],
    transition: { duration: 0.8, repeat: 2, ease: 'easeOut' },
  },
  hopeful: {
    y: [0, -4, 0],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  sad: {
    y: [0, 4, 0],
    rotate: [0, -3, 0],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
  oops: {
    rotate: [-10, 10, -10, 5, 0],
    transition: { duration: 0.5, repeat: 2, ease: 'easeInOut' },
  },
  hyped: {
    scale: [1, 1.2, 0.9, 1.15, 1],
    y: [0, -12, 4, -8, 0],
    transition: { duration: 0.7, repeat: 2, ease: 'easeOut' },
  },
  thinking: {
    rotate: [0, 5, 0, -5, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
  },
};

interface MascotProps {
  emotion: MascotEmotion;
  /** Show the speech bubble with a message */
  showMessage?: boolean;
  /** Custom message override — if not provided, picks randomly */
  message?: string;
  /** Size in px of the mascot image */
  size?: number;
  className?: string;
  /** Runs once on mount, then reverts to idle */
  autoRevertToIdle?: boolean;
  autoRevertDelay?: number;
}

export function Mascot({
  emotion,
  showMessage = true,
  message,
  size = 120,
  className,
  autoRevertToIdle = false,
  autoRevertDelay = 3000,
}: MascotProps) {
  const resolvedEmotion = resolveEmotion(emotion);
  const imgSrc = emotionImages[resolvedEmotion] ?? emotionImages.idle;
  const variant = emotionVariants[resolvedEmotion] ?? emotionVariants.idle;

  const [displayedMessage, setDisplayedMessage] = useState<string>('');
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    const msg = message ?? randomMessage(resolvedEmotion);
    setDisplayedMessage(msg);
    if (showMessage && msg) {
      // Slight delay so the mascot appears before the bubble
      const t = setTimeout(() => setShowBubble(true), 400);
      return () => clearTimeout(t);
    }
  }, [resolvedEmotion, message, showMessage]);

  // Auto-revert to idle after a delay
  useEffect(() => {
    if (autoRevertToIdle && resolvedEmotion !== 'idle') {
      const t = setTimeout(() => setShowBubble(false), autoRevertDelay - 600);
      return () => clearTimeout(t);
    }
  }, [resolvedEmotion, autoRevertToIdle, autoRevertDelay]);

  return (
    <div className={`relative flex flex-col items-center ${className ?? ''}`}>
      {/* Speech bubble */}
      <AnimatePresence>
        {showBubble && displayedMessage && (
          <motion.div
            key={displayedMessage}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full mb-2 z-10"
          >
            <div className="bg-[#1a1830] border border-white/20 text-foreground text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl shadow-black/40 whitespace-nowrap max-w-[200px] text-center leading-snug">
              {displayedMessage}
              {/* Tail */}
              <div className="absolute bottom-[-7px] left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#1a1830] border-b border-r border-white/20 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mascot image */}
      <motion.div
        key={resolvedEmotion}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, ...variant }}
        exit={{ scale: 0.8, opacity: 0 }}
        style={{ width: size, height: size }}
        className="relative select-none"
        aria-hidden="true"
      >
        <img
          src={imgSrc}
          alt={`Mascot: ${resolvedEmotion}`}
          className="w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(168,85,247,0.5)]"
          draggable={false}
        />
      </motion.div>
    </div>
  );
}
