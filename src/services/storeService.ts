import AsyncStorage from '@react-native-async-storage/async-storage';
import { distanceInMiles, type LatLng } from '../utils/geo';

// Looks up real nearby stores from OpenStreetMap, through two free
// services: Photon (komoot's OSM search engine) first, then the Overpass
// API.
//
// Chosen over Google Places specifically because neither needs an API key
// or a billing account, which keeps the whole project on free tier. The
// data is community-maintained and genuinely good for chain stores — a
// Tampa query returns Publix, Winn-Dixie, 7-Eleven and so on.
//
// Photon answers in about a second and has stayed up while every Overpass
// instance was overloaded (fast 502/504s, or requests that simply hang).
// Overpass is kept as a fallback because its data is richer (branch
// names) and it isn't capped at 50 results.
//
// Lookups are "hedged": the next source is asked as soon as the current
// one fails or has been quiet for HEDGE_DELAY_MS, and the first good
// answer wins. A healthy first source still answers alone, so the shared
// services aren't hit more than needed; results are also saved on the
// device for a week so the same area is only looked up once.
const PHOTON_URL = 'https://photon.komoot.io/reverse';
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const HEDGE_DELAY_MS = 3000;
const LOOKUP_TIMEOUT_MS = 20000;
// ~1.5 miles. Deliberately not larger: a wide search risks hitting the
// result cap and dropping nearby stores. Overpass applies its
// cap BEFORE any distance sorting, so an over-broad search could return
// 60 stores across town while omitting the Publix across the street.
const SEARCH_RADIUS_METERS = 2500;
const MAX_RESULTS = 150;
// Photon's public instance won't return more than this per request.
const PHOTON_MAX_RESULTS = 50;
// overpass-api.de refuses requests without an identifying User-Agent
// (HTTP 406); sent to every source to be a polite user of free services.
const USER_AGENT = 'PriceWatch/1.0 (Congressional App Challenge student project)';

// Wide on purpose. The obvious tags (supermarket, convenience) miss the
// stores people actually buy groceries at: Walmart and Target are tagged
// department_store, Costco and Sam's Club are wholesale, Dollar General is
// variety_store, and pharmacies like Walgreens sell staples.
const SHOP_TAGS = [
  'supermarket',
  'convenience',
  'grocery',
  'greengrocer',
  'department_store',
  'wholesale',
  'variety_store',
  'general',
  'butcher',
  'bakery',
  'deli',
  'farm',
  'chemist',
];
const AMENITY_TAGS = ['fuel', 'pharmacy'];

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
}

// A store as a source reports it, before distance is measured.
type FoundStore = Omit<NearbyStore, 'distanceMiles'>;
type StoreSource = (origin: LatLng, signal: AbortSignal) => Promise<FoundStore[]>;

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

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
  };
}

function buildAddress(
  houseNumber: string | undefined,
  street: string | undefined,
  city: string | undefined
): string | null {
  const line = [houseNumber, street].filter(Boolean).join(' ').trim();
  if (!line) return city ?? null;
  return city ? `${line}, ${city}` : line;
}

// Stores rarely open or close, so a lookup is saved on the device (not
// just in memory) and reused for a week by any later lookup within
// CACHE_REUSE_MILES of it — re-opening the app at the same store is
// instant, even when every source is down.
const CACHE_STORAGE_KEY = 'priceWatch:nearbyStores:v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_REUSE_MILES = 0.25;
// Each area is up to MAX_RESULTS stores (~30KB), so keep the newest few.
const MAX_CACHED_AREAS = 10;

interface CachedArea {
  origin: LatLng;
  fetchedAt: number;
  stores: NearbyStore[];
}

let cachedAreas: CachedArea[] | null = null;

async function loadCachedAreas(): Promise<CachedArea[]> {
  if (cachedAreas) return cachedAreas;
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    cachedAreas = raw ? (JSON.parse(raw) as CachedArea[]) : [];
  } catch {
    cachedAreas = [];
  }
  return cachedAreas;
}

