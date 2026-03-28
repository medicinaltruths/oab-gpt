// oab-web/src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getDownloadURL, getStorage, ref } from "firebase/storage";

// These must be present in .env.local as NEXT_PUBLIC_FIREBASE_*
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let app: FirebaseApp;
export function getClientApp() {
  if (!app) app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

/** Silently ensure an anonymous user, then return their uid */
export async function ensureAnonUser(): Promise<string> {
  const a = getAuth(getClientApp());
  // If already signed in, return uid
  if (a.currentUser?.uid) return a.currentUser.uid;

  // Wait for initial auth state (avoids racing)
  const existing = await new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(a, (u) => {
      unsub();
      resolve(u);
    });
  });
  if (existing?.uid) return existing.uid;

  // Otherwise sign in anonymously
  const cred = await signInAnonymously(a);
  return cred.user.uid;
}

/** Ensure an anonymous session exists, then return a fresh ID token. */
export async function ensureAnonIdToken(forceRefresh = false): Promise<string> {
  await ensureAnonUser();
  const a = getAuth(getClientApp());
  if (!a.currentUser) {
    throw new Error("Firebase user unavailable after anonymous sign-in");
  }
  return a.currentUser.getIdToken(forceRefresh);
}

/** Resolve a Firebase Storage path to a download URL for the signed-in user. */
export async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  const storage = getStorage(getClientApp());
  return getDownloadURL(ref(storage, storagePath));
}
