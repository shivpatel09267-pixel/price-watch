import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { captureLocation } from './locationService';
import { computeVerificationStatus } from './dataQualityService';
import { withTimeout } from '../utils/async';
import { distanceInMiles, LOCAL_RADIUS_MILES, type LatLng } from '../utils/geo';
import { pricePerBaseUnit, type UnitDimension } from '../constants/units';
import type { CategoryId } from '../constants/categories';
import type { NearbyStore } from './storeService';
import type { PriceEntry } from '../types';

// This exists so a slow/flaky connection can't hang the submit flow
// indefinitely, NOT to fail fast — 20s is deliberately generous, since a
// too-short timeout here causes a worse bug than a slow one: the write
// can still land a few seconds after our client gives up and reports
// failure (Firestore doesn't cancel it just because we stopped waiting),
// so the entry appears anyway a moment later despite the shown error.
const FIRESTORE_TIMEOUT_MS = 20000;

export interface LogPriceParams {
  userId: string;
  fallbackZip: string;
  store: NearbyStore;
  // What was bought.
  productName: string;
  brand: string | null;
  barcode: string | null;
  category: CategoryId | null;
  // What was paid, and for how much.
  price: number;
  amount: number;
  unitId: string;
}

// Where an entry gets pinned on the map, and how precisely.
//
// For a store OpenStreetMap already knows about, these are the SHOP's
// coordinates and OSM address — public facts about a business, so they're
// stored exactly as-is.
//
// A hand-typed store is different: there's no mapped shop to borrow a
// position from, so the entry is pinned to the REPORTER'S own device
// coordinates (see StorePicker). Every signed-in user can read every
// entry, and entries carry userId and a timestamp — so storing those at
// full GPS precision would publish a trace of exactly where a named
// person stood, and when. Rounding to 2 decimal places blurs that to
// roughly a kilometre, which costs nothing downstream: the coordinates
// are only used to filter by a 20-mile radius and to drop a map pin.
function pinnedLocation(store: NearbyStore): {
  latitude: number;
  longitude: number;
  address: string | null;
} {
  const isManual = store.id.startsWith('manual/');
  if (!isManual) {
    return { latitude: store.latitude, longitude: store.longitude, address: store.address };
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    latitude: round(store.latitude),
    longitude: round(store.longitude),
    // Manual stores already carry no address; being explicit stops a
    // reverse-geocoded one being introduced here later by accident.
    address: null,
  };
}

export async function logPriceEntry({
  userId,
  fallbackZip,
  store,
  productName,
  brand,
  barcode,
  category,
  price,
  amount,
  unitId,
}: LogPriceParams): Promise<{ zipCode: string; origin: LatLng }> {
  // The device's own location is captured only to derive the zip code and
  // to prove the reporter was at the store (the proximity check happens
  // in the UI). The entry itself is pinned to the STORE's coordinates.
  const { zipCode } = await captureLocation(fallbackZip);
  const { latitude, longitude, address } = pinnedLocation(store);

  const normalised = pricePerBaseUnit(price, amount, unitId);

  // Outlier/corroboration check runs against the NORMALISED price, so a
  // large pack isn't mistaken for an outlier next to a small one.
  const status = await computeVerificationStatus({
    category,
    zipCode,
    pricePerBase: normalised?.pricePerBase ?? null,
    nowMs: Date.now(),
  });

  // A hand-typed store at coordinates with no mapped shop is the one
  // path where the app has only the reporter's word that they were at a
  // store at all. Such an entry is kept — it may well be a real shop the
  // map is missing — but never counts as verified, so it stays out of
  // local averages, the cheapest-nearby list, and other entries'
  // corroboration. Enforced here rather than in the UI so it holds no
  // matter which screen calls this.
  const verified = store.locationCorroborated ? status.verified : false;
  const flaggedOutlier = status.flaggedOutlier;

  await withTimeout(
    addDoc(collection(db, 'priceEntries'), {
      userId,
      productName,
      // Firestore rejects `undefined`, so optional fields are only
      // included when they actually have a value.
      ...(brand ? { brand } : {}),
      ...(barcode ? { barcode } : {}),
      ...(category ? { category } : {}),
      price,
      amount,
      unitId,
      ...(normalised
        ? { pricePerBase: normalised.pricePerBase, dimension: normalised.dimension }
        : {}),
      latitude,
      longitude,
      zipCode,
      ...(address ? { address } : {}),
      storeName: store.name,
      storeId: store.id,
      ...(store.branch ? { storeBranch: store.branch } : {}),
      timestamp: serverTimestamp(),
      verified,
      ...(flaggedOutlier ? { flaggedOutlier: true } : {}),
    }),
    FIRESTORE_TIMEOUT_MS
  );

  return { zipCode, origin: { latitude, longitude } };
}

