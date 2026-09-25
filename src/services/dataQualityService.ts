import { collection, getDocs, limit, query, Timestamp, where } from 'firebase/firestore';
import { db } from './firebase';
import { mean, standardDeviation } from '../utils/stats';
import { withTimeout } from '../utils/async';
import type { CategoryId } from '../constants/categories';

const OUTLIER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CORROBORATION_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
const OUTLIER_STDDEV_THRESHOLD = 3;
const CORROBORATION_TOLERANCE = 0.15; // 15%
const MIN_BASELINE_ENTRIES = 3;
const MIN_CORROBORATING_ENTRIES = 2;
const QUERY_SAFETY_LIMIT = 200;
const QUERY_TIMEOUT_MS = 20000;

export interface VerificationResult {
  verified: boolean;
  flaggedOutlier: boolean;
}

interface VerificationInput {
  // Null for products whose category couldn't be determined — there's
  // nothing to compare such an entry against, so it's accepted as-is.
  category: CategoryId | null;
  zipCode: string;
  // Normalised price (per lb / gallon / item). Comparing raw prices would
  // flag a 5 lb bag as an outlier next to 1 lb bags of the same thing,
  // so all the statistics below run on this instead.
  pricePerBase: number | null;
  nowMs: number;
}

// Client-side stand-in for what the original design called a Cloud
// Function trigger — this project stays on Firebase's free Spark plan,
// which doesn't support Cloud Functions, so this runs here instead, right
// before the Firestore write in priceEntryService.ts.
//
// Like a single "on create" trigger would, it only looks at entries that
// already exist at submission time; it never goes back and re-verifies
// older entries once corroborating data arrives. A known limitation of
// having no background job, not a bug.
//
// Fails open: if a query errors or times out, the entry is accepted
// rather than blocked, since a network hiccup on a secondary check
// shouldn't stop someone logging a price.
export async function computeVerificationStatus({
  category,
  zipCode,
  pricePerBase,
  nowMs,
}: VerificationInput): Promise<VerificationResult> {
  // Without a category there's no comparable population, and without a
  // normalised price there's nothing meaningful to compare.
  if (!category || pricePerBase === null) {
    return { verified: true, flaggedOutlier: false };
  }

  try {
    // Step 1: outlier check against the established, already-verified
    // baseline for this item + zip over the last 7 days.
    const baselineSince = Timestamp.fromMillis(nowMs - OUTLIER_LOOKBACK_MS);
    const baselineQuery = query(
      collection(db, 'priceEntries'),
      where('category', '==', category),
      where('zipCode', '==', zipCode),
      where('verified', '==', true),
      where('timestamp', '>=', baselineSince),
      limit(QUERY_SAFETY_LIMIT)
    );
    const baselineSnapshot = await withTimeout(getDocs(baselineQuery), QUERY_TIMEOUT_MS);

    const baselinePrices = baselineSnapshot.docs
      .map((doc) => doc.data().pricePerBase as number | undefined)
      .filter((value): value is number => typeof value === 'number');

    if (baselinePrices.length < MIN_BASELINE_ENTRIES) {
      // Not enough established data to judge — accept it so the app isn't
      // empty during early use.
      return { verified: true, flaggedOutlier: false };
    }

    const baselineMean = mean(baselinePrices);
    const baselineStdDev = standardDeviation(baselinePrices);

    if (baselineStdDev > 0) {
      const zScore = Math.abs(pricePerBase - baselineMean) / baselineStdDev;
      if (zScore > OUTLIER_STDDEV_THRESHOLD) {
        return { verified: false, flaggedOutlier: true };
      }
    }

    // Step 2: corroboration — does this price roughly match what others
    // recently reported for the same item nearby? Outlier-flagged entries
    // don't count, so two bad prices can't validate each other.
    const corroborationSince = Timestamp.fromMillis(nowMs - CORROBORATION_WINDOW_MS);
    const corroborationQuery = query(
      collection(db, 'priceEntries'),
      where('category', '==', category),
      where('zipCode', '==', zipCode),
      where('timestamp', '>=', corroborationSince),
      limit(QUERY_SAFETY_LIMIT)
    );
    const corroborationSnapshot = await withTimeout(getDocs(corroborationQuery), QUERY_TIMEOUT_MS);

    const corroboratingCount = corroborationSnapshot.docs.filter((doc) => {
      const data = doc.data();
      if (data.flaggedOutlier === true) return false;
      const other = data.pricePerBase as number | undefined;
      if (typeof other !== 'number') return false;
      return Math.abs(other - pricePerBase) / pricePerBase <= CORROBORATION_TOLERANCE;
    }).length;

    return {
      verified: corroboratingCount >= MIN_CORROBORATING_ENTRIES,
      flaggedOutlier: false,
    };
  } catch (e) {
    console.warn('[dataQualityService] verification check failed, accepting entry:', e);
    return { verified: true, flaggedOutlier: false };
  }
}
