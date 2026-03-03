import { create } from 'zustand';

interface LessonState {
  combo: number;
  currentSign: string;
  feedback: string | null;
  status: 'idle' | 'listening' | 'success' | 'error';
  
  // New split architecture states
  referenceSign: string | null;
  mascotEmotion: 'idle' | 'success' | 'error' | 'listening';
  isLessonComplete: boolean;

  // Path Tracking Architecture
  activeLessonId: string | null;
  lessonPath: string[];
  currentStepIndex: number;
  isAiPaused: boolean;
  
  // Actions
  initializeLesson: (lessonId: string, path: string[]) => void;
  setAiPaused: (paused: boolean) => void;
  resetCombo: () => void;
  setFeedback: (message: string, status: LessonState['status']) => void;
  setCurrentSign: (sign: string) => void;
  setReferenceSign: (sign: string | null) => void;
  setMascotEmotion: (emotion: LessonState['mascotEmotion']) => void;
  setLessonComplete: (isComplete: boolean) => void;
  advanceStep: () => void;
  resetLesson: () => void;
}

export const useLessonStore = create<LessonState>((set) => ({
  combo: 0,
  currentSign: '',
  feedback: null,
  status: 'idle',
  referenceSign: null,
  mascotEmotion: 'idle',
  isLessonComplete: false,
  
  activeLessonId: null,
  lessonPath: [],
  currentStepIndex: 0,
  isAiPaused: false,

  initializeLesson: (lessonId, path) => set({
      activeLessonId: lessonId,
      lessonPath: path,
      currentStepIndex: 0,
      isAiPaused: false,
      isLessonComplete: false,
      status: 'idle',
      feedback: null,
      mascotEmotion: 'idle'
  }),

  setAiPaused: (paused) => set({ isAiPaused: paused }),

  resetCombo: () => set({ combo: 0, status: 'error', mascotEmotion: 'error' }),

  setFeedback: (message, status) => set({ feedback: message, status }),

  setCurrentSign: (sign) => set({ currentSign: sign }),

  setReferenceSign: (sign) => set({ referenceSign: sign }),

  setMascotEmotion: (emotion) => set({ mascotEmotion: emotion }),

  setLessonComplete: (isComplete) => set({ isLessonComplete: isComplete }),

  advanceStep: () => set((state) => {
    if (state.currentStepIndex < state.lessonPath.length - 1) {
      return { 
          currentStepIndex: state.currentStepIndex + 1,
          status: 'idle',
          feedback: null,
          mascotEmotion: 'idle'
      };
    } else {
        return { isLessonComplete: true };
    }
  }),

  resetLesson: () => set({ 
    combo: 0, 
    currentSign: '', 
    feedback: null, 
    status: 'idle',
    referenceSign: null,
    mascotEmotion: 'idle',
    isLessonComplete: false,
    currentStepIndex: 0,
    activeLessonId: null,
    isAiPaused: false
  }),
}));
