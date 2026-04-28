'use client';
import WhereItWorksComponent, { UniversalLocation } from './WhereItWorks-component';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const JAIL_URL    = 'https://imljail.shelbycountytn.gov/IML';
const GEOCODE_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const USC_URL     = 'https://uscrimecenters.com';

// ─── Address helpers ──────────────────────────────────────────────────────────

function splitAddress(raw: string) {
  const parts = raw.trim().split(/\s+/);
  return { num: parts[0] || '', name: parts.slice(1).join(' ') };
}
function warrantUrl(raw: string, city: CityConfig) {
  if (city.id === 'memphis') {
    const { num, name } = splitAddress(raw);
    const st = name.split(/\s+/)[0];
    return `https://warrants.shelby-sheriff.org/w_warrant_result.php?w=&l=&f=&s=${encodeURIComponent(num)}&st=${encodeURIComponent(st)}`;
  }
  return city.warrantUrl;
}
function offenderUrl(raw: string) {
  return `https://www.nsopw.gov/en/Search/Results?street=${encodeURIComponent(raw.trim())}`;
}
function directionsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
async function geocodeAddress(raw: string, suffix: string) {
  try {
    const url = `${GEOCODE_URL}?SingleLine=${encodeURIComponent(raw + ', ' + suffix)}&maxLocations=1&outFields=*&f=pjson`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.candidates?.length) return null;
    return { lat: j.candidates[0].location.y, lng: j.candidates[0].location.x, label: j.candidates[0].address };
  } catch { return null; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NearbyService { name: string; address: string; phone: string; lat: number; lng: number; distanceMi: number; directionsUrl?: string; }
interface EmergencyServices { police: NearbyService | null; fire: NearbyService | null; hospital: NearbyService | null; }
interface Contact { id: string; name: string; phone: string; email: string; }
interface TrackedPerson { id: string; name: string; lat: number; lng: number; updatedAt: number; }

// ─── Section accordion ────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false, dark = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      borderRadius:20,
      border: open ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(168,85,247,0.3)',
      background: dark ? 'linear-gradient(135deg,#0f1f3d,#0a1628)' : 'white',
      overflow:'visible',
      boxShadow: open ? '0 4px 24px rgba(34,211,238,0.12)' : '0 4px 24px rgba(0,0,0,0.35)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'16px 16px', background: open ? 'rgba(34,211,238,0.06)' : 'transparent',
          border:'none', cursor:'pointer', textAlign:'left',
          minHeight:56,
          touchAction:'manipulation',
          WebkitTapHighlightColor:'transparent',
          borderRadius: open ? '20px 20px 0 0' : 20,
        }}
      >
        <span style={{ fontSize:14, fontWeight:700, color: dark ? '#f1f5f9' : '#1e3a5f', flex:1, paddingRight:12 }}>{title}</span>
        <span style={{
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          width:40, height:40, borderRadius:'50%',
          background: open
            ? 'linear-gradient(135deg,#22d3ee,#3b82f6)'
            : 'linear-gradient(135deg,#a855f7,#7c3aed)',
          color:'white', fontSize:24, fontWeight:900, lineHeight:1,
          boxShadow: open ? '0 0 12px rgba(34,211,238,0.5)' : '0 0 12px rgba(168,85,247,0.5)',
          flexShrink:0,
          userSelect:'none',
        }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{
        padding:'8px 16px 16px',
        borderTop: '1px solid rgba(34,211,238,0.15)',
      }}>{children}</div>}
    </div>
  );
}


// ─── Contact row ──────────────────────────────────────────────────────────────

function ContactRow({ contact, onRemove }: { contact: Contact; onRemove: (id: string) => void }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
      <div>
        <p className="text-sm font-medium text-slate-200">{contact.name}</p>
        <p style={{ fontSize:11, color:"#64748b" }}>{contact.phone}{contact.phone && contact.email ? ' · ' : ''}{contact.email}</p>
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

function ServiceCard({ emoji, label, svc, loading }: { emoji: string; label: string; svc: NearbyService | null; loading: boolean }) {
  if (loading) return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
      <p className="text-xs text-slate-400 animate-pulse">{emoji} Locating nearest {label}…</p>
    </div>
  );
  if (!svc) return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
      <p className="text-sm font-medium text-slate-400">{emoji} {label}</p>
      <p className="text-xs text-slate-600 mt-1">Set an address above to find the nearest {label.toLowerCase()}.</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{emoji} {svc.name}</p>
          <p className="text-xs text-slate-500 truncate">{svc.address}</p>
          {svc.distanceMi > 0 && <p style={{ fontSize:11, color:"#475569" }}>{svc.distanceMi.toFixed(1)} mi away</p>}
          {svc.phone ? <a href={`tel:${svc.phone}`} style={{ fontSize:11, color:"#60a5fa", textDecoration:"underline" }}>{svc.phone}</a>
            : <p className="text-xs text-slate-600">Phone not available</p>}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {svc.phone && <a href={`tel:${svc.phone}`} className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-center">Call</a>}
          <a href={svc.directionsUrl || directionsUrl(svc.address)} target="_blank" rel="noopener noreferrer"
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

      // OSM light tiles — bright, clean, no referer issues on Railway
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
      className="w-full rounded-xl border border-slate-700 overflow-hidden"
      style={{ height: '300px' }}
    />
  );
}

