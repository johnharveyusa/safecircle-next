/**
 * lib/geocode.ts
 * Shared geocoding utilities using ESRI ArcGIS World Geocoder
 */

const GEOCODE_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

export interface LatLng {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<LatLng & { matched: string }> {
  const url = `${GEOCODE_URL}?SingleLine=${encodeURIComponent(address)}&maxLocations=1&outFields=*&f=pjson`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.candidates?.length) {
    throw new Error(`Address not found: ${address}`);
  }

  const best = data.candidates[0];
  return {
    lat: best.location.y,
    lng: best.location.x,
    matched: best.address,
  };
}

export function parseWarrantParams(address: string): { s: string; st: string } {
  // Parse "4128 Weymouth Cove, Memphis TN" → s="4128", st="weymouth"
  const parts = address.trim().split(",")[0].trim().split(/\s+/);
  const s = /^\d+$/.test(parts[0]) ? parts[0] : "";
  const st = (s ? parts[1] : parts[0])?.toLowerCase() ?? "";
  return { s, st };
}
