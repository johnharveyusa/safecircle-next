import { NextResponse } from 'next/server';

const sessions = new Map<string, {
  lat: number; lng: number; name: string; updatedAt: number;
}>();

function cleanup() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.updatedAt < cutoff) sessions.delete(id);
  }
}

// POST — tracked person posts location
export async function POST(request: Request) {
  try {
    const { id, lat, lng, name } = await request.json();
    if (!id || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'id, lat, lng required' }, { status: 400 });
    }
    cleanup();
    sessions.set(id, { lat, lng, name: name || 'Tracker', updatedAt: Date.now() });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

// GET — watcher polls for tracked persons
export async function GET(request: Request) {
  cleanup();
  const { searchParams } = new URL(request.url);
  const id  = searchParams.get('id');
  const all = searchParams.get('all');

  if (all) {
    const active = Array.from(sessions.entries()).map(([sid, s]) => ({ id: sid, ...s }));
    return NextResponse.json(active);
  }
  if (id) {
    const s = sessions.get(id);
    if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id, ...s });
  }
  return NextResponse.json({ error: 'id or all required' }, { status: 400 });
}

// DELETE — stop tracking session
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) sessions.delete(id);
  return NextResponse.json({ ok: true });
}
