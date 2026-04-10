/**
 * app/api/contacts/route.ts
 * Finds nearest police, fire, hospital using Google Places API
 * Requires GOOGLE_MAPS_API_KEY environment variable
 */

import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress, LatLng } from "@/lib/geocode";

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";
const SEARCH_RADIUS_METERS = 8000;

export interface EmergencyContact {
  type: "police" | "fire" | "hospital";
  name: string;
  address: string;
  phone: string;
  distance_mi: number | null;
  maps_url: string;
  place_id: string;
}

const PLACE_TYPES: { type: EmergencyContact["type"]; googleType: string }[] = [
  { type: "police", googleType: "police" },
  { type: "fire", googleType: "fire_station" },
  { type: "hospital", googleType: "hospital" },
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

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 500 });
  }

  try {
    const center = await geocodeAddress(address);
    const contacts: EmergencyContact[] = [];

    await Promise.all(
      PLACE_TYPES.map(async ({ type, googleType }) => {
        try {
          const nearbyParams = new URLSearchParams({
            location: `${center.lat},${center.lng}`,
            radius: String(SEARCH_RADIUS_METERS),
            type: googleType,
            key,
          });

          const nearbyRes = await fetch(`${PLACES_BASE}/nearbysearch/json?${nearbyParams}`);
          if (!nearbyRes.ok) return;
          const nearbyData = await nearbyRes.json();
          const nearby = nearbyData.results?.[0];
          if (!nearby) return;

          const placeId = String(nearby.place_id ?? "");

          // Get phone number from place details
          const detailParams = new URLSearchParams({
            place_id: placeId,
            fields: "name,formatted_address,formatted_phone_number,geometry",
            key,
          });
          const detailRes = await fetch(`${PLACES_BASE}/details/json?${detailParams}`);
          const detailData = detailRes.ok ? await detailRes.json() : null;
          const details = detailData?.result;

          const loc = nearby.geometry?.location;
          const distanceMi =
            loc?.lat != null
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
          // Skip if this type fails
        }
      })
    );

    contacts.sort((a, b) =>
      ["police", "fire", "hospital"].indexOf(a.type) -
      ["police", "fire", "hospital"].indexOf(b.type)
    );

    return NextResponse.json({ address, center, contacts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
