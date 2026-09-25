// The units a person can log a price in, and the math to normalise them
// so different package sizes become comparable.
//
// This is what lets the app compare a $5.40 18-count box of eggs against
// a BLS figure published per dozen, or a 28 oz jar against a per-pound
// price: everything converts to a canonical base unit first.

export type UnitDimension = 'weight' | 'volume' | 'count';

export interface UnitDef {
  id: string;
  label: string;
  dimension: UnitDimension;
  // How many canonical base units one of this unit equals.
  // Base units: weight = pound, volume = gallon, count = single item.
  perBase: number;
}

export const UNITS: UnitDef[] = [
  // Weight — base: pound
  { id: 'lb', label: 'lb', dimension: 'weight', perBase: 1 },
  { id: 'oz', label: 'oz', dimension: 'weight', perBase: 1 / 16 },
  { id: 'g', label: 'g', dimension: 'weight', perBase: 1 / 453.592 },
  { id: 'kg', label: 'kg', dimension: 'weight', perBase: 2.20462 },

  // Volume — base: gallon
  { id: 'gal', label: 'gallon', dimension: 'volume', perBase: 1 },
  { id: 'qt', label: 'quart', dimension: 'volume', perBase: 1 / 4 },
  { id: 'pt', label: 'pint', dimension: 'volume', perBase: 1 / 8 },
  { id: 'floz', label: 'fl oz', dimension: 'volume', perBase: 1 / 128 },
  { id: 'l', label: 'liter', dimension: 'volume', perBase: 0.264172 },
  { id: 'ml', label: 'mL', dimension: 'volume', perBase: 0.000264172 },

  // Count — base: one item
  { id: 'each', label: 'each', dimension: 'count', perBase: 1 },
  { id: 'dozen', label: 'dozen', dimension: 'count', perBase: 12 },
];

export function getUnit(id: string): UnitDef | undefined {
  return UNITS.find((unit) => unit.id === id);
}

// Converts a price for `amount` of `unitId` into a price per single base
// unit (per pound, per gallon, or per item). Returns null when the unit
// is unknown or the amount is unusable, rather than guessing.
export function pricePerBaseUnit(
  price: number,
  amount: number,
  unitId: string
): { pricePerBase: number; dimension: UnitDimension } | null {
  const unit = getUnit(unitId);
  if (!unit || !Number.isFinite(price) || !Number.isFinite(amount) || amount <= 0) return null;

  const baseAmount = amount * unit.perBase;
  if (baseAmount <= 0) return null;

  return { pricePerBase: price / baseAmount, dimension: unit.dimension };
}

// The inverse of pricePerBaseUnit: given a per-base-unit price, what
// would `amount` of `unitId` cost at that rate?
//
// This is what turns an abstract national figure into a directly
// meaningful one — "$3.42 per lb" becomes "$5.99 for the 28 oz jar you
// actually bought". Callers must check the dimensions match first; this
// can't tell that a per-gallon rate was passed with a weight unit.
export function priceForAmount(
  pricePerBase: number,
  amount: number,
  unitId: string
): number | null {
  const unit = getUnit(unitId);
  if (!unit || !Number.isFinite(pricePerBase) || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return pricePerBase * amount * unit.perBase;
}

// Human-readable label for a normalised price, e.g. "per lb".
export function baseUnitLabel(dimension: UnitDimension): string {
  switch (dimension) {
    case 'weight':
      return 'per lb';
    case 'volume':
      return 'per gallon';
    case 'count':
      return 'each';
  }
}

// Best-effort parse of the free-form quantity strings Open Food Facts
// carries ("1 gallon", "500 g", "1kg", "0.5L"). Used only to PREFILL the
// amount field — the user can always correct it, which is why loose
// parsing is acceptable here and wouldn't be for the price itself.
const QUANTITY_PATTERN = /([\d.]+)\s*([a-zA-Z]+)/;

const PARSE_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  ml: 'ml',
  l: 'l',
  liter: 'l',
  litre: 'l',
  gal: 'gal',
  gallon: 'gal',
  qt: 'qt',
  quart: 'qt',
  pt: 'pt',
  pint: 'pt',
  floz: 'floz',
  ct: 'each',
  count: 'each',
  pack: 'each',
  dozen: 'dozen',
};

export function parseQuantity(raw: string | null): { amount: number; unitId: string } | null {
  if (!raw) return null;
  const match = QUANTITY_PATTERN.exec(raw.trim().toLowerCase());
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const unitId = PARSE_ALIASES[match[2]];
  if (!Number.isFinite(amount) || amount <= 0 || !unitId) return null;

  return { amount, unitId };
}
