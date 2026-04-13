/**
 * app/api/contacts/route.ts
 *
 * Finds nearest police station, fire station, and hospital
 * using the Google Places API (Nearby Search).
 *
 * Requires GOOGLE_MAPS_API_KEY in Vercel environment variables.
 *
 * First geocodes the address, then queries Places for each type.
 */

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

interface PlaceResult {
  name: string;
  address: string;
  phone?: string;
  distance?: string;
  lat: number;
  lng: number;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) return null;
  return data.results[0].geometry.location;
}

async function findNearest(
  lat: number,
  lng: number,
  type: string,
  keyword?: string
): Promise<PlaceResult | null> {
  const kw = keyword ? `&keyword=${encodeURIComponent(keyword)}` : "";
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&type=${type}${kw}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) return null;

  const place = data.results[0];
  const plat = place.geometry.location.lat;
  const plng = place.geometry.location.lng;

  // Rough distance in miles
  const R = 3958.8;
  const dLat = ((plat - lat) * Math.PI) / 180;
  const dLng = ((plng - lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat * Math.PI) / 180) * Math.cos((plat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const distMi = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = distMi < 0.1 ? `${Math.round(distMi * 5280)} ft` : `${distMi.toFixed(1)} mi`;

  // Get phone via Place Details
  let phone: string | undefined;
  try {
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number&key=${GOOGLE_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();
    phone = detailData.result?.formatted_phone_number;
  } catch {}

  return {
    name: place.name,
    address: place.vicinity ?? "",
    phone,
    distance,
    lat: plat,
    lng: plng,
  };
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_MAPS_API_KEY not configured" },
      { status: 500 }
    );
  }

  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  const coords = await geocodeAddress(address);
  if (!coords) {
    return NextResponse.json({ error: "Could not geocode address" }, { status: 422 });
  }

  const { lat, lng } = coords;

  const [police, fire, hospital] = await Promise.all([
    findNearest(lat, lng, "police"),
    findNearest(lat, lng, "fire_station"),
    findNearest(lat, lng, "hospital"),
  ]);

  return NextResponse.json({ police, fire, hospital, coords: { lat, lng } });
}
