/**
 * app/api/warrants/route.ts
 *
 * Checks the Shelby County Sheriff's warrant search for active warrants
 * associated with a given address.
 *
 * The Shelby County warrant portal is a server-rendered HTML form at:
 *   https://warrants.shelby-sheriff.org/w_warrant_result.php
 *
 * Params (GET):
 *   w   = warrant number (leave blank for address search)
 *   l   = last name     (leave blank for address search)
 *   f   = first name    (leave blank for address search)
 *   s   = street number
 *   st  = street name (partial, lowercase)
 *
 * Strategy: fetch the results page, scrape for warrant records in the HTML
 * table, and return structured data.  We also return the direct search URL
 * so the frontend can link the user through for manual verification.
 *
 * NOTE: This is a best-effort HTML scrape of a public portal.
 * If the portal changes its markup this parser will need updating.
 */

import { NextRequest, NextResponse } from "next/server";
import { parseWarrantParams } from "@/lib/geocode";

const WARRANT_BASE = "https://warrants.shelby-sheriff.org/w_warrant_result.php";

export interface Warrant {
  name: string;
  address: string;
  warrantNumber: string;
  chargeDescription: string;
  issueDate: string;
}

function buildWarrantUrl(s: string, st: string): string {
  const p = new URLSearchParams({ w: "", l: "", f: "", s, st });
  return `${WARRANT_BASE}?${p}`;
}

function scrapeWarrants(html: string): Warrant[] {
  /**
   * The results page renders a plain HTML table.
   * We extract <tr> rows inside the results table, skipping the header row.
   * Each data row has cells: Name, Address, Warrant #, Charge, Issue Date
   *
   * We use simple regex parsing since we cannot use a DOM parser in
   * a Node.js edge/server environment without a dependency.
   */
  const warrants: Warrant[] = [];

  // Check for "no records found" text
  if (/no\s+(active\s+)?warrant/i.test(html) || /no\s+records\s+found/i.test(html)) {
    return warrants;
  }

  // Extract all <tr> blocks
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();

  let trMatch;
  let rowIndex = 0;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    let tdMatch;
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }
    // Skip header row and rows with fewer than 4 cells
    if (rowIndex > 0 && cells.length >= 4) {
      warrants.push({
        name: cells[0] ?? "",
        address: cells[1] ?? "",
        warrantNumber: cells[2] ?? "",
        chargeDescription: cells[3] ?? "",
        issueDate: cells[4] ?? "",
      });
    }
    rowIndex++;
  }

  return warrants;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  try {
    const { s, st } = parseWarrantParams(address);
    const searchUrl = buildWarrantUrl(s, st);

    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SafeCircle/1.0; +https://safecircle-next.vercel.app)",
        Accept: "text/html",
      },
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Warrant portal returned ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const warrants = scrapeWarrants(html);

    return NextResponse.json({
      address,
      street_number: s,
      street_name: st,
      search_url: searchUrl,
      found: warrants.length > 0,
      count: warrants.length,
      warrants,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
