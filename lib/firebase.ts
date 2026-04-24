import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB739h26CD1B2lkM0Wtb3aAnqPlrmsXlzs",
  authDomain: "run-local-8e93f.firebaseapp.com",
  projectId: "run-local-8e93f",
  storageBucket: "run-local-8e93f.firebasestorage.app",
  messagingSenderId: "950486741923",
  appId: "1:950486741923:web:1b6254fb8c15d0b4dda016",
  measurementId: "G-JSW1B2K586"
};

// Validate variables to prevent obscure Firebase crash
if (typeof window !== 'undefined' && !firebaseConfig.apiKey) {
  console.error("FATAL: Firebase API Key is missing. You MUST add your Firebase credentials to your .env.local file!");
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(app);
