/**
 * app/api/crimes/route.ts
 * Fetches Memphis MPD incidents from ESRI ArcGIS - same source as v5.7.3
 */

import { NextRequest, NextResponse } from "next/server";

const GEOCODE_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const MPD_QUERY_URL =
  "https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0/query";

const RADIUS_MILES = 0.5;
const RADIUS_METERS = RADIUS_MILES * 1609.344;
const DAYS_BACK = 14;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  try {
    // Step 1: Geocode the address using ESRI
    const geoRes = await fetch(
      `${GEOCODE_URL}?SingleLine=${encodeURIComponent(address)}&maxLocations=1&outFields=*&f=pjson`
    );
    const geoData = await geoRes.json();

    if (!geoData.candidates?.length) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const best = geoData.candidates[0];
    const lat = best.location.y;
    const lng = best.location.x;

    // Step 2: Query MPD incidents from ESRI - exactly like v5.7.3
    const end = Date.now();
    const start = end - DAYS_BACK * 24 * 60 * 60 * 1000;

    const params = new URLSearchParams({
      where: "1=1",
      geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      distance: String(RADIUS_METERS),
      units: "esriSRUnit_Meter",
      outFields:
        "Offense_Datetime,UCR_Category,UCR_Description,Street_Address,Latitude,Longitude,Precinct,Crime_ID",
      orderByFields: "Offense_Datetime DESC",
      resultRecordCount: "200",
      returnGeometry: "false",
      time: `${start},${end}`,
      f: "json",
    });

    const mpdRes = await fetch(`${MPD_QUERY_URL}?${params}`);
    const mpdData = await mpdRes.json();

    if (mpdData.error) {
      return NextResponse.json(
        { error: mpdData.error.message || "MPD query error" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      address: best.address,
      center: { lat, lng },
      count: (mpdData.features || []).length,
      days_back: DAYS_BACK,
      radius_mi: RADIUS_MILES,
      incidents: mpdData.features || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
