export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Great-circle ("haversine") distance in miles. Used to decide what
// counts as "near me" instead of relying on exact zip-code matches, which
// wrongly excluded a store a mile away across a zip boundary and wrongly
// included one at the far end of a large rural zip.
export function distanceInMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

// The radius the app treats as "local". Matches what a person would
// plausibly drive to for groceries.
export const LOCAL_RADIUS_MILES = 20;

export function isWithinLocalRadius(a: LatLng, b: LatLng): boolean {
  return distanceInMiles(a, b) <= LOCAL_RADIUS_MILES;
}
