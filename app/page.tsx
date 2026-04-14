'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';

const LeafletMapComponent = dynamic(() => import('./LeafletMapComponent'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-40 text-sm text-slate-400">Loading map…</div>,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const JAIL_URL    = 'https://imljail.shelbycountytn.gov/IML';
const GEOCODE_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const USC_URL     = 'https://uscrimecenters.com';

// ─── Address helpers ──────────────────────────────────────────────────────────

function splitAddress(raw: string) {
  const parts = raw.trim().split(/\s+/);
  return { num: parts[0] || '', name: parts.slice(1).join(' ') };
}
function warrantUrl(raw: string) {
  const { num, name } = splitAddress(raw);
  const st = name.split(/\s+/)[0];
  return `https://warrants.shelby-sheriff.org/w_warrant_result.php?w=&l=&f=&s=${encodeURIComponent(num)}&st=${encodeURIComponent(st)}`;
}
function offenderUrl(raw: string) {
  return `https://www.nsopw.gov/en/Search/Results?street=${encodeURIComponent(raw.trim() + ', Memphis, TN')}`;
}
function directionsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
async function geocodeAddress(raw: string) {
  try {
    const url = `${GEOCODE_URL}?SingleLine=${encodeURIComponent(raw + ', Memphis, TN')}&maxLocations=1&outFields=*&f=pjson`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.candidates?.length) return null;
    return { lat: j.candidates[0].location.y, lng: j.candidates[0].location.x, label: j.candidates[0].address };
  } catch { return null; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NearbyService { name: string; address: string; phone: string; lat: number; lng: number; distanceMi: number; }
interface EmergencyServices { police: NearbyService | null; fire: NearbyService | null; hospital: NearbyService | null; }
interface Contact { id: string; name: string; phone: string; email: string; }
interface TrackedPerson { id: string; name: string; lat: number; lng: number; updatedAt: number; }

// ─── Section accordion ────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false, dark = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderRadius: 20,
      border: dark ? '1px solid rgba(34,211,238,0.2)' : '1px solid #bfdbfe',
      background: dark
        ? 'linear-gradient(135deg, #0f1f3d 0%, #0a1628 100%)'
        : 'white',
      overflow: 'hidden',
      boxShadow: dark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 2px 12px rgba(37,99,235,0.08)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '14px 16px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left',
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: dark ? '#f1f5f9' : '#1e3a5f' }}>{title}</span>
        <span style={{
          fontSize: 20, fontWeight: 700, lineHeight: 1,
          color: open ? '#22d3ee' : (dark ? '#475569' : '#93c5fd'),
        }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{
        padding: '8px 16px 16px',
        borderTop: dark ? '1px solid rgba(34,211,238,0.15)' : '1px solid #bfdbfe',
      }}>{children}</div>}
    </div>
  );
}

// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({ contact, onRemove }: { contact: Contact; onRemove: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(34,211,238,0.1)' }}>
      <div>
        <p style={{ fontSize:14, fontWeight:600, color: '#f1f5f9' }}>{contact.name}</p>
        <p style={{ fontSize:11, color:'#64748b' }}>{contact.phone}{contact.phone && contact.email ? ' · ' : ''}{contact.email}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {contact.phone && <a href={`tel:${contact.phone}`} className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">Call</a>}
        {contact.phone && <a href={`sms:${contact.phone}`} className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">SMS</a>}
        {contact.email && <a href={`mailto:${contact.email}`} className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700">Email</a>}
        <button onClick={() => onRemove(contact.id)} className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-900/40">✕</button>
      </div>
    </div>
  );
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ emoji, label, svc, loading }: { emoji: string; label: string; svc: NearbyService | null; loading: boolean; darkMode?: boolean }) {
  const cardStyle = { borderRadius:14, border:'1px solid rgba(34,211,238,0.15)',
    background:'rgba(15,31,61,0.8)', padding:'12px 14px' };
  if (loading) return (
    <div style={cardStyle}>
      <p style={{ fontSize:12, color:'#22d3ee' }}>{emoji} Locating nearest {label}…</p>
    </div>
  );
  if (!svc) return (
    <div style={cardStyle}>
      <p style={{ fontSize:13, fontWeight:600, color:'#64748b' }}>{emoji} {label}</p>
      <p style={{ fontSize:11, color:'#334155', marginTop:4 }}>Set an address above to find the nearest {label.toLowerCase()}.</p>
    </div>
  );
  return (
    <div style={{ borderRadius:14, border:'1px solid rgba(34,211,238,0.25)',
      background:'linear-gradient(135deg, #0f1f3d, #0a1628)', padding:'12px 14px',
      boxShadow:'0 4px 20px rgba(0,0,0,0.3)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{emoji} {svc.name}</p>
          <p className="text-xs text-slate-500 truncate">{svc.address}</p>
          {svc.distanceMi > 0 && <p className="text-xs text-slate-500">{svc.distanceMi.toFixed(1)} mi away</p>}
          {svc.phone ? <a href={`tel:${svc.phone}`} className="text-xs text-blue-400 hover:underline">{svc.phone}</a>
            : <p className="text-xs text-slate-600">Phone not available</p>}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {svc.phone && <a href={`tel:${svc.phone}`} className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-center">Call</a>}
          <a href={directionsUrl(svc.address)} target="_blank" rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded-lg bg-blue-900/60 text-blue-300 hover:bg-blue-800/60 text-center">Directions →</a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — LOCATION TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

function TrackingMap({ watcherLat, watcherLng, sessions }: {
  watcherLat: number | null; watcherLng: number | null; sessions: TrackedPerson[];
}) {
  const mapRef     = useRef<any>(null);
  const watcherRef = useRef<any>(null);
  const markerRefs = useRef<Record<string, any>>({});
  const LRef       = useRef<any>(null);

  // Init map
  useEffect(() => {
    if (!watcherLat || !watcherLng) return;
    let cancelled = false;
    async function init() {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      LRef.current = L;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      const map = L.map('tracking-map').setView([watcherLat!, watcherLng!], 13);
      mapRef.current = map;

      // CartoDB dark tiles — same as crime map, no referer issues
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
      }).addTo(map);

      // Watcher's own pulsing blue dot
      watcherRef.current = L.circleMarker([watcherLat!, watcherLng!], {
        radius: 10, fillColor: '#2563eb', color: '#fff', weight: 3, fillOpacity: 1,
      }).addTo(map).bindPopup('<b>You are here</b>');
    }
    init();
    return () => { cancelled = true; };
  }, [watcherLat, watcherLng]);

  // Update watcher dot when position changes
  useEffect(() => {
    if (!watcherRef.current || !watcherLat || !watcherLng) return;
    watcherRef.current.setLatLng([watcherLat, watcherLng]);
  }, [watcherLat, watcherLng]);

  // Update tracked persons markers
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    // Remove stale markers
    for (const id of Object.keys(markerRefs.current)) {
      if (!sessions.find(s => s.id === id)) {
        markerRefs.current[id].remove();
        delete markerRefs.current[id];
      }
    }

    // Add / update markers
    for (const s of sessions) {
      if (markerRefs.current[s.id]) {
        markerRefs.current[s.id].setLatLng([s.lat, s.lng]);
        markerRefs.current[s.id].setPopupContent(`<b>📍 ${s.name}</b><br>Updated ${Math.round((Date.now() - s.updatedAt) / 1000)}s ago`);
      } else {
        const icon = L.divIcon({
          html: `<div style="background:#f59e0b;width:28px;height:28px;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 0 8px rgba(245,158,11,0.8)">📍</div>`,
          className: '', iconSize: [28, 28], iconAnchor: [14, 14],
        });
        markerRefs.current[s.id] = L.marker([s.lat, s.lng], { icon })
          .addTo(map)
          .bindPopup(`<b>📍 ${s.name}</b><br>Updated ${Math.round((Date.now() - s.updatedAt) / 1000)}s ago`);
      }
    }
  }, [sessions]);

  if (!watcherLat || !watcherLng) return null;

  return (
    <div id="tracking-map"
      style={{ width:'100%', height:'300px', borderRadius:16, border:'1px solid rgba(34,211,238,0.2)', overflow:'hidden' }}
    />
  );
}

function TrackingTab({ contacts, darkMode }: { contacts: Contact[]; darkMode: boolean }) {
  const [sessions,    setSessions]    = useState<TrackedPerson[]>([]);
  const [trackingOn,  setTrackingOn]  = useState(false);
  const [shareLink,   setShareLink]   = useState('');
  const [copied,      setCopied]      = useState(false);
  const [sessionId,   setSessionId]   = useState('');

  // Watcher's own location
  const [watcherLat,  setWatcherLat]  = useState<number | null>(null);
  const [watcherLng,  setWatcherLng]  = useState<number | null>(null);
  const [locStatus,   setLocStatus]   = useState<'idle' | 'active' | 'denied'>('idle');

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef   = useRef<number | null>(null);

  // ── Start watching own location ─────────────────────────────────────────
  function startMyLocation() {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setWatcherLat(pos.coords.latitude);
        setWatcherLng(pos.coords.longitude);
        setLocStatus('active');
      },
      err => { if (err.code === err.PERMISSION_DENIED) setLocStatus('denied'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function stopMyLocation() {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setLocStatus('idle');
    setWatcherLat(null);
    setWatcherLng(null);
  }

  function generateLink() {
    const id  = crypto.randomUUID().slice(0, 8);
    const url = `${window.location.origin}/track/${id}`;
    setSessionId(id);
    setShareLink(url);
    setTrackingOn(true);
  }

  function stopAll() {
    if (pollRef.current) clearInterval(pollRef.current);
    setSessions([]);
    setTrackingOn(false);
    setShareLink('');
    setSessionId('');
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { }
  }

  function smsLink() {
    window.open(`sms:?body=${encodeURIComponent('SafeCircle is requesting a location check-in for your visit. Tap to share your location (session only — stops when you close the page): ' + shareLink)}`);
  }

  // Google directions from watcher to a tracked person
  function directionsTo(s: TrackedPerson) {
    const origin = watcherLat && watcherLng ? `${watcherLat},${watcherLng}` : '';
    const dest   = `${s.lat},${s.lng}`;
    const url    = origin
      ? `https://www.google.com/maps/dir/${origin}/${dest}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    window.open(url, '_blank');
  }

  // Poll for active trackers
  useEffect(() => {
    if (!trackingOn) return;
    async function poll() {
      try {
        const res = await fetch('/api/track?all=1');
        const data: TrackedPerson[] = await res.json();
        setSessions(data.filter(d => Date.now() - d.updatedAt < 120000));
      } catch { }
    }
    poll();
    pollRef.current = setInterval(poll, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [trackingOn]);

  useEffect(() => () => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  return (
    <div className="space-y-4">

      {/* ── My location toggle ── */}
      <div style={{
            borderRadius: 20,
            border: darkMode ? '1px solid rgba(34,211,238,0.25)' : '1px solid #bfdbfe',
            background: darkMode
              ? 'linear-gradient(135deg, #0f1f3d, #0a1628)'
              : 'white',
            padding: '14px 16px',
            boxShadow: darkMode ? '0 0 30px rgba(34,211,238,0.05)' : '0 2px 12px rgba(37,99,235,0.08)',
          }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">🔵 My Location</p>
            <p className="text-xs text-slate-500">Show your position on the map below</p>
          </div>
          {locStatus === 'active'
            ? <button onClick={stopMyLocation} className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-white transition-colors">Stop</button>
            : <button onClick={startMyLocation} className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-medium transition-colors">Enable</button>
          }
        </div>
        {locStatus === 'active' && watcherLat && (
          <p className="text-xs text-blue-400">📍 Tracking your position · {watcherLat.toFixed(5)}, {watcherLng?.toFixed(5)}</p>
        )}
        {locStatus === 'denied' && (
          <p className="text-xs text-rose-400">Location access denied — enable it in browser settings.</p>
        )}
      </div>

      {/* ── Live tracking map ── */}
      {locStatus === 'active' && (
        <TrackingMap watcherLat={watcherLat} watcherLng={watcherLng} sessions={sessions} />
      )}

      {/* ── Share link panel ── */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">📍 Track a Field Worker</p>
            <p className="text-xs text-slate-500 mt-0.5">Session only · never stored · opt-in always</p>
          </div>
          <div className={`w-3 h-3 rounded-full ${trackingOn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
        </div>

        {!trackingOn ? (
          <button onClick={generateLink}
            className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors">
            📍 Generate Check-In Link
          </button>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2">
              <p className="text-xs text-slate-400 mb-1">Share this link — they tap it, location sharing is their choice:</p>
              <p className="text-xs text-emerald-400 font-mono break-all">{shareLink}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copyLink}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${copied ? 'bg-emerald-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
              <button onClick={smsLink}
                className="flex-1 py-2 rounded-lg bg-blue-800 hover:bg-blue-700 text-xs font-medium text-white transition-colors">
                Send via SMS
              </button>
              <button onClick={stopAll}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-xs text-rose-400 transition-colors">
                Stop
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Active check-ins ── */}
      {trackingOn && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Active Check-Ins</p>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-600">No one is sharing yet — waiting for them to open the link.</p>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">📍 {s.name}</p>
                  <p className="text-xs text-slate-500">Updated {Math.round((Date.now() - s.updatedAt) / 1000)}s ago</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <button onClick={() => directionsTo(s)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white font-medium transition-colors whitespace-nowrap">
                    🗺 Directions
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ borderRadius:20, border:'1px solid rgba(34,211,238,0.1)', background:'rgba(15,31,61,0.5)', padding:'12px 16px' }}>
        <p className="font-medium text-slate-400">How it works</p>
        <p>1. Enable My Location — your blue dot appears on the map</p>
        <p>2. Tap Generate — a unique link is created for your worker</p>
        <p>3. Send via SMS — they tap it and choose whether to share</p>
        <p>4. Their orange dot appears on the map in real time</p>
        <p>5. Tap Directions to get Google turn-by-turn to their location</p>
        <p>6. Everything stops the moment they close their page</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — SAFETY ALERTS
// ═══════════════════════════════════════════════════════════════════════════════

const TIMER_PRESETS = [5, 10, 15, 20, 30, 45, 60];

type AlertPhase =
  | 'idle'          // haven't started yet
  | 'running'       // timer counting down
  | 'departure'     // arrived check done, now timing departure walk
  | 'help'          // 🚨 HELP triggered
  | 'done';         // all clear

function AlertsTab({ contacts, address, darkMode }: { contacts: Contact[]; address: string; darkMode: boolean }) {
  const [phase,         setPhase]         = useState<AlertPhase>('idle');
  const [photo,         setPhoto]         = useState<string | null>(null);
  const [photoLabel,    setPhotoLabel]    = useState('');
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [intervalMin,   setIntervalMin]   = useState(30);
  const [customMin,     setCustomMin]     = useState('');
  const [secondsLeft,   setSecondsLeft]   = useState(0);
  const [helpTaps,      setHelpTaps]      = useState(0);
  const [cancelTaps,    setCancelTaps]    = useState(0);
  const [alarmActive,   setAlarmActive]   = useState(false);
  const [gpsCoords,     setGpsCoords]     = useState<{lat: number; lng: number} | null>(null);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef  = useRef<AudioContext | null>(null);
  const alarmRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveMin = customMin ? parseInt(customMin) || intervalMin : intervalMin;

  // ── Get GPS on mount for SOS coords ────────────────────────────────────────
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { },
        { enableHighAccuracy: true },
      );
    }
  }, []);

  // ── Alarm sound — Web Audio API, no file needed ────────────────────────────
  function startAlarm() {
    setAlarmActive(true);
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ctx;
      function blip() {
        if (!audioRef.current) return;
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        // Alternating high/low siren tones
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(1.0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.65);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.65);
      }
      blip();
      alarmRef.current = setInterval(blip, 700);
    } catch { }
  }

  function stopAlarm() {
    setAlarmActive(false);
    if (alarmRef.current) clearInterval(alarmRef.current);
    if (audioRef.current) { audioRef.current.close(); audioRef.current = null; }
  }

  // ── Timer tick ─────────────────────────────────────────────────────────────
  function startTimer(minutes: number, nextPhase: AlertPhase) {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(minutes * 60);
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          triggerHelp(); // dead man's switch
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    setPhase(nextPhase);
  }

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  // ── SOS blast ─────────────────────────────────────────────────────────────
  function sosBlast() {
    const locStr = gpsCoords
      ? `GPS: https://maps.google.com/?q=${gpsCoords.lat},${gpsCoords.lng}`
      : 'GPS unavailable';
    const addrStr = address ? `Address: ${address}, Memphis TN` : '';
    const body = `🚨 SAFECIRCLE EMERGENCY ALERT 🚨\n\nI NEED IMMEDIATE HELP.\n\n${addrStr}\n${locStr}\n\nPlease call me or send help NOW.`;
    for (const c of contacts) {
      if (c.email) window.open(`mailto:${c.email}?subject=${encodeURIComponent('🚨 SAFECIRCLE — EMERGENCY HELP NEEDED NOW')}&body=${encodeURIComponent(body)}`, '_blank');
    }
  }

  // ── Trigger help ───────────────────────────────────────────────────────────
  function triggerHelp() {
    clearTimer();
    setPhase('help');
    setHelpTaps(0);
    setCancelTaps(0);
    startAlarm();
    sosBlast();
  }

  // ── Arrival ────────────────────────────────────────────────────────────────
  function handleArrival() {
    startTimer(effectiveMin, 'running');
  }

  // ── I'm OK ─────────────────────────────────────────────────────────────────
  function handleOk() {
    clearTimer();
    stopAlarm();
    // Start 10-min departure timer
    startTimer(10, 'departure');
  }

  // ── Departure OK ──────────────────────────────────────────────────────────
  function handleDepartureOk() {
    clearTimer();
    stopAlarm();
    setPhase('done');
  }

  // ── Camera capture ────────────────────────────────────────────────────────
  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  function openCamera(label: string) {
    setPhotoLabel(label);
    cameraRef.current?.click();
  }

  // ── Cancel alarm (3 taps) ─────────────────────────────────────────────────
  function handleCancelTap() {
    const next = cancelTaps + 1;
    setCancelTaps(next);
    if (next >= 3) {
      stopAlarm();
      setPhase('done');
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function handleReset() {
    clearTimer();
    stopAlarm();
    setPhase('idle');
    setSecondsLeft(0);
    setHelpTaps(0);
    setCancelTaps(0);
  }

  useEffect(() => () => { clearTimer(); stopAlarm(); }, []);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const pct = phase === 'running' ? (secondsLeft / (effectiveMin * 60)) * 100
            : phase === 'departure' ? (secondsLeft / 600) * 100 : 100;

  // ── HELP SCREEN ────────────────────────────────────────────────────────────
  if (phase === 'help') {
    return (
      <div className="fixed inset-0 z-50 bg-red-900 flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-center space-y-2">
          <p className="text-6xl animate-bounce">🚨</p>
          <p className="text-3xl font-black text-white tracking-wide">ALERT SENT</p>
          <p className="text-sm text-red-200">Your circle has been notified</p>
        </div>

        {/* Call 911 — biggest button */}
        <a href="tel:911"
          className="w-full max-w-xs py-5 rounded-2xl bg-white text-red-700 text-2xl font-black text-center shadow-2xl active:scale-95 transition-transform">
          📞 CALL 911
        </a>

        {/* Cancel — requires 3 deliberate taps */}
        <div className="text-center space-y-2 w-full max-w-xs">
          <p className="text-xs text-red-300">
            {cancelTaps === 0 ? 'Tap 3 times to cancel if you are safe' : `Tap ${3 - cancelTaps} more time${3 - cancelTaps !== 1 ? 's' : ''} to cancel`}
          </p>
          <button onClick={handleCancelTap}
            className="w-full py-3 rounded-xl border-2 border-red-400 text-red-200 font-semibold text-sm transition-colors active:bg-red-800">
            I AM SAFE — TAP TO CANCEL ({cancelTaps}/3)
          </button>
        </div>
      </div>
    );
  }

  // ── DONE SCREEN ────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="space-y-4 text-center py-8">
        <p className="text-5xl">✅</p>
        <p className="text-xl font-semibold text-emerald-400">Visit Complete</p>
        <p className="text-sm text-slate-400">You're safe. Check-in closed.</p>
        <button onClick={handleReset}
          className="px-6 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors">
          Start New Check-In
        </button>
      </div>
    );
  }

  // ── IDLE / SETUP ───────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-200">🛡 Safety Check-In</p>
            {address && <p className="text-xs text-slate-500 mt-0.5">📍 {address}, Memphis TN</p>}
          </div>

          {/* Timer selection */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">Set your check-in interval</p>
            <div className="flex flex-wrap gap-2">
              {TIMER_PRESETS.map(m => (
                <button key={m} onClick={() => { setIntervalMin(m); setCustomMin(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${effectiveMin === m && !customMin ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                  {m} min
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="480" placeholder="Custom min"
                value={customMin} onChange={e => setCustomMin(e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              <span className="text-xs text-slate-500">minutes</span>
            </div>
            <p className="text-xs text-slate-600">
              ⚠ If you don't check in within {effectiveMin} min, an alert fires automatically.
            </p>
          </div>

          {contacts.length === 0 && (
            <p className="text-xs text-amber-500 bg-amber-900/20 rounded-lg px-3 py-2">
              ⚠ No circle contacts yet — add them on the SafeCircle tab so alerts can be sent.
            </p>
          )}

          {/* Hidden camera input */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment"
            onChange={handlePhotoCapture} className="hidden" />

          {/* Arrival photo */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">📷 Arrival photo (optional)</p>
            <button onClick={() => openCamera('Arrival')}
              className="w-full py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 text-sm transition-colors">
              📷 Take Arrival Photo
            </button>
            {photo && photoLabel === 'Arrival' && (
              <div className="relative">
                <img src={photo} alt="Arrival" className="w-full rounded-xl border border-slate-700 max-h-48 object-cover" />
                <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 text-xs">✕</button>
                <p className="text-xs text-emerald-400 mt-1">✓ Arrival photo captured</p>
              </div>
            )}
          </div>

          <button onClick={handleArrival}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold transition-colors">
            ▶ I've Arrived — Start Check-In
          </button>
        </div>

        <div style={{ borderRadius:20, border:'1px solid rgba(34,211,238,0.1)', background:'rgba(15,31,61,0.5)', padding:'12px 16px' }}>
          <p className="font-medium text-slate-400">How it works</p>
          <p>1. Set your interval and tap Arrived</p>
          <p>2. Timer counts down — if it hits zero, alert fires automatically</p>
          <p>3. Tap ✅ I'm OK before it expires to stop the timer</p>
          <p>4. A 10-min departure timer starts — tap safe when you're back at your car</p>
          <p>5. 🚨 I Need Help sends an immediate blast to your circle + calls 911</p>
        </div>
      </div>
    );
  }

  // ── RUNNING / DEPARTURE ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Timer display */}
      <div className={`rounded-2xl border px-4 py-5 text-center space-y-3 ${phase === 'departure' ? 'border-blue-700 bg-blue-950/40' : 'border-slate-700 bg-slate-900'}`}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {phase === 'departure' ? '🚶 Departure timer — get to your car' : '⏱ Visit check-in timer'}
        </p>
        {address && <p className="text-xs text-slate-500">📍 {address}</p>}

        {/* Progress ring (simple bar) */}
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${pct > 40 ? 'bg-emerald-500' : pct > 15 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className={`text-5xl font-mono font-bold ${pct > 40 ? 'text-emerald-400' : pct > 15 ? 'text-amber-400' : 'text-red-400 animate-pulse'}`}>
          {timerStr}
        </p>
        <p className="text-xs text-slate-500">remaining — alert fires automatically at 0:00</p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* I'm OK — tall, green */}
        <button
          onClick={phase === 'departure' ? handleDepartureOk : handleOk}
          className="py-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition-colors active:scale-95 flex flex-col items-center gap-2 shadow-lg">
          <span className="text-4xl">✅</span>
          <span>{phase === 'departure' ? "I'm Safe" : "I'm OK"}</span>
          <span className="text-xs font-normal opacity-80">{phase === 'departure' ? 'Made it to car' : 'Check in'}</span>
        </button>

        {/* I Need Help — wider, red, distinct shape */}
        <button
          onClick={triggerHelp}
          className="py-8 rounded-2xl bg-red-700 hover:bg-red-600 text-white font-bold text-lg transition-colors active:scale-95 flex flex-col items-center gap-2 shadow-lg border-4 border-red-400">
          <span className="text-4xl">🚨</span>
          <span>I Need Help</span>
          <span className="text-xs font-normal opacity-80">Alert + 911</span>
        </button>
      </div>

      {/* Departure photo button — shown during departure phase */}
      {phase === 'departure' && (
        <div className="space-y-2">
          <button onClick={() => openCamera('Departure')}
            className="w-full py-2.5 rounded-xl border border-blue-600 text-blue-300 hover:bg-blue-900/30 text-sm transition-colors">
            📷 Take Departure Photo
          </button>
          {photo && photoLabel === 'Departure' && (
            <div className="relative">
              <img src={photo} alt="Departure" className="w-full rounded-xl border border-slate-700 max-h-48 object-cover" />
              <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 text-xs">✕</button>
              <p className="text-xs text-blue-400 mt-1">✓ Departure photo captured</p>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Buttons are different sizes and shapes — readable under stress
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function SafeCirclePage() {
  const [activeTab, setActiveTab] = useState<'main' | 'tracking' | 'alerts'>('main');
  const [darkMode,  setDarkMode]  = useState(true);

  // Address
  const [address,  setAddress]  = useState('');
  const [addrSet,  setAddrSet]  = useState(false);
  const [geoLabel, setGeoLabel] = useState('');

  // Services
  const [services,   setServices]   = useState<EmergencyServices>({ police: null, fire: null, hospital: null });
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcError,   setSvcError]   = useState('');
  const lastGeoRef = useRef('');

  // Contacts / SOS
  const [contacts,  setContacts]  = useState<Contact[]>([]);
  const [newName,   setNewName]   = useState('');
  const [newPhone,  setNewPhone]  = useState('');
  const [newEmail,  setNewEmail]  = useState('');
  const [csvInput,  setCsvInput]  = useState('');
  const [sosActive, setSosActive] = useState(false);

  // Kaizen
  const [feedback,      setFeedback]      = useState('');
  const [feedbackRole,  setFeedbackRole]  = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackSent,  setFeedbackSent]  = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  // ── Services fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!addrSet || !address.trim()) return;
    const raw = address.trim();
    if (lastGeoRef.current === raw) return;
    lastGeoRef.current = raw;
    setSvcLoading(true); setSvcError('');
    setServices({ police: null, fire: null, hospital: null });
    geocodeAddress(raw).then(geo => {
      if (!geo) { setSvcLoading(false); setSvcError('Could not geocode address.'); return; }
      setGeoLabel(geo.label);
      return fetch(`/api/services?lat=${geo.lat}&lng=${geo.lng}`).then(r => r.json());
    }).then(svcs => { if (svcs) setServices(svcs); setSvcLoading(false); })
      .catch(err => { setSvcError(err.message); setSvcLoading(false); });
  }, [addrSet, address]);

  function handleSetAddress() {
    if (!address.trim()) return;
    lastGeoRef.current = '';
    setAddrSet(true);
  }

  function addContact() {
    if (!newName.trim()) return;
    setContacts(c => [...c, { id: crypto.randomUUID(), name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() }]);
    setNewName(''); setNewPhone(''); setNewEmail('');
  }

  function importCsv() {
    const imported: Contact[] = csvInput.trim().split('\n').filter(Boolean).map(line => {
      const [name, email, phone] = line.split(',').map(s => s.trim());
      return { id: crypto.randomUUID(), name: name || '', email: email || '', phone: phone || '' };
    }).filter(c => c.name);
    setContacts(c => [...c, ...imported]);
    setCsvInput('');
  }

  function triggerSos() {
    setSosActive(true);
    for (const c of contacts) {
      if (c.email) window.open(`mailto:${c.email}?subject=${encodeURIComponent('🚨 SAFE CIRCLE SOS — I need help NOW')}&body=${encodeURIComponent('This is an emergency alert from SafeCircle. I need immediate help at my current location. Please call or come immediately.')}`, '_blank');
    }
    setTimeout(() => setSosActive(false), 4000);
  }

  async function submitFeedback() {
    if (!feedback.trim()) return;
    setFeedbackSending(true);
    try {
      await fetch('/api/kaizen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim(), role: feedbackRole.trim(), contact: feedbackEmail.trim() }),
      });
      setFeedbackSent(true);
      setFeedback(''); setFeedbackRole(''); setFeedbackEmail('');
    } catch { }
    setFeedbackSending(false);
  }

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'main',     label: '🛡 SafeCircle' },
    { id: 'tracking', label: '📍 Tracking'   },
    { id: 'alerts',   label: '🚨 Alerts'     },
  ] as const;

  return (
    <div style={{
      minHeight: '100vh',
      background: darkMode
        ? 'linear-gradient(160deg, #050d1f 0%, #0a1628 50%, #050d1f 100%)'
        : 'linear-gradient(160deg, #e0f2fe 0%, #f0f9ff 50%, #e8f4fd 100%)',
      color: darkMode ? '#f1f5f9' : '#0f172a',
      maxWidth: 672, margin: '0 auto', display: 'flex', flexDirection: 'column',
    }}>

      {/* ── Tab bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: darkMode
          ? 'rgba(5,13,31,0.95)'
          : 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: darkMode ? '1px solid rgba(34,211,238,0.15)' : '1px solid #bfdbfe',
        padding: '12px 16px 0',
      }}>
        <div className="flex gap-1 items-center">
          <button onClick={() => setDarkMode(d => !d)}
            style={{
              padding: '8px 10px', borderRadius: 10, fontSize: 16,
              background: darkMode ? 'rgba(34,211,238,0.1)' : '#eff6ff',
              border: darkMode ? '1px solid rgba(34,211,238,0.3)' : '1px solid #bfdbfe',
              cursor: 'pointer', marginRight: 6,
            }}
            title="Toggle light/dark mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: '12px 12px 0 0',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                borderBottom: activeTab === t.id ? (darkMode ? '3px solid #22d3ee' : '3px solid #2563eb') : '3px solid transparent',
                background: activeTab === t.id
                  ? (darkMode ? 'rgba(34,211,238,0.1)' : '#eff6ff')
                  : 'transparent',
                color: activeTab === t.id
                  ? (darkMode ? '#22d3ee' : '#2563eb')
                  : (darkMode ? '#475569' : '#94a3b8'),
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ════════════════════════════ TAB 1 — MAIN ════════════════════════════ */}
        {activeTab === 'main' && (<>

          <div className="text-center pb-1">
            <h1 style={{
              fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px',
              background: 'linear-gradient(90deg, #22d3ee, #3b82f6, #a855f7)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>SafeCircle</h1>
            <p style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8', marginTop: 2 }}>
              Shelby County public safety · field worker edition
            </p>
          </div>

          {/* Address bar */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 space-y-2">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: darkMode ? '#22d3ee' : '#3b82f6', textTransform: 'uppercase' }}>Address</p>
            <p style={{ fontSize: 11, color: darkMode ? '#475569' : '#94a3b8' }}>Street number and name only — no Rd, St, Ave, or Cove. Type <span className="text-slate-300">Macon</span>, not Macon Road.</p>
            <div className="flex gap-2">
              <input type="text" placeholder="4128 Weymouth" value={address}
                onChange={e => { setAddress(e.target.value); setAddrSet(false); setGeoLabel(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSetAddress(); }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 14,
                  background: darkMode ? 'rgba(255,255,255,0.05)' : 'white',
                  border: darkMode ? '1px solid rgba(34,211,238,0.3)' : '1px solid #bfdbfe',
                  color: darkMode ? 'white' : '#0f172a',
                  outline: 'none',
                }} />
              <button onClick={handleSetAddress} disabled={!address.trim()}
                style={{
                padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                color: 'white', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(90deg, #22d3ee, #3b82f6)',
                boxShadow: '0 4px 15px rgba(34,211,238,0.35)',
              }}>
                Set address
              </button>
            </div>
            {addrSet && <p className="text-xs text-emerald-400 font-medium">✓ {geoLabel || (address.trim() + ', Memphis TN')}</p>}
          </div>

          {/* Crime map */}
          <Section title="🗺  Crime incidents — last 14 days, 0.5 mi radius" defaultOpen dark={darkMode}>
            <LeafletMapComponent lockedAddress={addrSet ? address : undefined} />
          </Section>

          {/* Warrants */}
          <Section title="⚖️  Warrant search" dark={darkMode}>
            <p className="text-xs text-slate-400 mb-3">Shelby County Sheriff's warrant database.</p>
            {address.trim() ? (
              <div className="space-y-2">
                <a href={warrantUrl(address)} target="_blank" rel="noopener noreferrer"
                  style={{ display:'inline-block', padding:'10px 18px', borderRadius:12, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(90deg,#f59e0b,#d97706)', boxShadow:'0 4px 15px rgba(245,158,11,0.35)', textDecoration:'none' }}>
                  Check warrants — {splitAddress(address).num} {splitAddress(address).name.split(/\s+/)[0]} →
                </a>
                <p className="text-xs text-slate-500">Search by name: <a href="https://warrants.shelby-sheriff.org/w_warrant_result.php" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Open warrant search</a></p>
              </div>
            ) : <p className="text-xs text-slate-500">Enter an address above first.</p>}
          </Section>

          {/* Sex offenders */}
          <Section title="🔍  Sex offender registry" dark={darkMode}>
            <p className="text-xs text-slate-400 mb-3">National Sex Offender Public Website (NSOPW) check.</p>
            {address.trim()
              ? <a href={offenderUrl(address)} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', padding:'10px 18px', borderRadius:12, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(90deg,#a855f7,#7c3aed)', boxShadow:'0 4px 15px rgba(168,85,247,0.35)', textDecoration:'none' }}>Check sex offenders near {address.trim()} →</a>
              : <p className="text-xs text-slate-500">Enter an address above first.</p>}
          </Section>

          {/* Jail roster */}
          <Section title="🏛  Shelby County jail roster" dark={darkMode}>
            <p className="text-xs text-slate-400 mb-3">Who is currently in custody.</p>
            <a href={JAIL_URL} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', padding:'10px 18px', borderRadius:12, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(90deg,#475569,#334155)', boxShadow:'0 4px 15px rgba(71,85,105,0.35)', textDecoration:'none' }}>Open jail roster →</a>
          </Section>

          {/* Emergency services */}
          <Section title="🚨  Nearest police · fire · hospital" dark={darkMode}>
            <p className="text-xs text-slate-400 mb-3">{addrSet ? 'Nearest services — tap Call or Directions.' : 'Set an address above first.'}</p>
            {svcError && <p className="text-xs text-rose-400 mb-2">{svcError}</p>}
            <div className="space-y-3">
              <ServiceCard emoji="🚓" label="Police"   svc={services.police}   loading={svcLoading} />
              <ServiceCard emoji="🚒" label="Fire"     svc={services.fire}     loading={svcLoading} />
              <ServiceCard emoji="🏥" label="Hospital" svc={services.hospital} loading={svcLoading} />
            </div>
          </Section>

          {/* Circle of friends + SOS */}
          <Section title="👥  Circle of friends &amp; SOS alert" dark={darkMode}>
            <button onClick={triggerSos} disabled={contacts.length === 0}
              className={`w-full py-3 rounded-xl text-base font-semibold mb-4 transition-all ${sosActive ? 'bg-red-500 text-white animate-pulse' : contacts.length === 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' : 'bg-red-700 hover:bg-red-600 text-white'}`}>
              {sosActive ? '🚨 SOS SENT' : '🚨 SOS — Alert my circle NOW'}
            </button>
            {contacts.length === 0 && <p className="text-xs text-slate-500 mb-3 -mt-2">Add contacts below to enable SOS.</p>}
            {contacts.length > 0 && <div className="mb-4">{contacts.map(c => <ContactRow key={c.id} contact={c} onRemove={id => setContacts(c => c.filter(x => x.id !== id))} />)}</div>}
            <div className="space-y-2 mb-4">
              <p className="text-xs text-slate-400 font-medium">Add a contact</p>
              <input type="text" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)} style={{ width:'100%', padding:'10px 14px', borderRadius:12, fontSize:13, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'white', outline:'none', boxSizing:'border-box' }} />
              <div className="flex gap-2">
                <input type="tel" placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                <input type="email" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <button onClick={addContact} style={{ padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(90deg,#22d3ee,#3b82f6)', border:'none', cursor:'pointer' }}>Add contact</button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Import from CSV</p>
              <p className="text-xs text-slate-500">One per line: Full Name, Email, Phone</p>
              <textarea rows={3} placeholder={'Jane Smith, jane@example.com, 901-555-1234'} value={csvInput} onChange={e => setCsvInput(e.target.value)} style={{ width:'100%', padding:'10px 14px', borderRadius:12, fontSize:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'white', outline:'none', fontFamily:'monospace', boxSizing:'border-box' }} />
              <button onClick={importCsv} style={{ padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:700, color:'white', background:'linear-gradient(90deg,#3b82f6,#6366f1)', border:'none', cursor:'pointer' }}>Import contacts</button>
            </div>
          </Section>

          {/* ── Kaizen feedback ── */}
          <Section title="💡 Make SafeCircle Better" dark={darkMode}>
            {feedbackSent ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-2xl">🙏</p>
                <p className="text-sm font-medium text-emerald-400">Thank you — your feedback was sent!</p>
                <p className="text-xs text-slate-500">We read every suggestion.</p>
                <button onClick={() => setFeedbackSent(false)} className="text-xs text-blue-400 underline mt-2">Send another</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p style={{ fontSize:11, color:'#64748b' }}>What would make SafeCircle more useful for you? Tell us anything — features, problems, ideas.</p>
                <textarea rows={4} placeholder="e.g. I wish it could show me if there were recent calls for service at the address before I even get there..."
                  value={feedback} onChange={e => setFeedback(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 13,
                    background: darkMode ? 'rgba(255,255,255,0.05)' : 'white',
                    border: darkMode ? '1px solid rgba(34,211,238,0.3)' : '1px solid #bfdbfe',
                    color: darkMode ? 'white' : '#0f172a',
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }} />
                <div className="flex gap-2">
                  <input type="text" placeholder="Your role (e.g. Home health nurse)" value={feedbackRole} onChange={e => setFeedbackRole(e.target.value)}
                    style={{ flex:1, padding:'10px 14px', borderRadius:12, fontSize:13,
                      background: darkMode ? 'rgba(255,255,255,0.05)':'white',
                      border: darkMode ? '1px solid rgba(34,211,238,0.3)':'1px solid #bfdbfe',
                      color: darkMode ? 'white':'#0f172a', outline:'none' }} />
                  <input type="email" placeholder="Email (optional)" value={feedbackEmail} onChange={e => setFeedbackEmail(e.target.value)}
                    style={{ flex:1, padding:'10px 14px', borderRadius:12, fontSize:13,
                      background: darkMode ? 'rgba(255,255,255,0.05)':'white',
                      border: darkMode ? '1px solid rgba(34,211,238,0.3)':'1px solid #bfdbfe',
                      color: darkMode ? 'white':'#0f172a', outline:'none' }} />
                </div>
                <button onClick={submitFeedback} disabled={!feedback.trim() || feedbackSending}
                  style={{ padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:700,
                    color:'white', border:'none', cursor:'pointer',
                    background:'linear-gradient(90deg, #22d3ee, #3b82f6)',
                    boxShadow:'0 4px 15px rgba(34,211,238,0.3)', opacity: (!feedback.trim() || feedbackSending) ? 0.4 : 1 }}>
                  {feedbackSending ? 'Sending…' : 'Send Feedback'}
                </button>
              </div>
            )}
          </Section>

          {/* Footer */}
          <div className="text-center py-4">
            <a href={USC_URL} target="_blank" rel="noopener noreferrer"
  style={{ fontSize:11, color: darkMode ? '#334155':'#94a3b8', textDecoration:'none' }}>
              Powered by U.S. Crime Centers
            </a>
          </div>

        </>)}

        {/* ══════════════════════════ TAB 2 — TRACKING ══════════════════════════ */}
        {activeTab === 'tracking' && (
          <TrackingTab contacts={contacts} darkMode={darkMode} />
        )}

        {/* ═══════════════════════════ TAB 3 — ALERTS ══════════════════════════ */}
        {activeTab === 'alerts' && (
          <AlertsTab contacts={contacts} address={address} darkMode={darkMode} />
        )}

      </main>
    </div>
  );
}