function TrackingTab({ contacts }: { contacts: Contact[] }) {
  const [sessions,    setSessions]    = useState<TrackedPerson[]>([]);
  const [trackingOn,  setTrackingOn]  = useState(false);
  const [shareLink,   setShareLink]   = useState('');
  const [copied,      setCopied]      = useState(false);
  const [sessionId,   setSessionId]   = useState('');

  // Watcher's own location
  const [watcherLat,  setWatcherLat]  = useState<number | null>(null);
  const [watcherLng,  setWatcherLng]  = useState<number | null>(null);
  const [locStatus,   setLocStatus]   = useState<'idle' | 'active' | 'denied'>('idle');

  const [smsPhone,    setSmsPhone]    = useState('');
  const [showSmsInput,setShowSmsInput] = useState(false);

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
    const body = encodeURIComponent('SafeCircle is requesting a location check-in for your visit. Tap to share your location (session only — stops when you close the page): ' + shareLink);
    const num = smsPhone.replace(/\D/g, '');
    window.open(`sms:${num}?body=${body}`);
    setShowSmsInput(false);
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
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* ── My location toggle ── */}
      <div style={{ borderRadius:20, border:'1px solid rgba(34,211,238,0.18)', background:'linear-gradient(135deg,#0f1f3d,#0a1628)', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.35)' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(34,211,238,0.10)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', margin:0 }}>🔵 My Location</p>
            <p style={{ fontSize:11, color:'#475569', margin:0 }}>Show your position on the live map</p>
          </div>
          {locStatus === 'active'
            ? <button onClick={stopMyLocation} style={{ fontSize:11, padding:'6px 14px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'#94a3b8', cursor:'pointer' }}>Stop</button>
            : <button onClick={startMyLocation} style={{ fontSize:11, padding:'6px 14px', borderRadius:10, background:'linear-gradient(90deg,#22d3ee,#2563eb)', border:'none', color:'#0a1628', fontWeight:700, cursor:'pointer' }}>Enable</button>
          }
        </div>
        <div style={{ padding:'10px 16px' }}>
          {locStatus === 'active' && watcherLat && (
            <p style={{ fontSize:11, color:'#22d3ee', margin:0 }}>📍 Tracking your position · {watcherLat.toFixed(5)}, {watcherLng?.toFixed(5)}</p>
          )}
          {locStatus === 'denied' && (
            <p style={{ fontSize:11, color:'#f87171', margin:0 }}>Location access denied — enable it in browser settings.</p>
          )}
          {locStatus === 'idle' && (
            <p style={{ fontSize:11, color:'#475569', margin:0 }}>Tap Enable to show your position on the map.</p>
          )}
        </div>
      </div>

      {/* ── Live tracking map ── */}
      {locStatus === 'active' && (
        <TrackingMap watcherLat={watcherLat} watcherLng={watcherLng} sessions={sessions} />
      )}

      {/* ── Share link panel ── */}
      <div style={{ borderRadius:20, border:'1px solid rgba(34,211,238,0.18)', background:'linear-gradient(135deg,#0f1f3d,#0a1628)', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.35)' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(34,211,238,0.10)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', margin:0 }}>📍 Track a Field Worker</p>
            <p style={{ fontSize:11, color:'#475569', margin:0 }}>Session only · never stored · opt-in always</p>
          </div>
          <div style={{ width:10, height:10, borderRadius:'50%', background: trackingOn ? '#10b981' : '#334155', boxShadow: trackingOn ? '0 0 8px #10b981' : 'none' }} />
        </div>
        <div style={{ padding:'12px 16px' }}>
        {!trackingOn ? (
          <button onClick={generateLink}
            style={{ width:'100%', padding:13, borderRadius:14, background:'linear-gradient(90deg,#10b981,#059669)', border:'none', color:'white', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            📍 Generate Check-In Link
          </button>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:'rgba(34,211,238,0.06)', border:'1px solid rgba(34,211,238,0.2)', borderRadius:10, padding:'10px 12px' }}>
              <p style={{ fontSize:10, color:'#64748b', margin:'0 0 4px' }}>Share this link — they tap it, location sharing is their choice:</p>
              <p style={{ fontSize:11, color:'#22d3ee', fontFamily:'monospace', wordBreak:'break-all', margin:0 }}>{shareLink}</p>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={copyLink}
                style={{ flex:1, padding:'9px', borderRadius:10, fontWeight:700, fontSize:11, cursor:'pointer', background: copied ? 'linear-gradient(90deg,#10b981,#059669)' : 'rgba(255,255,255,0.05)', color: copied ? 'white' : '#94a3b8', border: copied ? 'none' : '1px solid rgba(34,211,238,0.2)' }}>
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>
              <button onClick={() => setShowSmsInput(s => !s)}
                style={{ flex:1, padding:'9px', borderRadius:10, background: showSmsInput ? 'linear-gradient(90deg,#a855f7,#7c3aed)' : 'linear-gradient(90deg,#2563eb,#1d4ed8)', border:'none', color:'white', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                📱 Send SMS
              </button>
              <button onClick={stopAll}
                style={{ padding:'9px 12px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:11, cursor:'pointer' }}>
                Stop
              </button>
            </div>

            {/* Phone number input — slides in when Send SMS tapped */}
            {showSmsInput && (
              <div style={{ background:'rgba(168,85,247,0.08)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                <p style={{ fontSize:11, color:'#c4b5fd', fontWeight:600, margin:0 }}>📱 Enter the worker's phone number</p>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    type="tel"
                    placeholder="901-555-1234"
                    value={smsPhone}
                    onChange={e => setSmsPhone(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && smsPhone.trim()) smsLink(); }}
                    style={{ flex:1, padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(168,85,247,0.4)', color:'white', fontSize:13, outline:'none' }}
                    autoFocus
                  />
                  <button onClick={smsLink} disabled={!smsPhone.trim()}
                    style={{ padding:'10px 16px', borderRadius:10, background: smsPhone.trim() ? 'linear-gradient(90deg,#a855f7,#7c3aed)' : 'rgba(255,255,255,0.05)', border:'none', color: smsPhone.trim() ? 'white' : '#475569', fontWeight:700, fontSize:12, cursor: smsPhone.trim() ? 'pointer' : 'not-allowed', whiteSpace:'nowrap' }}>
                    Send ➤
                  </button>
                </div>
                <p style={{ fontSize:10, color:'#64748b', margin:0 }}>Opens your SMS app with the check-in link pre-filled.</p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ── Active check-ins ── */}
      {trackingOn && (
        <div style={{ borderRadius:20, border:'1px solid rgba(34,211,238,0.18)', background:'linear-gradient(135deg,#0f1f3d,#0a1628)', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.35)' }}>
          <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(34,211,238,0.10)' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#22d3ee', letterSpacing:1, textTransform:'uppercase', margin:0 }}>Active Check-Ins</p>
          </div>
          <div style={{ padding:'8px 16px' }}>
          {sessions.length === 0 ? (
            <p style={{ fontSize:12, color:'#475569', margin:'8px 0' }}>No one is sharing yet — waiting for them to open the link.</p>
          ) : (
            sessions.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(34,211,238,0.08)' }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:'#f1f5f9', margin:0 }}>📍 {s.name}</p>
                  <p style={{ fontSize:11, color:'#475569', margin:0 }}>Updated {Math.round((Date.now() - s.updatedAt) / 1000)}s ago</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', display:'inline-block', boxShadow:'0 0 6px #10b981' }} />
                  <button onClick={() => directionsTo(s)}
                    style={{ fontSize:11, padding:'6px 12px', borderRadius:10, background:'linear-gradient(90deg,#2563eb,#1d4ed8)', border:'none', color:'white', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    🗺 Directions
                  </button>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      )}

      <div style={{ background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.12)', borderRadius:16, padding:'12px 16px' }}>
        <p style={{ fontSize:11, fontWeight:700, color:'#22d3ee', letterSpacing:1, textTransform:'uppercase', margin:'0 0 8px' }}>How it works</p>
        {[
          '1. Enable My Location — your blue dot appears on the map',
          '2. Tap Generate — a unique link is created for your worker',
          '3. Send via SMS — they tap it and choose whether to share',
          '4. Their orange dot appears on the map in real time',
          '5. Tap Directions to get Google turn-by-turn to their location',
          '6. Everything stops the moment they close their page',
        ].map(step => (
          <p key={step} style={{ fontSize:11, color:'#64748b', margin:'3px 0' }}>{step}</p>
        ))}
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

function AlertsTab({ contacts, address }: { contacts: Contact[]; address: string }) {
  const [phase,         setPhase]         = useState<AlertPhase>('idle');
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
    const addrStr = address ? `Address: ${address}` : '';
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
      <div style={{ textAlign:'center', padding:'32px 0' }}>
        <p style={{ fontSize:48, margin:'0 0 12px' }}>✅</p>
        <p style={{ fontSize:20, fontWeight:700, color:'#10b981', margin:'0 0 6px' }}>Visit Complete</p>
        <p style={{ fontSize:13, color:'#475569', margin:'0 0 20px' }}>You're safe. Check-in closed.</p>
        <button onClick={handleReset}
          style={{ padding:'10px 28px', borderRadius:12, background:'linear-gradient(90deg,#22d3ee,#2563eb)', border:'none', color:'#0a1628', fontWeight:700, fontSize:13, cursor:'pointer' }}>
          Start New Check-In
        </button>
      </div>
    );
  }

  // ── IDLE / SETUP ───────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ borderRadius:20, border:'1px solid rgba(34,211,238,0.18)', background:'linear-gradient(135deg,#0f1f3d,#0a1628)', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.35)' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(34,211,238,0.10)' }}>
          <p style={{ fontSize:14, fontWeight:700, color:'#f1f5f9', margin:0 }}>🛡 Safety Check-In</p>
          {address && <p style={{ fontSize:11, color:'#475569', margin:0 }}>📍 {address}</p>}
        </div>
        <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#22d3ee', margin:0 }}>Set your check-in interval</p>
            <div className="flex flex-wrap gap-2">
              {TIMER_PRESETS.map(m => (
                <button key={m} onClick={() => { setIntervalMin(m); setCustomMin(''); }}
                  style={{ padding:'7px 12px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer',
                    background: effectiveMin === m && !customMin ? 'linear-gradient(90deg,#22d3ee,#2563eb)' : 'rgba(255,255,255,0.05)',
                    color: effectiveMin === m && !customMin ? '#0a1628' : '#94a3b8',
                    border: effectiveMin === m && !customMin ? 'none' : '1px solid rgba(34,211,238,0.15)',
                  }}>
                  {m} min
                </button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="number" min="1" max="480" placeholder="Custom min"
                value={customMin} onChange={e => setCustomMin(e.target.value)}
                style={{ width:110, padding:'8px 12px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'#f1f5f9', fontSize:12, outline:'none' }} />
              <span style={{ fontSize:11, color:'#475569' }}>minutes</span>
            </div>
            <p style={{ fontSize:11, color:'#475569', margin:0 }}>
              ⚠ If you don't check in within {effectiveMin} min, an alert fires automatically.
            </p>
          </div>

          {contacts.length === 0 && (
            <p style={{ fontSize:11, color:'#f59e0b', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:10, padding:'8px 12px', margin:0 }}>
              ⚠ No circle contacts yet — add them on the SafeCircle tab so alerts can be sent.
            </p>
          )}

          <button onClick={handleArrival}
            style={{ width:'100%', padding:16, borderRadius:14, background:'linear-gradient(90deg,#10b981,#059669)', border:'none', color:'white', fontSize:15, fontWeight:900, cursor:'pointer', boxShadow:'0 4px 20px rgba(16,185,129,0.4)' }}>
            ▶ I've Arrived — Start Check-In
          </button>
        </div>
      </div>

      <div style={{ background:'rgba(34,211,238,0.04)', border:'1px solid rgba(34,211,238,0.12)', borderRadius:16, padding:'12px 16px' }}>
        <p style={{ fontSize:11, fontWeight:700, color:'#22d3ee', letterSpacing:1, textTransform:'uppercase', margin:'0 0 8px' }}>How it works</p>
        {[
          '1. Set your interval and tap Arrived',
          '2. Timer counts down — if it hits zero, alert fires automatically',
          '3. Tap ✅ I\'m OK before it expires to stop the timer',
          '4. A 10-min departure timer starts — tap safe when you\'re back at your car',
          '5. 🚨 I Need Help sends an immediate blast to your circle + calls 911',
        ].map(step => (
          <p key={step} style={{ fontSize:11, color:'#64748b', margin:'3px 0' }}>{step}</p>
        ))}
      </div>
      </div>
    );
  }

  // ── RUNNING / DEPARTURE ────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Timer display */}
      <div style={{ borderRadius:20, border: phase === 'departure' ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(34,211,238,0.18)', background: phase === 'departure' ? 'linear-gradient(135deg,#0c1e3d,#071428)' : 'linear-gradient(135deg,#0f1f3d,#0a1628)', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.35)', textAlign:'center', padding:'20px 16px' }}>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {phase === 'departure' ? '🚶 Departure timer — get to your car' : '⏱ Visit check-in timer'}
        </p>
        {address && <p style={{ fontSize:11, color:"#475569" }}>📍 {address}</p>}

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
        <p style={{ fontSize:11, color:"#475569" }}>remaining — alert fires automatically at 0:00</p>
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

      <p className="text-xs text-slate-600 text-center">
        Buttons are different sizes and shapes — readable under stress
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════


// ─── Tab 4: Panic ─────────────────────────────────────────────────────────────
function PanicTab({ contacts }: { contacts: Contact[] }) {
  const [panicActive, setPanicActive] = useState(false);
  const [cancelTaps,  setCancelTaps]  = useState(0);
  const sirenRef = useRef<OscillatorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function activatePanic() {
    setPanicActive(true);
    setCancelTaps(0);

    // Siren via Web Audio
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.5);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 1);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      osc.start(); sirenRef.current = osc;
    } catch { }

    // Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      const vid = document.getElementById('panic-video') as HTMLVideoElement;
      if (vid) { vid.srcObject = stream; vid.play(); }
    } catch { }

    // SOS blast
    for (const c of contacts) {
      if (c.email) window.open(`mailto:${c.email}?subject=${encodeURIComponent('🆘 PANIC ALERT — I need help NOW')}&body=${encodeURIComponent('EMERGENCY: I have activated the SafeCircle panic button. I need immediate help. Please call 911 and come to my location immediately.')}`, '_blank');
      if (c.phone) window.open(`sms:${c.phone}?body=${encodeURIComponent('🆘 PANIC ALERT: I need help NOW. Please call 911 and come to my location.')}`, '_blank');
    }
  }

  function handleCancel() {
    const next = cancelTaps + 1;
    setCancelTaps(next);
    if (next >= 3) {
      setPanicActive(false);
      setCancelTaps(0);
      if (sirenRef.current) { try { sirenRef.current.stop(); } catch { } }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
    }
  }

  if (panicActive) return (
    <div style={{ textAlign:'center' }}>
      <div style={{ background:'linear-gradient(135deg,#1a0505,#0f0202)', border:'2px solid #ef4444',
        borderRadius:20, padding:20, marginBottom:12, boxShadow:'0 0 40px rgba(239,68,68,0.4)' }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#ef4444', letterSpacing:2,
          textTransform:'uppercase', marginBottom:8 }}>🆘 PANIC ACTIVE — SOS SENT</div>
        <video id="panic-video" autoPlay muted playsInline
          style={{ width:'100%', borderRadius:12, maxHeight:240, background:'#000', marginBottom:12 }} />
        <p style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>
          Camera active · Siren on · Circle alerted
        </p>
        <button onClick={handleCancel} style={{
          width:'100%', padding:14, borderRadius:14, border:'2px solid #ef4444',
          background:'transparent', color:'#ef4444', fontWeight:700, fontSize:14, cursor:'pointer',
        }}>
          TAP 3× TO CANCEL ({3 - cancelTaps} taps remaining)
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <div style={{ width:72, height:72, borderRadius:'50%',
          background:'linear-gradient(135deg,#ef4444,#dc2626)',
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 10px', fontSize:32,
          boxShadow:'0 0 30px rgba(239,68,68,0.6)' }}>📹</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:'white', margin:'0 0 4px' }}>Panic Camera</h2>
        <p style={{ fontSize:12, color:'#64748b', margin:0 }}>One tap · camera + siren + SOS + GPS</p>
      </div>

      {/* Big panic button */}
      <div style={{ textAlign:'center', marginBottom:20 }}>
        <button onClick={activatePanic} style={{
          width:180, height:180, borderRadius:'50%',
          border:'4px solid rgba(239,68,68,0.5)',
          background:'linear-gradient(135deg,#ef4444,#991b1b)',
          color:'white', cursor:'pointer',
          boxShadow:'0 0 40px rgba(239,68,68,0.5), 0 0 80px rgba(239,68,68,0.2)',
          display:'inline-flex', flexDirection:'column' as const,
          alignItems:'center', justifyContent:'center', gap:6,
        }}>
          <span style={{ fontSize:40 }}>🆘</span>
          <span style={{ fontSize:15, fontWeight:900, letterSpacing:1 }}>PANIC</span>
          <span style={{ fontSize:11, opacity:0.8, fontWeight:600 }}>TAP TO ACTIVATE</span>
        </button>
      </div>

      {/* What happens */}
      <div style={{ background:'linear-gradient(135deg,#0f1f3d,#0a1628)',
        border:'1px solid rgba(239,68,68,0.2)', borderRadius:16, padding:14, marginBottom:12 }}>
        <p style={{ fontSize:10, fontWeight:700, color:'#22d3ee', letterSpacing:2,
          textTransform:'uppercase', margin:'0 0 10px' }}>When activated:</p>
        {[
          ['📹','#ef4444','Camera activates','Front or rear camera starts immediately'],
          ['📢','#f97316','Loud siren sounds','Maximum volume to startle attacker'],
          ['📱','#a855f7','SOS blast fires','Texts + emails your circle instantly'],
          ['📍','#22d3ee','GPS location shared','Exact location sent to your circle'],
        ].map(([icon,color,title,sub]) => (
          <div key={title} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:color,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:16, flexShrink:0 }}>{icon}</div>
            <div>
              <p style={{ fontSize:13, color:'white', fontWeight:600, margin:0 }}>{title}</p>
              <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:'rgba(34,211,238,0.08)', border:'1px solid rgba(34,211,238,0.2)',
        borderRadius:14, padding:12, textAlign:'center' }}>
        <p style={{ fontSize:12, color:'#22d3ee', margin:0, fontWeight:600 }}>
          Triple-tap anywhere to cancel false alarm
        </p>
      </div>
    </div>
  );
}

// ─── Tab 5: How To ────────────────────────────────────────────────────────────
function HowToTab({ onShare, shareCopied }: { onShare: () => void; shareCopied: boolean }) {
  const steps = [
    { num:'1', color:'#22d3ee', title:'Enter your destination address', sub:'Street number + first word of street name only' },
    { num:'2', color:'#ef4444', title:'Review the crime map', sub:'Color-coded incidents within 0.5mi · last 14 days' },
    { num:'3', color:'#f59e0b', title:'Run warrant + offender checks', sub:'Shelby County Sheriff + NSOPW national registry' },
    { num:'4', color:'#a855f7', title:'Add your circle of friends', sub:'They get your SOS if something goes wrong' },
    { num:'5', color:'#10b981', title:'Start your check-in timer', sub:'Auto-fires SOS if you do not check in on time' },
    { num:'🆘', color:'#ef4444', title:'Emergency — use Panic tab', sub:'Camera + siren + SOS + GPS in one tap' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        <div style={{ width:64, height:64, borderRadius:'50%',
          background:'linear-gradient(135deg,#10b981,#059669)',
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 10px', fontSize:28,
          boxShadow:'0 0 25px rgba(16,185,129,0.5)' }}>❓</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:'white', margin:'0 0 4px' }}>How to Use SafeCircle</h2>
        <p style={{ fontSize:12, color:'#64748b', margin:0 }}>Watch the video or follow the steps below</p>
      </div>

      {/* YouTube video */}
      <div style={{ borderRadius:16, overflow:'hidden', marginBottom:14,
        border:'2px solid rgba(16,185,129,0.3)', background:'#000' }}>
        <div style={{ position:'relative', paddingBottom:'56.25%', height:0 }}>
          <iframe
            style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%' }}
            src="https://www.youtube.com/embed/Mwd0nktbu1I"
            title="How to Use SafeCircle"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      {/* Steps */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
        {steps.map(s => (
          <div key={s.num} style={{
            background:'linear-gradient(135deg,#0f1f3d,#0a1628)',
            borderLeft:`4px solid ${s.color}`,
            borderRadius:'0 14px 14px 0',
            padding:'12px 12px 12px 14px',
            display:'flex', gap:12, alignItems:'center',
          }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:s.color,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:900, color:'white', fontSize:14, flexShrink:0 }}>{s.num}</div>
            <div>
              <p style={{ fontSize:13, color:'white', fontWeight:700, margin:0 }}>{s.title}</p>
              <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Share + Donate */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <button onClick={onShare} style={{
          width:'100%', padding:12, borderRadius:14, border:'none',
          background: shareCopied ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#7c3aed,#4f46e5)',
          color:'white', fontWeight:700, fontSize:14, cursor:'pointer',
          boxShadow:'0 4px 20px rgba(124,58,237,0.4)',
        }}>
          {shareCopied ? '✓ Link copied! Opening SMS…' : '📲 Share SafeCircle with Friends'}
        </button>
        <a href="https://www.paypal.com/donate/?hosted_button_id=59GEQMLVVE68S"
          target="_blank" rel="noopener noreferrer" style={{
          display:'block', padding:12, borderRadius:14, textAlign:'center',
          background:'linear-gradient(90deg,#0070ba,#003087)',
          color:'white', fontWeight:700, fontSize:14, textDecoration:'none',
          boxShadow:'0 4px 20px rgba(0,112,186,0.4)',
        }}>
          💙 Donate via PayPal / Venmo
        </a>
      </div>
    </div>
  );
}

type TabId = 'main' | 'tracking' | 'alerts' | 'panic' | 'howto' | 'assessor';


// ── City config type ──────────────────────────────────────────────────────────

interface CityConfig {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  zoom: number;
  geocodeSuffix: string;        // appended to address for geocoding, e.g. "Memphis, TN"
  esriLayer: string;            // FeatureServer URL or 'socrata' or 'uk-police' etc.
  crimeField: string;           // field name for crime type
  updateFreq: string;
  apiStatus: '✅' | '~' | '🔧';
  warrantUrl: string;           // county sheriff warrant search URL
  jailUrl: string;              // jail roster URL
  warrantNote?: string;
  jailNote?: string;
  placeholderAddress: string;   // example address for input placeholder
}

// ── City configs ──────────────────────────────────────────────────────────────

const CITY_CONFIGS: CityConfig[] = [
  // ── United States ──────────────────────────────────────────────────────────
  { id:'memphis',       name:'Memphis',        state:'TN', country:'US',
    lat:35.1495, lng:-90.0490, zoom:13, geocodeSuffix:'Memphis, TN',
    esriLayer:'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0',
    crimeField:'UCR_Category', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://warrants.shelby-sheriff.org/w_warrant_result.php',
    jailUrl:'https://imljail.shelbycountytn.gov/IML',
    placeholderAddress:'4128 Weymouth' },
  { id:'denver',        name:'Denver',         state:'CO', country:'US',
    lat:39.7392, lng:-104.9903, zoom:13, geocodeSuffix:'Denver, CO',
    esriLayer:'https://services1.arcgis.com/geospatialDenver/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'offense_type_id', updateFreq:'Mon–Fri', apiStatus:'✅',
    warrantUrl:'https://www.denvercountycourt.org/records/',
    jailUrl:'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Sheriff-Department/Inmate-Search',
    warrantNote:'Denver County Court — web search',
    placeholderAddress:'1600 Broadway' },
  { id:'neworleans',    name:'New Orleans',    state:'LA', country:'US',
    lat:29.9511, lng:-90.0715, zoom:13, geocodeSuffix:'New Orleans, LA',
    esriLayer:'https://services3.arcgis.com/dty2kHktVXHrqO8i/arcgis/rest/services/Crime_Incidents/FeatureServer/0',
    crimeField:'TypeText', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.opcso.org/index.php?page=warrant_search',
    jailUrl:'https://opso.us/inmate-search/',
    placeholderAddress:'900 Bourbon St' },
  { id:'chicago',       name:'Chicago',        state:'IL', country:'US',
    lat:41.8781, lng:-87.6298, zoom:13, geocodeSuffix:'Chicago, IL',
    esriLayer:'socrata:data.cityofchicago.org/ijzp-q8t2',
    crimeField:'primary_type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://publicsearch1.chicagopolice.org/',
    jailUrl:'https://iic.ccsheriff.org/',
    placeholderAddress:'233 S Wacker Dr' },
  { id:'dc',            name:'Washington DC',  state:'DC', country:'US',
    lat:38.9072, lng:-77.0369, zoom:13, geocodeSuffix:'Washington, DC',
    esriLayer:'https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/MPD/MapServer/8',
    crimeField:'OFFENSE', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.dccourts.gov/superior-court/criminal-division',
    jailUrl:'https://doc.dc.gov/page/inmate-locator',
    placeholderAddress:'1600 Pennsylvania Ave' },
  { id:'losangeles',    name:'Los Angeles',    state:'CA', country:'US',
    lat:34.0522, lng:-118.2437, zoom:13, geocodeSuffix:'Los Angeles, CA',
    esriLayer:'https://data.lacity.org/resource/2nrs-mtv8.json',
    crimeField:'Crm Cd Desc', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.lasd.org/transparency/arrdivisions.html',
    jailUrl:'https://app5.lasd.org/iic/',
    placeholderAddress:'6801 Hollywood Blvd' },
  { id:'houston',       name:'Houston',        state:'TX', country:'US',
    lat:29.7604, lng:-95.3698, zoom:13, geocodeSuffix:'Houston, TX',
    esriLayer:'socrata:www.houstontx.gov',
    crimeField:'Offense Type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.hcso.hctx.net/warrant/',
    jailUrl:'https://www.hcso.hctx.net/jailinfo/',
    placeholderAddress:'1001 Avenida de las Americas' },
  { id:'phoenix',       name:'Phoenix',        state:'AZ', country:'US',
    lat:33.4484, lng:-112.0740, zoom:13, geocodeSuffix:'Phoenix, AZ',
    esriLayer:'https://maps.phoenix.gov/arcgis/rest/services/PHX_Crime/FeatureServer/0',
    crimeField:'UCR_CRIME_CATEGORY', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.maricopa.gov/5593/Warrant-Search',
    jailUrl:'https://www.mcso.org/Jail/InmateSearch',
    placeholderAddress:'200 W Washington St' },
  { id:'philadelphia',  name:'Philadelphia',   state:'PA', country:'US',
    lat:39.9526, lng:-75.1652, zoom:13, geocodeSuffix:'Philadelphia, PA',
    esriLayer:'socrata:www.opendataphilly.org',
    crimeField:'text_general_code', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://ujsportal.pacourts.us/',
    jailUrl:'https://www.phila.gov/departments/philadelphia-department-of-prisons/',
    placeholderAddress:'1 Penn Sq' },
  { id:'sanantonio',    name:'San Antonio',    state:'TX', country:'US',
    lat:29.4241, lng:-98.4936, zoom:13, geocodeSuffix:'San Antonio, TX',
    esriLayer:'https://cosagis.maps.arcgis.com/arcgis/rest/services/SAPD/FeatureServer/0',
    crimeField:'Highest NIBRS', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.bexar.org/2704/Active-Warrants',
    jailUrl:'https://jailrecords.bexar.org/',
    placeholderAddress:'300 Alamo Plaza' },
  { id:'dallas',        name:'Dallas',         state:'TX', country:'US',
    lat:32.7767, lng:-96.7970, zoom:13, geocodeSuffix:'Dallas, TX',
    esriLayer:'socrata:www.dallasopendata.com',
    crimeField:'Type of Incident', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.dallascounty.org/departments/sheriff/warrants.php',
    jailUrl:'https://www.dallascounty.org/departments/jail/',
    placeholderAddress:'1500 Marilla St' },
  { id:'austin',        name:'Austin',         state:'TX', country:'US',
    lat:30.2672, lng:-97.7431, zoom:13, geocodeSuffix:'Austin, TX',
    esriLayer:'https://data.austintexas.gov/resource/fdj4-gpfu.json',
    crimeField:'crime_type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.traviscountytx.gov/sheriff/warrants',
    jailUrl:'https://www.tcso.org/inmate-search',
    placeholderAddress:'301 W 2nd St' },
  { id:'jacksonville',  name:'Jacksonville',   state:'FL', country:'US',
    lat:30.3322, lng:-81.6557, zoom:13, geocodeSuffix:'Jacksonville, FL',
    esriLayer:'https://gis.coj.net/arcgis/rest/services/JSO/FeatureServer/0',
    crimeField:'CRIME_TYPE', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.jaxsheriff.org/services/warrant-search',
    jailUrl:'https://www.jaxsheriff.org/services/inmate-search',
    placeholderAddress:'117 W Duval St' },
  { id:'columbus',      name:'Columbus',       state:'OH', country:'US',
    lat:39.9612, lng:-82.9988, zoom:13, geocodeSuffix:'Columbus, OH',
    esriLayer:'https://columbus.maps.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'OFFENSE', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.franklincountyohio.gov/Sheriff/Warrants',
    jailUrl:'https://fcciportal.franklincountyohio.gov/',
    placeholderAddress:'90 W Broad St' },
  { id:'seattle',       name:'Seattle',        state:'WA', country:'US',
    lat:47.6062, lng:-122.3321, zoom:13, geocodeSuffix:'Seattle, WA',
    esriLayer:'https://data.seattle.gov/resource/tazs-3rd5.json',
    crimeField:'Primary Type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.kingcounty.gov/courts/district-court/warrants.aspx',
    jailUrl:'https://www.kingcounty.gov/depts/adult-and-juvenile-detention/jails/inmate-search.aspx',
    placeholderAddress:'600 4th Ave' },
  { id:'nashville',     name:'Nashville',      state:'TN', country:'US',
    lat:36.1627, lng:-86.7816, zoom:13, geocodeSuffix:'Nashville, TN',
    esriLayer:'https://data.nashville.gov/resource/2u6v-ujjs.json',
    crimeField:'OFFENSE_DESCRIPTION', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.dcso.com/inmate-search/',
    jailUrl:'https://www.dcso.com/inmate-search/',
    placeholderAddress:'1 Public Square' },
  { id:'baltimore',     name:'Baltimore',      state:'MD', country:'US',
    lat:39.2904, lng:-76.6122, zoom:13, geocodeSuffix:'Baltimore, MD',
    esriLayer:'https://gis-baltimore.opendata.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'Description', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.baltimorecountymd.gov/departments/police/warrants',
    jailUrl:'https://www.bcboc.org/inmate-search',
    placeholderAddress:'100 N Holliday St' },
  { id:'portland',      name:'Portland',       state:'OR', country:'US',
    lat:45.5231, lng:-122.6765, zoom:13, geocodeSuffix:'Portland, OR',
    esriLayer:'https://pdx.maps.arcgis.com/arcgis/rest/services/PPB/FeatureServer/0',
    crimeField:'OFFENSE_CATEGORY', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.mcso.us/inmate-search',
    jailUrl:'https://www.mcso.us/inmate-search',
    placeholderAddress:'1221 SW 4th Ave' },
  { id:'charlotte',     name:'Charlotte',      state:'NC', country:'US',
    lat:35.2271, lng:-80.8431, zoom:13, geocodeSuffix:'Charlotte, NC',
    esriLayer:'https://cmpd.maps.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'CATEGORY', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.mecksheriff.com/services/warrant-search',
    jailUrl:'https://www.mecksheriff.com/services/inmate-search',
    placeholderAddress:'600 E Trade St' },
  { id:'atlanta',       name:'Atlanta',        state:'GA', country:'US',
    lat:33.7490, lng:-84.3880, zoom:13, geocodeSuffix:'Atlanta, GA',
    esriLayer:'https://gis.atlantaga.gov/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'UC2_Literal', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/warrants',
    jailUrl:'https://ody.fultoncountyga.gov/portal/',
    placeholderAddress:'68 Mitchell St SW' },
  // ── Canada ─────────────────────────────────────────────────────────────────
  { id:'toronto',       name:'Toronto',        state:'ON', country:'CA',
    lat:43.6532, lng:-79.3832, zoom:13, geocodeSuffix:'Toronto, ON, Canada',
    esriLayer:'https://services.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Major_Crime_Indicators_Open_Data/FeatureServer/0',
    crimeField:'MCI_CATEGORY', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.torontopolice.on.ca/services/warrants.php',
    jailUrl:'https://www.mcscs.jus.gov.on.ca/english/corr_serv/InstitutionalServices/FindInmate/findInmate.html',
    placeholderAddress:'100 Queen St W' },
  { id:'vancouver',     name:'Vancouver',      state:'BC', country:'CA',
    lat:49.2827, lng:-123.1207, zoom:13, geocodeSuffix:'Vancouver, BC, Canada',
    esriLayer:'https://geodata.vancouver.ca/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'TYPE', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.vancouvercourts.ca/',
    jailUrl:'https://www.bcjails.gov.bc.ca/',
    placeholderAddress:'453 W 12th Ave' },
  { id:'calgary',       name:'Calgary',        state:'AB', country:'CA',
    lat:51.0447, lng:-114.0719, zoom:13, geocodeSuffix:'Calgary, AB, Canada',
    esriLayer:'https://data.calgary.ca/resource/crime-stats',
    crimeField:'category', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.calgary.ca/cps/Pages/Police-Home.aspx',
    jailUrl:'https://www.albertacourts.ca/',
    placeholderAddress:'800 Macleod Trail SE' },
  { id:'ottawa',        name:'Ottawa',         state:'ON', country:'CA',
    lat:45.4215, lng:-75.6919, zoom:13, geocodeSuffix:'Ottawa, ON, Canada',
    esriLayer:'https://ottawa.ca/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'offence_type', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.ottawapolice.ca/en/services-and-community/warrants.aspx',
    jailUrl:'https://www.mcscs.jus.gov.on.ca/english/corr_serv/InstitutionalServices/FindInmate/findInmate.html',
    placeholderAddress:'110 Laurier Ave W' },
  // ── United Kingdom ─────────────────────────────────────────────────────────
  { id:'london',        name:'London',         state:'England', country:'GB',
    lat:51.5074, lng:-0.1278, zoom:13, geocodeSuffix:'London, UK',
    esriLayer:'uk-police:metropolitan',
    crimeField:'category', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.met.police.uk/advice/advice-and-information/wsi/wanted/',
    jailUrl:'https://www.gov.uk/find-prisoner',
    placeholderAddress:'10 Downing Street' },
  { id:'manchester',    name:'Manchester',     state:'England', country:'GB',
    lat:53.4808, lng:-2.2426, zoom:13, geocodeSuffix:'Manchester, UK',
    esriLayer:'uk-police:greater-manchester',
    crimeField:'category', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.gmp.police.uk/advice/advice-and-information/wsi/wanted/',
    jailUrl:'https://www.gov.uk/find-prisoner',
    placeholderAddress:'Albert Square' },
  { id:'birmingham',    name:'Birmingham',     state:'England', country:'GB',
    lat:52.4862, lng:-1.8904, zoom:13, geocodeSuffix:'Birmingham, UK',
    esriLayer:'uk-police:west-midlands',
    crimeField:'category', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.westmidlands.police.uk/advice/advice-and-information/wsi/wanted/',
    jailUrl:'https://www.gov.uk/find-prisoner',
    placeholderAddress:'Victoria Square' },
  // ── Australia ──────────────────────────────────────────────────────────────
  { id:'sydney',        name:'Sydney',         state:'NSW', country:'AU',
    lat:-33.8688, lng:151.2093, zoom:13, geocodeSuffix:'Sydney, NSW, Australia',
    esriLayer:'bocsar:nsw',
    crimeField:'offence', updateFreq:'Quarterly', apiStatus:'✅',
    warrantUrl:'https://www.police.nsw.gov.au/crime/wanted_persons',
    jailUrl:'https://www.correctiveservices.dcj.nsw.gov.au/inmate-search',
    placeholderAddress:'1 Martin Place' },
  { id:'melbourne',     name:'Melbourne',      state:'VIC', country:'AU',
    lat:-37.8136, lng:144.9631, zoom:13, geocodeSuffix:'Melbourne, VIC, Australia',
    esriLayer:'csa:victoria',
    crimeField:'offence_category', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.police.vic.gov.au/wanted',
    jailUrl:'https://www.corrections.vic.gov.au/',
    placeholderAddress:'1 Swanston St' },
  // ── New Zealand ────────────────────────────────────────────────────────────
  { id:'auckland',      name:'Auckland',       state:'Auckland', country:'NZ',
    lat:-36.8509, lng:174.7645, zoom:13, geocodeSuffix:'Auckland, New Zealand',
    esriLayer:'nz-police:auckland-city',
    crimeField:'anzsoc_division', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.police.govt.nz/wanted',
    jailUrl:'https://www.corrections.govt.nz/our_prison_system/find_an_inmate',
    placeholderAddress:'1 Queen St' },
  // ── Mexico ─────────────────────────────────────────────────────────────────
  { id:'mexicocity',    name:'Mexico City',    state:'CDMX', country:'MX',
    lat:19.4326, lng:-99.1332, zoom:13, geocodeSuffix:'Ciudad de Mexico, Mexico',
    esriLayer:'https://services.arcgis.com/CDMX/arcgis/rest/services/Carpetas/FeatureServer/0',
    crimeField:'delito', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.fgjcdmx.gob.mx/',
    jailUrl:'https://reclusorios.cdmx.gob.mx/',
    placeholderAddress:'Plaza de la Constitucion' },
];

// ── Group configs by country ──────────────────────────────────────────────────

const COUNTRY_GROUPS = [
  { code:'US', flag:'🇺🇸', label:'United States', cities: CITY_CONFIGS.filter(c=>c.country==='US') },
  { code:'CA', flag:'🇨🇦', label:'Canada',         cities: CITY_CONFIGS.filter(c=>c.country==='CA') },
  { code:'GB', flag:'🇬🇧', label:'United Kingdom', cities: CITY_CONFIGS.filter(c=>c.country==='GB') },
  { code:'AU', flag:'🇦🇺', label:'Australia',      cities: CITY_CONFIGS.filter(c=>c.country==='AU') },
  { code:'NZ', flag:'🇳🇿', label:'New Zealand',    cities: CITY_CONFIGS.filter(c=>c.country==='NZ') },
  { code:'MX', flag:'🇲🇽', label:'Mexico',         cities: CITY_CONFIGS.filter(c=>c.country==='MX') },
];

// ── Sub-accordion ─────────────────────────────────────────────────────────────

function CountryGroup({
  flag, label, cities, selectedCity, originCity, onSelect, openKey, setOpenKey
}: {
  flag: string; label: string; cities: CityConfig[];
  selectedCity: CityConfig; originCity: CityConfig;
  onSelect: (c: CityConfig) => void;
  openKey: string; setOpenKey: (k: string) => void;
}) {
  const isOpen      = openKey === label;
  const hasSelected = cities.some(c => c.id === selectedCity.id);
  const hasOrigin   = cities.some(c => c.id === originCity.id);

  return (
    <div style={{
      borderRadius: 14,
      border: isOpen
        ? '1px solid rgba(34,211,238,0.35)'
        : hasSelected
          ? '1px solid rgba(16,185,129,0.4)'
          : hasOrigin
            ? '1px solid rgba(245,158,11,0.3)'
            : '1px solid rgba(255,255,255,0.07)',
      background: isOpen ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Header */}
      <button
        onClick={() => setOpenKey(isOpen ? '' : label)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '11px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{flag}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{label}</span>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 20,
            background: 'rgba(34,211,238,0.12)', color: '#22d3ee',
          }}>{cities.length} cities</span>
          {hasSelected && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(16,185,129,0.15)', color: '#10b981',
            }}>✓ active</span>
          )}
          {hasOrigin && !hasSelected && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
            }}>🏠 home</span>
          )}
        </div>
        <span style={{
          fontSize: 18, fontWeight: 900, color: isOpen ? '#22d3ee' : '#475569',
          lineHeight: 1, userSelect: 'none',
        }}>{isOpen ? '−' : '+'}</span>
      </button>

      {/* City list */}
      {isOpen && (
        <div style={{ padding: '0 10px 12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
            {cities.map(city => {
              const active  = city.id === selectedCity.id;
              const isHome  = city.id === originCity.id;
              return (
                <button
                  key={city.id}
                  onClick={() => onSelect(city)}
                  style={{
                    padding: '7px 13px', borderRadius: 20, fontSize: 12,
                    fontWeight: active || isHome ? 700 : 500, cursor: 'pointer',
                    border: active
                      ? '1px solid rgba(16,185,129,0.6)'
                      : isHome
                        ? '2px solid rgba(245,158,11,0.7)'
                        : '1px solid rgba(34,211,238,0.2)',
                    background: active
                      ? 'linear-gradient(90deg,#10b981,#059669)'
                      : isHome
                        ? 'rgba(245,158,11,0.12)'
                        : 'rgba(255,255,255,0.04)',
                    color: active ? 'white' : isHome ? '#fbbf24' : '#94a3b8',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {active ? '✓ ' : isHome && !active ? '🏠 ' : ''}{city.name}
                  {city.state ? `, ${city.state}` : ''}
                  <span style={{
                    marginLeft: 5, fontSize: 10,
                    color: city.apiStatus === '✅'
                      ? (active ? 'rgba(255,255,255,0.8)' : '#10b981')
                      : '#f59e0b',
                  }}>{city.apiStatus}</span>
                </button>
              );
            })}
          </div>

          {/* Selected city detail */}
          {hasSelected && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#10b981', margin: '0 0 6px' }}>
                ✓ {selectedCity.name} active — all data fresh for this city
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {[
                  ['Crime data', selectedCity.esriLayer.startsWith('http') ? 'ESRI FeatureServer' : selectedCity.esriLayer.split(':')[0].toUpperCase()],
                  ['Updates', selectedCity.updateFreq],
                  ['Warrants', selectedCity.warrantNote || 'Sheriff website'],
                  ['Geocoder', selectedCity.geocodeSuffix],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span style={{ fontSize: 10, color: '#475569' }}>{k}: </span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── WhereItWorks — wrapper around new universal component ──────────────────────
function WhereItWorks({ onLocationSet, currentLocation }: { onLocationSet: (loc: UniversalLocation) => void; currentLocation: UniversalLocation | null }) {
  return <WhereItWorksComponent onLocationSet={onLocationSet} currentLocation={currentLocation} />;
}

function AssessorTab({ address, selectedCity }: { address: string; selectedCity: CityConfig }) {
  const isShelby = selectedCity.id === 'memphis';

  // Build Shelby County Assessor search URL from address
  function buildAssessorUrl() {
    if (!address) return 'https://www.assessormelvinburgess.com/propertySearch';
    const clean = address.trim();
    return `https://www.assessormelvinburgess.com/propertySearch?searchText=${encodeURIComponent(clean)}`;
  }

  // Parse address — street number + first word of street name only (same rule as warrants)
  const addressParts = address.trim().split(/\s+/);
  const streetNum = addressParts[0] || '';
  const streetName = addressParts[1] || '';

  function buildTrusteeUrl() {
    return 'https://www.shelbycountytrustee.com/103/Tax-Look-Up';
  }

  // Build Register of Deeds GIS URL
  function buildDeedsUrl() {
    if (!address) return 'https://gis.register.shelby.tn.us/';
    const clean = address.trim();
    return `https://gis.register.shelby.tn.us/?search=${encodeURIComponent(clean)}`;
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(15,31,61,0.7)',
    border: '1px solid rgba(34,211,238,0.2)',
    borderRadius: 14,
    padding: '18px 20px',
    marginBottom: 14,
  };

  const btnStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 10,
    textAlign: 'left' as const,
    letterSpacing: 0.2,
  };

  return (
    <div style={{ padding: '16px 14px', maxWidth: 520, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#22d3ee', margin: '0 0 4px' }}>
        🏠 Assessor Lookup
      </h2>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 18px' }}>
        Property ownership, assessed value &amp; tax records
      </p>

      {/* Address display */}
      <div style={cardStyle}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Current Address
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, color: address ? '#f1f5f9' : '#475569', margin: 0 }}>
          {address || '⚠ No address entered — go to Safe tab first'}
        </p>
      </div>

      {isShelby ? (
        <>
          {/* Shelby County Assessor */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#22d3ee', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>
              🏛 Shelby County Assessor
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
              Owner name · Appraised value · Assessed value · Parcel ID · Last sale date
            </p>
            <button
              style={{ ...btnStyle, background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: 'white' }}
              onClick={() => window.open(buildAssessorUrl(), '_blank')}
            >
              🔍 Search Assessor Records →
            </button>
          </div>

          {/* Shelby County Trustee - Tax */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>
              💰 Shelby County Trustee — Tax Lookup
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 10px' }}>
              Property tax bills · Payment status · Tax history
            </p>
            {address && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: 1 }}>Enter these values on the Trustee site:</p>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: '0 0 4px' }}>Street Number: <strong>{streetNum}</strong></p>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: 0 }}>Street Name: <strong>{streetName}</strong></p>
              </div>
            )}
            <button
              style={{ ...btnStyle, background: 'linear-gradient(135deg,#d97706,#b45309)', color: 'white' }}
              onClick={() => window.open(buildTrusteeUrl(), '_blank')}
            >
              💵 Open Tax Lookup →
            </button>
          </div>

          {/* Register of Deeds */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 1 }}>
              📜 Register of Deeds — GIS Map
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
              Deeds · Mortgages · Aerial view · Surrounding parcels · Sales data
            </p>
            <button
              style={{ ...btnStyle, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: 'white' }}
              onClick={() => window.open(buildDeedsUrl(), '_blank')}
            >
              🗺 View on GIS Map →
            </button>
          </div>

          {/* Quick tip */}
          <div style={{ ...cardStyle, borderColor: 'rgba(34,211,238,0.1)', background: 'rgba(34,211,238,0.04)' }}>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
              💡 <strong style={{ color: '#94a3b8' }}>Pro tip:</strong> For warrants, use street name only (no number/direction). For Assessor, use the full address as entered above.
            </p>
          </div>
        </>
      ) : (
        <div style={cardStyle}>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: 0, textAlign: 'center', padding: '20px 0' }}>
            🌐 Assessor lookup for <strong style={{ color: '#f1f5f9' }}>{selectedCity.name}</strong> coming soon.
            <br /><br />
            <span style={{ fontSize: 12, color: '#64748b' }}>Currently available for Memphis / Shelby County only.</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function SafeCirclePage() {
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [showDisclaimer,   setShowDisclaimer]   = useState(true);
  const [installPrompt,    setInstallPrompt]    = useState<any>(null);
  const [showInstallBanner,setShowInstallBanner] = useState(false);
  const [darkMode,         setDarkMode]         = useState(true);

  // Hydrate disclaimer state from localStorage after mount (fixes Next.js hydration error)
  useEffect(() => {
    try {
      if (localStorage.getItem('sc_disclaimer_accepted') === '1') {
        setShowDisclaimer(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    });
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setShowInstallBanner(false);
  }

  // Address — persisted across refreshes
  // Safe server defaults — hydrated from localStorage in useEffect below
  const [selectedCity, setSelectedCity] = useState<CityConfig>(CITY_CONFIGS[0]);
  const [originCity,   setOriginCity]   = useState<CityConfig>(CITY_CONFIGS[0]);

  // Ref for auto-focusing address input after city change
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Hydrate city state from localStorage after mount (fixes Next.js hydration error)
  useEffect(() => {
    try {
      const sc = localStorage.getItem('sc_city');
      if (sc) setSelectedCity(JSON.parse(sc));
      const oc = localStorage.getItem('sc_origin_city');
      if (oc) setOriginCity(JSON.parse(oc));
    } catch {}
  }, []);

  function handleCitySelect(city: CityConfig) {
    // Save origin city + address the first time someone leaves it
    try {
      if (!localStorage.getItem('sc_origin_city')) {
        const currentCity = JSON.parse(localStorage.getItem('sc_city') || 'null') || CITY_CONFIGS[0];
        const currentAddr = localStorage.getItem('sc_address') || '';
        localStorage.setItem('sc_origin_city', JSON.stringify(currentCity));
        localStorage.setItem('sc_origin_address', currentAddr);
        setOriginCity(currentCity);
      }
    } catch {}

    const isReturningHome = city.id === originCity.id;

    // Switch city and clear ALL previous data immediately
    setSelectedCity(city);
    setAddrSet(false);
    setGeoLabel('');
    lastGeoRef.current = '';
    setServices({ police: null, fire: null, hospital: null });

    // If returning home, restore saved home address — otherwise clear it
    try {
      if (isReturningHome) {
        const homeAddr = localStorage.getItem('sc_origin_address') || '';
        setAddress(homeAddr);
        localStorage.setItem('sc_address', homeAddr);
      } else {
        setAddress('');
        localStorage.removeItem('sc_address');
      }
      localStorage.setItem('sc_city', JSON.stringify(city));
      localStorage.removeItem('sc_addrSet');
      localStorage.removeItem('sc_geoLabel');
    } catch {}

    // Auto-focus and scroll to address input
    setTimeout(() => {
      addressInputRef.current?.focus();
      addressInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  const [address,  setAddress]  = useState('');
  const [addrSet,  setAddrSet]  = useState(false);
  const [geoLabel, setGeoLabel] = useState('');
  const [geoLat,   setGeoLat]   = useState<number | null>(null);
  const [geoLon,   setGeoLon]   = useState<number | null>(null);

  // Hydrate address state from localStorage after mount
  useEffect(() => {
    try {
      const a = localStorage.getItem('sc_address');
      if (a) setAddress(a);
      const s = localStorage.getItem('sc_addrSet');
      if (s === 'true') setAddrSet(true);
      const g = localStorage.getItem('sc_geoLabel');
      if (g) setGeoLabel(g);
      // Save origin address if not yet saved (first ever load)
      if (!localStorage.getItem('sc_origin_address') && a) {
        localStorage.setItem('sc_origin_address', a);
      }
    } catch {}
  }, []);

  // Services
  const [services,   setServices]   = useState<EmergencyServices>({ police: null, fire: null, hospital: null });
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcError,   setSvcError]   = useState('');
  const lastGeoRef = useRef('');

  // Contacts / SOS
  // Platform detection
  const platform = typeof navigator !== 'undefined'
    ? /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios'
    : /Android/i.test(navigator.userAgent) ? 'android'
    : 'desktop'
    : 'desktop';

  // Dummy contacts for first-time users
  const DUMMY_CONTACTS: Contact[] = [
    { id: 'dummy-1', name: 'Maria Gonzalez', phone: '901-555-0142', email: 'maria.g@homehealthcare.com' },
    { id: 'dummy-2', name: 'James Whitfield', phone: '901-555-0287', email: 'jwhitfield@shelbysos.org' },
    { id: 'dummy-3', name: 'Tanya Brooks',    phone: '901-555-0391', email: 'tbrooks@caregivers.net' },
    { id: 'dummy-4', name: 'Kevin Okafor',    phone: '901-555-0456', email: 'k.okafor@midsouthsocial.com' },
  ];

  const [contacts, setContacts] = useState<Contact[]>(DUMMY_CONTACTS);

  // Hydrate contacts from localStorage after mount, then persist on change
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sc_contacts');
      if (saved) setContacts(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('sc_contacts', JSON.stringify(contacts)); } catch {}
  }, [contacts]);
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
  const [showAddComment,  setShowAddComment]  = useState(false);
  const [addComment,      setAddComment]      = useState('');
  const [commentSent,     setCommentSent]     = useState(false);
  const [showDevResponse, setShowDevResponse] = useState(false);
  const [devResponse,     setDevResponse]     = useState('');
  const [devVideoUrl,     setDevVideoUrl]     = useState('');
  const [devVideoFile,    setDevVideoFile]    = useState<File | null>(null);
  const [devResponseSent, setDevResponseSent] = useState(false);
  const [devUnlocked,     setDevUnlocked]     = useState(false);
  const [devTapCount,     setDevTapCount]     = useState(0);
  const devTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live GPS for nearest services ───────────────────────────────────────
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsReady, setGpsReady] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);
        setGpsReady(true);
      },
      () => setGpsReady(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // ── Services fetch — GPS first, falls back to geocoded address ───────────
  useEffect(() => {
    // Use live GPS if available, otherwise fall back to geocoded address coords
    const lat = gpsLat ?? geoLat;
    const lng = gpsLng ?? geoLon;
    if (!lat || !lng) {
      // No GPS and no geocoded address yet — try geocoding if address is set
      if (!addrSet || !address.trim()) return;
      const raw = address.trim();
      if (lastGeoRef.current === raw) return;
      lastGeoRef.current = raw;
      setSvcLoading(true); setSvcError('');
      setServices({ police: null, fire: null, hospital: null });
      geocodeAddress(raw, selectedCity.geocodeSuffix).then(geo => {
        if (!geo) { setSvcLoading(false); setSvcError('Could not geocode address.'); return; }
        setGeoLabel(geo.label);
        setGeoLat(geo.lat);
        setGeoLon(geo.lng);
        try { localStorage.setItem('sc_geoLabel', geo.label); } catch {}
        return fetch(`/api/services?lat=${geo.lat}&lng=${geo.lng}`).then(r => r.json());
      }).then(svcs => { if (svcs) setServices(svcs); setSvcLoading(false); })
        .catch(err => { setSvcError(err.message); setSvcLoading(false); });
      return;
    }
    setSvcLoading(true); setSvcError('');
    setServices({ police: null, fire: null, hospital: null });
    fetch(`/api/services?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(svcs => { if (svcs) setServices(svcs); setSvcLoading(false); })
      .catch(err => { setSvcError(err.message); setSvcLoading(false); });
  }, [gpsLat, gpsLng, addrSet, address]);

  function handleSetAddress() {
    if (!address.trim()) return;
    lastGeoRef.current = '';
    setAddrSet(true);
    try { localStorage.setItem('sc_addrSet','true'); localStorage.setItem('sc_address', address.trim()); } catch {}
  }

  function addContact() {
    if (!newName.trim()) return;
    setContacts(c => [...c, { id: crypto.randomUUID(), name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() }]);
    setNewName(''); setNewPhone(''); setNewEmail('');
  }

  function initiateGoogleContactsImport() {
    const google = (window as any).google;
    if (!google?.accounts?.oauth2) return;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: '905532345244-ro7u2p478c0pvmluisqj0dvcmfa09ec9.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/contacts.readonly',
      callback: async (tokenResponse: any) => {
        if (tokenResponse.error) return;
        try {
          const r = await fetch(
            'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses&pageSize=50',
            { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
          );
          const data = await r.json();
          const imported: Contact[] = (data.connections || [])
            .filter((p: any) => p.names?.length)
            .map((p: any) => ({
              id: crypto.randomUUID(),
              name:  p.names?.[0]?.displayName || '',
              phone: p.phoneNumbers?.[0]?.value || '',
              email: p.emailAddresses?.[0]?.value || '',
            }))
            .filter((c: Contact) => c.name);
          if (imported.length > 0) {
            setContacts(prev => {
              const existing = new Set(prev.map(c => c.name.toLowerCase()));
              const fresh = imported.filter(c => !existing.has(c.name.toLowerCase()));
              return [...prev.filter(c => !c.id.startsWith('dummy-')), ...fresh];
            });
          }
        } catch (e) { console.error('Google Contacts import failed', e); }
      },
    });
    client.requestAccessToken();
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

  // ── Share SafeCircle ────────────────────────────────────────────────────────
  const [shareCopied, setShareCopied] = useState(false);
  const SHARE_URL = 'https://safecircle.chat';
  const SHARE_MSG = 'Stay safe with SafeCircle — free public safety app for Memphis field workers: ' + SHARE_URL;

  async function shareApp() {
    // Try native Web Share API first (works on mobile iOS/Android)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SafeCircle', text: SHARE_MSG, url: SHARE_URL });
        return;
      } catch { }
    }
    // Fallback: copy to clipboard + open SMS
    try { await navigator.clipboard.writeText(SHARE_URL); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch { }
    setTimeout(() => { window.open(`sms:?body=${encodeURIComponent(SHARE_MSG)}`); }, 400);
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
  const tabs: Array<{ id: TabId; label: string; sub: string }> = [
    { id: 'main',     label: '🛡',  sub: 'Safe'     },
    { id: 'tracking', label: '📍',  sub: 'Track'    },
    { id: 'alerts',   label: '🚨',  sub: 'Alerts'   },
    { id: 'panic',    label: '📹',  sub: 'Panic'    },
    { id: 'assessor', label: '🏠',  sub: 'Assessor' },
    { id: 'howto',    label: '❓',  sub: 'How To'   },
  ];

  return (
    <>
      {/* ── Tab hover glow styles ── */}
      <style>{`
        .sc-tab-btn { transition: color 0.18s, background 0.18s, text-shadow 0.18s; }
        .sc-tab-btn:hover .sc-tab-icon {
          text-shadow: 0 0 10px rgba(34,211,238,0.9), 0 0 20px rgba(34,211,238,0.5);
          filter: brightness(1.3);
        }
        .sc-tab-btn:hover {
          color: #67e8f9 !important;
          background: rgba(34,211,238,0.08) !important;
        }
      `}</style>

      {/* ── Disclaimer Modal ── */}
      {showDisclaimer && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(0,0,0,0.92)',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:16,
        }}>
          <div style={{
            background:'linear-gradient(135deg,#0f1f3d,#0a1628)',
            border:'1px solid rgba(34,211,238,0.4)',
            borderRadius:24, padding:28, maxWidth:380, width:'100%',
            boxShadow:'0 0 60px rgba(34,211,238,0.2)',
          }}>
            <div style={{ textAlign:'center', marginBottom:16 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>⚠️</div>
              <h2 style={{ fontSize:22, fontWeight:900, color:'#22d3ee', margin:0 }}>Disclaimer</h2>
            </div>
            <p style={{ fontSize:13, color:'#94a3b8', lineHeight:1.7, marginBottom:20 }}>
              SafeCircle provides public safety information for <strong style={{color:'#f1f5f9'}}>informational purposes only</strong>.
              Data is sourced from public records and may not be complete or current.
              <br /><br />
              By using SafeCircle you agree that <strong style={{color:'#f1f5f9'}}>U.S. Crime Centers, LLC</strong> is
              not responsible for any decisions made based on information displayed in this app.
              <br /><br />
              <strong style={{color:'#ef4444'}}>Always call 911 in any emergency.</strong>
            </p>
            <button onClick={() => { try { localStorage.setItem('sc_disclaimer_accepted','1'); } catch {} setShowDisclaimer(false); }} style={{
              width:'100%', padding:16, borderRadius:14,
              background:'linear-gradient(90deg,#22d3ee,#3b82f6)',
              color:'white', fontWeight:900, fontSize:16,
              border:'none', cursor:'pointer',
              boxShadow:'0 4px 20px rgba(34,211,238,0.5)',
            }}>
              ✓ I Understand — Enter SafeCircle
            </button>
          </div>
        </div>
      )}

      {/* ── PWA Install Banner ── */}
      {showInstallBanner && (
        <div style={{
          position:'fixed', bottom:20, left:16, right:16, zIndex:9998,
          background:'linear-gradient(135deg,#0f1f3d,#1a2744)',
          border:'1px solid rgba(34,211,238,0.4)',
          borderRadius:16, padding:'14px 16px',
          display:'flex', alignItems:'center', gap:12,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize:32 }}>🛡</div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'white', margin:0 }}>Add SafeCircle to your home screen</p>
            <p style={{ fontSize:11, color:'#64748b', margin:0 }}>Tap to install as an app</p>
          </div>
          <button onClick={handleInstall} style={{
            padding:'8px 16px', borderRadius:10, border:'none',
            background:'linear-gradient(90deg,#22d3ee,#3b82f6)',
            color:'white', fontWeight:700, fontSize:12, cursor:'pointer',
          }}>Install</button>
          <button onClick={() => setShowInstallBanner(false)} style={{
            padding:'8px', borderRadius:10, border:'none',
            background:'transparent', color:'#475569', fontSize:16, cursor:'pointer',
          }}>✕</button>
        </div>
      )}

    <div style={{
      minHeight:'100vh',
      background:'linear-gradient(160deg,#050d1f 0%,#0a1628 50%,#050d1f 100%)',
      color:'white', maxWidth:672, margin:'0 auto', display:'flex', flexDirection:'column'
    }}>

      {/* ── Tab bar ── */}
      <div style={{
        position:'sticky', top:0, zIndex:40,
        background:'rgba(5,13,31,0.97)',
        backdropFilter:'blur(12px)',
        borderBottom:'1px solid rgba(34,211,238,0.15)',
        padding:'12px 16px 0',
      }}>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <button onClick={() => setDarkMode((d:boolean) => !d)}
            style={{ padding:'8px 10px', borderRadius:10, fontSize:16,
              background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.3)',
              cursor:'pointer', marginRight:4, color:'#f1f5f9' }}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="sc-tab-btn"
              style={{
                flex:1, padding:'10px 8px', borderRadius:'12px 12px 0 0',
                fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                borderBottom: activeTab === t.id ? '3px solid #22d3ee' : '3px solid transparent',
                background: activeTab === t.id ? 'rgba(34,211,238,0.1)' : 'transparent',
                color: activeTab === t.id ? '#22d3ee' : '#475569',
              }}>
              <span className="sc-tab-icon" style={{fontSize:16,display:'block'}}>{t.label}</span>
              <span style={{fontSize:9,marginTop:2,display:'block'}}>{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex:1, padding:'20px 16px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* ════════════════════════════ TAB 1 — MAIN ════════════════════════════ */}
        {activeTab === 'main' && (<>

          {/* ── Hero Header ── */}
          <div style={{
            borderRadius:24, padding:'24px 20px 20px',
            background:'linear-gradient(135deg,#0f1f3d 0%,#0a1628 50%,#0f1f3d 100%)',
            border:'1px solid rgba(34,211,238,0.2)',
            boxShadow:'0 0 40px rgba(34,211,238,0.08)',
            textAlign:'center',
          }}>
            {/* Shield icon */}
            <div style={{
              width:72, height:72, borderRadius:'50%', margin:'0 auto 12px',
              background:'linear-gradient(135deg,#22d3ee,#3b82f6)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:36, boxShadow:'0 0 30px rgba(34,211,238,0.5)',
            }}>🛡</div>

            <h1 style={{
              fontSize:38, fontWeight:900, letterSpacing:'-1px', margin:'0 0 4px',
              background:'linear-gradient(90deg,#22d3ee,#3b82f6,#a855f7)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
            }}>SafeCircle</h1>

            <p style={{ fontSize:13, color:'#64748b', margin:'0 0 16px' }}>
              Shelby County public safety · field worker edition
            </p>

            {/* Stats bar */}
            <div style={{
              display:'flex', justifyContent:'center', gap:24, marginBottom:16,
              padding:'12px 0', borderTop:'1px solid rgba(34,211,238,0.1)',
              borderBottom:'1px solid rgba(34,211,238,0.1)',
            }}>
              {[['🔴','Crime Data'],['⚖️','Warrants'],['🔍','Offenders'],['🚨','Emergency']].map(([icon,label]) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:20 }}>{icon}</div>
                  <div style={{ fontSize:9, color:'#475569', fontWeight:600, letterSpacing:1, textTransform:'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Share button */}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={shareApp} style={{
                flex:1, padding:'12px', borderRadius:14,
                background: shareCopied ? 'linear-gradient(90deg,#10b981,#059669)' : 'linear-gradient(90deg,#7c3aed,#4f46e5)',
                color:'white', fontWeight:700, fontSize:13, border:'none', cursor:'pointer',
                boxShadow: shareCopied ? '0 4px 20px rgba(16,185,129,0.4)' : '0 4px 20px rgba(124,58,237,0.4)',
              }}>
                {shareCopied ? '✓ Copied!' : '📲 Share'}
              </button>
              <button onClick={() => setActiveTab('howto')} style={{
                flex:1, padding:'12px', borderRadius:14,
                background:'linear-gradient(90deg,#10b981,#059669)',
                color:'white', fontWeight:700, fontSize:13, border:'none', cursor:'pointer',
                boxShadow:'0 4px 20px rgba(16,185,129,0.4)',
              }}>
                ❓ How To
              </button>
            </div>
          </div>

          {/* Address bar */}
          <div style={{
            borderRadius:20, border:'1px solid rgba(34,211,238,0.25)',
            background:'linear-gradient(135deg,#0f1f3d,#0a1628)',
            padding:'16px', boxShadow:'0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <p style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:'#22d3ee', textTransform:'uppercase' }}>Address — {selectedCity.name}</p>
            <p style={{ fontSize:11, color:'#475569' }}>Street number and name only — no Rd, St, Ave, or suffix.</p>
            <div style={{ display:"flex", gap:8 }}>
              <input ref={addressInputRef} type="text" placeholder={selectedCity.placeholderAddress} value={address}
                onChange={e => { const v = e.target.value; setAddress(v); setAddrSet(false); setGeoLabel(''); try { localStorage.setItem('sc_address', v); localStorage.setItem('sc_addrSet','false'); localStorage.removeItem('sc_geoLabel'); } catch {} }}
                onKeyDown={e => { if (e.key === 'Enter') handleSetAddress(); }}
                style={{ flex:1, padding:'10px 14px', borderRadius:12, fontSize:14,
                  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(34,211,238,0.3)',
                  color:'white', outline:'none' }} />
              <button onClick={handleSetAddress} disabled={!address.trim()}
                style={{ padding:'10px 18px', borderRadius:12, fontSize:13, fontWeight:700,
                  color:'white', border:'none', cursor:'pointer', whiteSpace:'nowrap',
                  background:'linear-gradient(90deg,#22d3ee,#3b82f6)',
                  boxShadow:'0 4px 15px rgba(34,211,238,0.35)' }}>
                Set address
              </button>
            </div>
            {addrSet && <p style={{ fontSize:11, color:'#10b981', fontWeight:600 }}>✓ {geoLabel || (address.trim() + ', ' + selectedCity.geocodeSuffix)}</p>}
          </div>

          {/* ── City quick-switcher bar ── */}
          <div style={{
            display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
            padding:'10px 14px', borderRadius:14,
            background:'linear-gradient(135deg,#0f1f3d,#0a1628)',
            border:'1px solid rgba(34,211,238,0.18)',
          }}>
            <span style={{ fontSize:11, color:'#475569', fontWeight:700, flexShrink:0 }}>🌎 City:</span>
            <span style={{
              fontSize:12, fontWeight:700, color:'#22d3ee', flex:1,
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>
              {selectedCity.name}{selectedCity.state ? `, ${selectedCity.state}` : ''} {selectedCity.apiStatus}
            </span>
            <button
              onClick={() => {
                // Scroll to WhereItWorks section
                const el = document.getElementById('where-it-works');
                if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
              }}
              style={{
                padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700,
                background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.4)',
                color:'#c4b5fd', cursor:'pointer', whiteSpace:'nowrap',
                touchAction:'manipulation', flexShrink:0,
              }}>
              ✏ Change city
            </button>
          </div>

          {/* Crime map */}
          <Section title="🗺  Crime map" dark={true} defaultOpen>
            {geoLat && geoLon ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <a
                  href={`https://spotcrime.com/map?lat=${geoLat}&lon=${geoLon}&address=`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:'block', padding:'14px 16px', borderRadius:14, textAlign:'center',
                    background:'linear-gradient(90deg,#22d3ee,#3b82f6)',
                    color:'white', fontWeight:700, fontSize:15, textDecoration:'none',
                    boxShadow:'0 4px 20px rgba(34,211,238,0.35)' }}>
                  🗺 SpotCrime Map — {geoLabel || address}
                </a>
                {selectedCity.esriLayer && selectedCity.esriLayer !== 'spotcrime' && (
                  <a
                    href={selectedCity.id === 'memphis' ? 'https://experience.arcgis.com/experience/7fe3d1d471984096ad287080e3cd5e60' : `https://www.arcgis.com/apps/mapviewer/index.html?url=${encodeURIComponent(selectedCity.esriLayer)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display:'block', padding:'12px 16px', borderRadius:14, textAlign:'center',
                      background:'linear-gradient(90deg,#10b981,#059669)',
                      color:'white', fontWeight:700, fontSize:13, textDecoration:'none',
                      boxShadow:'0 4px 15px rgba(16,185,129,0.3)' }}>
                    📊 {selectedCity.id === 'memphis' ? 'MPD Safer Communities Dashboard' : `ESRI Crime Data — ${selectedCity.name}`}
                  </a>
                )}
              </div>
            ) : (
              <div style={{ height:80, display:'flex', alignItems:'center', justifyContent:'center',
                color:'#475569', fontSize:13 }}>
                Set an address above to load the crime map
              </div>
            )}
          </Section>

          {/* Warrants */}
          <Section title={`⚖️  Warrant search — ${selectedCity.name}`} dark={true}>
            <p style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>{selectedCity.name} warrant database — {selectedCity.warrantNote || 'Sheriff / court website'}.</p>
            {address.trim() ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <a href={warrantUrl(address, selectedCity)} target="_blank" rel="noopener noreferrer"
                  style={{ display:"inline-block", padding:"10px 20px", borderRadius:12, fontSize:13, fontWeight:700, color:"white", textDecoration:"none", background:"linear-gradient(90deg,#f59e0b,#d97706)", boxShadow:"0 4px 15px rgba(245,158,11,0.4)" }}>
                  {selectedCity.id === 'memphis'
                    ? `Check warrants — ${splitAddress(address).num} ${splitAddress(address).name.split(/\s+/)[0]} →`
                    : `Search ${selectedCity.name} warrants →`}
                </a>
              </div>
            ) : <p style={{ fontSize:11, color:"#475569" }}>Enter an address above first.</p>}
          </Section>

          {/* Sex offenders */}
          <Section title="🔍  Sex offender registry" dark={true}>
            <p style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>National Sex Offender Public Website (NSOPW) check.</p>
            {address.trim()
              ? <a href={offenderUrl(address)} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", padding:"10px 20px", borderRadius:12, fontSize:13, fontWeight:700, color:"white", textDecoration:"none", background:"linear-gradient(90deg,#a855f7,#7c3aed)", boxShadow:"0 4px 15px rgba(168,85,247,0.4)" }}>Check sex offenders near {address.trim()} →</a>
              : <p style={{ fontSize:11, color:"#475569" }}>Enter an address above first.</p>}
          </Section>

          {/* Jail roster */}
          <Section title={`🏛  ${selectedCity.name} jail roster`} dark={true}>
            <p style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>Who is currently in custody in {selectedCity.name}.</p>
            <a href={selectedCity.jailUrl} target="_blank" rel="noopener noreferrer" style={{ display:"inline-block", padding:"10px 20px", borderRadius:12, fontSize:13, fontWeight:700, color:"white", textDecoration:"none", background:"linear-gradient(90deg,#06b6d4,#0891b2)", boxShadow:"0 4px 15px rgba(6,182,212,0.4)" }}>Open {selectedCity.name} jail roster →</a>
          </Section>

          {/* Emergency services */}
          <Section title="🚨  Nearest police · fire · hospital" dark={true}>
            <p style={{ fontSize:11, color: gpsReady ? '#22d3ee' : '#64748b', marginBottom:12 }}>
              {gpsReady ? '📍 Using your live location — nearest services below.' : addrSet ? 'Nearest services — tap Call or Directions.' : 'Set an address above first.'}
            </p>
            {svcError && <p className="text-xs text-rose-400 mb-2">{svcError}</p>}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <ServiceCard emoji="🚓" label="Police"   svc={services.police   ? { ...services.police,   directionsUrl: `https://www.google.com/maps/dir/${gpsLat ?? ''},${gpsLng ?? ''}/${services.police.lat},${services.police.lng}` } : null}   loading={svcLoading} />
              <ServiceCard emoji="🚒" label="Fire"     svc={services.fire     ? { ...services.fire,     directionsUrl: `https://www.google.com/maps/dir/${gpsLat ?? ''},${gpsLng ?? ''}/${services.fire.lat},${services.fire.lng}` } : null}     loading={svcLoading} />
              <ServiceCard emoji="🏥" label="Hospital" svc={services.hospital ? { ...services.hospital, directionsUrl: `https://www.google.com/maps/dir/${gpsLat ?? ''},${gpsLng ?? ''}/${services.hospital.lat},${services.hospital.lng}` } : null} loading={svcLoading} />
            </div>
          </Section>

          {/* Circle of friends + SOS */}
          <Section title="👥  Circle of friends &amp; SOS alert" dark={true}>
            {/* SOS button */}
            <button onClick={triggerSos} disabled={contacts.length === 0}
              style={{ width:'100%', padding:'14px', borderRadius:14, fontSize:16, fontWeight:900,
              border:'none', cursor: contacts.length === 0 ? 'not-allowed' : 'pointer',
              background: sosActive ? '#ef4444' : contacts.length === 0 ? '#1e293b' : 'linear-gradient(90deg,#ef4444,#dc2626)',
              color: contacts.length === 0 ? '#475569' : 'white', marginBottom:16,
              boxShadow: sosActive || contacts.length > 0 ? '0 4px 20px rgba(239,68,68,0.5)' : 'none',
              touchAction:'manipulation', WebkitTapHighlightColor:'transparent',
            }}>
              {sosActive ? '🚨 SOS SENT' : '🚨 SOS — Alert my circle NOW'}
            </button>
            {contacts.length === 0 && <p style={{ fontSize:11, color:"#475569", marginBottom:12, marginTop:-8 }}>Add contacts below to enable SOS.</p>}

            {/* Contact list */}
            {contacts.length > 0 && (
              <div style={{ marginBottom:16 }}>
                {contacts.map(c => (
                  <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', margin:0 }}>{c.name}</p>
                      <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{c.phone}{c.phone && c.email ? ' · ' : ''}{c.email}</p>
                      {c.id.startsWith('dummy-') && (
                        <p style={{ fontSize:10, color:'#f59e0b', margin:0 }}>⚠ Sample — tap Edit to replace with real info</p>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:8 }}>
                      {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize:11, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.07)', color:'#94a3b8', textDecoration:'none' }}>Call</a>}
                      {c.phone && <a href={`sms:${c.phone}`} style={{ fontSize:11, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.07)', color:'#94a3b8', textDecoration:'none' }}>SMS</a>}
                      <button onClick={() => setContacts(prev => prev.filter(x => x.id !== c.id))} style={{ fontSize:11, padding:'4px 8px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'#f87171', border:'none', cursor:'pointer' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Google Contacts import */}
            <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:14, border:'1px solid rgba(34,211,238,0.2)', background:'rgba(34,211,238,0.04)' }}>
              <p style={{ fontSize:12, fontWeight:700, color:'#22d3ee', margin:'0 0 6px' }}>📱 Import from Google Contacts</p>
              <p style={{ fontSize:11, color:'#64748b', margin:'0 0 10px' }}>Sign in with Google to pull your contacts directly into your circle.</p>
              <div id="g_id_onload"
                data-client_id="905532345244-ro7u2p478c0pvmluisqj0dvcmfa09ec9.apps.googleusercontent.com"
                data-callback="handleGoogleContact"
                data-auto_prompt="false">
              </div>
              <button
                onClick={() => {
                  // Load Google Identity Services if not already loaded
                  if (!(window as any).google?.accounts) {
                    const script = document.createElement('script');
                    script.src = 'https://accounts.google.com/gsi/client';
                    script.onload = () => initiateGoogleContactsImport();
                    document.head.appendChild(script);
                  } else {
                    initiateGoogleContactsImport();
                  }
                }}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:12,
                  border:'1px solid rgba(255,255,255,0.15)', background:'white', cursor:'pointer',
                  fontSize:13, fontWeight:600, color:'#1f2937', touchAction:'manipulation',
                }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
                Import from Google
              </button>
              {platform === 'ios' && <p style={{ fontSize:10, color:'#475569', marginTop:6 }}>📱 iPhone detected — Safari works best for Google sign-in.</p>}
              {platform === 'android' && <p style={{ fontSize:10, color:'#475569', marginTop:6 }}>📱 Android detected — Chrome works best for Google sign-in.</p>}
            </div>

            {/* Manual add */}
            <div style={{ marginBottom:16 }}>
              <p style={{ fontSize:11, color:'#64748b', fontWeight:600, marginBottom:8 }}>Or add manually</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <input type="text" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)}
                  style={{ width:'100%', padding:'10px 14px', borderRadius:12, fontSize:13, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'white', outline:'none', boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:8 }}>
                  <input type="tel" placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                    style={{ flex:1, padding:'10px 14px', borderRadius:12, fontSize:13, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'white', outline:'none' }} />
                  <input type="email" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    style={{ flex:1, padding:'10px 14px', borderRadius:12, fontSize:13, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'white', outline:'none' }} />
                </div>
                <button onClick={addContact} style={{ padding:'10px 16px', borderRadius:12, fontSize:13, fontWeight:600, color:'white', border:'none', cursor:'pointer', background:'linear-gradient(90deg,#22d3ee,#3b82f6)', touchAction:'manipulation' }}>
                  + Add to circle
                </button>
              </div>
            </div>

            {/* CSV import */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <p style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Import from CSV</p>
              <p style={{ fontSize:11, color:'#475569' }}>One per line: Full Name, Email, Phone</p>
              <textarea rows={3} placeholder={'Jane Smith, jane@example.com, 901-555-1234'} value={csvInput} onChange={e => setCsvInput(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', fontSize:12, color:'#e2e8f0', outline:'none', fontFamily:'monospace', boxSizing:'border-box' }} />
              <button onClick={importCsv} style={{ padding:'10px 16px', borderRadius:12, fontSize:13, fontWeight:600, color:'white', border:'none', cursor:'pointer', background:'rgba(255,255,255,0.08)', touchAction:'manipulation' }}>
                Import CSV
              </button>
            </div>
          </Section>

          {/* ── Kaizen feedback ── */}
          <Section title="💡 Make SafeCircle Better" dark={true}>
            {feedbackSent ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-2xl">🙏</p>
                <p className="text-sm font-medium text-emerald-400">Thank you — your feedback was sent!</p>
                <p style={{ fontSize:11, color:"#475569" }}>We read every suggestion.</p>
                <button onClick={() => setFeedbackSent(false)} className="text-xs text-blue-400 underline mt-2">Send another</button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <p style={{ fontSize:11, color:"#64748b" }}>What would make SafeCircle more useful for you? Tell us anything — features, problems, ideas.</p>
                <textarea rows={4} placeholder="e.g. I wish it could show me if there were recent calls for service at the address before I even get there..."
                  value={feedback} onChange={e => setFeedback(e.target.value)}
                  style={{ width:"100%", padding:"10px 14px", borderRadius:12, fontSize:13, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(34,211,238,0.2)", color:"white", outline:"none", boxSizing:"border-box" }} />
                <div style={{ display:"flex", gap:8 }}>
                  <input type="text" placeholder="Your role (e.g. Home health nurse)" value={feedbackRole} onChange={e => setFeedbackRole(e.target.value)}
                    style={{ flex:1, padding:"10px 14px", borderRadius:12, fontSize:13, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(34,211,238,0.2)", color:"white", outline:"none" }} />
                  <input type="email" placeholder="Email (optional)" value={feedbackEmail} onChange={e => setFeedbackEmail(e.target.value)}
                    style={{ flex:1, padding:"10px 14px", borderRadius:12, fontSize:13, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(34,211,238,0.2)", color:"white", outline:"none" }} />
                </div>
                <button onClick={submitFeedback} disabled={!feedback.trim() || feedbackSending}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-sm font-medium text-white transition-colors">
                  {feedbackSending ? 'Sending…' : 'Send Feedback'}
                </button>

                {/* ── Add Comment button ── */}
                <div style={{ borderTop:'1px solid rgba(34,211,238,0.12)', paddingTop:10 }}>
                  <button onClick={() => setShowAddComment(v => !v)}
                    style={{ padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:600, color:'#22d3ee', border:'1px solid rgba(34,211,238,0.3)', background:'rgba(34,211,238,0.06)', cursor:'pointer', touchAction:'manipulation' }}>
                    💬 Add Comment
                  </button>
                  {showAddComment && (
                    <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
                      <p style={{ fontSize:11, color:'#64748b' }}>Add a follow-up to your original suggestion.</p>
                      <textarea rows={3} placeholder="Your follow-up comment..."
                        value={addComment} onChange={e => setAddComment(e.target.value)}
                        style={{ width:'100%', padding:'10px 14px', borderRadius:12, fontSize:13, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(34,211,238,0.2)', color:'white', outline:'none', boxSizing:'border-box' }} />
                      {commentSent ? (
                        <p style={{ fontSize:12, color:'#10b981' }}>✅ Comment sent!</p>
                      ) : (
                        <button disabled={!addComment.trim()}
                          onClick={() => { setCommentSent(true); setAddComment(''); setTimeout(() => { setCommentSent(false); setShowAddComment(false); }, 2500); }}
                          style={{ padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:600, color:'white', border:'none', background:'linear-gradient(90deg,#22d3ee,#3b82f6)', cursor:'pointer', opacity: addComment.trim() ? 1 : 0.4, touchAction:'manipulation' }}>
                          Send Comment
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Developer Response — hidden tap trigger (3 taps unlocks) ── */}
                <div style={{ borderTop:'1px solid rgba(168,85,247,0.12)', paddingTop:10 }}>
                  {/* Hidden tap zone — tiny, invisible, top-right corner feel */}
                  {!devUnlocked && (
                    <div
                      onClick={() => {
                        const next = devTapCount + 1;
                        if (devTapTimer.current) clearTimeout(devTapTimer.current);
                        if (next >= 3) {
                          setDevUnlocked(true);
                          setDevTapCount(0);
                          setShowDevResponse(true);
                        } else {
                          setDevTapCount(next);
                          devTapTimer.current = setTimeout(() => setDevTapCount(0), 2000);
                        }
                      }}
                      style={{
                        width:28, height:28, borderRadius:'50%',
                        background:'rgba(168,85,247,0.06)',
                        border:'1px solid rgba(168,85,247,0.12)',
                        cursor:'default', userSelect:'none',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        touchAction:'manipulation',
                      }}
                      title=""
                    >
                      <span style={{ fontSize:9, color:'rgba(168,85,247,0.3)' }}>
                        {devTapCount > 0 ? '·'.repeat(devTapCount) : '·'}
                      </span>
                    </div>
                  )}

                  {/* Once unlocked — show the full developer panel */}
                  {devUnlocked && (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <p style={{ fontSize:11, color:'#a855f7', fontWeight:600 }}>🛠 Developer Response</p>
                        <button onClick={() => { setDevUnlocked(false); setShowDevResponse(false); setDevTapCount(0); }}
                          style={{ fontSize:10, color:'#64748b', background:'none', border:'none', cursor:'pointer' }}>
                          ✕ close
                        </button>
                      </div>
                      <textarea rows={3} placeholder="Developer response text..."
                        value={devResponse} onChange={e => setDevResponse(e.target.value)}
                        style={{ width:'100%', padding:'10px 14px', borderRadius:12, fontSize:13, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(168,85,247,0.2)', color:'white', outline:'none', boxSizing:'border-box' }} />

                      {/* Video — paste URL or browse for file */}
                      <p style={{ fontSize:11, color:'#64748b', marginBottom:2 }}>Video (optional)</p>
                      <input type="url" placeholder="Paste URL — YouTube, Loom, etc."
                        value={devVideoUrl} onChange={e => { setDevVideoUrl(e.target.value); setDevVideoFile(null); }}
                        style={{ width:'100%', padding:'10px 14px', borderRadius:12, fontSize:13, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(168,85,247,0.2)', color:'white', outline:'none', boxSizing:'border-box' }} />
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:11, color:'#475569' }}>— or —</span>
                        <label style={{
                          padding:'7px 14px', borderRadius:10, fontSize:12, fontWeight:600,
                          color:'#a855f7', border:'1px solid rgba(168,85,247,0.35)',
                          background:'rgba(168,85,247,0.08)', cursor:'pointer', whiteSpace:'nowrap',
                        }}>
                          📁 Browse file
                          <input type="file" accept="video/*"
                            style={{ display:'none' }}
                            onChange={e => {
                              const f = e.target.files?.[0] ?? null;
                              setDevVideoFile(f);
                              if (f) setDevVideoUrl('');
                            }} />
                        </label>
                        {devVideoFile && (
                          <span style={{ fontSize:11, color:'#10b981', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
                            ✅ {devVideoFile.name}
                          </span>
                        )}
                      </div>

                      {devResponseSent ? (
                        <p style={{ fontSize:12, color:'#10b981' }}>✅ Response posted!</p>
                      ) : (
                        <button disabled={!devResponse.trim()}
                          onClick={() => {
                            setDevResponseSent(true);
                            setDevResponse('');
                            setDevVideoUrl('');
                            setDevVideoFile(null);
                            setTimeout(() => {
                              setDevResponseSent(false);
                              setShowDevResponse(false);
                              setDevUnlocked(false);
                            }, 2500);
                          }}
                          style={{ padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:600, color:'white', border:'none', background:'linear-gradient(90deg,#a855f7,#7c3aed)', cursor:'pointer', opacity: devResponse.trim() ? 1 : 0.4, touchAction:'manipulation' }}>
                          Post Response
                        </button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}
          </Section>



          {/* ── Where It Works — city selector ── */}
          <div id="where-it-works">
            <WhereItWorks
                onLocationSet={(loc) => {
                  // Convert UniversalLocation to CityConfig shape
                  const city: CityConfig = {
                    id: loc.city.toLowerCase().replace(/\s/g,''),
                    name: loc.city,
                    state: loc.state,
                    country: 'US',
                    lat: 0, lng: 0, zoom: 14,
                    geocodeSuffix: loc.geocodeSuffix,
                    esriLayer: loc.esriLayer || 'spotcrime',
                    crimeField: loc.crimeField || 'UCR_Category',
                    updateFreq: 'Daily',
                    apiStatus: loc.esriLayer ? '✅' : '~',
                    warrantUrl: loc.warrantUrl || '',
                    jailUrl: loc.jailUrl || '',
                    placeholderAddress: loc.address,
                  };
                  handleCitySelect(city);
                  setAddress(loc.address);
                  setAddrSet(true);
                  // Auto-fire the map immediately
                  setTimeout(() => handleSetAddress(), 100);
                }}
                currentLocation={selectedCity ? {
                  state: selectedCity.state,
                  city: selectedCity.name,
                  address: address,
                  geocodeSuffix: selectedCity.geocodeSuffix,
                  esriLayer: selectedCity.esriLayer,
                  crimeField: selectedCity.crimeField,
                  warrantUrl: selectedCity.warrantUrl,
                  jailUrl: selectedCity.jailUrl,
                  spotCrimeUrl: '',
                } : null}
              />
          </div>

          {/* Footer */}
          <div style={{ textAlign:'center', padding:'16px 0 8px' }}>
            {/* Free forever line */}
            <p style={{ fontSize:12, color:'#22d3ee', fontWeight:700, marginBottom:6, letterSpacing:0.5 }}>
              🛡 SafeCircle is a free service
            </p>
            <p style={{ fontSize:11, color:'#475569', marginBottom:14, lineHeight:1.5 }}>
              Your donation keeps it running and helps us expand to protect more field workers.
            </p>
            {/* PayPal Donate Button */}
            <a href="https://www.paypal.com/donate/?hosted_button_id=59GEQMLVVE68S"
              target="_blank" rel="noopener noreferrer"
              style={{
                display:'inline-block', padding:'12px 32px', borderRadius:30,
                background:'linear-gradient(90deg,#0070ba,#003087)',
                color:'white', fontWeight:700, fontSize:14, textDecoration:'none',
                boxShadow:'0 4px 20px rgba(0,112,186,0.5)',
                marginBottom:10,
              }}>
              💙 Donate via PayPal / Venmo
            </a>
            <br />
            <p style={{ fontSize:11, color:'#475569', margin:'8px 0 6px' }}>
              Support <a href={USC_URL} target="_blank" rel="noopener noreferrer"
                style={{ color:'#22d3ee', textDecoration:'none', fontWeight:700 }}>USCrimeCenters</a> — help keep people safe.
            </p>
            <a href={USC_URL} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:10, color:'#334155', textDecoration:'none' }}>
              Powered by U.S. Crime Centers
            </a>
          </div>

        </>)}

        {/* ══════════════════════════ TAB 2 — TRACKING ══════════════════════════ */}
        {activeTab === 'tracking' && (
          <TrackingTab contacts={contacts} />
        )}

        {/* ═══════════════════════════ TAB 3 — ALERTS ══════════════════════════ */}
        {activeTab === 'alerts' && (
          <AlertsTab contacts={contacts} address={address} />
        )}

        {/* ═══════════════════════════ TAB 4 — PANIC ═══════════════════════════ */}
        {activeTab === 'panic' && (
          <PanicTab contacts={contacts} />
        )}

        {/* ═══════════════════════════ TAB 5 — HOW TO ══════════════════════════ */}
        {activeTab === 'howto' && (
          <HowToTab onShare={shareApp} shareCopied={shareCopied} />
        )}

        {/* ══════════════════════════ TAB 6 — ASSESSOR ══════════════════════════ */}
        {activeTab === 'assessor' && (
          <AssessorTab address={address} selectedCity={selectedCity} />
        )}

      </main>
    </div>
    </>
  );
}

