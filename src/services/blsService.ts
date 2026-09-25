import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../utils/async';
import { pricePerBaseUnit, type UnitDimension } from '../constants/units';
import type { CategoryId } from '../constants/categories';

// Real national figures from the U.S. Bureau of Labor Statistics, in two
// tiers, because BLS simply does not publish the same depth of data for
// every item people buy:
//
//   1. BLS_SERIES — "Average Price Data": actual dollar prices, but only
//      for a fixed basket of ~64 food and energy staples.
//   2. CPI_SERIES — Consumer Price Index: no dollar figure, but a real
//      year-over-year percentage for essentially every product group,
//      which is what the remaining categories fall back to.
//
// Between them every category has an official number. Nothing here is
// estimated or hardcoded.
//
// Uses the BLS Public Data API v1.0, which needs no API key or
// registration. v1 is rate limited (25 queries per day per IP and 25
// series per query), so this module batches all series into as few
// requests as fit and caches the result for a day. BLS publishes these
// monthly, so a daily refresh is already far more often than the data
// actually changes.
//
// https://www.bls.gov/developers/
const BLS_API_URL = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
// Versioned: bump this whenever BLS_SERIES *or the shape of the cached
// payload* changes, so devices holding a day-old cache pick up added or
// corrected series immediately instead of waiting out the TTL. v4 added
// pricePerBase/dimension; a v3 payload lacks them entirely, which is a
// different problem from them being null.
// v5 added the `kind` discriminant and the CPI index-trend tier.
const CACHE_KEY = 'priceWatch:blsNationalAverages:v5';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

interface BlsSeriesMapping {
  seriesId: string;
  // The series' price expressed as an amount + unit, so it can be
  // normalised to a per-pound / per-gallon / per-item figure and compared
  // against a logged price of any package size. Example: soda is
  // published per 2 liters, so amount 2 / unit 'l'.
  amount: number;
  unitId: string;
  // BLS's own unit for this series, which does NOT always match the unit
  // this app collects in (BLS prices bread per pound; the app logs it per
  // loaf). Displayed alongside the figure so the comparison stays honest
  // instead of silently comparing different quantities.
  blsUnit: string;
  // The exact BLS series title, so the app can cite precisely what it's
  // showing rather than implying BLS tracks our category label verbatim.
  blsTitle: string;
}

