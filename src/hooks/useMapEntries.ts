import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { mapPriceEntryDoc } from '../services/priceEntryService';
import type { PriceEntry } from '../types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// Safety cap on how many pins we ever pull down at once. This app doesn't
// do live viewport-based re-querying as you pan/zoom the map (a real
// bounding-box or geohash query is a good amount of extra complexity for
// this stage) — instead it fetches the most recent entries within 7 days
// across all users and lets the map simply not render whatever falls
// outside the visible region.
const QUERY_LIMIT = 300;

// Live-updating set of price entries from ALL users in the last 7 days —
// used by the map. Filtering to "last 7 days" happens in the query itself
// (an index range, not a client-side check), per the spec's requirement
// that old entries never even come down to the device.
// Listeners are gated on screen focus. A bottom-tab navigator keeps every
// screen mounted, so without this the Map and Dashboard queries keep
// streaming documents while the user is sitting on Home — billed reads
// for pixels nobody is looking at. On blur the effect's cleanup detaches
// the listener; on focus it re-attaches. Existing state is deliberately
// NOT cleared on blur, so returning to the tab shows the last known data
// immediately instead of an empty screen.
export function useMapEntries() {
  const isFocused = useIsFocused();
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Blur re-runs this effect, which detaches the listener via cleanup
    // and then attaches nothing.
    if (!isFocused) return;
    const since = Timestamp.fromMillis(Date.now() - SEVEN_DAYS_MS);
    const mapQuery = query(
      collection(db, 'priceEntries'),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'desc'),
      limit(QUERY_LIMIT)
    );

    const unsubscribe = onSnapshot(
      mapQuery,
      (snapshot) => {
        setEntries(snapshot.docs.map((doc) => mapPriceEntryDoc(doc.id, doc.data())));
        setLoading(false);
      },
      (queryError) => {
        // See the matching comment in useRecentEntries — a rejected query
        // (usually a missing composite index) must not look like "no pins".
        console.warn(`[useMapEntries] query failed:`, queryError?.message ?? queryError);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [isFocused]);

  return { entries, loading };
}
