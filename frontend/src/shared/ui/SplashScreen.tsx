import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'subtitle' | 'done'>('logo');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('subtitle'), 800);
    const t2 = setTimeout(() => setPhase('done'), 2400);
    const t3 = setTimeout(() => onComplete(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-[#0A0A0F] overflow-hidden">
      {/* Cosmic background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e] opacity-90" />
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-indigo-500/15 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '6s' }} />

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Mascot bouncing in */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
        >
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <img
              src="/mascot/celebrate.png"
              alt="SignSensei mascot"
              className="w-40 h-40 object-contain drop-shadow-[0_8px_32px_rgba(168,85,247,0.6)]"
              draggable={false}
            />
          </motion.div>
        </motion.div>

        {/* App title */}
        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: phase !== 'logo' ? 1 : 0, y: phase !== 'logo' ? 0 : 20 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-black text-white tracking-tight">
            Sign<span className="text-primary">Sensei</span>
          </h1>
          <p className="text-muted-foreground text-sm font-medium tracking-wider">
            Learn ASL with AI
          </p>
        </motion.div>

        {/* Loading dots */}
        <motion.div
          className="flex gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'subtitle' ? 1 : 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
