import { withTimeout } from '../utils/async';
import { CATEGORIES, type CategoryId } from '../constants/categories';
import { englishName, filterAndRank } from '../utils/productSearch';

// Product lookup powered by Open Food Facts — a free, open, barcode-level
// product database (effectively the open-source equivalent of the food
// databases calorie-tracking apps use). No API key, no billing.
//
// This is what makes the log flow product-first: search "publix milk" or
// scan a barcode and get the exact item, rather than choosing from a
// fixed list of generic categories.
// Search runs against Search-a-licious, Open Food Facts' current search
// service. The older `cgi/search.pl` endpoint is aggressively rate
// limited and starts returning HTTP 503 after a handful of queries —
// which is exactly what a search-as-you-type box generates — so it's
// only kept below as a fallback.
//
// The query MUST be sent as plain free text. Search-a-licious accepts
// Lucene syntax, but the moment the query contains any (`AND`, a quoted
// phrase, a `field:value` filter) it switches to strict parsing and
// silently returns zero hits — `ground beef` finds thousands of
// products, `"ground beef" AND countries_tags:"en:united-states"` finds
// none. Verified against the live API; do not "improve" this by adding a
// country filter.
const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';
const OFF_LEGACY_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const REQUEST_TIMEOUT_MS = 20000;
// How many results are shown, and how many are fetched to get there —
// most of what the service returns is dropped by filterAndRank(), so it
// has to be asked for several times what's actually displayed.
const SEARCH_RESULT_LIMIT = 20;
const SEARCH_FETCH_SIZE = 100;
const USER_AGENT = 'PriceWatch/1.0 (Congressional App Challenge student project)';

export interface Product {
  barcode: string;
  name: string;
  brand: string | null;
  // Package size as the database records it, e.g. "1 gallon", "12 oz".
  quantity: string | null;
  imageUrl: string | null;
  // Category derived from the product's Open Food Facts tags. Null when
  // the product has no usable tags — the UI then asks the user to pick
  // one, because every entry needs a category for the averages,
  // corroboration and BLS comparison to work.
  category: CategoryId | null;
}

// Maps Open Food Facts category tags to this app's categories.
//
// Ordered most-specific first: a whole milk product carries both
// "en:whole-milks" and the broader "en:dairies", and matching the
// specific tag first avoids classifying it as something generic. A
// fragment matches whole hyphen-separated words of a tag, so "milks"
// also catches "en:cow-milks" but "rices" doesn't catch "en:licorices".
const TAG_TO_CATEGORY: [string, CategoryId][] = [
  // Before 'butters', which would otherwise claim "en:peanut-butters".
  ['peanut-butters', 'peanut_butter'],
  // Dairy
  ['butters', 'butter'],
  ['cheeses', 'cheese'],
  ['yogurts', 'yogurt'],
  ['ice-creams', 'ice_cream'],
  ['milks', 'milk'],
  ['eggs', 'eggs'],
  // Meat / protein
  ['bacons', 'bacon'],
  ['pork-chops', 'pork_chops'],
  ['ground-beef', 'ground_beef'],
  ['minced-beef', 'ground_beef'],
  ['steaks', 'steak'],
  ['beef-roasts', 'beef_roast'],
  ['chicken-breasts', 'chicken_breast'],
  ['chickens', 'whole_chicken'],
  ['fishes', 'fish'],
  // Pantry / grains
  ['breads', 'bread'],
  ['tortillas', 'tortillas'],
  ['pastas', 'pasta'],
  ['rices', 'rice'],
  ['breakfast-cereals', 'cereal'],
  ['flours', 'flour'],
  ['sugars', 'sugar'],
  ['vegetable-oils', 'cooking_oil'],
  ['olive-oils', 'cooking_oil'],
  ['dried-beans', 'dried_beans'],
  ['canned-beans', 'canned_beans'],
  ['soups', 'canned_soup'],
  // Produce
  ['apples', 'apples'],
  ['bananas', 'bananas'],
  ['oranges', 'oranges'],
  ['potatoes', 'potatoes'],
  ['onions', 'onions'],
  ['tomatoes', 'tomatoes'],
  ['lettuces', 'lettuce'],
  ['broccoli', 'broccoli'],
  ['carrots', 'carrots'],
  // Drinks
  ['orange-juices', 'orange_juice'],
  ['coffees', 'coffee'],
  ['sodas', 'soda'],
  ['waters', 'bottled_water'],
];

