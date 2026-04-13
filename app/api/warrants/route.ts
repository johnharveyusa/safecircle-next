/**
 * app/api/warrants/route.ts
 *
 * Builds a pre-filled Shelby County Sheriff warrant search URL.
 * This is NOT an API scrape — the sheriff site blocks server fetches.
 * We simply return the parameterized URL and the front end opens it
 * in a new browser tab.
 *
 * URL format (written by John Harvey, 1989, still works):
 *   https://warrants.shelby-sheriff.org/w_warrant_result.php
 *     ?w=&l=&f=&s=<street_number>&st=<first_word_of_street_lowercase>
 *
 * Also supports name search:
 *   ?w=&l=<last_name>&f=<first_name>&s=&st=
 */

import { NextRequest, NextResponse } from "next/server";

const WARRANT_BASE =
  "https://warrants.shelby-sheriff.org/w_warrant_result.php";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  const lastName = req.nextUrl.searchParams.get("last") ?? "";
  const firstName = req.nextUrl.searchParams.get("first") ?? "";

  // Parse street number and first word of street name from address
  const match = address.match(/^(\d+)\s+([a-zA-Z]+)/);
  const s = match?.[1] ?? "";
  const st = match?.[2]?.toLowerCase() ?? "";

  // Address-based search URL
  const address_url = `${WARRANT_BASE}?w=&l=&f=&s=${encodeURIComponent(s)}&st=${encodeURIComponent(st)}`;

  // Name-based search URL
  const name_url = `${WARRANT_BASE}?w=&l=${encodeURIComponent(lastName)}&f=${encodeURIComponent(firstName)}&s=&st=`;

  return NextResponse.json({
    address_url,
    name_url,
    parsed: { street_number: s, street_name: st },
  });
}
