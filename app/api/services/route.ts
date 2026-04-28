import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

interface PlaceResult {
  name: string;
  vicinity: string;
  formatted_phone_number?: string;
  place_id: string;
  geometry: { location: { lat: number; lng: number } };
}

function calcDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearest(lat: number, lng: number, type: string, keyword: string) {
  // Step 1: Nearby search
  const nearbyUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&type=${type}&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_API_KEY}`;

  const nearbyRes = await fetch(nearbyUrl);
  const nearbyData = await nearbyRes.json();

  if (!nearbyData.results || nearbyData.results.length === 0) {
    return null;
  }

  const best: PlaceResult = nearbyData.results[0];
  const distMiles = calcDistanceMiles(lat, lng, best.geometry.location.lat, best.geometry.location.lng);
  const distLabel = distMiles < 1 ? `${Math.round(distMiles * 5280)} ft` : `${distMiles.toFixed(1)} mi`;

  // Step 2: Details for phone number
  const detailsUrl =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${best.place_id}&fields=name,formatted_phone_number,formatted_address,opening_hours&key=${GOOGLE_API_KEY}`;

  const detailsRes = await fetch(detailsUrl);
  const detailsData = await detailsRes.json();
  const details = detailsData.result || {};

  return {
    name: best.name,
    address: details.formatted_address || best.vicinity,
    phone: details.formatted_phone_number || null,
    distance: distLabel,
    lat: best.geometry.location.lat,
    lng: best.geometry.location.lng,
    place_id: best.place_id,
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${best.place_id}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${best.geometry.location.lat},${best.geometry.location.lng}&destination_place_id=${best.place_id}`,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY not configured' }, { status: 500 });
  }

  try {
    const [police, fire, hospital] = await Promise.all([
      findNearest(lat, lng, 'police', 'police station'),
      findNearest(lat, lng, 'fire_station', 'fire station'),
      findNearest(lat, lng, 'hospital', 'hospital'),
    ]);

    return NextResponse.json({ police, fire, hospital });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lookup failed' }, { status: 500 });
  }
}
