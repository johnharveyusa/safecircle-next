/**
 * app/api/crimes/route.ts
 *
 * Geocodes the address via ArcGIS World Geocoder, then queries the
 * Memphis MPD Public Safety Incidents ESRI layer for offenses within
 * a half-mile radius over the previous 14 days.
 *
 * Correct layer (from v5.7.3 script):
 *   MPD_Public_Safety_Incidents/FeatureServer/0
 */

import { NextRequest, NextResponse } from "next/server";

const GEOCODE_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";

const MPD_QUERY_URL =
  "https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0/query";

const RADIUS_MILES = 0.5;
const WINDOW_DAYS = 14;

function psMeters(mi: number) {
  return mi * 1609.344;
}

export interface CrimeFeature {
  UCR_Category: string;
  UCR_Description: string;
  Street_Address: string;
  Offense_Datetime: number | null;
  Latitude: number | null;
  Longitude: number | null;
  Precinct: string;
  Ward: string;
  Crime_ID: string;
}

export interface CrimesResponse {
  address: string;
  matched: string;
  center: { lat: number; lon: number };
  total: number;
  by_category: Record<string, number>;
  features: CrimeFeature[];
  date_range: { from: string; to: string };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json(
      { error: "address param required" },
      { status: 400 }
    );
  }

  try {
    // ── 1. Geocode ──────────────────────────────────────────────────────
    const geoParams = new URLSearchParams({
      SingleLine: `${address}, Memphis, TN`,
      maxLocations: "1",
      outFields: "*",
      f: "pjson",
    });

    const geoRes = await fetch(`${GEOCODE_URL}?${geoParams}`);
    if (!geoRes.ok) {
      return NextResponse.json(
        { error: `Geocoder HTTP ${geoRes.status}` },
        { status: 502 }
      );
    }

    const geoData = await geoRes.json();
    const candidate = geoData?.candidates?.[0];
    if (!candidate) {
      return NextResponse.json(
        { error: "Address not found by geocoder" },
        { status: 404 }
      );
    }

    const lat: number = candidate.location.y;
    const lon: number = candidate.location.x;
    const matched: string = candidate.address ?? address;

    // ── 2. Date range (last 14 days as epoch ms) ────────────────────────
    const end = Date.now();
    const start = end - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

    // ── 3. Query MPD layer ──────────────────────────────────────────────
    const crimeParams = new URLSearchParams({
      where: "1=1",
      geometry: `${lon},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      distance: String(psMeters(RADIUS_MILES)),
      units: "esriSRUnit_Meter",
      outFields:
        "Offense_Datetime,UCR_Category,UCR_Description,Street_Address,Latitude,Longitude,Precinct,Ward,Crime_ID",
      orderByFields: "Offense_Datetime DESC",
      resultRecordCount: "200",
      returnGeometry: "true",
      time: `${start},${end}`,
      f: "json",
    });

    const crimeRes = await fetch(`${MPD_QUERY_URL}?${crimeParams}`);
    if (!crimeRes.ok) {
      return NextResponse.json(
        { error: `MPD layer HTTP ${crimeRes.status}` },
        { status: 502 }
      );
    }

    const crimeData = await crimeRes.json();

    if (crimeData.error) {
      const msg =
        crimeData.error.details?.join(" ") ??
        crimeData.error.message ??
        "ESRI layer error";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const features: CrimeFeature[] = (crimeData.features ?? []).map(
      (f: { attributes: Record<string, unknown> }) => ({
        UCR_Category: String(f.attributes.UCR_Category ?? ""),
        UCR_Description: String(f.attributes.UCR_Description ?? ""),
        Street_Address: String(f.attributes.Street_Address ?? ""),
        Offense_Datetime:
          typeof f.attributes.Offense_Datetime === "number"
            ? f.attributes.Offense_Datetime
            : null,
        Latitude:
          typeof f.attributes.Latitude === "number"
            ? f.attributes.Latitude
            : null,
        Longitude:
          typeof f.attributes.Longitude === "number"
            ? f.attributes.Longitude
            : null,
        Precinct: String(f.attributes.Precinct ?? ""),
        Ward: String(f.attributes.Ward ?? ""),
        Crime_ID: String(f.attributes.Crime_ID ?? ""),
      })
    );

    // ── 4. Tally by category ────────────────────────────────────────────
    const by_category: Record<string, number> = {};
    features.forEach((f) => {
      const cat = f.UCR_Category || "Other";
      by_category[cat] = (by_category[cat] ?? 0) + 1;
    });

    const response: CrimesResponse = {
      address,
      matched,
      center: { lat, lon },
      total: features.length,
      by_category,
      features,
      date_range: { from: fmtDate(start), to: fmtDate(end) },
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
