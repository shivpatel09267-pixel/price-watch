import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'priceWatch:showPriceContext';

interface SettingsContextValue {
  showPriceContext: boolean;
  setShowPriceContext: (value: boolean) => void;
  // True once the persisted value (if any) has been read from
  // AsyncStorage — lets consumers avoid a flash of the default before the
  // real saved preference loads.
  loaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// Global, persisted app preferences. Currently just the "Show price
// context" toggle (Feature 6B), but a natural place to add more later.
// Backed by AsyncStorage rather than Firestore since this is a per-device
// display preference, not account data that needs to sync anywhere.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [showPriceContext, setShowPriceContextState] = useState(true); // default ON per spec
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored !== null) setShowPriceContextState(stored === 'true');
      })
      .catch(() => {
        // If the read fails for some reason, just keep the default (ON)
        // rather than blocking the app on a settings preference.
      })
      .finally(() => setLoaded(true));
  }, []);

  function setShowPriceContext(value: boolean) {
    setShowPriceContextState(value);
    AsyncStorage.setItem(STORAGE_KEY, String(value)).catch(() => {
      // Best-effort persistence — if this fails, the toggle still works
      // for the rest of this session, it just won't survive a restart.
    });
  }

  return (
    <SettingsContext.Provider value={{ showPriceContext, setShowPriceContext, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
