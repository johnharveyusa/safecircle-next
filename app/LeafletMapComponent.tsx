'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────

const GEOCODE_URL =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const MPD_URL =
  'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0/query';
const RADIUS_MILES = 0.5;
const WINDOW_DAYS  = 14;
const CITY_SUFFIX  = ', Memphis, TN';

// ─── UCR category → hex color ─────────────────────────────────────────────

const UCR_COLORS: Record<string, string> = {
  DRUGS:     '#e05c2a',
  ASSAULT:   '#c0392b',
  THEFT:     '#2980b9',
  BURGLARY:  '#8e44ad',
  ROBBERY:   '#922b21',
  VANDALISM: '#f39c12',
  AUTO:      '#16a085',
  WEAPONS:   '#6d1f1f',
  HOMICIDE:  '#1a1a1a',
  SEX:       '#76448a',
  OTHER:     '#7f8c8d',
};

function getColor(cat: string): string {
  if (!cat) return UCR_COLORS.OTHER;
  const up = cat.toUpperCase();
  for (const [k, v] of Object.entries(UCR_COLORS)) {
    if (up.includes(k)) return v;
  }
  return UCR_COLORS.OTHER;
}

function meters(mi: number) { return mi * 1609.344; }

function fmtDate(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Incident {
  attributes: {
    Offense_Datetime: number | null;
    UCR_Category:     string;
    UCR_Description:  string;
    Street_Address:   string;
    Latitude:         number;
    Longitude:        number;
    Crime_ID:         string;
  };
}

interface GeoResult {
  lat:   number;
  lon:   number;
  label: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LeafletMapComponent() {
  // Address entry state
  const [streetNum,  setStreetNum]  = useState('4128');
  const [streetName, setStreetName] = useState('Weymouth Cove');
  const [inputStatus, setInputStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Map / results state
  const [stage, setStage]           = useState<'input' | 'map'>('input');
  const [matchedAddr, setMatchedAddr] = useState('');
  const [incidents,   setIncidents]   = useState<Incident[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<[string, number][]>([]);
  const [activeFilter, setActiveFilter]     = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState('');

  // Leaflet refs — never stored in React state (causes SSR issues)
  const mapRef     = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geoRef     = useRef<GeoResult | null>(null);

  // ── Build Leaflet map once stage === 'map' ──────────────────────────────
  useEffect(() => {
    if (stage !== 'map') return;

    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !geoRef.current) return;
      const { lat, lon } = geoRef.current;

      // Destroy previous map if any
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];

      const map = L.map('ps-map').setView([lat, lon], 14);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Address marker
      L.circleMarker([lat, lon], {
        radius: 9, fillColor: '#2563eb', color: '#fff', weight: 2, fillOpacity: 1,
      }).addTo(map).bindPopup(`<b>Address</b><br>${geoRef.current.label}`);

      // Radius ring
      L.circle([lat, lon], {
        radius: meters(RADIUS_MILES),
        color: '#2563eb', fillColor: '#2563eb',
        fillOpacity: 0.05, weight: 1.5, dashArray: '4 4',
      }).addTo(map);

      // Incident markers
      const bounds = L.latLngBounds([[lat, lon]]);
      const stored: any[] = [];

      for (const f of incidents) {
        const a = f.attributes;
        if (typeof a.Latitude !== 'number' || typeof a.Longitude !== 'number') continue;
        const cat   = (a.UCR_Category || 'OTHER').trim();
        const color = getColor(cat);

        const icon = L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7" fill="${color}" stroke="#fff" stroke-width="2"/>
          </svg>`,
          className: '',
          iconSize:    [20, 20],
          iconAnchor:  [10, 10],
          popupAnchor: [0, -12],
        });

        const marker = L.marker([a.Latitude, a.Longitude], { icon });
        (marker as any)._category = cat;

        marker.bindPopup(`
          <div style="font-size:12px;min-width:160px">
            <b>${cat}</b><br>
            ${a.UCR_Description || ''}<br>
            ${a.Street_Address  || ''}<br>
            <span style="opacity:.75">${fmtDate(a.Offense_Datetime)}</span>
          </div>
        `);

        marker.addTo(map);
        bounds.extend([a.Latitude, a.Longitude]);
        stored.push(marker);
      }

      markersRef.current = stored;

      map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
      if (map.getZoom() < 13) map.setZoom(13);

      setMapStatus(`${incidents.length} incidents — tap a category to filter`);
    }

    init();
    return () => { cancelled = true; };
  }, [stage, incidents]);

  // ── Apply filter whenever activeFilter changes ──────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    let shown = 0;

    for (const m of markersRef.current) {
      const visible = !activeFilter || (m as any)._category === activeFilter;
      if (visible) { m.addTo(map); shown++; }
      else          { m.remove(); }
    }

    setMapStatus(
      activeFilter
        ? `Showing ${shown} "${activeFilter}" incident${shown !== 1 ? 's' : ''}`
        : `Showing all ${markersRef.current.length} incidents — tap a category to filter`
    );
  }, [activeFilter]);

  // ── Search handler ───────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const num  = streetNum.trim();
    const name = streetName.trim();
    if (!num || !name) {
      setInputStatus('Please enter both a street number and street name.');
      return;
    }

    const fullAddr = `${num} ${name}${CITY_SUFFIX}`;
    setLoading(true);
    setInputStatus('Geocoding address…');

    let geo: GeoResult;
    try {
      const url = `${GEOCODE_URL}?SingleLine=${encodeURIComponent(fullAddr)}&maxLocations=1&outFields=*&f=pjson`;
      const r   = await fetch(url);
      const j   = await r.json();
      if (!j.candidates?.length) throw new Error('Address not found — check street number and name.');
      geo = {
        lat:   j.candidates[0].location.y,
        lon:   j.candidates[0].location.x,
        label: j.candidates[0].address,
      };
    } catch (e: any) {
      setInputStatus(e.message);
      setLoading(false);
      return;
    }

    setInputStatus('Querying MPD incidents…');

    let rawIncidents: Incident[];
    try {
      const end   = Date.now();
      const start = end - WINDOW_DAYS * 86400000;
      const params = new URLSearchParams({
        where:             '1=1',
        geometry:          `${geo.lon},${geo.lat}`,
        geometryType:      'esriGeometryPoint',
        inSR:              '4326',
        distance:          String(meters(RADIUS_MILES)),
        units:             'esriSRUnit_Meter',
        outFields:         'Offense_Datetime,UCR_Category,UCR_Description,Street_Address,Latitude,Longitude,Crime_ID',
        orderByFields:     'Offense_Datetime DESC',
        resultRecordCount: '200',
        returnGeometry:    'false',
        time:              `${start},${end}`,
        f:                 'json',
      });
      const r = await fetch(`${MPD_URL}?${params}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'MPD query failed');
      rawIncidents = j.features || [];
    } catch (e: any) {
      setInputStatus(`MPD query failed: ${e.message}`);
      setLoading(false);
      return;
    }

    // Build category counts once
    const counts: Record<string, number> = {};
    for (const f of rawIncidents) {
      const cat = (f.attributes?.UCR_Category || 'OTHER').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    geoRef.current = geo;
    setMatchedAddr(geo.label);
    setIncidents(rawIncidents);
    setCategoryCounts(sorted);
    setActiveFilter(null);
    setLoading(false);
    setStage('map');
  }, [streetNum, streetName]);

  const handleReset = useCallback(() => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    markersRef.current = [];
    geoRef.current     = null;
    setStage('input');
    setInputStatus('');
    setIncidents([]);
    setCategoryCounts([]);
    setActiveFilter(null);
    setMapStatus('');
  }, []);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (stage === 'input') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-200 mb-1">Enter a Shelby County address</p>
          <p className="text-xs text-slate-400 mb-3">Street number and street name only.</p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="4128"
              value={streetNum}
              onChange={e => setStreetNum(e.target.value)}
              onKeyDown={onKey}
              className="w-20 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Weymouth Cove"
              value={streetName}
              onChange={e => setStreetName(e.target.value)}
              onKeyDown={onKey}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Examples: &nbsp;123 Main &nbsp;·&nbsp; 4128 Weymouth Cove &nbsp;·&nbsp; 2714 Union Ave
          </p>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
        >
          {loading ? 'Searching…' : 'Check address'}
        </button>

        {inputStatus && (
          <p className="text-xs text-slate-400">{inputStatus}</p>
        )}
      </div>
    );
  }

  // ── Map stage ─────────────────────────────────────────────────────────────
  const allCategories = categoryCounts.map(([cat]) => cat);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium text-slate-200">{matchedAddr}</span>
        <button
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          ← New address
        </button>
      </div>

      {/* Status */}
      {mapStatus && (
        <p className="text-xs text-slate-400">{mapStatus}</p>
      )}

      {/* Filter buttons */}
      {categoryCounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {/* All button */}
          <button
            onClick={() => setActiveFilter(null)}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === null
                ? 'bg-slate-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeFilter === null ? 'bg-white/20' : 'bg-slate-700 text-slate-400'
            }`}>
              {incidents.length}
            </span>
          </button>

          {/* Category buttons — built once, never re-render on filter */}
          {categoryCounts.map(([cat, count]) => {
            const color   = getColor(cat);
            const isActive = activeFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(isActive ? null : cat)}
                style={isActive ? { backgroundColor: color, borderColor: color } : {}}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {cat}
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Map container */}
      <div
        id="ps-map"
        className="w-full rounded-xl border border-slate-700 overflow-hidden"
        style={{ height: '360px' }}
      />

      {/* Legend */}
      {allCategories.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {allCategories.map(cat => (
            <span key={cat} className="flex items-center gap-1 text-xs text-slate-400">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: getColor(cat) }}
              />
              {cat}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
