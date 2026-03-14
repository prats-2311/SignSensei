import { motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from './Button';
import { Mascot } from './Mascot';
import { TOUR_STEPS } from './tourSteps';
import { useUserStore } from '../../stores/useUserStore';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface TourOverlayProps {
  onComplete: () => void;
}

export function TourOverlay({ onComplete }: TourOverlayProps) {
  const [step, setStep] = useState(0);
  const { completeTour } = useUserStore();
  const current = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setStep((s) => s - 1);
  };

  const handleComplete = () => {
    completeTour();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center">
      {/* Semi-transparent backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Tour card — anchored to bottom on mobile */}
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="relative z-10 w-full max-w-sm bg-[#1a1830] border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-accent" />

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-4">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-white/15'
              }`}
            />
          ))}
        </div>

        <div className="px-6 pt-3 pb-6 flex flex-col gap-4">
          {/* Mascot */}
          <div className="flex justify-center">
            <Mascot
              emotion={step === 0 ? 'wave' : step === TOUR_STEPS.length - 1 ? 'hyped' : 'thinking'}
              size={100}
              showMessage={false}
            />
          </div>

          {/* Content */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-black text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
          </div>

          {/* Step label */}
          <p className="text-center text-xs text-muted-foreground/60 font-semibold">
            Step {step + 1} of {TOUR_STEPS.length}
          </p>

          {/* Navigation */}
          <div className="flex gap-3">
            {!isFirst && (
              <Button
                variant="ghost"
                className="flex-none w-12 px-0"
                onClick={handlePrev}
                aria-label="Previous step"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <Button
              className="flex-1 font-black text-base"
              onClick={handleNext}
              aria-label={isLast ? 'Finish tour' : 'Next step'}
            >
              {isLast ? "Let's Sign! 🤟" : (
                <span className="flex items-center gap-1">
                  Next <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </div>

          {/* Skip */}
          <button
            onClick={handleComplete}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors text-center"
          >
            Skip tour
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={handleComplete}
          aria-label="Close tour"
          className="absolute top-4 right-4 p-1.5 rounded-xl text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}