async function saveCachedArea(area: CachedArea): Promise<void> {
  const areas = await loadCachedAreas();
  cachedAreas = [
    area,
    ...areas.filter(
      (other) =>
        area.fetchedAt - other.fetchedAt < CACHE_TTL_MS &&
        distanceInMiles(area.origin, other.origin) > CACHE_REUSE_MILES
    ),
  ].slice(0, MAX_CACHED_AREAS);
  await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cachedAreas)).catch(() => {
    // Not fatal: the lookup still worked, it just won't be remembered.
  });
}

async function findCachedStores(origin: LatLng): Promise<NearbyStore[] | null> {
  const now = Date.now();
  const nearest = (await loadCachedAreas())
    .filter((area) => now - area.fetchedAt < CACHE_TTL_MS)
    .map((area) => ({ area, miles: distanceInMiles(origin, area.origin) }))
    .filter(({ miles }) => miles <= CACHE_REUSE_MILES)
    .sort((a, b) => a.miles - b.miles)[0];
  if (!nearest) return null;
  // Distances were measured from where that lookup happened; re-measure
  // from where the user is now.
  return measureFrom(origin, nearest.area.stores);
}

function measureFrom(origin: LatLng, stores: FoundStore[]): NearbyStore[] {
  return stores
    .map((store) => ({ ...store, distanceMiles: distanceInMiles(origin, store) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export async function findNearbyStores(origin: LatLng): Promise<NearbyStore[]> {
  const cached = await findCachedStores(origin);
  if (cached) return cached;

  const stores = measureFrom(origin, await queryHedged(origin, STORE_SOURCES));

  // An empty answer may just be a sparse map, so don't pin it for a week.
  if (stores.length > 0) await saveCachedArea({ origin, fetchedAt: Date.now(), stores });
  return stores;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Store lookup failed: HTTP ${response.status}`);
  return (await response.json()) as T;
}

const photonSource: StoreSource = async (origin, signal) => {
  const tags = [
    ...SHOP_TAGS.map((tag) => `shop:${tag}`),
    ...AMENITY_TAGS.map((tag) => `amenity:${tag}`),
  ];
  const params = [
    `lat=${origin.latitude}`,
    `lon=${origin.longitude}`,
    `radius=${SEARCH_RADIUS_METERS / 1000}`,
    `limit=${PHOTON_MAX_RESULTS}`,
    ...tags.map((tag) => `osm_tag=${encodeURIComponent(tag)}`),
  ];
  const json = await fetchJson<{ features?: PhotonFeature[] }>(
    `${PHOTON_URL}?${params.join('&')}`,
    { headers: { 'User-Agent': USER_AGENT }, signal }
  );
  return parsePhotonFeatures(json.features);
};

function parsePhotonFeatures(features: PhotonFeature[] | undefined): FoundStore[] {
  // Photon uses N/W/R; spelled out to match the ids Overpass produces, so
  // the same store gets the same id whichever source found it.
  const osmTypes: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };
  return (features ?? [])
    .map((feature): FoundStore | null => {
      const [longitude, latitude] = feature.geometry?.coordinates ?? [];
      const props = feature.properties ?? {};
      const osmType = osmTypes[props.osm_type ?? ''];
      if (latitude === undefined || longitude === undefined || !props.name || !osmType) {
        return null;
      }
      return {
        id: `${osmType}/${props.osm_id}`,
        name: props.name,
        branch: null,
        address: buildAddress(props.housenumber, props.street, props.city),
        latitude,
        longitude,
      };
    })
    .filter((store): store is FoundStore => store !== null);
}

const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api';
const STORE_SEARCH_TIMEOUT_MS = 10000;

// Finds stores by name anywhere — "costco" finds every Costco, not just
// ones within the nearby-store radius — listed nearest first.
//
// Photon is asked to favour results near the user (lat/lon with a strong
// location bias), so its 50-result cap is spent on the closest matches
// rather than famous ones across the country. Any kind of shop counts
// here, plus pharmacies and gas stations, since someone searching by name
// already knows which store they mean.
export async function searchStores(text: string, origin: LatLng): Promise<NearbyStore[]> {
  const params = [
    `q=${encodeURIComponent(text)}`,
    `lat=${origin.latitude}`,
    `lon=${origin.longitude}`,
    'location_bias_scale=0.1',
    `limit=${PHOTON_MAX_RESULTS}`,
    'osm_tag=shop',
    ...AMENITY_TAGS.map((tag) => `osm_tag=${encodeURIComponent(`amenity:${tag}`)}`),
  ];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STORE_SEARCH_TIMEOUT_MS);
  try {
    const json = await fetchJson<{ features?: PhotonFeature[] }>(
      `${PHOTON_SEARCH_URL}?${params.join('&')}`,
      { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal }
    );
    return measureFrom(origin, parsePhotonFeatures(json.features));
  } finally {
    clearTimeout(timer);
  }
}

function overpassSource(url: string): StoreSource {
  return async (origin, signal) => {
    const around = `${SEARCH_RADIUS_METERS},${origin.latitude},${origin.longitude}`;
    // Anchored with ^...$ so "convenience" doesn't also match unrelated
    // tags. `nwr` covers nodes, ways and relations — large stores are
    // often mapped as building outlines rather than single points.
    const overpassQuery = `[out:json][timeout:20];(
      nwr["shop"~"^(${SHOP_TAGS.join('|')})$"](around:${around});
      nwr["amenity"~"^(${AMENITY_TAGS.join('|')})$"](around:${around});
    );out center ${MAX_RESULTS};`;

    const json = await fetchJson<{ elements?: OverpassElement[]; remark?: string }>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
      signal,
    });
    // An overloaded server can answer 200 with no elements and a
    // "runtime error" remark; that's a failure, not "no stores".
    if (json.remark && !json.elements?.length) {
      throw new Error(`Store lookup failed: ${json.remark}`);
    }

    return (json.elements ?? [])
      .map((element): FoundStore | null => {
        const latitude = element.lat ?? element.center?.lat;
        const longitude = element.lon ?? element.center?.lon;
        const tags = element.tags ?? {};
        const name = tags.name ?? tags.brand;
        if (latitude === undefined || longitude === undefined || !name) return null;

        return {
          id: `${element.type}/${element.id}`,
          name,
          branch: tags.branch ?? null,
          address: buildAddress(tags['addr:housenumber'], tags['addr:street'], tags['addr:city']),
          latitude,
          longitude,
        };
      })
      .filter((store): store is FoundStore => store !== null);
  };
}

const STORE_SOURCES: StoreSource[] = [photonSource, ...OVERPASS_SERVERS.map(overpassSource)];

// Hedged lookup across sources (see the top of this file). Any failure —
// an HTTP error (Overpass signals overload with 429/502/504) or no
// network — immediately brings in the next source; the first good answer
// wins and the requests still in flight are cancelled. Gives up with the
// last error once every source has failed or LOOKUP_TIMEOUT_MS has passed.
function queryHedged(origin: LatLng, sources: StoreSource[]): Promise<FoundStore[]> {
  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let nextSource = 0;
    let failures = 0;
    let settled = false;
    let lastError: unknown = new Error('TIMEOUT');
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      clearTimeout(deadline);
      controllers.forEach((controller) => controller.abort());
      settle();
    };
    const deadline = setTimeout(() => finish(() => reject(lastError)), LOOKUP_TIMEOUT_MS);

    const askNextSource = () => {
      clearTimeout(hedgeTimer);
      if (settled || nextSource >= sources.length) return;
      const controller = new AbortController();
      controllers.push(controller);

      sources[nextSource++](origin, controller.signal)
        .then((stores) => finish(() => resolve(stores)))
        .catch((error) => {
          if (settled) return;
          lastError = error;
          failures += 1;
          if (failures === sources.length) finish(() => reject(lastError));
          else askNextSource();
        });

      hedgeTimer = setTimeout(askNextSource, HEDGE_DELAY_MS);
    };

    askNextSource();
  });
}