// Turns a raw Firestore document into a PriceEntry.
//
// Shared by both live listeners so the two can't drift apart, and
// deliberately forgiving about missing fields: entries written before a
// schema change still have to render rather than crash the list.
export function mapPriceEntryDoc(id: string, data: Record<string, unknown>): PriceEntry {
  const timestamp = data.timestamp as Timestamp | null;
  return {
    id,
    userId: data.userId as string,
    productName: (data.productName as string | undefined) ?? 'Unknown item',
    brand: (data.brand as string | undefined) ?? null,
    barcode: (data.barcode as string | undefined) ?? null,
    category: (data.category as CategoryId | undefined) ?? null,
    price: data.price as number,
    amount: (data.amount as number | undefined) ?? 1,
    unitId: (data.unitId as string | undefined) ?? 'each',
    pricePerBase: (data.pricePerBase as number | undefined) ?? null,
    dimension: (data.dimension as UnitDimension | undefined) ?? null,
    latitude: data.latitude as number,
    longitude: data.longitude as number,
    zipCode: data.zipCode as string,
    address: (data.address as string | undefined) ?? null,
    storeName: (data.storeName as string | undefined) ?? null,
    storeBranch: (data.storeBranch as string | undefined) ?? null,
    storeId: (data.storeId as string | undefined) ?? null,
    timestamp: timestamp?.toMillis() ?? Date.now(),
    verified: data.verified as boolean,
    flaggedOutlier: (data.flaggedOutlier as boolean | undefined) ?? false,
  };
}

export interface CheapestNearby {
  id: string;
  productName: string;
  brand: string | null;
  price: number;
  amount: number;
  unitId: string;
  pricePerBase: number | null;
  dimension: UnitDimension | null;
  latitude: number;
  longitude: number;
  timestamp: number;
  distanceMiles: number;
  address: string | null;
  storeName: string | null;
  storeBranch: string | null;
}

// What "the same item" means for a cheapest-nearby search.
export interface CheapestTarget {
  // The exact product, when it came from the product database.
  barcode: string | null;
  // The broader item type, used when nobody nearby has logged this exact
  // barcode — far more likely with a small user base.
  category: CategoryId | null;
  productName: string;
}

export interface CheapestNearbyResult {
  results: CheapestNearby[];
  // Lets the UI be honest about what it found: prices for this exact
  // product, or for comparable items of the same kind.
  matchedBy: 'product' | 'category' | 'none';
}

const CHEAPEST_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const QUERY_SAFETY_LIMIT = 200;

function toCheapestNearby(
  doc: { id: string; data: () => Record<string, unknown> },
  origin: LatLng
): CheapestNearby {
  const data = doc.data();
  const timestamp = data.timestamp as Timestamp | null;
  const latitude = data.latitude as number;
  const longitude = data.longitude as number;
  return {
    id: doc.id,
    productName: (data.productName as string | undefined) ?? 'Unknown item',
    brand: (data.brand as string | undefined) ?? null,
    price: data.price as number,
    amount: (data.amount as number | undefined) ?? 1,
    unitId: (data.unitId as string | undefined) ?? 'each',
    pricePerBase: (data.pricePerBase as number | undefined) ?? null,
    dimension: (data.dimension as UnitDimension | undefined) ?? null,
    latitude,
    longitude,
    timestamp: timestamp?.toMillis() ?? Date.now(),
    address: (data.address as string | undefined) ?? null,
    storeName: (data.storeName as string | undefined) ?? null,
    storeBranch: (data.storeBranch as string | undefined) ?? null,
    distanceMiles: distanceInMiles(origin, { latitude, longitude }),
  };
}

