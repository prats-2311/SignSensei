import { create } from 'zustand';

interface LessonState {
  xp: number;
  combo: number;
  currentSign: string;
  feedback: string | null;
  status: 'idle' | 'listening' | 'success' | 'error';
  
  // Actions
  incrementXP: (amount: number) => void;
  resetCombo: () => void;
  setFeedback: (message: string, status: LessonState['status']) => void;
  setCurrentSign: (sign: string) => void;
  resetLesson: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  xp: 0,
  combo: 0,
  currentSign: '',
  feedback: null,
  status: 'idle',

  incrementXP: (amount) => set((state) => ({ 
    xp: state.xp + amount,
    combo: state.combo + 1,
    status: 'success'
  })),

  resetCombo: () => set({ combo: 0, status: 'error' }),

  setFeedback: (message, status) => set({ feedback: message, status }),

  setCurrentSign: (sign) => set({ currentSign: sign }),

  resetLesson: () => set({ 
    xp: 0, 
    combo: 0, 
    currentSign: '', 
    feedback: null, 
    status: 'idle' 
  }),
}));
