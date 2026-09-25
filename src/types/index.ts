import type { CategoryId } from '../constants/categories';
import type { UnitDimension } from '../constants/units';

// Mirrors a document in the Firestore `priceEntries` collection.
//
// Entries are product-first: people search for or scan the exact item
// they bought, then enter what they paid and for how much of it. The
// generic `category` is still recorded, but it's derived automatically
// rather than chosen — it's what links an entry to a BLS series and lets
// unrelated brands of the same item be averaged together.
export interface PriceEntry {
  id: string; // Firestore document id, attached client-side after reading
  userId: string;

  // --- What was bought ---
  productName: string;
  brand: string | null;
  barcode: string | null;
  // Derived from the product's Open Food Facts tags, or chosen by the
  // user when the product isn't in the database (gas, household goods).
  // Null when nothing could be determined — such entries still display,
  // they just can't be compared against a national figure.
  category: CategoryId | null;

  // --- What was paid ---
  price: number;
  // How much the price covers, e.g. 1 gallon, 18 each, 28 oz.
  amount: number;
  unitId: string;
  // price normalised to a per-pound / per-gallon / per-item basis. This
  // is what averages and comparisons actually use, so a 28 oz jar and a
  // 16 oz jar of the same thing are directly comparable. Null when the
  // unit couldn't be normalised.
  pricePerBase: number | null;
  dimension: UnitDimension | null;

  // --- Where ---
  latitude: number;
  longitude: number;
  zipCode: string;
  address?: string | null;
  storeName?: string | null;
  storeBranch?: string | null;
  storeId?: string | null;

  // --- When / trust ---
  timestamp: number; // millis since epoch, converted from Firestore Timestamp
  verified: boolean;
  flaggedOutlier?: boolean;
}

// Mirrors a document in the Firestore `users` collection.
export interface UserProfile {
  uid: string;
  email: string;
  zipCode: string;
  createdAt: number;
}
