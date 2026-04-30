import { NextRequest, NextResponse } from 'next/server';

interface NearbyService {
  name: string; address: string; phone: string;
  lat: number; lng: number; distanceMi: number;
}

function distMi(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Map our service types to Overpass amenity tags
const AMENITY_MAP: Record<string, string[]> = {
  police:       ['amenity=police'],
  fire_station: ['amenity=fire_station'],
  hospital:     ['amenity=hospital', 'amenity=clinic', 'amenity=doctors'],
};

async function findNearest(
  lat: number, lng: number, type: string
): Promise<NearbyService | null> {
  const tags = AMENITY_MAP[type] ?? [`amenity=${type}`];
  // Search within 10 km radius via Overpass API (free, no key)
  const radius = 10000;
  const filters = tags.map(t => `node[${t}](around:${radius},${lat},${lng});`).join('\n');
  const query = `[out:json][timeout:10];\n(\n${filters}\n);\nout body 5;`;

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    const j = await r.json();
    const elements: any[] = j.elements ?? [];
    if (!elements.length) return null;

    // Sort by distance and take the closest
    const sorted = elements
      .map(el => ({
        el,
        dist: distMi(lat, lng, el.lat, el.lon),
      }))
      .sort((a, b) => a.dist - b.dist);

    const best = sorted[0];
    const t = best.el.tags ?? {};

    const name =
      t.name ??
      t['name:en'] ??
      (type === 'police' ? 'Police Station' :
       type === 'fire_station' ? 'Fire Station' : 'Hospital');

    // Build a readable address from OSM tags
    const addrParts = [
      t['addr:housenumber'],
      t['addr:street'],
      t['addr:city'],
    ].filter(Boolean);
    const address = addrParts.length
      ? addrParts.join(' ')
      : `${best.el.lat.toFixed(5)}, ${best.el.lon.toFixed(5)}`;

    const phone = t.phone ?? t['contact:phone'] ?? '';

    return {
      name,
      address,
      phone,
      lat: best.el.lat,
      lng: best.el.lon,
      distanceMi: parseFloat(best.dist.toFixed(2)),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get('lat') ?? '');
  const lng = parseFloat(req.nextUrl.searchParams.get('lng') ?? '');
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }
  const [police, fire, hospital] = await Promise.all([
    findNearest(lat, lng, 'police'),
    findNearest(lat, lng, 'fire_station'),
    findNearest(lat, lng, 'hospital'),
  ]);
  return NextResponse.json({ police, fire, hospital });
}
