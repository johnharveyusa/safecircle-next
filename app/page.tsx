'use client';

import React, { useState, useEffect } from 'react';

const GEOCODE_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const MPD_QUERY_URL = "https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0/query";

interface Incident {
  attributes: {
    Offense_Datetime?: number;
    UCR_Category?: string;
    UCR_Description?: string;
    Street_Address?: string;
    Latitude?: number;
    Longitude?: number;
  };
}

export default function SafeCirclePublicSafety() {
  const [address, setAddress] = useState("4128 Weymouth Cove, Memphis, TN");
  const [geoStatus, setGeoStatus] = useState("");
  const [subStatus, setSubStatus] = useState("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [matchedAddress, setMatchedAddress] = useState("");
  const [sexOffenderLink, setSexOffenderLink] = useState("");

  const radiusMiles = 0.5;
  const windowDays = 14;

  const psMeters = (mi: number) => mi * 1609.344;

  const escapeHtml = (s: string | undefined) => 
    (s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c] || c));

  const fmtDate = (ms?: number) => 
    ms ? new Date(ms).toLocaleString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric', 
        hour: 'numeric', minute: '2-digit' 
      }) : "";

  const getCrimeColor = (category?: string) => {
    const cat = (category || "").toUpperCase();
    if (cat.includes("ASSAULT") || cat.includes("ROBBERY") || cat.includes("HOMICIDE") || cat.includes("VIOLENT")) return "#ef4444";   // Red - Violent
    if (cat.includes("BURGLARY") || cat.includes("THEFT") || cat.includes("VANDAL") || cat.includes("PROPERTY")) return "#f59e0b"; // Orange - Property
    if (cat.includes("FRAUD")) return "#8b5cf6"; // Purple
    return "#64748b"; // Gray - Other
  };

  const geocodeAddress = async () => {
    if (!address.trim()) {
      setGeoStatus("Please enter an address.");
      return false;
    }
    setGeoStatus("Geocoding…");
    try {
      const url = `${GEOCODE_URL}?SingleLine=${encodeURIComponent(address)}&maxLocations=1&outFields=*&f=pjson`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.candidates?.length) {
        setGeoStatus("No match found.");
        return false;
      }

      const best = data.candidates[0];
      setLat(best.location.y);
      setLon(best.location.x);
      setMatchedAddress(best.address);
      setGeoStatus(`Mapped: ${best.address} (score ${best.score})`);

      const nsopwBase = "https://www.nsopw.gov/search-public-sex-offender-registries";
      setSexOffenderLink(`${nsopwBase}?address=${encodeURIComponent(best.address)}`);

      return true;
    } catch (err) {
      console.error(err);
      setGeoStatus("Geocoding failed.");
      return false;
    }
  };

  const loadPublicSafety = async () => {
    setSubStatus("Loading reported offenses...");
    const success = await geocodeAddress();
    if (!success || !lat || !lon) {
      setSubStatus("Address not mapped.");
      return;
    }

    const end = Date.now();
    const start = end - (windowDays * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      where: "1=1",
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      distance: psMeters(radiusMiles).toString(),
      units: "esriSRUnit_Meter",
      outFields: "Offense_Datetime,UCR_Category,UCR_Description,Street_Address,Latitude,Longitude",
      orderByFields: "Offense_Datetime DESC",
      resultRecordCount: "200",
      returnGeometry: "true",
      time: `${start},${end}`,
      f: "json"
    });

    try {
      const url = `${MPD_QUERY_URL}?${params.toString()}`;
      console.log("Querying MPD:", url);
      const res = await fetch(url);
      const json = await res.json();

      if (json.error) {
        setSubStatus(`Query error: ${json.error.message}`);
        console.error(json.error);
        return;
      }

      const features = json.features || [];
      setIncidents(features);
      setSubStatus(`Loaded ${features.length} reported offenses within ½ mile.`);
    } catch (err) {
      console.error(err);
      setSubStatus("Network or query error - check console.");
    }
  };

  // Auto load when page opens
  useEffect(() => {
    const timer = setTimeout(() => loadPublicSafety(), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Safe Circle - Memphis Public Safety</h1>
        <p className="text-slate-400 mb-6">½-mile radius around address • Colored icons by offense type</p>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter Memphis / Shelby County address"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-600"
            onKeyDown={(e) => e.key === "Enter" && loadPublicSafety()}
          />
          <button
            onClick={loadPublicSafety}
            className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-medium transition-colors"
          >
            Run Safety Check
          </button>
        </div>

        <div className="text-emerald-400 mb-2">{geoStatus}</div>
        <div className="text-sm mb-8 font-medium">{subStatus}</div>

        {/* Legend for colored icons */}
        <div className="mb-6 p-4 bg-slate-900 border border-slate-700 rounded-xl text-sm">
          <strong>Crime Icon Colors:</strong><br />
          🔴 <span className="text-red-500">Red</span> = Violent (Assault, Robbery, Homicide...)<br />
          🟠 <span className="text-orange-400">Orange</span> = Property (Burglary, Theft, Vandalism...)<br />
          🟣 Purple = Fraud<br />
          ⚪ Gray = Other
        </div>

        {/* Reported Offenses Table */}
        {incidents.length > 0 && (
          <div className="mb-10 overflow-auto rounded-xl border border-slate-700 bg-slate-950/30">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Address</th>
                </tr>
              </thead>
              <tbody>
                {incidents.slice(0, 40).map((f, i) => {
                  const a = f.attributes || {};
                  const color = getCrimeColor(a.UCR_Category);
                  return (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-900/50">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(a.Offense_Datetime)}</td>
                      <td className="px-4 py-3 font-medium" style={{ color }}>
                        {escapeHtml(a.UCR_Category)}
                      </td>
                      <td className="px-4 py-3">{escapeHtml(a.UCR_Description)}</td>
                      <td className="px-4 py-3">{escapeHtml(a.Street_Address)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* National Sex Offender Check */}
        {sexOffenderLink && (
          <div className="mb-10 p-6 bg-rose-950/40 border border-rose-800 rounded-2xl">
            <h3 className="text-amber-300 font-semibold mb-3">National Sex Offender Registry Check</h3>
            <p className="text-slate-400 mb-4 text-sm">
              Official check for the area (½ mile). Always verify on the government site.
            </p>
            <a
              href={sexOffenderLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 px-6 py-3 rounded-lg text-white font-medium transition-colors"
            >
              Open Official NSOPW Address Search →
            </a>
          </div>
        )}

        <div className="text-xs text-slate-500 mt-8">
          Test address: 4128 Weymouth Cove, Memphis, TN<br />
          Data from Memphis Police Department (updated daily)
        </div>
      </div>
    </div>
  );
}