// Every ID and title below was verified against BLS's own published
// catalog (https://download.bls.gov/pub/time.series/ap/ap.series, which
// lists each series' exact title and the period it was last published)
// and then confirmed live against the API — not guessed. Two traps that
// catalog exists to prevent: discontinued series keep returning old
// values as if current, and plausible-looking IDs often belong to an
// entirely different product.
//
// `blsUnit` is for display only. Comparisons run on the normalised
// per-pound/per-gallon/per-item figure derived from `amount` + `unitId`,
// so unit *strings* no longer have to match anything.
export const BLS_SERIES: Partial<Record<CategoryId, BlsSeriesMapping>> = {
  // --- Units match this app's, so these render a comparison ---
  gas: {
    seriesId: 'APU000074714',
    amount: 1,
    unitId: 'gal',
    blsUnit: 'per gallon',
    blsTitle: 'Gasoline, Unleaded Regular',
  },
  milk: {
    seriesId: 'APU0000709112',
    amount: 1,
    unitId: 'gal',
    blsUnit: 'per gallon',
    blsTitle: 'Milk, Fresh, Whole, Fortified',
  },
  eggs: {
    seriesId: 'APU0000708111',
    amount: 1,
    unitId: 'dozen',
    blsUnit: 'per dozen',
    blsTitle: 'Eggs, Grade A, Large',
  },
  ground_beef: {
    seriesId: 'APU0000703112',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Ground Beef, 100% Beef',
  },
  bacon: {
    seriesId: 'APU0000704111',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Bacon, Sliced',
  },
  chicken_breast: {
    seriesId: 'APU0000FF1101',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Chicken Breast, Boneless',
  },
  cheese: {
    seriesId: 'APU0000710211',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'American Processed Cheese',
  },
  butter: {
    seriesId: 'APU0000FS1101',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Butter, Stick',
  },
  rice: {
    seriesId: 'APU0000701312',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Rice, White, Long Grain, Uncooked',
  },
  coffee: {
    seriesId: 'APU0000717311',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Coffee, 100%, Ground Roast',
  },
  bananas: {
    seriesId: 'APU0000711211',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Bananas',
  },
  oranges: {
    seriesId: 'APU0000711311',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Oranges, Navel',
  },
  tomatoes: {
    seriesId: 'APU0000712311',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Tomatoes, Field Grown',
  },
  potatoes: {
    seriesId: 'APU0000712112',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Potatoes, White',
  },
  soda: {
    seriesId: 'APU0000FN1101',
    amount: 2,
    unitId: 'l',
    blsUnit: 'per 2-liter',
    blsTitle: 'All Soft Drinks',
  },
  pork_chops: {
    seriesId: 'APU0000FD3101',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'All Pork Chops',
  },
  steak: {
    seriesId: 'APU0000703613',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Steak, Sirloin, USDA Choice, Boneless',
  },
  beef_roast: {
    seriesId: 'APU0000FC2101',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'All Uncooked Beef Roasts',
  },
  whole_chicken: {
    seriesId: 'APU0000706111',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Chicken, Fresh, Whole',
  },
  ice_cream: {
    seriesId: 'APU0000710411',
    amount: 0.5,
    unitId: 'gal',
    blsUnit: 'per half gallon',
    blsTitle: 'Ice Cream, Prepackaged, Bulk, Regular',
  },
  dried_beans: {
    seriesId: 'APU0000714233',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Beans, Dried, Any Type, All Sizes',
  },

  // --- BLS publishes these, but prices them in a different unit than
  // this app records, so no comparison is drawn. Kept here because the
  // data is real and correct: if a category's unit is ever changed to
  // match, the comparison starts working with no other edits. ---
  bread: {
    seriesId: 'APU0000702111',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per pound',
    blsTitle: 'Bread, White, Pan',
  },
  flour: {
    seriesId: 'APU0000701111',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per pound',
    blsTitle: 'Flour, White, All Purpose',
  },
  sugar: {
    seriesId: 'APU0000715211',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per pound',
    blsTitle: 'Sugar, White, All Sizes',
  },
  lettuce: {
    seriesId: 'APU0000FL2101',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per pound',
    blsTitle: 'Lettuce, Romaine',
  },
  yogurt: {
    seriesId: 'APU0000FJ4101',
    amount: 8,
    unitId: 'oz',
    blsUnit: 'per 8 oz',
    blsTitle: 'Yogurt',
  },

  pasta: {
    seriesId: 'APU0000701322',
    amount: 1,
    unitId: 'lb',
    blsUnit: 'per lb',
    blsTitle: 'Spaghetti and macaroni',
  },
  // Deliberately NOT mapped, and why:
  // - Orange juice: BLS's only series (APU0000713111) prices FROZEN
  //   CONCENTRATE per 16 oz, and 16 oz of concentrate makes roughly 64 oz
  //   of juice. The units convert cleanly, so nothing errors — it just
  //   silently compares concentrate against ready-to-drink and reports a
  //   normal carton as ~68% below national. It uses the CPI trend instead.
  //   Watch for this class of trap in any future mapping: dimensionally
  //   valid is not the same as the same product.
  // - Apples (APU0000711111, "Red Delicious") and peanut butter
  //   (APU0000716141) are DISCONTINUED series. They still return old
  //   values if queried without a date range, which makes them look alive
  //   — always restrict to recent years when checking a new series.
  // - Chicken "fresh, whole" (APU0000706111) exists but is a different
  //   product from this app's Chicken Breast category.
  // - Everything else in CPI_SERIES below simply has no average-price
  //   series: BLS publishes actual dollar prices for a fixed basket of
  //   ~64 food and energy staples, not for the whole store. Verified
  //   against the full catalog at
  //   https://download.bls.gov/pub/time.series/ap/ap.series — if you
  //   think an item is missing, check there before adding a guess.
};

// --- Tier 2: CPI index series ---------------------------------------
//
// For the items BLS prices in dollars, we can show "$X per lb". For
// everything else there is no dollar figure published anywhere free —
// so instead of showing nothing (or inventing a number), these map to
// the official CPI *index* for that product group, which yields a real
// year-over-year percentage change.
//
// It answers a different question ("are these getting more expensive
// nationally?" rather than "what do they cost nationally?"), so the UI
// must present it as a trend and never as a price. Every id below was
// verified live against the API.
interface CpiSeriesMapping {
  seriesId: string;
  blsTitle: string;
  // True when the series covers a much broader basket than the category
  // — the UI says so, rather than implying BLS tracks this exact item.
  broad?: boolean;
}

