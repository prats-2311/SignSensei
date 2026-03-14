import { Trophy, Star } from 'lucide-react';
import { Button } from './Button';
import { GlassCard } from './GlassCard';
import { Mascot } from './Mascot';
import { useLessonStore } from '../../stores/useLessonStore';
import { useUserStore } from '../../stores/useUserStore';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { emotionFromScore } from './mascotMessages';

interface VictoryModalProps {
  onContinue: () => void;
}

export function VictoryModal({ onContinue }: VictoryModalProps) {
  const { finalScore, feedback } = useLessonStore();
  const { streak, xp } = useUserStore();
  const [revealedStars, setRevealedStars] = useState(0);

  const starCount = finalScore ?? 0;
  const mascotEmotion = emotionFromScore(starCount);

  // Duolingo-style sequential star fill animation
  useEffect(() => {
    if (finalScore === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= finalScore; i++) {
      timers.push(setTimeout(() => setRevealedStars(i), i * 600));
    }
    return () => timers.forEach(clearTimeout);
  }, [finalScore]);

  const scoreLabel =
    starCount === 3 ? "Perfect!" :
    starCount === 2 ? "Great job!" :
    starCount === 1 ? "You'll grow!" :
    "Keep practicing!";

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Lesson complete"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-sm"
      >
        <GlassCard variant="elevated" className="overflow-visible text-center">
          {/* Accent bar */}
          <div className={`h-1.5 w-full rounded-t-3xl ${starCount === 3 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : starCount >= 2 ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : 'bg-gradient-to-r from-indigo-600 to-purple-700'}`} />

          <div className="px-6 pt-4 pb-6 flex flex-col items-center gap-5">
            {/* Mascot — floats above the card */}
            <div className="-mt-2">
              <Mascot
                emotion={mascotEmotion}
                size={130}
                showMessage={true}
                autoRevertToIdle={false}
              />
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">
                Lesson Complete!
              </h2>
              <p className="text-muted-foreground font-medium text-sm mt-0.5">{scoreLabel}</p>
            </div>

            {/* 3-Star Rating */}
            <div className="flex justify-center items-end space-x-3 py-1">
              {[1, 2, 3].map((star) => {
                const isEarned = star <= starCount;
                const isRevealed = star <= revealedStars;
                const isMiddle = star === 2;
                return (
                  <motion.div
                    key={star}
                    className={isMiddle ? 'scale-125 -translate-y-1' : ''}
                    animate={isRevealed && isEarned ? { scale: [1, 1.3, 1], rotate: [0, -8, 8, 0] } : {}}
                    transition={{ duration: 0.5, delay: star * 0.05 }}
                  >
                    <Star
                      className={`w-12 h-12 transition-all duration-500 ${
                        isRevealed && isEarned
                          ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)]'
                          : 'text-white/15'
                      }`}
                      strokeWidth={1.5}
                    />
                  </motion.div>
                );
              })}
            </div>

            {/* Feedback message */}
            {feedback && (
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-left">
                <p className="text-sm text-foreground/90 italic leading-snug">
                  "{feedback}"
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-3 text-center">
                <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-0.5">Total XP</div>
                <div className="text-2xl font-black text-purple-300">+{xp}</div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 text-center">
                <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                  <Trophy className="w-3 h-3" /> Streak
                </div>
                <div className="text-2xl font-black text-orange-300">{streak}</div>
              </div>
            </div>

            <Button
              className="w-full h-14 text-base font-black uppercase tracking-widest shadow-lg shadow-primary/30"
              variant="primary"
              onClick={onContinue}
            >
              Continue 🤟
            </Button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
