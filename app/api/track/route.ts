import { NextRequest, NextResponse } from 'next/server';

// In-memory store — sessions clear on server restart (intentional, privacy-first)
const sessions: Map<string, { id: string; name: string; lat: number; lng: number; updatedAt: number }> = new Map();

export async function GET(req: NextRequest) {
 const all = req.nextUrl.searchParams.get('all');
 if (all) {
 return NextResponse.json(Array.from(sessions.values()));
 }
 const id = req.nextUrl.searchParams.get('id');
 if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
 return NextResponse.json(sessions.get(id) ?? null);
}

export async function POST(req: NextRequest) {
 try {
 const { id, name, lat, lng } = await req.json();
 if (!id || !lat || !lng) return NextResponse.json({ error: 'id, lat, lng required' }, { status: 400 });
 sessions.set(id, { id, name: name || 'Field Worker', lat, lng, updatedAt: Date.now() });
 return NextResponse.json({ ok: true });
 } catch {
 return NextResponse.json({ error: 'server error' }, { status: 500 });
 }
}
