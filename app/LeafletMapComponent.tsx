'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const GEOCODE_URL = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const MPD_URL     = 'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0/query';
const RADIUS_MILES = 0.5;
const WINDOW_DAYS  = 14;
const CITY_SUFFIX  = ', Memphis, TN';

// ─── Address helpers ──────────────────────────────────────────────────────────
// User types "4128 Weymouth" — we slice it as needed internally.
// Geocoder gets: "4128 Weymouth, Memphis, TN"
// Warrant gets:  s=4128  st=Weymouth  (no extension — Macon not Macon Road)

function splitAddress(raw: string) {
  const parts = raw.trim().split(/\s+/);
  return { num: parts[0] || '', name: parts.slice(1).join(' ') };
}

function warrantUrl(raw: string) {
  const { num, name } = splitAddress(raw);
  const st = name.split(/\s+/)[0]; // first word only
  return `https://warrants.shelby-sheriff.org/w_warrant_result.php?w=&l=&f=&s=${encodeURIComponent(num)}&st=${encodeURIComponent(st)}`;
}

// ─── UCR colors ───────────────────────────────────────────────────────────────

const UCR_COLORS: Record<string, string> = {
  DRUGS: '#e05c2a', ASSAULT: '#c0392b', THEFT: '#2980b9',
  BURGLARY: '#8e44ad', ROBBERY: '#922b21', VANDALISM: '#f39c12',
  AUTO: '#16a085', WEAPONS: '#6d1f1f', HOMICIDE: '#111111',
  SEX: '#76448a', OTHER: '#7f8c8d',
};

