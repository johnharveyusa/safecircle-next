import { NextRequest, NextResponse } from 'next/server';

interface NearbyService {
  name: string; address: string; phone: string;
  lat: number; lng: number; distanceMi: number;
  directionsUrl?: string;
}

function distMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function findNearestGoogle(
  lat: number, lng: number, type: string, apiKey: string
): Promise<NearbyService | null> {
  const keyword = type === 'police' ? 'police station'
    : type === 'fire_station' ? 'fire station'
    : 'hospital';

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&rankby=distance&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    if (!j.results?.length) return null;

    const place = j.results[0];
    const placeLat = place.geometry.location.lat;
    const placeLng = place.geometry.location.lng;

    return {
      name: place.name,
      address: place.vicinity || '',
      phone: '',
      lat: placeLat,
      lng: placeLng,
      distanceMi: parseFloat(distMi(lat, lng, placeLat, placeLng).toFixed(2)),
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${placeLat},${placeLng}`,
    };
  } catch {
    return null;
  }
}

async function findNearestOverpass(
  lat: number, lng: number, type: string
): Promise<NearbyService | null> {
  const radius = 15000;
  let filter = '';
  if (type === 'police') {
    filter = `node[amenity=police](around:${radius},${lat},${lng});way[amenity=police](around:${radius},${lat},${lng});`;
  } else if (type === 'fire_station') {
    filter = `node[amenity=fire_station](around:${radius},${lat},${lng});way[amenity=fire_station](around:${radius},${lat},${lng});`;
  } else {
    filter = `node[amenity=hospital](around:${radius},${lat},${lng});way[amenity=hospital](around:${radius},${lat},${lng});node[healthcare=hospital](around:${radius},${lat},${lng});`;
  }
  const query = `[out:json][timeout:15];\n(\n${filter}\n);\nout center 5;`;
  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    const j = await r.json();
    const elements: any[] = j.elements ?? [];
    if (!elements.length) return null;
    const withCoords = elements.map(el => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      return { el, elLat, elLon, dist: distMi(lat, lng, elLat, elLon) };
    }).filter(x => x.elLat && x.elLon).sort((a, b) => a.dist - b.dist);
    if (!withCoords.length) return null;
    const best = withCoords[0];
    const t = best.el.tags ?? {};
    const name = t.name ?? t['name:en'] ??
      (type === 'police' ? 'Police Station' : type === 'fire_station' ? 'Fire Station' : 'Hospital');
    const addrParts = [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean);
    return {
      name, phone: t.phone ?? t['contact:phone'] ?? '',
      address: addrParts.length ? addrParts.join(' ') : `${best.elLat.toFixed(4)}, ${best.elLon.toFixed(4)}`,
      lat: best.elLat, lng: best.elLon,
      distanceMi: parseFloat(best.dist.toFixed(2)),
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${best.elLat},${best.elLon}`,
    };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '');
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

  let police, fire, hospital;

  if (apiKey) {
    // Google Places — accurate, always has data
    [police, fire, hospital] = await Promise.all([
      findNearestGoogle(lat, lng, 'police', apiKey),
      findNearestGoogle(lat, lng, 'fire_station', apiKey),
      findNearestGoogle(lat, lng, 'hospital', apiKey),
    ]);
  } else {
    // Fallback to Overpass (free, no key needed)
    [police, fire, hospital] = await Promise.all([
      findNearestOverpass(lat, lng, 'police'),
      findNearestOverpass(lat, lng, 'fire_station'),
      findNearestOverpass(lat, lng, 'hospital'),
    ]);
  }

  return NextResponse.json({ police, fire, hospital });
}