export const CPI_SERIES: Partial<Record<CategoryId, CpiSeriesMapping>> = {
  fish: { seriesId: 'CUUR0000SEFG', blsTitle: 'Fish and seafood' },
  cereal: { seriesId: 'CUUR0000SEFA02', blsTitle: 'Breakfast cereal' },
  tortillas: { seriesId: 'CUUR0000SEFB04', blsTitle: 'Other bakery products', broad: true },
  cooking_oil: { seriesId: 'CUUR0000SEFS', blsTitle: 'Fats and oils' },
  peanut_butter: { seriesId: 'CUUR0000SS16014', blsTitle: 'Peanut butter' },
  canned_beans: { seriesId: 'CUUR0000SS14021', blsTitle: 'Canned vegetables', broad: true },
  canned_soup: { seriesId: 'CUUR0000SEFT01', blsTitle: 'Soups' },
  apples: { seriesId: 'CUUR0000SEFK01', blsTitle: 'Apples' },
  // BLS breaks out only potatoes, lettuce and tomatoes by name; every
  // other fresh vegetable shares this one index.
  onions: { seriesId: 'CUUR0000SEFL04', blsTitle: 'Other fresh vegetables', broad: true },
  broccoli: { seriesId: 'CUUR0000SEFL04', blsTitle: 'Other fresh vegetables', broad: true },
  carrots: { seriesId: 'CUUR0000SEFL04', blsTitle: 'Other fresh vegetables', broad: true },
  bottled_water: {
    seriesId: 'CUUR0000SEFN03',
    blsTitle: 'Nonfrozen noncarbonated juices and drinks',
    broad: true,
  },
  // See the note in BLS_SERIES: the dollar series is frozen concentrate,
  // which isn't the same product as what people actually buy.
  orange_juice: {
    seriesId: 'CUUR0000SEFN03',
    blsTitle: 'Nonfrozen noncarbonated juices and drinks',
    broad: true,
  },
  toilet_paper: { seriesId: 'CUUR0000SEHN02', blsTitle: 'Household paper products', broad: true },
  paper_towels: { seriesId: 'CUUR0000SEHN02', blsTitle: 'Household paper products', broad: true },
  laundry_detergent: {
    seriesId: 'CUUR0000SEHN01',
    blsTitle: 'Household cleaning products',
    broad: true,
  },
  dish_soap: { seriesId: 'CUUR0000SEHN01', blsTitle: 'Household cleaning products', broad: true },
  trash_bags: { seriesId: 'CUUR0000SEHN', blsTitle: 'Housekeeping supplies', broad: true },
  baby_formula: { seriesId: 'CUUR0000SEFT05', blsTitle: 'Baby food and formula' },
  // Diapers have NO series of their own anywhere in the CPI — not even a
  // discontinued one (checked the full cu.item catalog). Rather than
  // quietly file them under an unrelated index, they fall back to
  // headline inflation, clearly labelled as such.
  diapers: { seriesId: 'CUUR0000SA0', blsTitle: 'All items (overall U.S. inflation)', broad: true },
};

export interface NationalAverage {
  kind: 'average_price';
  price: number;
  // The same figure normalised to a per-pound / per-gallon / per-item
  // basis, so it can be compared against a logged price of any package
  // size. Null if the series' unit isn't convertible.
  pricePerBase: number | null;
  dimension: UnitDimension | null;
  // e.g. "July 2026" — BLS data lags by a few weeks, so showing the
  // period it belongs to matters.
  periodLabel: string;
  blsUnit: string;
  blsTitle: string;
  seriesId: string;
}

export interface NationalTrend {
  kind: 'index_trend';
  // Percent change vs. the same month a year earlier.
  yearOverYearPercent: number;
  periodLabel: string;
  blsTitle: string;
  seriesId: string;
  broad: boolean;
}

// A discriminated union on purpose: a trend is an index number, not
// dollars, and `kind` makes it impossible to render one as the other by
// accident.
export type NationalReference = NationalAverage | NationalTrend;

export type NationalAverages = Partial<Record<CategoryId, NationalReference>>;

interface CachedPayload {
  fetchedAt: number;
  averages: NationalAverages;
}

interface BlsSeriesData {
  year: string;
  period: string;
  periodName: string;
  value: string;
}

interface BlsApiResponse {
  status?: string;
  Results?: {
    series?: {
      seriesID: string;
      data?: BlsSeriesData[];
    }[];
  };
}

// The v1 API accepts at most 25 series per request, and this app now
// tracks more than that across both tiers, so requests are chunked.
// The daily cap is on requests (25/day/IP), and the whole result is
// cached for 24h, so two or three requests a day is comfortably inside
// it — but this is why the cache matters and shouldn't be bypassed.
const MAX_SERIES_PER_REQUEST = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function readCache(): Promise<CachedPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedPayload) : null;
  } catch {
    return null;
  }
}

