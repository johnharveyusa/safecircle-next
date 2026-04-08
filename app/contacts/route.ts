/**
 * app/api/contacts/route.ts
 *
 * Finds the nearest police station, fire station, and hospital to a given
 * address using the Google Places Nearby Search API.
 *
 * Required env vars:
 *   GOOGLE_MAPS_API_KEY  — must have Places API enabled
 */

import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress, LatLng } from "@/lib/geocode";

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const SEARCH_RADIUS_METERS = 8000; // 5 miles

export interface EmergencyContact {
  type: "police" | "fire" | "hospital";
  name: string;
  address: string;
  phone: string;
  distance_mi: number | null;
  maps_url: string;
  place_id: string;
}

const PLACE_TYPES: { type: EmergencyContact["type"]; keyword: string; googleType: string }[] = [
  { type: "police", keyword: "police precinct", googleType: "police" },
  { type: "fire", keyword: "fire station", googleType: "fire_station" },
  { type: "hospital", keyword: "hospital emergency", googleType: "hospital" },
];

function haversineDistanceMi(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function fetchNearby(
  center: LatLng,
  googleType: string,
  key: string
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    location: `${center.lat},${center.lng}`,
    radius: String(SEARCH_RADIUS_METERS),
    type: googleType,
    key,
  });

  const res = await fetch(`${PLACES_BASE}/nearbysearch/json?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results as Record<string, unknown>[];
  return results?.[0] ?? null;
}

async function fetchPlaceDetails(
  placeId: string,
  key: string
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "name,formatted_address,formatted_phone_number,geometry",
    key,
  });

  const res = await fetch(`${PLACES_BASE}/details/json?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.result as Record<string, unknown>) ?? null;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });
  }

  try {
    const center = await geocodeAddress(address);
    const contacts: EmergencyContact[] = [];

    await Promise.all(
      PLACE_TYPES.map(async ({ type, googleType }) => {
        try {
          const nearby = await fetchNearby(center, googleType, key);
          if (!nearby) return;

          const placeId = String(nearby.place_id ?? "");
          const details = placeId ? await fetchPlaceDetails(placeId, key) : null;
          const loc = (nearby.geometry as Record<string, unknown>)?.location as
            | Record<string, number>
            | undefined;

          const distanceMi =
            loc?.lat != null && loc?.lng != null
              ? Math.round(haversineDistanceMi(center, { lat: loc.lat, lng: loc.lng }) * 10) / 10
              : null;

          contacts.push({
            type,
            name: String(details?.name ?? nearby.name ?? ""),
            address: String(details?.formatted_address ?? nearby.vicinity ?? ""),
            phone: String(details?.formatted_phone_number ?? ""),
            distance_mi: distanceMi,
            maps_url: `https://www.google.com/maps/place/?q=place_id:${placeId}`,
            place_id: placeId,
          });
        } catch {
          // Skip this contact type if lookup fails
        }
      })
    );

    const order = ["police", "fire", "hospital"];
    contacts.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    return NextResponse.json({ address, center, contacts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
