"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LeafletMapProps {
  lat: number | null;
  lon: number | null;
  incidents: any[];
  matchedAddress: string;
}

export default function LeafletMapComponent({
  lat,
  lon,
  incidents,
  matchedAddress,
}: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const radiusMiles = 0.5;
  const psMeters = (mi: number) => mi * 1609.344;

  const getCrimeColor = (category?: string): string => {
    const cat = (category || "").toUpperCase();
    if (
      cat.includes("ROBBERY") ||
      cat.includes("HOMICIDE") ||
      cat.includes("VIOLENT")
    )
      return "#ef4444";
    if (
      cat.includes("BURGLARY") ||
      cat.includes("THEFT") ||
      cat.includes("VANDAL") ||
      cat.includes("PROPERTY")
    )
      return "#f59e0b";
    if (cat.includes("FRAUD")) return "#8b5cf6";
    return "#64748b";
  };

  const escapeHtml = (s: string | undefined) =>
    (s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
          c
        ] || c)
    );

  const fmtDate = (ms?: number) =>
    ms
      ? new Date(ms).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView(
      [35.1495, -90.049],
      14
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(mapRef.current);

    layerGroupRef.current = L.layerGroup().addTo(mapRef.current);
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current || !lat || !lon) return;

    layerGroupRef.current.clearLayers();
    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    const center = L.latLng(lat, lon);
    mapRef.current.setView(center, 15);

    // Address marker (green)
    L.circleMarker(center, { radius: 9, color: "#22c55e", fillOpacity: 0.9 })
      .addTo(layerGroupRef.current)
      .bindPopup(
        `<b>Visit Address</b><br>${escapeHtml(matchedAddress)}`
      );

    // Half-mile radius circle
    circleRef.current = L.circle(center, {
      radius: psMeters(radiusMiles),
      color: "#64748b",
      weight: 2,
      opacity: 0.08,
      fillOpacity: 0.08,
    }).addTo(layerGroupRef.current);

    // Crime icons with UCR_Category color coding
    incidents.forEach((f) => {
      const a = f.attributes || {};
      if (typeof a.Latitude !== "number" || typeof a.Longitude !== "number")
        return;

      const point = L.latLng(a.Latitude, a.Longitude);
      const color = getCrimeColor(a.UCR_Category);

      const popupHTML = `
        <div style="font-size:13px;line-height:1.4;">
          <span style="display:inline-block;width:10px;height:10px;background:${color};border-radius:50%;border:2px solid white;"></span>
          <b>${escapeHtml(a.UCR_Category)}</b><br>
          ${escapeHtml(a.UCR_Description)}<br>
          ${escapeHtml(a.Street_Address)}<br>
          <span style="opacity:0.85">${fmtDate(a.Offense_Datetime)}</span>
        </div>`;

      L.circleMarker(point, {
        radius: 8,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .addTo(layerGroupRef.current!)
        .bindPopup(popupHTML);
    });
  }, [lat, lon, incidents, matchedAddress]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[520px] rounded-2xl border border-slate-700 overflow-hidden bg-slate-900"
    />
  );
}