// Fetches every mapped series across both tiers. Returns cached data
// when it's fresh, and falls back to stale cache if the network fails —
// a month-old official figure beats showing nothing, as long as the UI
// keeps displaying which month it's from.
export async function fetchNationalAverages(
  options: { forceRefresh?: boolean } = {}
): Promise<{ averages: NationalAverages; fetchedAt: number; stale: boolean }> {
  const cached = await readCache();
  const cacheIsFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  if (cached && cacheIsFresh && !options.forceRefresh) {
    return { averages: cached.averages, fetchedAt: cached.fetchedAt, stale: false };
  }

  const priceEntries = Object.entries(BLS_SERIES) as [CategoryId, BlsSeriesMapping][];
  const trendEntries = Object.entries(CPI_SERIES) as [CategoryId, CpiSeriesMapping][];
  const currentYear = new Date().getFullYear();

  // Deduplicated: several categories deliberately share one CPI series
  // (toilet paper and paper towels are both "Household paper products"),
  // and asking for the same id twice would waste the request budget.
  const seriesIds = [
    ...new Set([
      ...priceEntries.map(([, m]) => m.seriesId),
      ...trendEntries.map(([, m]) => m.seriesId),
    ]),
  ];

  try {
    const responses = await Promise.all(
      chunk(seriesIds, MAX_SERIES_PER_REQUEST).map(async (ids) => {
        const response = await withTimeout(
          fetch(BLS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seriesid: ids,
              // A two-year window is what makes the year-over-year
              // comparison possible, and it also stops a discontinued
              // series from quietly returning ancient values as if
              // they were current.
              startyear: String(currentYear - 1),
              endyear: String(currentYear),
            }),
          }),
          REQUEST_TIMEOUT_MS
        );
        const json = (await response.json()) as BlsApiResponse;
        if (json.status !== 'REQUEST_SUCCEEDED' || !json.Results?.series) {
          throw new Error(`BLS request failed: ${json.status ?? 'unknown status'}`);
        }
        return json.Results.series;
      })
    );

    const bySeriesId = new Map(responses.flat().map((series) => [series.seriesID, series]));
    const averages: NationalAverages = {};

    for (const [category, mapping] of priceEntries) {
      // data[0] is the most recent observation BLS returned.
      const latest = bySeriesId.get(mapping.seriesId)?.data?.[0];
      const price = latest ? Number.parseFloat(latest.value) : NaN;
      if (!latest || !Number.isFinite(price)) continue;

      const normalised = pricePerBaseUnit(price, mapping.amount, mapping.unitId);

      averages[category] = {
        kind: 'average_price',
        price,
        pricePerBase: normalised?.pricePerBase ?? null,
        dimension: normalised?.dimension ?? null,
        periodLabel: `${latest.periodName} ${latest.year}`,
        blsUnit: mapping.blsUnit,
        blsTitle: mapping.blsTitle,
        seriesId: mapping.seriesId,
      };
    }

    for (const [category, mapping] of trendEntries) {
      // A dollar figure always wins over an index trend, so a category
      // that somehow has both keeps the tier-1 entry.
      if (averages[category]) continue;

      const data = bySeriesId.get(mapping.seriesId)?.data;
      const latest = data?.[0];
      // Same month a year earlier — comparing against the previous
      // month instead would mostly measure seasonality (produce in
      // particular swings hard month to month).
      const yearAgo = data?.find(
        (point) =>
          point.period === latest?.period && Number(point.year) === Number(latest?.year) - 1
      );
      if (!latest || !yearAgo) continue;

      const current = Number.parseFloat(latest.value);
      const previous = Number.parseFloat(yearAgo.value);
      if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) continue;

      averages[category] = {
        kind: 'index_trend',
        yearOverYearPercent: ((current - previous) / previous) * 100,
        periodLabel: `${latest.periodName} ${latest.year}`,
        blsTitle: mapping.blsTitle,
        seriesId: mapping.seriesId,
        broad: mapping.broad ?? false,
      };
    }

    const fetchedAt = Date.now();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, averages })).catch(() => {
      // Cache write is best-effort; the data is still usable this session.
    });
    return { averages, fetchedAt, stale: false };
  } catch (error) {
    console.warn('[blsService] fetch failed:', error);
    if (cached) {
      return { averages: cached.averages, fetchedAt: cached.fetchedAt, stale: true };
    }
    throw error;
  }
}
