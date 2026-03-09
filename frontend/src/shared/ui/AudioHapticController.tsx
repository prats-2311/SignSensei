import { useEffect } from 'react';
import { useLessonStore } from '../../stores/useLessonStore';
import confetti from 'canvas-confetti';

// Global AudioContext instance
let audioCtx: AudioContext | null = null;

// Helper to create the Audio Context
const getAudioContext = () => {
    if (!audioCtx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

// Global initializer to unlock the Web Audio API on first user interaction
const initAudioContextHelper = () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    // Remove listener once we've unlocked it
    window.removeEventListener('click', initAudioContextHelper);
    window.removeEventListener('touchstart', initAudioContextHelper);
};

// Add global event listeners for the first user interaction
if (typeof window !== 'undefined') {
    window.addEventListener('click', initAudioContextHelper, { once: true });
    window.addEventListener('touchstart', initAudioContextHelper, { once: true });
}

export function AudioHapticController() {
  const { mascotEmotion } = useLessonStore();

  // Helper function to synthesize retro 8-bit sounds natively
  const playPureTone = (frequency: number, type: OscillatorType, duration: number) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    // Web Audio requires resumption after user gesture
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    // Simple ADSR amplitude envelope to prevent clicks
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    // Use setTargetAtTime instead of exponentialRamp to avoid negative value errors in older browsers
    gainNode.gain.setTargetAtTime(0, ctx.currentTime + 0.05, duration / 3);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  useEffect(() => {
    
    if (mascotEmotion === 'success') {
      
      // Haptics (10ms light pulse for success if supported)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
         navigator.vibrate(10);
      }
      
      // Visual Confetti
      confetti({
         particleCount: 150,
         spread: 80,
         origin: { y: 0.6 },
         colors: ['#4ade80', '#facc15', '#60a5fa', '#f87171'],
         zIndex: 200,
         disableForReducedMotion: true
      });
      
      // Audio "Ding" (Major third rising arpeggio)
      playPureTone(523.25, 'sine', 0.1); // C5
      setTimeout(() => playPureTone(659.25, 'sine', 0.15), 100); // E5
      
    } else if (mascotEmotion === 'error') {
      
      // Haptics (Double pulse for error)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
         navigator.vibrate([50, 30, 50]);
      }
      
      // Audio "Bzzt" (Low discordant crunch)
      playPureTone(150, 'sawtooth', 0.2); 
      setTimeout(() => playPureTone(142, 'sawtooth', 0.25), 50); 
    }
  }, [mascotEmotion]);

  return null; // Purely functional, no DOM nodes required
}