function getColor(cat: string): string {
  if (!cat) return UCR_COLORS.OTHER;
  const up = cat.toUpperCase();
  for (const [k, v] of Object.entries(UCR_COLORS)) {
    if (up.includes(k)) return v;
  }
  return UCR_COLORS.OTHER;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function getIconSvg(cat: string): string {
  const color = getColor(cat);
  const up = cat.toUpperCase();
  let inner = '';
  if (up.includes('DRUG') || up.includes('NARC')) {
    inner = `<rect x="8" y="12" width="12" height="5" rx="2.5" fill="#fff"/>
             <rect x="8" y="12" width="6" height="5" rx="2.5" fill="rgba(255,255,255,0.4)"/>`;
  } else if (up.includes('ASSAULT') || up.includes('BATTERY')) {
    inner = `<path d="M15 6 L11 14 L14 14 L13 22 L19 12 L16 12 Z" fill="#fff"/>`;
  } else if (up.includes('THEFT') || up.includes('LARCENY') || up.includes('SHOPLI')) {
    inner = `<path d="M10 20 L10 13 Q10 11 12 11 L16 11 Q18 11 18 13 L18 20 Z" fill="#fff"/>
             <path d="M12 11 Q12 8 14 8 Q16 8 16 11" stroke="#fff" stroke-width="1.5" fill="none"/>`;
  } else if (up.includes('BURGLAR')) {
    inner = `<path d="M14 6 L21 13 L19 13 L19 21 L9 21 L9 13 L7 13 Z" fill="#fff"/>
             <rect x="12" y="15" width="4" height="6" fill="${color}"/>
             <circle cx="15.5" cy="18" r="0.8" fill="#fff"/>`;
  } else if (up.includes('ROBBERY')) {
    inner = `<path d="M7 14 L7 16 L15 16 L15 18 L18 18 L18 16 L20 16 L20 13 L18 13 L18 11 L15 11 L15 14 Z" fill="#fff"/>
             <rect x="10" y="16" width="2" height="3" fill="#fff"/>`;
  } else if (up.includes('VANDAL') || up.includes('DESTRUCT')) {
    inner = `<rect x="12" y="9" width="5" height="12" rx="2" fill="#fff"/>
             <rect x="13.5" y="7" width="2" height="3" fill="#fff"/>
             <path d="M8 11 Q6 13 8 15" stroke="#fff" stroke-width="1.5" fill="none"/>
             <circle cx="8" cy="13" r="1" fill="#fff"/>`;
  } else if (up.includes('AUTO') || up.includes('VEHICLE') || up.includes('CAR')) {
    inner = `<path d="M8 16 L9 12 L11 10 L17 10 L19 12 L20 16 Z" fill="#fff"/>
             <circle cx="11" cy="17" r="1.8" fill="${color}" stroke="#fff" stroke-width="1"/>
             <circle cx="17" cy="17" r="1.8" fill="${color}" stroke="#fff" stroke-width="1"/>
             <rect x="11" y="11" width="6" height="4" rx="1" fill="${color}"/>`;
  } else if (up.includes('WEAPON') || up.includes('FIREARM')) {
    inner = `<path d="M6 13 L6 16 L15 16 L15 18 L18 18 L18 16 L21 16 L21 14 L18 14 L18 12 L15 12 L15 13 Z" fill="#fff"/>
             <rect x="9" y="16" width="2" height="4" fill="#fff"/>`;
  } else if (up.includes('HOMICIDE') || up.includes('MURDER') || up.includes('MANSL')) {
    inner = `<circle cx="14" cy="13" r="5" fill="#fff"/>
             <rect x="11" y="17" width="6" height="3" rx="1" fill="#fff"/>
             <circle cx="12" cy="13" r="1.5" fill="${color}"/>
             <circle cx="16" cy="13" r="1.5" fill="${color}"/>`;
  } else if (up.includes('SEX') || up.includes('RAPE') || up.includes('MOLEST')) {
    inner = `<path d="M14 7 L20 10 L20 16 Q20 20 14 22 Q8 20 8 16 L8 10 Z" fill="#fff"/>
             <text x="14" y="18" text-anchor="middle" font-size="9" font-weight="bold" fill="${color}">!</text>`;
  } else {
    inner = `<circle cx="14" cy="14" r="5" fill="#fff" opacity="0.9"/>
             <text x="14" y="18" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">!</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    ${inner}
  </svg>`;
}

function meters(mi: number) { return mi * 1609.344; }
function fmtDate(ms: number | null) { return ms ? new Date(ms).toLocaleString() : ''; }

interface Incident {
  attributes: {
    Offense_Datetime: number | null;
    UCR_Category: string; UCR_Description: string;
    Street_Address: string; Latitude: number; Longitude: number; Crime_ID: string;
  };
}
interface GeoResult { lat: number; lon: number; label: string; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeafletMapComponent({ lockedAddress }: { lockedAddress?: string }) {
  const [address,        setAddress]        = useState('');
  const [inputStatus,    setInputStatus]    = useState('');
  const [loading,        setLoading]        = useState(false);
  const [stage,          setStage]          = useState<'input' | 'map'>('input');
  const [matchedAddr,    setMatchedAddr]    = useState('');
  const [incidents,      setIncidents]      = useState<Incident[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<[string, number][]>([]);
  const [activeFilter,   setActiveFilter]   = useState<string | null>(null);
  const [mapStatus,      setMapStatus]      = useState('');
  const [enlarged,       setEnlarged]       = useState(false);

  const mapRef        = useRef<any>(null);
  const bigMapRef     = useRef<any>(null);
  const markersRef    = useRef<any[]>([]);
  const bigMarkersRef = useRef<any[]>([]);
  const geoRef        = useRef<GeoResult | null>(null);
  const LRef          = useRef<any>(null);

  function buildMarkers(L: any, map: any, store: any[]) {
    if (!geoRef.current) return;
    const { lat, lon } = geoRef.current;
    const bounds = L.latLngBounds([[lat, lon]]);
    for (const f of incidents) {
      const a = f.attributes;
      if (typeof a.Latitude !== 'number' || typeof a.Longitude !== 'number') continue;
      const cat = (a.UCR_Category || 'OTHER').trim();
      const marker = L.marker([a.Latitude, a.Longitude], {
        icon: L.divIcon({ html: getIconSvg(cat), className: '', iconSize: [30,30], iconAnchor: [15,15], popupAnchor: [0,-18] }),
      });
      (marker as any)._category = cat;
      (marker as any)._crimeId  = a.Crime_ID;
      (marker as any)._lat      = a.Latitude;
      (marker as any)._lng      = a.Longitude;
      marker.bindPopup(`<div style="font-size:12px;min-width:180px;line-height:1.6">
        <b style="color:${getColor(cat)}">${cat}</b><br>
        ${a.UCR_Description || ''}<br>
        <span style="color:#888">${a.Street_Address || ''}</span><br>
        <span style="opacity:.7;font-size:11px">${fmtDate(a.Offense_Datetime)}</span>
      </div>`);
      marker.addTo(map);
      bounds.extend([a.Latitude, a.Longitude]);
      store.push(marker);
    }
    map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
    if (map.getZoom() < 13) map.setZoom(13);
  }

  // ── Init small map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'map') return;
    let cancelled = false;
    async function init() {
      const L = (await import('leaflet')).default;
      LRef.current = L;
      if (cancelled || !geoRef.current) return;
      const { lat, lon } = geoRef.current;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      markersRef.current = [];
      const map = L.map('ps-map').setView([lat, lon], 14);
      mapRef.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const homeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
        <filter id="ds"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.45"/></filter>
        <path d="M19 2 C10.16 2 3 9.16 3 18 C3 30 19 46 19 46 C19 46 35 30 35 18 C35 9.16 27.84 2 19 2Z"
          fill="#facc15" stroke="#b45309" stroke-width="2" filter="url(#ds)"/>
        <path d="M19 7 L28 15 L26 15 L26 25 L12 25 L12 15 L10 15 Z" fill="#1e3a5f"/>
        <rect x="16" y="19" width="6" height="6" rx="1" fill="#facc15"/>
        <circle cx="19" cy="16" r="1.5" fill="#facc15"/>
      </svg>`;
      L.marker([lat, lon], {
        icon: L.divIcon({ html: homeSvg, className: '', iconSize: [38,48], iconAnchor: [19,46], popupAnchor: [0,-44] }),
        zIndexOffset: 1000,
      }).addTo(map).bindPopup(`<div style="font-size:13px;font-weight:700;color:#1e3a5f">📍 ${geoRef.current.label}</div>`);
      L.circle([lat, lon], { radius: meters(RADIUS_MILES), color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.05, weight: 1.5, dashArray: '4 4' }).addTo(map);
      buildMarkers(L, map, markersRef.current);
      setMapStatus(`${incidents.length} incidents — tap a category to filter`);
    }
    init();
    return () => { cancelled = true; };
  }, [stage, incidents]);

  // ── Init enlarged map ───────────────────────────────────────────────────
  useEffect(() => {
    if (!enlarged || !geoRef.current || !LRef.current) return;
    const L = LRef.current;
    const { lat, lon } = geoRef.current;
    setTimeout(() => {
      if (bigMapRef.current) { bigMapRef.current.remove(); bigMapRef.current = null; }
      bigMarkersRef.current = [];
      const map = L.map('ps-map-big').setView([lat, lon], 14);
      bigMapRef.current = map;
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
      const homeSvg2 = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
        <filter id="ds2"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.45"/></filter>
        <path d="M19 2 C10.16 2 3 9.16 3 18 C3 30 19 46 19 46 C19 46 35 30 35 18 C35 9.16 27.84 2 19 2Z"
          fill="#facc15" stroke="#b45309" stroke-width="2" filter="url(#ds2)"/>
        <path d="M19 7 L28 15 L26 15 L26 25 L12 25 L12 15 L10 15 Z" fill="#1e3a5f"/>
        <rect x="16" y="19" width="6" height="6" rx="1" fill="#facc15"/>
        <circle cx="19" cy="16" r="1.5" fill="#facc15"/>
      </svg>`;
      L.marker([lat, lon], {
        icon: L.divIcon({ html: homeSvg2, className: '', iconSize: [38,48], iconAnchor: [19,46], popupAnchor: [0,-44] }),
        zIndexOffset: 1000,
      }).addTo(map).bindPopup(`<div style="font-size:13px;font-weight:700;color:#1e3a5f">📍 ${geoRef.current!.label}</div>`);
      L.circle([lat, lon], { radius: meters(RADIUS_MILES), color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.05, weight: 1.5, dashArray: '4 4' }).addTo(map);
      buildMarkers(L, map, bigMarkersRef.current);
    }, 100);
    return () => { if (bigMapRef.current) { bigMapRef.current.remove(); bigMapRef.current = null; } };
  }, [enlarged, incidents]);

  // ── Filter ───────────────────────────────────────────────────────────────
  useEffect(() => {
    for (const { map, markers } of [
      { map: mapRef.current,    markers: markersRef.current },
      { map: bigMapRef.current, markers: bigMarkersRef.current },
    ]) {
      if (!map) continue;
      for (const m of markers) {
        const visible = !activeFilter || (m as any)._category === activeFilter;
        if (visible) m.addTo(map); else m.remove();
      }
    }
    const shown = activeFilter
      ? markersRef.current.filter(m => (m as any)._category === activeFilter).length
      : markersRef.current.length;
    setMapStatus(activeFilter
      ? `Showing ${shown} "${activeFilter}" incident${shown !== 1 ? 's' : ''}`
      : `Showing all ${markersRef.current.length} incidents — tap a category to filter`
    );
  }, [activeFilter]);

  // ── Auto-fire when lockedAddress prop arrives from page.tsx ─────────────
  useEffect(() => {
    if (!lockedAddress?.trim()) return;
    setAddress(lockedAddress.trim());
    runSearch(lockedAddress.trim());
  }, [lockedAddress]);

  // ── Search ────────────────────────────────────────────────────────────────
  async function runSearch(raw: string) {
    if (!raw) { setInputStatus('Enter an address.'); return; }
    setLoading(true);
    setInputStatus('Geocoding…');

    let geo: GeoResult;
    try {
      const url = `${GEOCODE_URL}?SingleLine=${encodeURIComponent(raw + CITY_SUFFIX)}&maxLocations=1&outFields=*&f=pjson`;
      const r = await fetch(url);
      const j = await r.json();
      if (!j.candidates?.length) throw new Error('Address not found.');
      geo = { lat: j.candidates[0].location.y, lon: j.candidates[0].location.x, label: j.candidates[0].address };
    } catch (e: any) { setInputStatus(e.message); setLoading(false); return; }

    setInputStatus('Querying MPD…');
    let rawIncidents: Incident[];
    try {
      const end = Date.now(), start = end - WINDOW_DAYS * 86400000;
      const params = new URLSearchParams({
        where: '1=1', geometry: `${geo.lon},${geo.lat}`,
        geometryType: 'esriGeometryPoint', inSR: '4326',
        distance: String(meters(RADIUS_MILES)), units: 'esriSRUnit_Meter',
        outFields: 'Offense_Datetime,UCR_Category,UCR_Description,Street_Address,Latitude,Longitude,Crime_ID',
        orderByFields: 'Offense_Datetime DESC', resultRecordCount: '200',
        returnGeometry: 'false', time: `${start},${end}`, f: 'json',
      });
      const r = await fetch(`${MPD_URL}?${params}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'MPD query failed');
      rawIncidents = j.features || [];
    } catch (e: any) { setInputStatus(`MPD failed: ${e.message}`); setLoading(false); return; }

    const counts: Record<string, number> = {};
    for (const f of rawIncidents) {
      const cat = (f.attributes?.UCR_Category || 'OTHER').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    }
    geoRef.current = geo;
    setMatchedAddr(geo.label);
    setIncidents(rawIncidents);
    setCategoryCounts(Object.entries(counts).sort((a, b) => b[1] - a[1]));
    setActiveFilter(null);
    setLoading(false);
    setStage('map');
  }

  const handleSearch = useCallback(() => runSearch(address.trim()), [address]);

  const handleReset = useCallback(() => {
    if (mapRef.current)    { mapRef.current.remove();    mapRef.current    = null; }
    if (bigMapRef.current) { bigMapRef.current.remove(); bigMapRef.current = null; }
    markersRef.current = []; bigMarkersRef.current = []; geoRef.current = null;
    setStage('input'); setInputStatus(''); setIncidents([]);
    setCategoryCounts([]); setActiveFilter(null); setMapStatus(''); setEnlarged(false);
  }, []);

  // ── Filter bar ────────────────────────────────────────────────────────────
  function FilterBar() {
    const btnBase: React.CSSProperties = {
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'6px 12px', borderRadius:20, fontSize:11, fontWeight:700,
      cursor:'pointer', border:'1.5px solid', whiteSpace:'nowrap',
      transition:'all 0.2s', letterSpacing:0.3,
    };
    const activeLabel = activeFilter
      ? `Showing ${categoryCounts.find(([c]) => c === activeFilter)?.[1] ?? 0} "${activeFilter}" incidents`
      : `Showing ${incidents.length} total incidents`;

    return (
      <div>
        {/* Summary line */}
        <p style={{ fontSize:12, color:'#94a3b8', fontWeight:600, margin:'0 0 10px',
          padding:'6px 10px', background:'rgba(34,211,238,0.06)',
          borderRadius:10, border:'1px solid rgba(34,211,238,0.12)' }}>
          {activeLabel}
        </p>
        {/* All button */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:8 }}>
          <button onClick={() => setActiveFilter(null)} style={{
            ...btnBase,
            background: activeFilter === null ? 'linear-gradient(90deg,#22d3ee,#3b82f6)' : 'rgba(34,211,238,0.07)',
            borderColor: activeFilter === null ? '#22d3ee' : 'rgba(34,211,238,0.2)',
            color: activeFilter === null ? '#0a1628' : '#22d3ee',
            boxShadow: activeFilter === null ? '0 2px 12px rgba(34,211,238,0.35)' : 'none',
          }}>
            All
            <span style={{
              background: activeFilter === null ? 'rgba(0,0,0,0.2)' : 'rgba(34,211,238,0.15)',
              borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:800,
            }}>{incidents.length}</span>
          </button>

          {/* Category buttons */}
          {categoryCounts.map(([cat, count]) => {
            const color = getColor(cat);
            const isActive = activeFilter === cat;
            // Assign a lavender tint to non-active buttons for variety
            const lavender = '#a855f7';
            return (
              <button key={cat} onClick={() => setActiveFilter(isActive ? null : cat)} style={{
                ...btnBase,
                background: isActive ? color + '28' : 'rgba(168,85,247,0.08)',
                borderColor: isActive ? color : 'rgba(168,85,247,0.3)',
                color: isActive ? color : '#c4b5fd',
                boxShadow: isActive ? `0 2px 10px ${color}44` : 'none',
              }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background: isActive ? color : lavender, flexShrink:0, display:'inline-block' }}/>
                {cat}
                <span style={{
                  background: isActive ? color + '33' : 'rgba(168,85,247,0.2)',
                  borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:800,
                  color: isActive ? color : '#e9d5ff',
                }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render: input ─────────────────────────────────────────────────────────
  if (stage === 'input') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <p style={{ fontSize:11, color:'#64748b' }}>Street number and name — no Rd, St, Ave, or Cove. Type <span style={{color:'#e2e8f0'}}>Macon</span>, not Macon Road.</p>
        <div style={{ display:'flex', gap:8 }}>
          <input
            type="text"
            placeholder="4128 Weymouth"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            style={{ flex:1, padding:'10px 14px', borderRadius:12, fontSize:13,
              background:'rgba(255,255,255,0.06)', border:'1px solid rgba(34,211,238,0.3)',
              color:'white', outline:'none' }}
          />
          <button onClick={handleSearch} disabled={loading} style={{
            padding:'10px 16px', borderRadius:12, fontSize:13, fontWeight:700,
            color:'white', border:'none', cursor: loading ? 'not-allowed' : 'pointer',
            background:'linear-gradient(90deg,#22d3ee,#3b82f6)',
            opacity: loading ? 0.6 : 1, whiteSpace:'nowrap',
            boxShadow:'0 4px 15px rgba(34,211,238,0.3)',
          }}>
            {loading ? 'Searching…' : 'Check address'}
          </button>
        </div>
        {inputStatus && <p style={{ fontSize:11, color:'#64748b' }}>{inputStatus}</p>}
      </div>
    );
  }

  // ── Fly map to incident ───────────────────────────────────────────────────
  function flyToIncident(crimeId: string, lat: number, lng: number) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lng], 17, { animate: true, duration: 0.8 });
    const marker = markersRef.current.find(m => (m as any)._crimeId === crimeId);
    if (marker) setTimeout(() => marker.openPopup(), 850);
    // Scroll map into view
    const el = document.getElementById('ps-map');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Incident grid accordion ───────────────────────────────────────────────
  function IncidentAccordion() {
    const [open, setOpen] = useState(true);
    const filtered = activeFilter
      ? incidents.filter(f => (f.attributes.UCR_Category || 'OTHER').trim() === activeFilter)
      : incidents;
    const label = activeFilter
      ? `${activeFilter} — ${filtered.length} incident${filtered.length !== 1 ? 's' : ''}`
      : `All incidents — ${filtered.length}`;

    return (
      <div style={{
        borderRadius:20,
        border: open ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(168,85,247,0.35)',
        background:'linear-gradient(135deg,#0f1f3d,#0a1628)',
        overflow:'hidden',
        boxShadow: open ? '0 4px 24px rgba(34,211,238,0.10)' : '0 4px 24px rgba(0,0,0,0.35)',
      }}>
        {/* Accordion header */}
        <button onClick={() => setOpen(o => !o)} style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 16px',
          background: open ? 'rgba(34,211,238,0.06)' : 'transparent',
          border:'none', cursor:'pointer', textAlign:'left',
        }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#f1f5f9' }}>
            📋 {label}
          </span>
          <span style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:32, height:32, borderRadius:'50%',
            background: open
              ? 'linear-gradient(135deg,#22d3ee,#3b82f6)'
              : 'linear-gradient(135deg,#a855f7,#7c3aed)',
            color:'white', fontSize:20, fontWeight:900, lineHeight:1,
            boxShadow: open ? '0 0 12px rgba(34,211,238,0.5)' : '0 0 12px rgba(168,85,247,0.5)',
            flexShrink:0,
          }}>{open ? '−' : '+'}</span>
        </button>

        {/* Incident grid */}
        {open && (
          <div style={{ padding:'4px 12px 14px', borderTop:'1px solid rgba(34,211,238,0.12)' }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize:12, color:'#475569', padding:'12px 4px' }}>No incidents found.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8 }}>
                {filtered.map((f, i) => {
                  const a = f.attributes;
                  const cat = (a.UCR_Category || 'OTHER').trim();
                  const color = getColor(cat);
                  const date = a.Offense_Datetime
                    ? new Date(a.Offense_Datetime).toLocaleDateString('en-US', { month:'short', day:'numeric' })
                    : '';
                  const hasCoords = typeof a.Latitude === 'number' && typeof a.Longitude === 'number';
                  return (
                    <div key={a.Crime_ID || i}
                      onClick={() => hasCoords && flyToIncident(a.Crime_ID, a.Latitude, a.Longitude)}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        background:'rgba(255,255,255,0.04)',
                        border:`1px solid ${color}22`,
                        borderLeft:`3px solid ${color}`,
                        borderRadius:8, padding:'5px 10px',
                        cursor: hasCoords ? 'pointer' : 'default',
                        transition:'background 0.15s',
                      }}
                      onMouseEnter={e => { if (hasCoords) (e.currentTarget as HTMLDivElement).style.background = `${color}15`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    >
                      {/* Pin icon */}
                      {hasCoords && (
                        <span style={{ fontSize:12, flexShrink:0, opacity:0.8 }}>📍</span>
                      )}
                      {/* Address */}
                      <span style={{ flex:1, fontSize:11, color:'#e2e8f0', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {a.Street_Address || '—'}
                      </span>
                      {/* Date */}
                      <span style={{ fontSize:10, color:'#475569', flexShrink:0 }}>{date}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render: map ───────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Top row: address + controls */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <span style={{ fontSize:12, fontWeight:600, color:'#94a3b8' }}>{matchedAddr}</span>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setEnlarged(true)} style={{
            fontSize:11, color:'#22d3ee', border:'1px solid rgba(34,211,238,0.3)',
            borderRadius:8, padding:'5px 12px', background:'rgba(34,211,238,0.07)', cursor:'pointer', fontWeight:600 }}>⛶ Enlarge</button>
          <button onClick={handleReset} style={{
            fontSize:11, color:'#94a3b8', border:'1px solid rgba(255,255,255,0.12)',
            borderRadius:8, padding:'5px 12px', background:'transparent', cursor:'pointer' }}>← New address</button>
        </div>
      </div>

      {/* 1. Filter buttons — always visible */}
      {categoryCounts.length > 0 && <FilterBar />}

      {/* 2. Map — always visible, never inside accordion */}
      <div id="ps-map" style={{ width:'100%', borderRadius:16, border:'2px solid rgba(34,211,238,0.3)', overflow:'hidden', height:400, minHeight:400 }} />

      {/* 3. Incident grid accordion — starts open, filters with map */}
      {incidents.length > 0 && <IncidentAccordion />}

      {/* Enlarged fullscreen */}
      {enlarged && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", flexDirection:"column", background:"#050d1f" }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'linear-gradient(135deg,#0f1f3d,#0a1628)', borderBottom:'1px solid rgba(34,211,238,0.15)', flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#f1f5f9' }}>{matchedAddr}</span>
            <button onClick={() => setEnlarged(false)} style={{ fontSize:11, color:'#22d3ee', border:'1px solid rgba(34,211,238,0.3)', borderRadius:8, padding:'6px 14px', background:'rgba(34,211,238,0.08)', cursor:'pointer', fontWeight:700 }}>✕ Close</button>
          </div>
          <div style={{ padding:'10px 12px', background:'linear-gradient(135deg,#0f1f3d,#0a1628)', borderBottom:'1px solid rgba(34,211,238,0.10)', flexShrink:0, overflowX:'auto' }}>
            <FilterBar />
          </div>
          <div id="ps-map-big" style={{ flex:1, width:'100%' }} />
        </div>
      )}
    </div>
  );
}

