/**
 * app/api/offenders/route.ts
 *
 * NSOPW and Tennessee SOR do not have public JSON APIs.
 * This route returns a pre-filled direct link to NSOPW address search
 * so the user can look up offenders with the address pre-populated.
 */

import { NextRequest, NextResponse } from "next/server";

const NSOPW_SEARCH_URL = "https://www.nsopw.gov/en/Search/Results";

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
  const address = req.nextUrl.searchParams.get("address") ?? "";

  // Parse address into components for NSOPW pre-fill
  // e.g. "4128 Weymouth Cove, Memphis TN" -> street, city, state
  const parts = address.split(",");
  const street = parts[0]?.trim() ?? "";
  const cityState = parts[1]?.trim() ?? "";
  const cityParts = cityState.split(" ");
  const state = cityParts.pop() ?? "TN";
  const city = cityParts.join(" ").trim();

  // Build NSOPW address search URL with pre-filled fields
  const searchUrl = new URL("https://www.nsopw.gov/Search/Results");
  searchUrl.searchParams.set("byAddressStreet", street);
  searchUrl.searchParams.set("byAddressCity", city || "Memphis");
  searchUrl.searchParams.set("byAddressState", state || "TN");
  searchUrl.searchParams.set("radius", "0.5");

  return NextResponse.json({
    offenders: [],
    search_url: searchUrl.toString(),
    tn_sor_url: `https://sor.tbi.tn.gov/`,
    note: "Direct search required — use the link below to view registered offenders near this address.",
  });
}
