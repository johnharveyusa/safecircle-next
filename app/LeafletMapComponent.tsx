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
      L.circleMarker([lat, lon], { radius: 10, fillColor: '#2563eb', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map).bindPopup(`<b>Address</b><br>${geoRef.current.label}`);
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
      L.circleMarker([lat, lon], { radius: 10, fillColor: '#2563eb', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(map).bindPopup(`<b>Address</b><br>${geoRef.current!.label}`);
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
    return (
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setActiveFilter(null)}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFilter === null ? 'bg-slate-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
          All
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeFilter === null ? 'bg-white/20' : 'bg-slate-700 text-slate-400'}`}>{incidents.length}</span>
        </button>
        {categoryCounts.map(([cat, count]) => {
          const color = getColor(cat); const isActive = activeFilter === cat;
          return (
            <button key={cat} onClick={() => setActiveFilter(isActive ? null : cat)}
              style={isActive ? { backgroundColor: color, borderColor: color } : {}}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isActive ? 'text-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`}>
              <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? '#fff' : color }}/>
              {cat}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Render: input ─────────────────────────────────────────────────────────
  if (stage === 'input') {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">Street number and name — no Rd, St, Ave, or Cove. Type <span className="text-slate-200">Macon</span>, not Macon Road.</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="4128 Weymouth"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button onClick={handleSearch} disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors whitespace-nowrap">
            {loading ? 'Searching…' : 'Check address'}
          </button>
        </div>
        {inputStatus && <p className="text-xs text-slate-400">{inputStatus}</p>}
      </div>
    );
  }

  // ── Render: map ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium text-slate-200">{matchedAddr}</span>
        <div className="flex gap-2">
          <button onClick={() => setEnlarged(true)} className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 transition-colors">⛶ Enlarge</button>
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 transition-colors">← New address</button>
        </div>
      </div>

      {mapStatus && <p className="text-xs text-slate-400">{mapStatus}</p>}
      {categoryCounts.length > 0 && <FilterBar />}

      <div id="ps-map" className="w-full rounded-xl border border-slate-700 overflow-hidden" style={{ height: '360px' }} />

      {categoryCounts.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {categoryCounts.map(([cat]) => (
            <span key={cat} className="flex items-center gap-1 text-xs text-slate-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(cat) }}/>
              {cat}
            </span>
          ))}
        </div>
      )}

      {enlarged && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
            <span className="text-sm font-medium text-slate-200">{matchedAddr}</span>
            <button onClick={() => setEnlarged(false)} className="text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5">✕ Close</button>
          </div>
          <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
            <FilterBar />
          </div>
          <div id="ps-map-big" className="flex-1 w-full" />
        </div>
      )}
    </div>
  );
}
