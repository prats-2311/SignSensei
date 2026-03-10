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
  hasUserSignaledDone: boolean;

  // Path Tracking Architecture
  activeLessonId: string | null;
  lessonPath: string[];
  currentStepIndex: number;
  isAiPaused: boolean;
  
  // Actions
  initializeLesson: (lessonId: string, path: string[]) => void;
  setAiPaused: (paused: boolean) => void;
  setPracticeModeActive: (active: boolean) => void;
  setHasUserSignaledDone: (signaled: boolean) => void;
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
  hasUserSignaledDone: false,

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
      finalScore: null,
      hasUserSignaledDone: false
  }),

  setAiPaused: (paused) => set({ isAiPaused: paused }),

  setPracticeModeActive: (active: boolean) => set({ isPracticeModeActive: active }),

  setHasUserSignaledDone: (signaled: boolean) => set({ hasUserSignaledDone: signaled }),

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
          isPracticeModeActive: false,
          hasUserSignaledDone: false
          // Intentionally omitting status and mascotEmotion reset here 
          // so the success animation has 2000ms to breathe.
      };
    } else {
        // Transition to Boss Stage instead of completing the lesson immediately
        // CRITICAL BUG FIX (Missing Checkmark):
        // We must advance the index even on the last word so the UI renders the final checkmark!
        return { 
            currentStepIndex: state.currentStepIndex + 1,
            isBossStage: true, 
            isPracticeModeActive: false,
            hasUserSignaledDone: false
        };
    }
  }),

  completeLessonFlow: (score, feedback) => set(() => {
      const passedBossStage = score >= 3;
      
      return {
          finalScore: score,
          feedback: feedback,
          isPracticeModeActive: false,
          
          // CRITICAL BUG FIX (Double-Trigger Loop):
          // Only trigger the Victory Modal (isLessonComplete) if they actually passed the Boss Stage.
          // If they failed, keep them in the Boss Stage loop so they have to try again.
          isLessonComplete: passedBossStage,
          isBossStage: !passedBossStage,
          mascotEmotion: passedBossStage ? 'success' : 'error',
          status: passedBossStage ? 'success' : 'error' // Ensure the status briefly flashes so the UI updates
      };
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
    finalScore: null,
    hasUserSignaledDone: false
  }),
}));
