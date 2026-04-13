import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

interface PlaceResult {
  name: string;
  vicinity: string;
  geometry: { location: { lat: number; lng: number } };
  formatted_phone_number?: string;
  place_id: string;
}

function distanceMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearest(
  lat: number, lng: number,
  type: string, keyword: string,
): Promise<{ name: string; address: string; phone: string; lat: number; lng: number; distanceMi: number } | null> {
  if (!GOOGLE_API_KEY) return null;

  // Nearby search
  const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&type=${type}&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_API_KEY}`;
  const nearbyRes = await fetch(nearbyUrl);
  const nearbyJson = await nearbyRes.json();
  const results: PlaceResult[] = nearbyJson.results || [];
  if (!results.length) return null;

  const place = results[0];
  const pLat = place.geometry.location.lat;
  const pLng = place.geometry.location.lng;

  // Details call to get phone number
  let phone = '';
  try {
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number&key=${GOOGLE_API_KEY}`;
    const detailRes = await fetch(detailUrl);
    const detailJson = await detailRes.json();
    phone = detailJson.result?.formatted_phone_number || '';
  } catch {
    // phone stays empty — not fatal
  }

  return {
    name:       place.name,
    address:    place.vicinity,
    phone,
    lat:        pLat,
    lng:        pLng,
    distanceMi: distanceMi(lat, lng, pLat, pLng),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_API_KEY is not set in Vercel environment variables.' },
      { status: 500 },
    );
  }

  try {
    const [police, fire, hospital] = await Promise.all([
      findNearest(lat, lng, 'police',   'police station'),
      findNearest(lat, lng, 'fire_station', 'fire station'),
      findNearest(lat, lng, 'hospital', 'hospital'),
    ]);

    return NextResponse.json({ police, fire, hospital });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lookup failed' }, { status: 500 });
  }
}
