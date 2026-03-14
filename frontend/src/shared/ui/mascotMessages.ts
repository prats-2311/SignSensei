/**
 * Mascot emotion type — all possible states the hand mascot can express.
 * 'success' and 'error' map to 'celebrate' and 'sad' for display.
 */
export type MascotEmotion =
  | 'idle'       // Open palm floating, neutral
  | 'wave'       // Waving hello
  | 'celebrate'  // ILY sign, confetti — perfect score
  | 'hopeful'    // Thumb up with soft eyes — low score but encouraging
  | 'sad'        // Drooping, failed boss stage
  | 'oops'       // Wagging finger — wrong sign
  | 'hyped'      // Rock-on horns — high combo or boss cleared
  | 'thinking'   // Chin-tap — practice mode / waiting
  // Legacy aliases used by AI tool calls (mapped internally)
  | 'success'    // → celebrate
  | 'error'      // → sad
  | 'listening'; // → thinking

/** Speech bubble messages by emotion and score */
export const MASCOT_MESSAGES: Record<string, string[]> = {
  idle: [
    'Ready to sign! 🌟',
    "Let's practice some ASL!",
    'What will we learn today?',
  ],
  wave: [
    'Hey there! Welcome back! 👋',
    "Great to see you again!",
    'Ready to level up your ASL?',
  ],
  celebrate: [
    'PERFECT! You crushed it! 🎉',
    'AMAZING! That was flawless!',
    '3 stars?! You are unstoppable! ⭐⭐⭐',
    'YES! That signing was beautiful!',
  ],
  hopeful: [
    "You'll get it next time! 👍",
    "Almost there! Keep practicing!",
    "Don't give up — progress is progress!",
    "Every signer started where you are!",
  ],
  sad: [
    "Oof, that was tough. Try again! 💪",
    "The boss got you — but you'll beat it!",
    "Even pros have bad days. You've got this.",
  ],
  oops: [
    "Hmm, not quite! Let's try that again.",
    "Almost! There's a subtle difference here.",
    "Watch the hand position — you can do it!",
  ],
  hyped: [
    "COMBO! You are ON FIRE! 🔥",
    "Look at you go! Keep it up!",
    "Now that's some CLEAN signing! ⚡",
  ],
  thinking: [
    "Take your time — I'm watching! 👀",
    'Say "Done" when you\'re ready to grade.',
    "Need a hint? Just ask!",
  ],

  // Aliases handled in Mascot.tsx
  success: [],
  error: [],
  listening: [],
};

/** Map legacy AI emotion states to display states */
export function resolveEmotion(emotion: MascotEmotion): MascotEmotion {
  if (emotion === 'success') return 'celebrate';
  if (emotion === 'error') return 'sad';
  if (emotion === 'listening') return 'thinking';
  return emotion;
}

/** Select the right emotion from a star score (1–3) */
export function emotionFromScore(score: number): MascotEmotion {
  if (score === 3) return 'hyped';
  if (score === 2) return 'celebrate';
  if (score === 1) return 'hopeful';
  return 'sad';
}

/** Pick a random message for an emotion */
export function randomMessage(emotion: MascotEmotion): string {
  const resolved = resolveEmotion(emotion);
  const msgs = MASCOT_MESSAGES[resolved] ?? MASCOT_MESSAGES.idle;
  if (msgs.length === 0) return '';
  return msgs[Math.floor(Math.random() * msgs.length)];
}
