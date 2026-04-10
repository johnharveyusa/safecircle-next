/**
 * app/api/warrants/route.ts
 * Shelby County Sheriff warrant search - parameterized by address
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
  const warrants: Warrant[] = [];

  if (/no\s+(active\s+)?warrant/i.test(html) || /no\s+records\s+found/i.test(html)) {
    return warrants;
  }

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
        "User-Agent": "Mozilla/5.0 (compatible; SafeCircle/1.0)",
        Accept: "text/html",
      },
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
