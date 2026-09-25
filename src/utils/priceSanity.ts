import type { NationalReference } from '../services/blsService';
import { baseUnitLabel, type UnitDimension } from '../constants/units';

// Hard bounds on how far a submitted price may sit from the official
// national average before the app refuses it outright.
//
// Deliberately wide. This is a "that can't be real" filter, not a
// "that seems high" filter — the statistical outlier check in
// dataQualityService.ts is what catches subtler nonsense, and it does so
// without blocking the entry. Tight bounds here would reject legitimate
// receipts: a national average covers store brands and premium brands
// alike, and organic or specialty versions of an item genuinely run 3-4x
// the conventional average.
const MAX_MULTIPLE_OF_NATIONAL = 5;
const MIN_MULTIPLE_OF_NATIONAL = 0.2;

export interface PriceSanityResult {
  ok: boolean;
  message?: string;
}

export interface NormalisedPrice {
  pricePerBase: number;
  dimension: UnitDimension;
}

// Rejects prices that can't plausibly be real for this item.
//
// Both sides are normalised to a per-pound / per-gallon / per-item basis
// first, which is what makes this check work at all now that people log
// whatever package size they actually bought — a $14 five-pound bag and a
// $3 one-pound bag are the same price once divided out.
//
// The check is skipped rather than guessed at whenever the two figures
// aren't genuinely comparable: no national series for the item, a unit
// that wouldn't normalise, or two different dimensions (a price per pound
// against a series published per gallon).
export function checkPriceAgainstNational(
  entered: NormalisedPrice | null,
  national: NationalReference | undefined,
  itemLabel: string
): PriceSanityResult {
  if (!entered || !national) return { ok: true };
  // An index trend is a percentage, not dollars — there is nothing to
  // bound a submitted price against, so those categories skip the check.
  if (national.kind !== 'average_price') return { ok: true };
  // `typeof`, not `!== null`: a cached payload from an older build can be
  // missing the field entirely, and `undefined` would slip past a null
  // check and turn every comparison below into NaN.
  if (typeof national.pricePerBase !== 'number' || !national.dimension) return { ok: true };
  if (national.dimension !== entered.dimension) return { ok: true };

  const max = national.pricePerBase * MAX_MULTIPLE_OF_NATIONAL;
  const min = national.pricePerBase * MIN_MULTIPLE_OF_NATIONAL;
  const label = baseUnitLabel(national.dimension);
  const nationalText = `$${national.pricePerBase.toFixed(2)} ${label}`;
  const enteredText = `$${entered.pricePerBase.toFixed(2)} ${label}`;

  if (entered.pricePerBase > max) {
    return {
      ok: false,
      message: `That works out to ${enteredText} — more than ${MAX_MULTIPLE_OF_NATIONAL}x the national average for ${itemLabel} (${nationalText}). Double-check the price and the amount.`,
    };
  }

  if (entered.pricePerBase < min) {
    return {
      ok: false,
      message: `That works out to ${enteredText} — less than a fifth of the national average for ${itemLabel} (${nationalText}). Double-check the price and the amount.`,
    };
  }

  return { ok: true };
}
