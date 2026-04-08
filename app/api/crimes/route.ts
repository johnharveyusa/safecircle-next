/**
 * app/api/crimes/route.ts
 *
 * Fetches Memphis MPD incidents from the Socrata open data portal.
 * Dataset: puh4-eea4  (updated dataset as of 2024, daily at 6am)
 * Docs:    https://data.memphistn.gov/Public-Safety/Memphis-Police-Department-Public-Safety-Incidents/puh4-eea4
 *
 * Query strategy:
 *   - Geocode the supplied address to lat/lng
 *   - Use Socrata's `$where` with `within_circle()` for a 0.5-mile (804m) radius
 *   - Filter to the past 14 days via `offense_date`
 *   - Return up to 200 records, ordered newest-first
 *
 * NOTE: Sex crimes and juvenile-specific crimes are OMITTED from this dataset
 *       per Memphis MPD policy. Use the NSOPW route for offender data.
 */

import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

const SOCRATA_HOST = "data.memphistn.gov";
const DATASET_ID = "puh4-eea4";
const RADIUS_METERS = 804; // 0.5 miles
const DAYS_BACK = 14;
const MAX_ROWS = 200;

export interface CrimeIncident {
  crime_id: string;
  offense_date: string;
  offense_type: string;
  category: string;
  address: string;
  lat: number | null;
  lng: number | null;
  distance_mi?: number;
}

function milesAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function haversineDistanceMi(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  try {
    const { lat, lng } = await geocodeAddress(address);
    const since = milesAgo(DAYS_BACK);

    // Socrata SODA query
    const params = new URLSearchParams({
      $where: `within_circle(geocoded_column, ${lat}, ${lng}, ${RADIUS_METERS}) AND offense_date >= '${since}'`,
      $order: "offense_date DESC",
      $limit: String(MAX_ROWS),
    });

    // App token reduces throttling — optional but recommended
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (process.env.SOCRATA_APP_TOKEN) {
      headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
    }

    const url = `https://${SOCRATA_HOST}/resource/${DATASET_ID}.json?${params}`;
    const res = await fetch(url, { headers, next: { revalidate: 3600 } });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Socrata error ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const raw: Record<string, string>[] = await res.json();

    const incidents: CrimeIncident[] = raw.map((r) => {
      // Coordinates can live in a nested object or flat fields depending on dataset version
      const incLat =
        r.latitude != null
          ? parseFloat(r.latitude)
          : r.geocoded_column?.latitude != null
          ? parseFloat(r.geocoded_column.latitude)
          : null;
      const incLng =
        r.longitude != null
          ? parseFloat(r.longitude)
          : r.geocoded_column?.longitude != null
          ? parseFloat(r.geocoded_column.longitude)
          : null;

      return {
        crime_id: r.crime_id ?? r.incident_id ?? "",
        offense_date: r.offense_date ?? "",
        offense_type: r.agency_crimetype_id ?? r.offense_type ?? r.crime_type ?? "Unknown",
        category: r.category ?? r.crime_category ?? "Other",
        address: r["100_block_address"] ?? r.block_address ?? r.location_description ?? "",
        lat: incLat,
        lng: incLng,
        distance_mi:
          incLat != null && incLng != null
            ? Math.round(haversineDistanceMi(lat, lng, incLat, incLng) * 10) / 10
            : undefined,
      };
    });

    return NextResponse.json({
      address,
      center: { lat, lng },
      count: incidents.length,
      days_back: DAYS_BACK,
      radius_mi: 0.5,
      incidents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
