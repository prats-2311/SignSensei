import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// TODO: Replace with actual Firebase configuration
// These should ideally be in process.env / import.meta.env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_MOCK_KEY_REPLACE_ME",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "signsensei-mock.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "signsensei-mock",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "signsensei-mock.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "sign-sensei-db");
export const auth = getAuth(app);

// Authenticate anonymously immediately on module load if not already
signInAnonymously(auth).catch((error) => {
  console.error("Anonymous authentication failed:", error);
});
