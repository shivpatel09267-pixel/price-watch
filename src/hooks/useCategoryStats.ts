import { useEffect, useState } from 'react';
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
import { mean } from '../utils/stats';
import { isWithinLocalRadius, type LatLng } from '../utils/geo';
import type { UnitDimension } from '../constants/units';
import type { CategoryId } from '../constants/categories';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// Cap on how many recent entries get pulled before the distance filter
// runs client-side. Comfortably above this app's data volume; a much
// larger dataset would want geohash-based querying instead.
const LOCAL_QUERY_LIMIT = 500;

export interface PricePoint {
  // Always the NORMALISED price (per lb / per gallon / per item). Raw
  // shelf prices stopped being comparable the moment people started
  // logging whatever package size they actually bought — averaging a
  // 5 lb bag against a 1 lb bag would produce a meaningless number.
  price: number;
  timestamp: number;
}

export interface CategoryStats {
  // The signed-in user's own entries for this category, last 30 days,
  // oldest first — used for both the chart and "Your average".
  personalEntries: PricePoint[];
  yourAverage: number | null;
  // Mean of every VERIFIED entry (any user) within 20 miles, last 30 days
  // — deliberately excludes unverified/flagged entries (Feature 5),
  // unlike personalEntries which shows the user everything they logged,
  // verified or not, since that view is their own personal record.
  localAverage: number | null;
  // How many reports each average is actually built from. Worth surfacing:
  // when you're the only person who has logged an item nearby, the local
  // average is legitimately just your own price, and without a count that
  // reads like a bug rather than a thin dataset.
  yourReportCount: number;
  localReportCount: number;
  // What the averages are measured in, so the UI can label them "per lb"
  // rather than leaving a bare number. Null when there's no data yet.
  dimension: UnitDimension | null;
  loading: boolean;
}

// "Local" means a true 20-mile radius around `origin` (the user's current
// coordinates), not a zip-code match — a store a mile away across a zip
// boundary counts, and the far end of a sprawling rural zip doesn't.
// `category` is nullable because an item whose product had no
// recognisable category has no comparable population — there's nothing to
// average it against, so both queries are skipped rather than run with a
// bogus filter.
export function useCategoryStats(
  userId: string | undefined,
  origin: LatLng | null,
  category: CategoryId | null
): CategoryStats {
  const [personalEntries, setPersonalEntries] = useState<PricePoint[]>([]);
  const [localPrices, setLocalPrices] = useState<number[]>([]);
  const [dimension, setDimension] = useState<UnitDimension | null>(null);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    if (!userId || !category) {
      setPersonalEntries([]);
      setDimension(null);
      setPersonalLoading(false);
      return;
    }
    setPersonalLoading(true);
    // Cleared on every category change so a previous item's unit label
    // can't linger over the new item's numbers.
    setDimension(null);
    const since = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);
    const personalQuery = query(
      collection(db, 'priceEntries'),
      where('userId', '==', userId),
      where('category', '==', category),
      where('timestamp', '>=', since),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(
      personalQuery,
      (snapshot) => {
        const points: PricePoint[] = [];
        let seenDimension: UnitDimension | null = null;
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const pricePerBase = data.pricePerBase as number | undefined;
          // Entries whose unit couldn't be normalised are simply left out
          // of the average rather than folded in at their raw price,
          // which would quietly distort it.
          if (typeof pricePerBase !== 'number') continue;
          const timestamp = data.timestamp as Timestamp | null;
          points.push({ price: pricePerBase, timestamp: timestamp?.toMillis() ?? Date.now() });
          seenDimension ??= (data.dimension as UnitDimension | undefined) ?? null;
        }
        setPersonalEntries(points);
        if (seenDimension) setDimension(seenDimension);
        setPersonalLoading(false);
      },
      (queryError) => {
        console.warn(
          `[useCategoryStats] personal query failed:`,
          queryError?.message ?? queryError
        );
        setPersonalLoading(false);
      }
    );
    return unsubscribe;
  }, [userId, category]);

  useEffect(() => {
    if (!origin || !category) {
      setLocalPrices([]);
      setLocalLoading(false);
      return;
    }
    setLocalLoading(true);
    const since = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);
    // Note there's no zipCode filter here any more: "local" is a real
    // 20-mile radius now, so the distance test happens below in JS.
    // Firestore can't range-filter on two fields (lat AND lng) in one
    // query, and a proper radius query needs geohashing — for this app's
    // data volume, fetching the recent verified entries for one item and
    // measuring distance client-side is simpler and accurate.
    const localQuery = query(
      collection(db, 'priceEntries'),
      where('category', '==', category),
      where('verified', '==', true),
      where('timestamp', '>=', since),
      limit(LOCAL_QUERY_LIMIT)
    );
    const unsubscribe = onSnapshot(
      localQuery,
      (snapshot) => {
        const nearby = snapshot.docs
          .map((doc) => doc.data())
          .filter(
            (data) =>
              typeof data.pricePerBase === 'number' &&
              typeof data.latitude === 'number' &&
              typeof data.longitude === 'number' &&
              isWithinLocalRadius(origin, {
                latitude: data.latitude as number,
                longitude: data.longitude as number,
              })
          );
        setLocalPrices(nearby.map((data) => data.pricePerBase as number));
        const seenDimension = nearby.find((data) => data.dimension)?.dimension as
          UnitDimension | undefined;
        if (seenDimension) setDimension((current) => current ?? seenDimension);
        setLocalLoading(false);
      },
      (queryError) => {
        console.warn(
          `[useCategoryStats] local-average query failed:`,
          queryError?.message ?? queryError
        );
        setLocalLoading(false);
      }
    );
    return unsubscribe;
  }, [origin?.latitude, origin?.longitude, category]);

  return {
    personalEntries,
    yourAverage: personalEntries.length > 0 ? mean(personalEntries.map((e) => e.price)) : null,
    localAverage: localPrices.length > 0 ? mean(localPrices) : null,
    yourReportCount: personalEntries.length,
    localReportCount: localPrices.length,
    dimension,
    loading: personalLoading || localLoading,
  };
}
