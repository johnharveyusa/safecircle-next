/**
 * components/SafeCircleMap.tsx
 *
 * Leaflet map showing:
 *   - Center pin (searched address)
 *   - 0.5-mile radius circle
 *   - Crime incidents (colored by category)
 *   - Sex offenders (red markers)
 *
 * Lazy-loaded from page.tsx to avoid SSR issues with Leaflet.
 * Requires: npm install leaflet react-leaflet @types/leaflet
 */

"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { CrimeIncident } from "@/app/api/crimes/route";
import type { SexOffender } from "@/app/api/offenders/route";

interface Props {
  center: { lat: number; lng: number };
  crimes: CrimeIncident[];
  offenders: SexOffender[];
}

const CAT_CRIME_COLOR: Record<string, string> = {
  violent: "#E24B4A",
  property: "#378ADD",
  drug: "#BA7517",
  other: "#888780",
};

function categorizeCrime(c: CrimeIncident): string {
  const t = (c.offense_type + " " + c.category).toLowerCase();
  if (/assault|robbery|weapon|homicide|rape|kidnap/.test(t)) return "violent";
  if (/drug|narcotic|controlled/.test(t)) return "drug";
  if (/theft|burglary|auto|vandal|arson|break/.test(t)) return "property";
  return "other";
}

// Fly map to new center when the center prop changes
function MapFlyTo({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], 14, { duration: 1 });
  }, [center, map]);
  return null;
}

export default function SafeCircleMap({ center, crimes, offenders }: Props) {
  const HALF_MILE_METERS = 804;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapFlyTo center={center} />

      {/* 0.5-mile radius circle */}
      <Circle
        center={[center.lat, center.lng]}
        radius={HALF_MILE_METERS}
        pathOptions={{ color: "#1D9E75", fillColor: "#1D9E75", fillOpacity: 0.04, weight: 1.5 }}
      />

      {/* Center pin */}
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={8}
        pathOptions={{ color: "#1D9E75", fillColor: "#1D9E75", fillOpacity: 1, weight: 2 }}
      >
        <Popup>
          <strong>Searched address</strong>
        </Popup>
      </CircleMarker>

      {/* Crime incidents */}
      {crimes
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => (
          <CircleMarker
            key={c.crime_id}
            center={[c.lat!, c.lng!]}
            radius={5}
            pathOptions={{
              color: CAT_CRIME_COLOR[categorizeCrime(c)] ?? "#888",
              fillColor: CAT_CRIME_COLOR[categorizeCrime(c)] ?? "#888",
              fillOpacity: 0.75,
              weight: 1,
            }}
          >
            <Popup>
              <strong>{c.offense_type}</strong>
              <br />
              {c.address}
              <br />
              <span style={{ color: "#888", fontSize: 11 }}>
                {new Date(c.offense_date).toLocaleDateString()}
                {c.distance_mi != null ? ` · ${c.distance_mi} mi` : ""}
              </span>
            </Popup>
          </CircleMarker>
        ))}

      {/* Sex offenders */}
      {offenders
        .filter((o) => {
          // NSOPW may return lat/lng as undocumented fields; skip if missing
          const r = o as unknown as Record<string, unknown>;
          return r.lat != null && r.lng != null;
        })
        .map((o) => {
          const r = o as unknown as Record<string, number>;
          const tierKey = String(o.tier ?? "").replace(/tier\s*/i, "").trim();
          return (
            <CircleMarker
              key={o.offenderId}
              center={[r.lat, r.lng]}
              radius={6}
              pathOptions={{ color: "#A32D2D", fillColor: "#A32D2D", fillOpacity: 0.85, weight: 1.5 }}
            >
              <Popup>
                <strong>
                  {o.firstName} {o.lastName}
                </strong>
                <br />
                {o.offenseDescription}
                <br />
                <span style={{ color: "#A32D2D", fontSize: 11 }}>
                  {o.tier ? `Tier ${tierKey}` : ""}
                  {o.distanceMi != null ? ` · ${o.distanceMi} mi` : ""}
                </span>
                {o.registryUrl && (
                  <>
                    <br />
                    <a href={o.registryUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11 }}>
                      View registry record ↗
                    </a>
                  </>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
