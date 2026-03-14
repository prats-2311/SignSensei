import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../shared/lib/firebase';

interface UserState {
  // Stats
  xp: number;
  streak: number;
  gems: number;
  lastPlayedDate: string;
  
  // Progression
  unlockedLessonIds: string[];
  weakWords: Record<string, number>;
  lessonScores: Record<string, number>;
  
  // Actions
  incrementXP: (amount: number) => void;
  incrementStreak: () => void;
  addGems: (amount: number) => void;
  unlockLesson: (lessonId: string) => void;
  recordWeakWord: (word: string) => void;
  setLessonScore: (lessonId: string, score: number) => void;
  setStoreFromFirestore: (data: Partial<UserState>) => void;
  updateLastPlayedDate: (dateStr: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      xp: 0,
      streak: 1,
      gems: 50,
      lastPlayedDate: '',
      unlockedLessonIds: ['the-basics'], // Start with the first module unlocked
      weakWords: {},
      lessonScores: {},
      
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

      setLessonScore: (lessonId, score) => set((state) => ({
        lessonScores: {
          ...state.lessonScores,
          [lessonId]: Math.max(state.lessonScores[lessonId] || 0, score)
        }
      })),

      setStoreFromFirestore: (data) => set((state) => ({ ...state, ...data })),
      updateLastPlayedDate: (dateStr) => set({ lastPlayedDate: dateStr }),
    }),
    {
      name: 'signsensei-user-storage',
    }
  )
);

// --- FIRESTORE SYNC LOGIC ---
let isHydrating = false;

if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          isHydrating = true; // prevent the subscription from firing a write immediately
          useUserStore.getState().setStoreFromFirestore({
            xp: data.stats?.xp ?? 0,
            gems: data.stats?.gems ?? 50,
            streak: data.stats?.currentStreak ?? 1,
            lastPlayedDate: data.stats?.lastPlayedDate ?? '',
            unlockedLessonIds: data.progression?.unlockedLessonIds ?? ['the-basics'],
            lessonScores: data.progression?.lessonScores ?? {},
            weakWords: data.learningData?.weakWords ?? {},
          });
          isHydrating = false;
        }
      } catch (error) {
        console.error("Error fetching user data from Firestore:", error);
      }
    }
  });

  // Subscribe to Zustand changes and write to Firestore
  useUserStore.subscribe((state) => {
    if (isHydrating) return;
    
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    
    // Format matching the agreed schema
    const firestoreData = {
      stats: {
        xp: state.xp,
        gems: state.gems,
        currentStreak: state.streak,
        lastPlayedDate: state.lastPlayedDate
      },
      progression: {
        unlockedLessonIds: state.unlockedLessonIds,
        lessonScores: state.lessonScores
      },
      learningData: {
        weakWords: state.weakWords
      }
    };

    setDoc(userRef, firestoreData, { merge: true }).catch(console.error);
  });
}
