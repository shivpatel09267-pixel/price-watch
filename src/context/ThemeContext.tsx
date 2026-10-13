import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, makeCard, type ColorPalette } from '../constants/theme';

const STORAGE_KEY = 'priceWatch:themePreference';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface AppTheme {
  scheme: ColorScheme;
  colors: ColorPalette;
  card: ViewStyle;
}

const themes: Record<ColorScheme, AppTheme> = {
  dark: { scheme: 'dark', colors: darkColors, card: makeCard(darkColors) },
  light: { scheme: 'light', colors: lightColors, card: makeCard(lightColors) },
};

interface ThemeContextValue extends AppTheme {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Light / dark / follow-the-phone. Persisted per device in AsyncStorage,
// same as the other display preferences in SettingsContext.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  // Light until the user picks something else.
  const [preference, setPreferenceState] = useState<ThemePreference>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'system' || stored === 'light' || stored === 'dark') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {
        // Keep the default rather than block the app on a display setting.
      });
  }, []);

  function setPreference(value: ThemePreference) {
    setPreferenceState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {
      // Best-effort — the choice still applies for this session.
    });
  }

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo(
    () => ({ ...themes[scheme], preference, setPreference }),
    [scheme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

// Declares a component's styles as a function of the theme and returns a
// hook that hands back the right set. Each scheme's StyleSheet is built
// once, on first use, so switching themes never rebuilds styles per render.
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: AppTheme) => T
): () => T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  return function useStyles() {
    const { scheme } = useTheme();
    return (cache[scheme] ??= StyleSheet.create(factory(themes[scheme])));
  };
}
