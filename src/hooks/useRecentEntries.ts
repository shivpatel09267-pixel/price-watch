import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { mapPriceEntryDoc } from '../services/priceEntryService';
import type { PriceEntry } from '../types';

// Live-updating list of a single user's most recent price entries. Used by
// the Home screen's "last 5 logged entries" list — a live listener means
// a freshly-submitted entry appears immediately with no manual refetch.
export function useRecentEntries(userId: string | undefined, count: number = 5) {
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const entriesQuery = query(
      collection(db, 'priceEntries'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(count)
    );

    const unsubscribe = onSnapshot(
      entriesQuery,
      (snapshot) => {
        setEntries(snapshot.docs.map((docSnap) => mapPriceEntryDoc(docSnap.id, docSnap.data())));
        setLoading(false);
      },
      (queryError) => {
        // Never swallow this. A missing composite index shows up here and
        // nowhere else — silently rendering an empty list instead makes it
        // look like "no data" when it's really "query rejected". Firestore
        // puts a create-this-index link directly in the message.
        console.warn(`[useRecentEntries] query failed:`, queryError?.message ?? queryError);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId, count]);

  return { entries, loading };
}
