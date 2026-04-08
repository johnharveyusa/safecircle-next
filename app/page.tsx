'use client';

import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Incident {
  latitude?: string;
  longitude?: string;
  offense_description?: string;
  offense?: string;
  incident_date?: string;
  incident_time?: string;
}

const SafeCircleMap: React.FC = () => {
  const [streetNumber, setStreetNumber] = useState('4128');
  const [streetName, setStreetName] = useState('Weymouth Cove');
  const [inTransit, setInTransit] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [fullAddress, setFullAddress] = useState('');
  const [wasInTransit, setWasInTransit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callTime, setCallTime] = useState('');

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const getColor = (offense: string = ''): string => {
    const lower = offense.toLowerCase();
    if (lower.includes('assault') || lower.includes('robbery') || lower.includes('homicide') || lower.includes('weapon')) return '#ef4444';
    if (lower.includes('burglary') || lower.includes('theft') || lower.includes('larceny') || lower.includes('vandalism')) return '#f59e0b';
    if (lower.includes('fraud') || lower.includes('drug') || lower.includes('narcotic')) return '#8b5cf6';
    return '#6b7280';
  };

  const runSafetyCheck = async () => {
    const address = `${streetNumber} ${streetName}, Memphis, TN`.trim();
    setFullAddress(address);
    setWasInTransit(inTransit);
    setCallTime(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }));
    setShowMap(true);
    setLoading(true);

    const defaultLat = 35.1728;
    const defaultLng = -89.9625;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    if (!mapContainerRef.current) {
      setLoading(false);
      return;
    }

    const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 16);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap • Memphis PD Data',
    }).addTo(map);

    L.marker([defaultLat, defaultLng])
      .addTo(map)
      .bindPopup(`<b>${address}</b><br>Destination`)
      .openPopup();

    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 90);
      const dateStr = sinceDate.toISOString().split('T')[0];

      const apiUrl = `https://data.memphistn.gov/resource/12b51ce4-d5a1-4493-ab6c-c05d32e0c1ee.json?$limit=300&$where=incident_date >= '${dateStr}' AND latitude BETWEEN ${defaultLat - 0.015} AND ${defaultLat + 0.015} AND longitude BETWEEN ${defaultLng - 0.02} AND ${defaultLng + 0.02}`;

      const response = await fetch(apiUrl);
      const incidents: Incident[] = await response.json();

      incidents.forEach((inc) => {
        if (!inc.latitude || !inc.longitude) return;

        const lat = parseFloat(inc.latitude);
        const lng = parseFloat(inc.longitude);
        const offenseDesc = inc.offense_description || inc.offense || 'Incident';
        const color = getColor(offenseDesc);

        const iconHtml = `<div style="background:${color}; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:bold; box-shadow:0 0 0 3px rgba(255,255,255,0.8);">
          ${color === '#ef4444' ? 'V' : color === '#f59e0b' ? 'P' : color === '#8b5cf6' ? 'F' : 'O'}
        </div>`;

        const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [26, 26] });

        L.marker([lat, lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(`
            <b style="color:${color}">${offenseDesc}</b><br>
            ${inc.incident_date ? new Date(inc.incident_date).toLocaleDateString() : ''}
            ${inc.incident_time || ''}<br>
            <small>MPD Reported Incident</small>
          `);
      });
    } catch (error) {
      console.error('MPD data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetPage = () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setShowMap(false);
    setWasInTransit(false);
  };

  useEffect(() => {
    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-semibold text-gray-900">Safe Circle</h1>
          <p className="text-lg text-gray-600">Memphis / Shelby County • Real MPD Crime Icons</p>
        </div>
        {showMap && (
          <button onClick={resetPage} className="px-6 py-3 bg-white border border-gray-300 rounded-2xl hover:bg-gray-100">
            ← New Address
          </button>
        )}
      </div>

      {!showMap ? (
        <div className="bg-white rounded-3xl p-8 shadow-sm border">
          <h2 className="text-2xl font-semibold text-center mb-6">Enter Street Number &amp; Street Name</h2>
          <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Number</label>
              <input
                type="text"
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Name</label>
              <input
                type="text"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 text-lg"
              />
            </div>
          </div>

          <div className="max-w-md mx-auto mt-6">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setInTransit(!inTransit)}
                className={`relative w-12 h-6 rounded-full transition-colors ${inTransit ? 'bg-orange-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${inTransit ? 'translate-x-6' : ''}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                I am currently en route to this address
              </span>
            </label>
            {inTransit && (
              <p className="mt-2 text-xs text-orange-600 font-medium">
                This check will be labeled as an In-Transit Call
              </p>
            )}
          </div>

          <button
            onClick={runSafetyCheck}
            disabled={loading}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-5 rounded-3xl text-xl shadow-lg transition-all"
          >
            {loading ? 'Loading Real Crime Data...' : 'Run Safety Check → Show Crime Map with Icons'}
          </button>
          <p className="text-center text-xs text-gray-400 mt-4">Integrates with Memphis PD Public Safety Incidents</p>
        </div>
      ) : (
        <div>
          {wasInTransit && (
            <div className="mb-4 flex items-center gap-3 bg-orange-50 border border-orange-300 rounded-2xl px-5 py-3">
              <span className="text-orange-500 text-xl">🚗</span>
              <div>
                <p className="text-orange-700 font-semibold text-sm uppercase tracking-wide">In-Transit Call</p>
                <p className="text-orange-600 text-xs">Worker was en route when this check was run • {callTime}</p>
              </div>
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-3xl font-semibold">
              {streetNumber} <span className="text-blue-600">{streetName}</span>
            </h2>
            <p className="text-gray-600">Mapped: {fullAddress}</p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 bg-white p-4 rounded-2xl text-sm shadow-sm">
            <div className="flex items-center gap-2"><span className="w-5 h-5 bg-red-500 rounded-full inline-block"></span> Violent</div>
            <div className="flex items-center gap-2"><span className="w-5 h-5 bg-orange-500 rounded-full inline-block"></span> Property</div>
            <div className="flex items-center gap-2"><span className="w-5 h-5 bg-purple-500 rounded-full inline-block"></span> Fraud/Drug</div>
            <div className="flex items-center gap-2"><span className="w-5 h-5 bg-gray-400 rounded-full inline-block"></span> Other</div>
          </div>

          <div ref={mapContainerRef} className="h-[620px] rounded-3xl overflow-hidden shadow-sm mb-6" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="https://www.nsopw.gov/" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-2xl border text-center hover:border-purple-200">🔎 Sex Offender Registry</a>
            <a href="https://warrants.shelby-sheriff.org/" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-2xl border text-center hover:border-amber-200">⚖️ Warrant Search</a>
            <a href="https://data.memphistn.gov/datasets/MEMEGIS::mpd-public-safety-incidents-1/explore" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-2xl border text-center hover:border-blue-200">📊 Full MPD Dataset</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafeCircleMap;