const TAG_PATTERNS = TAG_TO_CATEGORY.map(
  ([fragment, category]) => [new RegExp(`(^|[:-])${fragment}($|-)`), category] as const
);

export function deriveCategory(tags: string[] | undefined): CategoryId | null {
  if (!tags?.length) return null;
  for (const [pattern, category] of TAG_PATTERNS) {
    if (tags.some((tag) => pattern.test(tag))) return category;
  }
  return null;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  // The product's main language, e.g. "en", "fr".
  lang?: string;
  countries_tags?: string[];
  // The two endpoints disagree on this one: Search-a-licious returns an
  // array of brand names, the legacy endpoint a comma-separated string.
  brands?: string | string[];
  quantity?: string;
  image_small_url?: string;
  image_front_small_url?: string;
  categories_tags?: string[];
}

// The first brand is the primary one; the rest are usually parent
// companies, which aren't what someone is shopping by.
function primaryBrand(brands: string | string[] | undefined): string | null {
  if (!brands) return null;
  const first = Array.isArray(brands) ? brands[0] : brands.split(',')[0];
  return first?.trim() || null;
}

// `name` is supplied by the caller: search results must have an English
// name (see englishName), while a scanned barcode is accepted under any
// name, since the user is holding the exact item.
function toProduct(raw: OffProduct, name: string | null): Product | null {
  const barcode = raw.code;
  if (!barcode || !name) return null;

  return {
    barcode,
    name,
    brand: primaryBrand(raw.brands),
    quantity: raw.quantity?.trim() || null,
    imageUrl: raw.image_small_url ?? raw.image_front_small_url ?? null,
    category: deriveCategory(raw.categories_tags),
  };
}

const FIELDS =
  'code,product_name,product_name_en,lang,countries_tags,brands,quantity,image_small_url,categories_tags';
const LEGACY_FIELDS =
  'code,product_name,product_name_en,lang,countries_tags,brands,quantity,image_front_small_url,categories_tags';

// English-named products only, filtered down to what was actually
// searched for and ranked — see utils/productSearch.ts.
function toSearchResults(query: string, raw: OffProduct[] | undefined): Product[] {
  const candidates = (raw ?? []).flatMap((item) => {
    const product = toProduct(item, englishName(item));
    if (!product) return [];
    return [
      {
        product,
        name: product.name,
        brand: product.brand,
        category: product.category,
        countries: item.countries_tags ?? [],
      },
    ];
  });
  return filterAndRank(query, candidates, CATEGORIES)
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((candidate) => candidate.product);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url =
      `${OFF_SEARCH_URL}?q=${encodeURIComponent(trimmed)}` +
      `&page_size=${SEARCH_FETCH_SIZE}&fields=${FIELDS}`;
    const response = await withTimeout(
      fetch(url, { headers: { 'User-Agent': USER_AGENT } }),
      REQUEST_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`Product search failed: HTTP ${response.status}`);

    const json = (await response.json()) as { hits?: OffProduct[] };
    return toSearchResults(trimmed, json.hits);
  } catch (searchError) {
    console.warn(
      `[productService] primary search failed, trying legacy:`,
      searchError instanceof Error ? searchError.message : searchError
    );
    return searchLegacy(trimmed);
  }
}

// Fallback only. Rate limited enough that it can't be the primary path,
// but a slow answer beats no answer when the main service is down.
async function searchLegacy(trimmed: string): Promise<Product[]> {
  const url =
    `${OFF_LEGACY_SEARCH_URL}?search_terms=${encodeURIComponent(trimmed)}` +
    `&search_simple=1&action=process&json=1&page_size=${SEARCH_FETCH_SIZE}&fields=${LEGACY_FIELDS}`;

  const response = await withTimeout(
    fetch(url, { headers: { 'User-Agent': USER_AGENT } }),
    REQUEST_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Product search failed: HTTP ${response.status}`);

  const json = (await response.json()) as { products?: OffProduct[] };
  return toSearchResults(trimmed, json.products);
}

// Used by the barcode scanner. Returns null when the barcode isn't in the
// database, which happens often enough that callers must handle it.
export async function lookupBarcode(barcode: string): Promise<Product | null> {
  const response = await withTimeout(
    fetch(`${OFF_PRODUCT_URL}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT },
    }),
    REQUEST_TIMEOUT_MS
  );
  if (!response.ok) return null;

  const json = (await response.json()) as { status?: number; product?: OffProduct };
  if (json.status !== 1 || !json.product) return null;
  return toProduct(json.product, englishName(json.product) ?? json.product.product_name?.trim() ?? null);
}
