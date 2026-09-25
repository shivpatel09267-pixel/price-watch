import { withTimeout } from '../utils/async';
import { distanceInMiles, type LatLng } from '../utils/geo';

// Looks up real nearby stores from OpenStreetMap via the Overpass API.
//
// Chosen over Google Places specifically because it needs no API key and
// no billing account, which keeps the whole project on free tier. The
// data is community-maintained and genuinely good for chain stores — a
// Tampa query returns Publix (with branch name and store number),
// Winn-Dixie, 7-Eleven and so on.
//
// Overpass is a shared free service, so this is deliberately polite: one
// request per store-picker open, a timeout, an identifying User-Agent,
// and an in-memory cache keyed to a coarse location.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const REQUEST_TIMEOUT_MS = 25000;
// ~1.5 miles. Deliberately not larger: you can only log at a store within
// MAX_LOG_DISTANCE_MILES (0.4 mi) anyway, so a wide search just risks
// hitting the result cap and dropping nearby stores. Overpass applies its
// cap BEFORE any distance sorting, so an over-broad search could return
// 60 stores across town while omitting the Publix across the street.
const SEARCH_RADIUS_METERS = 2500;
const MAX_RESULTS = 150;

export interface NearbyStore {
  id: string;
  // Chain or shop name, e.g. "Publix".
  name: string;
  // Specific location label when OSM has one, e.g. "The Village Center".
  branch: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  // Whether the app has independent evidence the reporter was at a real
  // shop. Always true for a store picked from the map data. For a
  // hand-typed store it's true only when some mapped store was within
  // logging range — i.e. they're demonstrably at a retail location, just
  // naming one the map doesn't know about. See StorePicker.
  locationCorroborated: boolean;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  // Values are optional: OSM tags vary wildly between entries, and typing
  // them as always-present makes `?? null` fallbacks silently wrong.
  tags?: Record<string, string | undefined>;
}

function buildAddress(tags: Record<string, string | undefined>): string | null {
  const line = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
  if (!line) return tags['addr:city'] ?? null;
  return tags['addr:city'] ? `${line}, ${tags['addr:city']}` : line;
}

// Cheap cache so re-opening the picker (or switching category) doesn't
// re-hit Overpass for the same spot.
const cache = new Map<string, { fetchedAt: number; stores: NearbyStore[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheKey(origin: LatLng): string {
  // ~100m precision is plenty for "which stores are near me".
  return `${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}`;
}

export async function findNearbyStores(origin: LatLng): Promise<NearbyStore[]> {
  const key = cacheKey(origin);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.stores;

  const around = `${SEARCH_RADIUS_METERS},${origin.latitude},${origin.longitude}`;
  // Wide on purpose. The obvious tags (supermarket, convenience) miss the
  // stores people actually buy groceries at: Walmart and Target are
  // tagged department_store, Costco and Sam's Club are wholesale, Dollar
  // General is variety_store, and pharmacies like Walgreens sell staples.
  // Anchored with ^...$ so "convenience" doesn't also match unrelated
  // tags. `nwr` covers nodes, ways and relations — large stores are often
  // mapped as building outlines rather than single points.
  const shopTags =
    'supermarket|convenience|grocery|greengrocer|department_store|wholesale|variety_store|general|butcher|bakery|deli|farm|chemist';
  const overpassQuery = `[out:json][timeout:25];(
    nwr["shop"~"^(${shopTags})$"](around:${around});
    nwr["amenity"~"^(fuel|pharmacy)$"](around:${around});
  );out center ${MAX_RESULTS};`;

  const response = await withTimeout(
    fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PriceWatch/1.0 (Congressional App Challenge student project)',
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    }),
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) throw new Error(`Overpass request failed: HTTP ${response.status}`);
  const json = (await response.json()) as { elements?: OverpassElement[] };

  const stores: NearbyStore[] = (json.elements ?? [])
    .map((element): NearbyStore | null => {
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      const tags = element.tags ?? {};
      const name = tags.name ?? tags.brand;
      if (latitude === undefined || longitude === undefined || !name) return null;

      return {
        id: `${element.type}/${element.id}`,
        name,
        branch: tags.branch ?? null,
        address: buildAddress(tags),
        latitude,
        longitude,
        distanceMiles: distanceInMiles(origin, { latitude, longitude }),
        // It's on the map, so its existence isn't taken on the
        // reporter's word.
        locationCorroborated: true,
      };
    })
    .filter((store): store is NearbyStore => store !== null)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  cache.set(key, { fetchedAt: Date.now(), stores });
  return stores;
}
