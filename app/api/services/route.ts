import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

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

async function findNearest(lat: number, lng: number, type: string): Promise<NearbyService | null> {
 if (!GOOGLE_KEY) return null;
 try {
 const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&type=${type}&key=${GOOGLE_KEY}`;
 const r = await fetch(url);
 const j = await r.json();
 const place = j.results?.[0];
 if (!place) return null;
 const plat = place.geometry.location.lat;
 const plng = place.geometry.location.lng;
 // Get phone via Place Details
 let phone = '';
 try {
 const d = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number&key=${GOOGLE_KEY}`);
 const dj = await d.json();
 phone = dj.result?.formatted_phone_number ?? '';
 } catch {}
 return {
 name: place.name,
 address: place.vicinity,
 phone,
 lat: plat,
 lng: plng,
 distanceMi: parseFloat(distMi(lat, lng, plat, plng).toFixed(2)),
 };
 } catch { return null; }
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
