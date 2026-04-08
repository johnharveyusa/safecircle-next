/**
 * app/api/offenders/route.ts
 *
 * Queries the National Sex Offender Public Website (NSOPW) API for registered
 * offenders within a radius of the supplied address.
 *
 * NSOPW public API docs:  https://www.nsopw.gov/Developer
 * Radius search endpoint: https://www.nsopw.gov/api/Search/Radius
 *
 * Required env vars: none (NSOPW is a free public API, no key required)
 *
 * The Tennessee SOR (https://sor.tbi.tn.gov) does not expose a public JSON API,
 * so NSOPW is the authoritative programmatic source.  Full name/photo details
 * are only surfaced when the user clicks through to the state registry link.
 */

import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

const NSOPW_BASE = "https://www.nsopw.gov/api";
const RADIUS_MILES = 0.5;

export interface SexOffender {
  offenderId: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  tier: string | null;
  offenseDescription: string;
  registryUrl: string;
  distanceMi: number | null;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  try {
    const { lat, lng } = await geocodeAddress(address);

    // NSOPW radius search — returns offenders from all participating state registries
    const params = new URLSearchParams({
      Latitude: String(lat),
      Longitude: String(lng),
      RadiusInMiles: String(RADIUS_MILES),
      SkipCount: "0",
      MaxCount: "200",
    });

    const res = await fetch(`${NSOPW_BASE}/Search/Radius?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "SafeCircle/1.0 (safecircle-next)",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `NSOPW error ${res.status}`, detail: text },
        { status: 502 }
      );
    }

    const data = await res.json();

    // NSOPW returns { Results: [...], TotalCount: number }
    const raw: Record<string, unknown>[] = data?.Results ?? data?.results ?? [];

    const offenders: SexOffender[] = raw.map((r) => ({
      offenderId: String(r.OffenderId ?? r.offenderId ?? ""),
      firstName: String(r.FirstName ?? r.firstName ?? ""),
      lastName: String(r.LastName ?? r.lastName ?? ""),
      address: String(r.Address ?? r.address ?? ""),
      city: String(r.City ?? r.city ?? ""),
      state: String(r.State ?? r.state ?? "TN"),
      zip: String(r.Zip ?? r.zip ?? ""),
      tier: r.Tier != null ? String(r.Tier) : r.tier != null ? String(r.tier) : null,
      offenseDescription: String(
        r.OffenseDescription ?? r.offenseDescription ?? r.PrimaryOffense ?? ""
      ),
      registryUrl: String(
        r.OffenderUrl ?? r.offenderUrl ?? r.StateRegistryUrl ?? ""
      ),
      distanceMi:
        r.Distance != null
          ? Math.round(parseFloat(String(r.Distance)) * 10) / 10
          : null,
    }));

    // Sort by distance ascending
    offenders.sort((a, b) => (a.distanceMi ?? 99) - (b.distanceMi ?? 99));

    return NextResponse.json({
      address,
      center: { lat, lng },
      radius_mi: RADIUS_MILES,
      total_count: data?.TotalCount ?? offenders.length,
      offenders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
