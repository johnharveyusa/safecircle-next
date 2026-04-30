import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

// ─── Distance helper ──────────────────────────────────────────────────────────

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

// ─── Google Places lookup ─────────────────────────────────────────────────────

async function findViaGoogle(lat: number, lng: number, type: string, keyword: string) {
  const base = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
  const primaryUrl = `${base}?location=${lat},${lng}&rankby=distance&type=${type}&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_API_KEY}`;
  const fallbackUrl = `${base}?location=${lat},${lng}&rankby=distance&type=${type}&key=${GOOGLE_API_KEY}`;

  let nearbyData: any = null;
  try {
    const r1 = await fetch(primaryUrl);
    nearbyData = await r1.json();
    if (!nearbyData.results?.length) {
      const r2 = await fetch(fallbackUrl);
      nearbyData = await r2.json();
    }
  } catch {
    return null;
  }

  if (!nearbyData.results?.length) return null;

  const best = nearbyData.results[0];
  const bLat = best.geometry.location.lat;
  const bLng = best.geometry.location.lng;
  const distMi = calcDistanceMiles(lat, lng, bLat, bLng);

  // Get phone number via Details call
  let phone: string | null = null;
  let formattedAddress = best.vicinity || '';
  try {
    const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${best.place_id}&fields=name,formatted_phone_number,formatted_address&key=${GOOGLE_API_KEY}`;
    const dr = await fetch(detailsUrl);
    const dd = await dr.json();
    phone = dd.result?.formatted_phone_number || null;
    formattedAddress = dd.result?.formatted_address || best.vicinity || '';
  } catch { /* phone stays null */ }

  return {
    name: best.name,
    address: formattedAddress,
    phone,
    distanceMi: distMi,
    lat: bLat,
    lng: bLng,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${bLat},${bLng}&destination_place_id=${best.place_id}`,
  };
}

// ─── OpenStreetMap Overpass fallback ──────────────────────────────────────────

async function findViaOverpass(lat: number, lng: number, osmAmenity: string) {
  const radius = 8000; // ~5 miles
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"="${osmAmenity}"](around:${radius},${lat},${lng});
      way["amenity"="${osmAmenity}"](around:${radius},${lat},${lng});
    );
    out center 5;
  `;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await r.json();
    if (!data.elements?.length) return null;

    // Find closest
    let best: any = null;
    let bestDist = Infinity;
    for (const el of data.elements) {
      const eLat = el.lat ?? el.center?.lat;
      const eLng = el.lon ?? el.center?.lon;
      if (!eLat || !eLng) continue;
      const d = calcDistanceMiles(lat, lng, eLat, eLng);
      if (d < bestDist) { bestDist = d; best = { ...el, eLat, eLng }; }
    }
    if (!best) return null;

    const name = best.tags?.name || best.tags?.['name:en'] || osmAmenity.replace('_', ' ');
    const addr = [
      best.tags?.['addr:housenumber'],
      best.tags?.['addr:street'],
      best.tags?.['addr:city'],
      best.tags?.['addr:state'],
    ].filter(Boolean).join(' ') || `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    return {
      name,
      address: addr,
      phone: best.tags?.phone || best.tags?.['contact:phone'] || null,
      distanceMi: bestDist,
      lat: best.eLat,
      lng: best.eLng,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${best.eLat},${best.eLng}`,
    };
  } catch {
    return null;
  }
}

// ─── Combined: Google first, Overpass fallback ────────────────────────────────

async function findNearest(
  lat: number, lng: number,
  googleType: string, googleKeyword: string,
  osmAmenity: string,
) {
  if (GOOGLE_API_KEY) {
    try {
      const result = await findViaGoogle(lat, lng, googleType, googleKeyword);
      if (result) return result;
    } catch { /* fall through */ }
  }
  return findViaOverpass(lat, lng, osmAmenity);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    const [police, fire, hospital] = await Promise.all([
      findNearest(lat, lng, 'police',       'police station',  'police'),
      findNearest(lat, lng, 'fire_station', 'fire department', 'fire_station'),
      findNearest(lat, lng, 'hospital',     'hospital',        'hospital'),
    ]);

    return NextResponse.json({ police, fire, hospital });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lookup failed' }, { status: 500 });
  }
}
