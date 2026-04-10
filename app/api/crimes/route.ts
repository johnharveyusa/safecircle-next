/**
 * app/api/warrants/route.ts
 *
 * Builds a pre-filled Shelby County warrant search URL from the address.
 * The sheriff site blocks server-side scraping so we return the direct link.
 */

import { NextRequest, NextResponse } from "next/server";

const WARRANT_BASE = "https://warrants.shelby-sheriff.org/w_warrant_result.php";

export interface Warrant {
  name: string;
  chargeDescription: string;
  warrantNumber: string;
  issueDate: string;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  const match = address.match(/^(\d+)\s+([a-zA-Z]+)/);
  const s = match?.[1] ?? "";
  const st = match?.[2]?.toLowerCase() ?? "";

  return NextResponse.json({
    found: false,
    count: 0,
    warrants: [],
    search_url: `${WARRANT_BASE}?w=&l=&f=&s=${s}&st=${st}`,
  });
}
