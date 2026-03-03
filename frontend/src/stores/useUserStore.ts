import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  // Stats
  xp: number;
  streak: number;
  gems: number;
  
  // Progression
  unlockedLessonIds: string[];
  weakWords: Record<string, number>;
  
  // Actions
  incrementXP: (amount: number) => void;
  incrementStreak: () => void;
  addGems: (amount: number) => void;
  unlockLesson: (lessonId: string) => void;
  recordWeakWord: (word: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      xp: 0,
      streak: 1,
      gems: 50,
      unlockedLessonIds: ['the-basics'], // Start with the first module unlocked
      weakWords: {},
      
      incrementXP: (amount) => set((state) => ({ xp: state.xp + amount })),
      incrementStreak: () => set((state) => ({ streak: state.streak + 1 })),
      addGems: (amount) => set((state) => ({ gems: state.gems + amount })),
      
      unlockLesson: (lessonId) => set((state) => {
        if (state.unlockedLessonIds.includes(lessonId)) return state;
        return { unlockedLessonIds: [...state.unlockedLessonIds, lessonId] };
      }),

      recordWeakWord: (word) => set((state) => ({
        weakWords: {
          ...state.weakWords,
          [word]: (state.weakWords[word] || 0) + 1
        }
      })),
    }),
    {
      name: 'signsensei-user-storage',
    }
  )
);
