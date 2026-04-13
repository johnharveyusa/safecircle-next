'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

export default function TrackerPage() {
  const params  = useParams();
  const id      = Array.isArray(params.id) ? params.id[0] : params.id as string;
  const [status,   setStatus]   = useState<'idle' | 'active' | 'denied' | 'error'>('idle');
  const [name,     setName]     = useState('');
  const [lastSent, setLastSent] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    fetch(`/api/track?id=${id}`, { method: 'DELETE' });
    setStatus('idle');
  }

  async function sendLocation() {
    return new Promise<void>(resolve => {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          try {
            await fetch('/api/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, lat: pos.coords.latitude, lng: pos.coords.longitude, name: name || 'Field Worker' }),
            });
            setLastSent(new Date().toLocaleTimeString());
          } catch { /* retry next interval */ }
          resolve();
        },
        err => { if (err.code === err.PERMISSION_DENIED) setStatus('denied'); resolve(); },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  async function start() {
    if (!navigator.geolocation) { setStatus('error'); return; }
    setStatus('active');
    await sendLocation();
    intervalRef.current = setInterval(sendLocation, 15000);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-2">🛡</div>
        <h1 className="text-2xl font-semibold text-white">SafeCircle</h1>
        <p className="text-sm text-slate-400">Location check-in</p>
      </div>

      {status === 'idle' && (
        <div className="w-full max-w-sm space-y-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2 text-xs text-slate-400">
            <p>✅ <strong className="text-slate-200">Your choice, always.</strong> Tap the button below only if you want to share your location.</p>
            <p>🔒 <strong className="text-slate-200">Session only.</strong> Location is never stored — it disappears the moment you close this page.</p>
            <p>👁 <strong className="text-slate-200">Live only.</strong> Whoever sent you this link can see where you are right now, nothing more.</p>
            <p>🛑 <strong className="text-slate-200">Stop anytime.</strong> Tap Stop or just close this tab.</p>
          </div>
          <input
            type="text" placeholder="Your name (optional)"
            value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button onClick={start}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-bold transition-colors">
            📍 Yes — Share My Location
          </button>
          <p className="text-center text-xs text-slate-600">Don't want to? Just close this page. Nothing happens.</p>
        </div>
      )}

      {status === 'active' && (
        <div className="text-center space-y-5 w-full max-w-sm">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto animate-pulse">
            <span className="text-3xl">📍</span>
          </div>
          <div>
            <p className="text-emerald-400 font-semibold text-lg">Location sharing active</p>
            {lastSent && <p className="text-xs text-slate-500 mt-1">Last update: {lastSent}</p>}
            <p className="text-xs text-slate-500 mt-1">Updating every 15 seconds</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-400 text-left space-y-1">
            <p>• Keep this page open to continue sharing</p>
            <p>• Closing this tab stops sharing immediately</p>
            <p>• Your location is not recorded or stored</p>
          </div>
          <button onClick={stop}
            className="w-full py-3 rounded-xl border-2 border-rose-600 text-rose-400 hover:bg-rose-900/30 font-semibold transition-colors">
            🛑 Stop Sharing My Location
          </button>
        </div>
      )}

      {status === 'denied' && (
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-rose-400 font-semibold">Location access was denied</p>
          <p className="text-xs text-slate-400">To share your location, enable location permissions in your browser or phone settings, then try again.</p>
          <button onClick={() => setStatus('idle')} className="text-sm text-blue-400 underline">Try again</button>
        </div>
      )}

      {status === 'error' && (
        <p className="text-rose-400 text-sm text-center">Location services are not available on this device or browser.</p>
      )}

      <p className="text-xs text-slate-700 text-center">Powered by U.S. Crime Centers</p>
    </main>
  );
}
