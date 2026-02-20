import { create } from 'zustand';

interface LessonState {
  xp: number;
  combo: number;
  currentSign: string;
  feedback: string | null;
  status: 'idle' | 'listening' | 'success' | 'error';
  
  // New split architecture states
  referenceSign: string | null;
  mascotEmotion: 'idle' | 'success' | 'error' | 'listening';
  isLessonComplete: boolean;
  
  // Actions
  incrementXP: (amount: number) => void;
  resetCombo: () => void;
  setFeedback: (message: string, status: LessonState['status']) => void;
  setCurrentSign: (sign: string) => void;
  setReferenceSign: (sign: string | null) => void;
  setMascotEmotion: (emotion: LessonState['mascotEmotion']) => void;
  setLessonComplete: (isComplete: boolean) => void;
  resetLesson: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  xp: 0,
  combo: 0,
  currentSign: '',
  feedback: null,
  status: 'idle',
  referenceSign: null,
  mascotEmotion: 'idle',
  isLessonComplete: false,

  incrementXP: (amount) => set((state) => ({ 
    xp: state.xp + amount,
    combo: state.combo + 1,
    status: 'success',
    mascotEmotion: 'success'
  })),

  resetCombo: () => set({ combo: 0, status: 'error', mascotEmotion: 'error' }),

  setFeedback: (message, status) => set({ feedback: message, status }),

  setCurrentSign: (sign) => set({ currentSign: sign }),

  setReferenceSign: (sign) => set({ referenceSign: sign }),

  setMascotEmotion: (emotion) => set({ mascotEmotion: emotion }),

  setLessonComplete: (isComplete) => set({ isLessonComplete: isComplete }),

  resetLesson: () => set({ 
    xp: 0, 
    combo: 0, 
    currentSign: '', 
    feedback: null, 
    status: 'idle',
    referenceSign: null,
    mascotEmotion: 'idle',
    isLessonComplete: false
  }),
}));
