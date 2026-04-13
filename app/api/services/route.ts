import { NextResponse } from 'next/server';

const USGS_FIRE_URL     = 'https://carto.nationalmap.gov/arcgis/rest/services/structures/MapServer/51/query';
const USGS_HOSPITAL_URL = 'https://carto.nationalmap.gov/arcgis/rest/services/structures/MapServer/21/query';
const MPD_PRECINCTS_URL = 'https://mapgis.memphistn.gov/arcgis/rest/services/AGO_MapMemphis/MapMemphis/MapServer/14/query';

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

async function queryUsgsNearest(serviceUrl: string, lat: number, lng: number) {
  try {
    const params = new URLSearchParams({
      where: "STATE='TN'", geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      distance: '12875', units: 'esriSRUnit_Meter',
      outFields: 'NAME,ADDRESS,CITY,STATE,ZIP,TELEPHONE',
      outSR: '4326', returnGeometry: 'true',
      resultRecordCount: '10', f: 'json',
    });
    const res  = await fetch(`${serviceUrl}?${params}`);
    const json = await res.json();
    const features: any[] = json.features || [];
    if (!features.length) return null;
    let best: any = null, bestDist = Infinity;
    for (const f of features) {
      const d = distanceMi(lat, lng, f.geometry?.y ?? 0, f.geometry?.x ?? 0);
      if (d < bestDist) { bestDist = d; best = f; }
    }
    if (!best) return null;
    const a = best.attributes;
    return {
      name: a.NAME || 'Unknown',
      address: [a.ADDRESS, a.CITY, a.STATE, a.ZIP].filter(Boolean).join(', '),
      phone: a.TELEPHONE || '',
      lat: best.geometry.y, lng: best.geometry.x, distanceMi: bestDist,
    };
  } catch { return null; }
}

const MPD_STATIONS: Record<string, { name: string; address: string; phone: string }> = {
  '1': { name: 'MPD Precinct 1', address: '2602 Avery Ave, Memphis, TN 38112',      phone: '(901) 636-3700' },
  '2': { name: 'MPD Precinct 2', address: '1060 Willow Rd, Memphis, TN 38117',      phone: '(901) 636-3711' },
  '3': { name: 'MPD Precinct 3', address: '4625 Tchulahoma Rd, Memphis, TN 38118',  phone: '(901) 636-3722' },
  '4': { name: 'MPD Precinct 4', address: '3880 Hamann Dr, Memphis, TN 38128',      phone: '(901) 636-3733' },
  '5': { name: 'MPD Precinct 5', address: '2285 Union Ave, Memphis, TN 38104',      phone: '(901) 636-3744' },
  '6': { name: 'MPD Precinct 6', address: '3445 Kirby Pkwy, Memphis, TN 38115',     phone: '(901) 636-3755' },
  '7': { name: 'MPD Precinct 7', address: '6850 Sandidge Rd, Memphis, TN 38134',    phone: '(901) 636-3766' },
  '8': { name: 'MPD Precinct 8', address: '2950 Appling Rd, Memphis, TN 38133',     phone: '(901) 636-3777' },
  '9': { name: 'MPD Precinct 9', address: '4895 Spottswood Ave, Memphis, TN 38117', phone: '(901) 636-3788' },
};

const PRECINCT_CENTROIDS = [
  { num: '1', lat: 35.1495, lng: -90.0490 }, { num: '2', lat: 35.1200, lng: -89.9500 },
  { num: '3', lat: 35.0600, lng: -89.9200 }, { num: '4', lat: 35.2100, lng: -89.9700 },
  { num: '5', lat: 35.1400, lng: -90.0200 }, { num: '6', lat: 35.0900, lng: -89.8900 },
  { num: '7', lat: 35.1900, lng: -89.9200 }, { num: '8', lat: 35.2200, lng: -89.8800 },
  { num: '9', lat: 35.1100, lng: -89.9300 },
];

async function queryNearestPolice(lat: number, lng: number) {
  try {
    const params = new URLSearchParams({
      where: '1=1', geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'MPDPrecinc,StationAdd,StationNam,Phone',
      returnGeometry: 'false', f: 'json',
    });
    const res  = await fetch(`${MPD_PRECINCTS_URL}?${params}`);
    const json = await res.json();
    const features: any[] = json.features || [];
    if (features.length) {
      const a = features[0].attributes;
      const precNum = String(a.MPDPrecinc || '').replace(/\D/g, '');
      const station = MPD_STATIONS[precNum];
      return {
        name: a.StationNam || station?.name    || `MPD Precinct ${precNum}`,
        address: a.StationAdd || station?.address || '',
        phone:   a.Phone      || station?.phone   || '(901) 636-3700',
        lat, lng, distanceMi: 0,
      };
    }
  } catch { /* fall through */ }
  let bestNum = '1', bestDist = Infinity;
  for (const p of PRECINCT_CENTROIDS) {
    const d = distanceMi(lat, lng, p.lat, p.lng);
    if (d < bestDist) { bestDist = d; bestNum = p.num; }
  }
  const s = MPD_STATIONS[bestNum];
  return { ...s, lat, lng, distanceMi: bestDist };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }
  try {
    const [police, fire, hospital] = await Promise.all([
      queryNearestPolice(lat, lng),
      queryUsgsNearest(USGS_FIRE_URL,     lat, lng),
      queryUsgsNearest(USGS_HOSPITAL_URL, lat, lng),
    ]);
    return NextResponse.json({ police, fire, hospital });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lookup failed' }, { status: 500 });
  }
}
