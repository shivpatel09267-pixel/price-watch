import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from '@firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  // True only until we know, for certain, whether a session is already
  // persisted (checked once on cold start) AND — once a user is known —
  // until their Firestore profile has loaded. RootNavigator shows a
  // spinner for this instead of the Auth screens or Onboarding, so a
  // returning user with a zip code already set never sees an incorrect
  // flash of the onboarding screen while their profile is still loading.
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    // A live listener (not a one-time getDoc) so the app reacts the moment
    // OnboardingScreen writes a zip code, with no manual navigation call
    // needed — RootNavigator just re-renders once userProfile updates.
    const unsubscribeProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUserProfile({
            uid: data.uid,
            email: data.email,
            zipCode: data.zipCode ?? '',
            createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
          });
        } else {
          setUserProfile(null);
        }
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );
    return unsubscribeProfile;
  }, [user]);

  const loading = initializing || (user !== null && profileLoading);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
