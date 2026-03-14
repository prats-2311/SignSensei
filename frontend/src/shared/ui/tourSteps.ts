/** Tour step definition */
export interface TourStep {
  id: string;
  /** CSS selector or data-tour attribute to highlight */
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: 'body',
    title: "Welcome to SignSensei! 🤟",
    description: "Your AI-powered ASL tutor. Let me show you around! This quick tour will help you get started.",
    position: 'center',
  },
  {
    id: 'lesson-node',
    target: '[data-tour="lesson-node"]',
    title: "Lesson Nodes",
    description: "Tap any glowing circle to start a lesson. Complete it to unlock the next one and earn stars!",
    position: 'bottom',
  },
  {
    id: 'ai-input',
    target: '[data-tour="ai-input"]',
    title: "AI Lesson Generator ✨",
    description: "Type anything here — kitchen items, travel, emotions — and our AI builds a custom ASL lesson just for you!",
    position: 'bottom',
  },
  {
    id: 'daily-goal',
    target: '[data-tour="daily-goal"]',
    title: "Daily Goal",
    description: "Earn 100 XP each day to keep your streak alive. Practice a little every day for the best results.",
    position: 'bottom',
  },
  {
    id: 'nav-decks',
    target: '[data-tour="nav-decks"]',
    title: "Your Decks",
    description: "All your AI-generated lessons are saved here as decks. Play any deck again or share it with the community!",
    position: 'top',
  },
  {
    id: 'nav-profile',
    target: '[data-tour="nav-profile"]',
    title: "Your Profile",
    description: "Track your progress, review lesson history, and see which words you need to practice more.",
    position: 'top',
  },
];
