// Single source of truth for the Firebase connection. Every other service
// file (auth actions, Firestore queries) imports `auth`/`db` from here
// instead of calling initializeApp() itself.
import { getApp, getApps, initializeApp } from 'firebase/app';
// Imported from the scoped @firebase/auth package rather than the
// `firebase/auth` wrapper: in the installed SDK version, the wrapper's
// package exports don't route to the React Native build, so
// getReactNativePersistence isn't reachable through it.
import {
  browserLocalPersistence,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from '@firebase/auth';
import { Platform } from 'react-native';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reads from .env (see .env.example for the shape). Not committed to git —
// each teammate needs their own copy with the real values (share them
// directly, e.g. in your team chat — they're not secret, but keeping them
// out of source control makes it easy to point at a different Firebase
// project later, e.g. for testing, without touching code).
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill in your Firebase config.`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requiredEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requiredEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('EXPO_PUBLIC_FIREBASE_APP_ID'),
};

// getApps()/getApp() guards against "Firebase App named '[DEFAULT]' already
// exists" errors, which otherwise happen during Metro Fast Refresh in
// development (this module re-running without the app fully restarting).
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// React Native has no browser localStorage, so Firebase Auth needs to be
// told explicitly to persist sessions in AsyncStorage instead. Without
// this, `auth` still works, but every user would be logged out on every
// app restart — which breaks the "returning users skip straight to the
// main app" requirement.
// On web there is no AsyncStorage and `firebase/auth` resolves to the
// browser build, where getReactNativePersistence doesn't exist at all —
// calling it throws at module load and nothing renders. Web already has
// localStorage, so browserLocalPersistence gives the same "stay logged in
// across reloads" behaviour there.
export const auth: Auth = initializeAuth(app, {
  persistence:
    Platform.OS === 'web'
      ? browserLocalPersistence
      : getReactNativePersistence(AsyncStorage),
});

// IMPORTANT — the third argument ('default') is not a typo or a no-op.
//
// Firestore's *special* default database has the literal ID "(default)",
// parentheses included. This project doesn't have one: the database that
// actually exists here is a regular NAMED database whose name happens to
// be the word "default" (no parentheses) — confirm any time with
// `npx firebase firestore:databases:list`.
//
// Without this third argument the SDK silently targets "(default)", which
// doesn't exist, and the failure mode is nasty: reads quietly return zero
// documents and writes hang forever with no error, alongside a repeating
// "Database '(default)' not found" warning in the Metro logs.
//
// Creating a real "(default)" database would be the more conventional
// setup, but that specific API call requires the paid Blaze plan (it's
// also why `firebase deploy --only firestore:rules` fails here — it tries
// to create "(default)" first). Since this project stays on the free
// Spark plan, we point at the named database instead.
//
// experimentalAutoDetectLongPolling is unrelated defensive config: it lets
// Firestore fall back to HTTP long-polling on networks that interfere with
// its normal streaming connection.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, 'default');
