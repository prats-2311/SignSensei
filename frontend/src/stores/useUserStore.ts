import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  streak: number;
  gems: number;
  completedLessons: string[]; // IDs of completed lessons
  
  // Actions
  incrementStreak: () => void;
  addGems: (amount: number) => void;
  completeLesson: (lessonId: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      streak: 1,
      gems: 50,
      completedLessons: [],

      incrementStreak: () => set((state) => ({ streak: state.streak + 1 })),
      
      addGems: (amount) => set((state) => ({ gems: state.gems + amount })),
      
      completeLesson: (lessonId) => set((state) => {
        if (state.completedLessons.includes(lessonId)) return state;
        return { completedLessons: [...state.completedLessons, lessonId] };
      }),
    }),
    {
      name: 'signsensei-user-storage', // unique name
    }
  )
);
