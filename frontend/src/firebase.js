import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Values come from Firebase Console -> Project Settings -> General ->
// Your apps -> Web app -> SDK setup and configuration. These are safe to
// expose in client code (that's how Firebase web apps are designed to
// work) — the config below is not itself a secret.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
