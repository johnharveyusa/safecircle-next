/**
 * lib/geocode.ts
 *
 * Geocodes a free-text address to { lat, lng } using the free
 * ArcGIS World Geocoding Service — no API key required.
 *
 * Same geocoder used by the MPD public safety HTML prototype.
 */

const ARCGIS_GEOCODE_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

export interface LatLng {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<LatLng> {
  const url = new URL(ARCGIS_GEOCODE_URL);
  url.searchParams.set("SingleLine", address);
  url.searchParams.set("maxLocations", "1");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("f", "pjson");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`ArcGIS geocoder HTTP error ${res.status}`);

  const data = await res.json();
  if (!data.candidates || !data.candidates.length) {
    throw new Error(`Address not found: ${address}`);
  }

  const best = data.candidates[0];
  return {
    lat: best.location.y,
    lng: best.location.x,
  };
}

/**
 * Parse a Shelby County address string into warrant search params.
 * e.g. "4128 Weymouth Cove" -> { s: "4128", st: "weymouth" }
 */
export function parseWarrantParams(address: string): { s: string; st: string } {
  const parts = address.trim().split(/\s+/);
  const s = parts[0] ?? "";
  const st = (parts[1] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return { s, st };
}
