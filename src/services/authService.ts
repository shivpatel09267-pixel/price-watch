// Thin wrapper around Firebase Auth + the `users` Firestore collection.
// Screens call these functions rather than touching `auth`/`db` directly.
//
// Imported from '@firebase/auth' (not the 'firebase/auth' wrapper) to stay
// consistent with services/firebase.ts — see the comment there for why.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { withTimeout } from '../utils/async';

// Same reasoning as the rest of the app: a hung network call should
// surface as an error, never as a spinner that never resolves.
const FIRESTORE_TIMEOUT_MS = 20000;

export async function signUp(email: string, password: string): Promise<void> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  // Create the Firestore profile immediately. zipCode starts blank —
  // OnboardingScreen (shown automatically right after this, see
  // RootNavigator) fills it in.
  await setDoc(doc(db, 'users', credential.user.uid), {
    uid: credential.user.uid,
    email: credential.user.email,
    zipCode: '',
    createdAt: serverTimestamp(),
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

// Saves the zip code from the onboarding screen.
//
// Has to handle two cases, not one. Normally the profile document already
// exists (signUp created it) and this is a plain update. But a signed-in
// user can legitimately have NO profile document — e.g. their Firebase
// Auth account outlived the Firestore data, or signUp's second write
// failed after the account itself was created. In that case a
// `{ zipCode }`-only merge would try to CREATE a document, and the
// security rules reject a new `users` doc that's missing `uid`/`email`,
// which showed up as onboarding silently bouncing back to itself.
export async function setUserZipCode(uid: string, zipCode: string): Promise<void> {
  const profileRef = doc(db, 'users', uid);
  const existing = await withTimeout(getDoc(profileRef), FIRESTORE_TIMEOUT_MS);

  if (existing.exists()) {
    // Update path — deliberately touches only zipCode, since the rules
    // require uid/email/createdAt to stay exactly as they were.
    await withTimeout(setDoc(profileRef, { zipCode }, { merge: true }), FIRESTORE_TIMEOUT_MS);
    return;
  }

  // Create path — must include every field the create rule checks for.
  await withTimeout(
    setDoc(profileRef, {
      uid,
      email: auth.currentUser?.email ?? '',
      zipCode,
      createdAt: serverTimestamp(),
    }),
    FIRESTORE_TIMEOUT_MS
  );
}
