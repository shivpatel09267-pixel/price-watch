import * as Location from 'expo-location';
import { withTimeout } from '../utils/async';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CapturedLocation extends Coordinates {
  zipCode: string;
  // Human-readable street address of where the price was seen, derived
  // from the same reverse-geocode call that produces the zip code (so it
  // costs nothing extra and needs no input from the user). Null when
  // reverse geocoding fails or returns nothing usable — callers must
  // handle that, since coordinates always exist but an address may not.
  address: string | null;
}

// Turns a reverse-geocode result into something worth showing a person.
// Prefers "1234 W Hillsborough Ave, Tampa" and falls back through the
// less specific fields rather than rendering "null" or an empty string.
function formatAddress(result: Location.LocationGeocodedAddress): string | null {
  const streetLine =
    [result.streetNumber, result.street].filter(Boolean).join(' ').trim() || result.name || '';
  if (!streetLine) return result.city ?? null;
  return result.city ? `${streetLine}, ${result.city}` : streetLine;
}

// Thrown specifically so callers (the quick-log flow) can show a clear,
// actionable message instead of a generic "something went wrong".
export class LocationPermissionDeniedError extends Error {
  // true when the OS won't even show the permission prompt again (the
  // user has to go into Settings manually) — worth telling them that
  // instead of having them tap "Submit" over and over for nothing.
  constructor(public canAskAgain: boolean) {
    super('Location permission denied');
    this.name = 'LocationPermissionDeniedError';
  }
}

export class LocationUnavailableError extends Error {
  constructor() {
    super('Could not determine location');
    this.name = 'LocationUnavailableError';
  }
}

// A location this fresh is close enough for tagging a price entry or
// centering the map — neither needs a brand new GPS fix.
const ACCEPTABLE_CACHE_AGE_MS = 5 * 60 * 1000;
// If a real GPS fix hasn't come back by this point, stop waiting rather
// than leaving the caller stuck spinning forever — some devices
// (especially emulators, or a weak signal indoors) can hang far longer
// than a "quick log" flow (or a map screen's initial load) should wait.
const GPS_TIMEOUT_MS = 8000;
// "Last known" and reverse-geocode calls are supposed to be near-instant,
// but on some devices they can hang indefinitely rather than resolving
// or rejecting — every single native Location.* call below is wrapped in
// a timeout for exactly this reason, not just the ones that seemed most
// likely to be slow.
const QUICK_CALL_TIMEOUT_MS = 4000;

// Every location call below fails soft — a denied permission or a GPS
// timeout returns null or falls back rather than throwing. That's the
// right behaviour for the user, but it means failures leave no trace
// unless they're logged, so each one is recorded here. Not step-by-step
// tracing: only the things that actually went wrong.
function logFailure(step: string, error: unknown) {
  console.warn(`[locationService] ${step}:`, error instanceof Error ? error.message : error);
}

// Shared by captureLocation (below) and the map screen's initial
// centering. Tries a cached "last known" position first (instant, if
// recent enough), then a fresh GPS fix capped at GPS_TIMEOUT_MS. Returns
// null rather than throwing if permission is denied or nothing resolves
// in time — callers decide their own fallback (a zip-code estimate, a
// fixed default region, an error message, etc.).
export async function getDeviceCoordinates(): Promise<Coordinates | null> {
  let status: Location.PermissionStatus;
  try {
    ({ status } = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      QUICK_CALL_TIMEOUT_MS
    ));
  } catch (e) {
    logFailure('getDeviceCoordinates: permission request', e);
    return null;
  }
  if (status !== 'granted') return null;

  try {
    const cached = await withTimeout(
      Location.getLastKnownPositionAsync({ maxAge: ACCEPTABLE_CACHE_AGE_MS }),
      QUICK_CALL_TIMEOUT_MS
    );
    if (cached) return cached.coords;
  } catch (e) {
    logFailure('getDeviceCoordinates: cached position', e);
    // Fall through to a fresh fix below.
  }

  try {
    const fresh = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      GPS_TIMEOUT_MS
    );
    return fresh.coords;
  } catch (e) {
    logFailure('getDeviceCoordinates: fresh position', e);
    return null;
  }
}

// Requests permission (if not already granted), gets the device's
// coordinates, and reverse-geocodes them to a zip code — this tags the
// entry with where the price was actually seen, which may differ from the
// user's home zip code (e.g. logging a gas price while traveling).
//
// Falls back in stages rather than ever blocking submission indefinitely:
//   1. Cached/fresh device coordinates (see getDeviceCoordinates above)
//   2. Forward-geocoding the user's profile zip code to an approximate
//      lat/long, if GPS never resolves at all
export async function captureLocation(fallbackZip: string): Promise<CapturedLocation> {
  let status: Location.PermissionStatus;
  let canAskAgain: boolean;
  try {
    ({ status, canAskAgain } = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      QUICK_CALL_TIMEOUT_MS
    ));
  } catch (e) {
    logFailure('captureLocation: permission request', e);
    // Couldn't even determine permission status in time — treat it the
    // same as "location truly unavailable" rather than assuming denied.
    throw new LocationUnavailableError();
  }
  if (status !== 'granted') {
    throw new LocationPermissionDeniedError(canAskAgain);
  }

  let coords = await getDeviceCoordinates();

  if (!coords && fallbackZip) {
    try {
      const results = await withTimeout(Location.geocodeAsync(fallbackZip), GPS_TIMEOUT_MS);
      if (results[0]) coords = results[0];
    } catch (e) {
      logFailure('captureLocation: zip geocode', e);
      // Also failed (e.g. fully offline) — handled below.
    }
  }

  if (!coords) {
    throw new LocationUnavailableError();
  }

  const { latitude, longitude } = coords;

  let zipCode = fallbackZip;
  let address: string | null = null;
  try {
    const results = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      QUICK_CALL_TIMEOUT_MS
    );
    const postalCode = results[0]?.postalCode;
    if (postalCode) zipCode = postalCode;
    if (results[0]) address = formatAddress(results[0]);
  } catch (e) {
    logFailure('captureLocation: reverse geocode', e);
    // Reverse geocoding can fail (e.g. no network) — fall back to the
    // user's profile zip code rather than blocking the whole submission
    // over a non-essential lookup.
  }

  return { latitude, longitude, zipCode, address };
}
