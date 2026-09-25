import { withTimeout } from '../utils/async';
import type { CategoryId } from '../constants/categories';

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
const SEARCH_PAGE_SIZE = 20;
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
// specific tag first avoids classifying it as something generic. Tags are
// matched as substrings, so "milks" also catches "en:cow-milks".
const TAG_TO_CATEGORY: [string, CategoryId][] = [
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
  ['peanut-butters', 'peanut_butter'],
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

export function deriveCategory(tags: string[] | undefined): CategoryId | null {
  if (!tags?.length) return null;
  for (const [fragment, category] of TAG_TO_CATEGORY) {
    if (tags.some((tag) => tag.includes(fragment))) return category;
  }
  return null;
}

interface OffProduct {
  code?: string;
  product_name?: string;
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

function toProduct(raw: OffProduct): Product | null {
  const barcode = raw.code;
  const name = raw.product_name?.trim();
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

const FIELDS = 'code,product_name,brands,quantity,image_small_url,categories_tags';
const LEGACY_FIELDS = 'code,product_name,brands,quantity,image_front_small_url,categories_tags';

function toProducts(raw: OffProduct[] | undefined): Product[] {
  return (raw ?? []).map(toProduct).filter((product): product is Product => product !== null);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url =
      `${OFF_SEARCH_URL}?q=${encodeURIComponent(trimmed)}` +
      `&page_size=${SEARCH_PAGE_SIZE}&fields=${FIELDS}`;
    const response = await withTimeout(
      fetch(url, { headers: { 'User-Agent': USER_AGENT } }),
      REQUEST_TIMEOUT_MS
    );
    if (!response.ok) throw new Error(`Product search failed: HTTP ${response.status}`);

    const json = (await response.json()) as { hits?: OffProduct[] };
    return toProducts(json.hits);
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
    `&search_simple=1&action=process&json=1&page_size=${SEARCH_PAGE_SIZE}&fields=${LEGACY_FIELDS}`;

  const response = await withTimeout(
    fetch(url, { headers: { 'User-Agent': USER_AGENT } }),
    REQUEST_TIMEOUT_MS
  );
  if (!response.ok) throw new Error(`Product search failed: HTTP ${response.status}`);

  const json = (await response.json()) as { products?: OffProduct[] };
  return toProducts(json.products);
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
  return toProduct(json.product);
}
