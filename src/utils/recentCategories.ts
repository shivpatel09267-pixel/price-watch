import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CategoryId } from '../constants/categories';

const STORAGE_KEY = 'priceWatch:recentCategories';
const MAX_RECENT = 8;

// Remembers which items this person actually logs. With 47 categories,
// scrolling the full grid every time is the main friction in the log
// flow — and in practice people report the same handful of things over
// and over, so surfacing those first removes most of the scrolling.
export async function getRecentCategories(): Promise<CategoryId[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CategoryId[]) : [];
  } catch {
    return [];
  }
}

export async function rememberCategory(category: CategoryId): Promise<void> {
  try {
    const existing = await getRecentCategories();
    // Most recent first, no duplicates.
    const next = [category, ...existing.filter((id) => id !== category)].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort convenience feature — never block logging over it.
  }
}
