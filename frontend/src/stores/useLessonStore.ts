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
  isPracticeModeActive: boolean;
  isBossStage: boolean;
  finalScore: number | null;

  // Path Tracking Architecture
  activeLessonId: string | null;
  lessonPath: string[];
  currentStepIndex: number;
  isAiPaused: boolean;
  
  // Actions
  initializeLesson: (lessonId: string, path: string[]) => void;
  setAiPaused: (paused: boolean) => void;
  setPracticeModeActive: (active: boolean) => void;
  resetCombo: () => void;
  resetStatusToIdle: () => void;
  setFeedback: (message: string, status: LessonState['status']) => void;
  setCurrentSign: (sign: string) => void;
  setReferenceSign: (sign: string | null) => void;
  setMascotEmotion: (emotion: LessonState['mascotEmotion']) => void;
  setLessonComplete: (isComplete: boolean) => void;
  advanceStep: () => void;
  resetLesson: () => void;
  completeLessonFlow: (score: number, feedback: string) => void;
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
  isPracticeModeActive: false,
  isBossStage: false,
  finalScore: null,

  initializeLesson: (lessonId, path) => set({
      activeLessonId: lessonId,
      lessonPath: path,
      currentStepIndex: 0,
      isAiPaused: false,
      isLessonComplete: false,
      status: 'idle',
      feedback: null,
      mascotEmotion: 'idle',
      isBossStage: false,
      finalScore: null
  }),

  setAiPaused: (paused) => set({ isAiPaused: paused }),

  setPracticeModeActive: (active: boolean) => set({ isPracticeModeActive: active }),

  resetCombo: () => set({ combo: 0, status: 'error', mascotEmotion: 'error' }),
  
  resetStatusToIdle: () => set({ status: 'idle', mascotEmotion: 'idle' }),

  setFeedback: (message, status) => set({ feedback: message, status }),

  setCurrentSign: (sign) => set({ currentSign: sign }),

  setReferenceSign: (sign) => set({ referenceSign: sign }),

  setMascotEmotion: (emotion) => set({ mascotEmotion: emotion }),

  setLessonComplete: (isComplete) => set({ isLessonComplete: isComplete }),

  advanceStep: () => set((state) => {
    if (state.currentStepIndex < state.lessonPath.length - 1) {
      return { 
          currentStepIndex: state.currentStepIndex + 1,
          feedback: null,
          isPracticeModeActive: false
          // Intentionally omitting status and mascotEmotion reset here 
          // so the success animation has 2000ms to breathe.
      };
    } else {
        // Transition to Boss Stage instead of completing the lesson immediately
        return { isBossStage: true, isPracticeModeActive: false };
    }
  }),

  completeLessonFlow: (score, feedback) => set({
      isLessonComplete: true,
      finalScore: score,
      feedback: feedback,
      isBossStage: false,
      isPracticeModeActive: false,
      mascotEmotion: 'success'
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
    isAiPaused: false,
    isPracticeModeActive: false,
    isBossStage: false,
    finalScore: null
  }),
}));
