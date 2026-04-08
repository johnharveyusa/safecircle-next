/**
 * Geocode a free-text address to { lat, lng }
 * Uses Google Maps Geocoding API.
 * Requires GOOGLE_MAPS_API_KEY in environment.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<LatLng> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set");

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding HTTP error ${res.status}`);

  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }

  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

/**
 * Parse a Shelby County address string into the warrant search params.
 * e.g. "4128 Weymouth Cove" -> { s: "4128", st: "weymouth" }
 */
export function parseWarrantParams(address: string): { s: string; st: string } {
  const parts = address.trim().split(/\s+/);
  const s = parts[0] ?? "";
  // Street name is everything after the number, lowercased, first word only
  const st = (parts[1] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return { s, st };
}