async function queryCheapest(
  field: 'barcode' | 'category',
  value: string,
  origin: LatLng
): Promise<CheapestNearby[]> {
  const since = Timestamp.fromMillis(Date.now() - CHEAPEST_LOOKBACK_MS);
  const cheapestQuery = query(
    collection(db, 'priceEntries'),
    where(field, '==', value),
    where('verified', '==', true),
    where('timestamp', '>=', since),
    limit(QUERY_SAFETY_LIMIT)
  );

  const snapshot = await withTimeout(getDocs(cheapestQuery), FIRESTORE_TIMEOUT_MS);

  return (
    snapshot.docs
      .map((doc) => toCheapestNearby(doc, origin))
      .filter((entry) => entry.distanceMiles <= LOCAL_RADIUS_MILES)
      // Ranks on the NORMALISED price where available, so a 2 lb bag
      // genuinely beats a 1 lb bag at the same total price rather than
      // looking worse. Sorting happens client-side because Firestore won't
      // order by one field while range-filtering on another.
      .sort((a, b) => (a.pricePerBase ?? a.price) - (b.pricePerBase ?? b.price))
  );
}

// Recent verified reports for one item near the user, cheapest first.
//
// Tries the exact product first, then falls back to the whole category.
// The exact barcode is the truest match but will usually have no nearby
// reports yet, so falling back is what makes the feature useful on day
// one — and `matchedBy` keeps the UI from overstating what it found.
export async function findCheapestNearbyList(
  target: CheapestTarget,
  origin: LatLng
): Promise<CheapestNearbyResult> {
  if (target.barcode) {
    const exact = await queryCheapest('barcode', target.barcode, origin);
    if (exact.length > 0) return { results: exact, matchedBy: 'product' };
  }

  if (target.category) {
    const similar = await queryCheapest('category', target.category, origin);
    if (similar.length > 0) return { results: similar, matchedBy: 'category' };
  }

  return { results: [], matchedBy: 'none' };
}

export async function findCheapestNearby(
  target: CheapestTarget,
  origin: LatLng
): Promise<CheapestNearbyResult> {
  const { results, matchedBy } = await findCheapestNearbyList(target, origin);
  return { results: results.slice(0, 1), matchedBy };
}


// Deleting is owner-only, enforced in firestore.rules:
//   allow delete: if request.auth.uid == resource.data.userId
// so there's no need to re-check ownership here — a request for someone
// else's entry is rejected by the server regardless of what the client
// believes.
export async function deletePriceEntry(entryId: string): Promise<void> {
  await withTimeout(deleteDoc(doc(db, 'priceEntries', entryId)), FIRESTORE_TIMEOUT_MS);
}

// Wipes every price this user has logged.
//
// IMPORTANT — what this does NOT remove: the `users/{uid}` profile
// document (email, zip code, createdAt). firestore.rules has
// `allow delete: if false` on that collection, so the client genuinely
// cannot delete it, and the Firebase Auth account itself also survives.
// The UI has to say "your logged prices", not "your account", or it's
// promising something it can't do.
export async function deleteAllPriceEntriesForUser(userId: string): Promise<number> {
  const snapshot = await withTimeout(
    getDocs(query(collection(db, 'priceEntries'), where('userId', '==', userId))),
    FIRESTORE_TIMEOUT_MS
  );
  if (snapshot.empty) return 0;

  // Firestore caps a batch at 500 writes, and someone who has been
  // logging prices for a while can exceed that.
  const BATCH_LIMIT = 500;
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const entry of docs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(entry.ref);
    }
    await withTimeout(batch.commit(), FIRESTORE_TIMEOUT_MS);
  }
  return docs.length;
}
