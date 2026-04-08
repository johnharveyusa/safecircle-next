/**
 * app/page.tsx  (or app/dashboard/page.tsx)
 *
 * Main SafeCircle dashboard page.
 * Wires the useSafeCircleData hook to the UI, includes:
 *   - Address search I
 *   - Risk metrics
 *   - Crime list with category filter
 *   - Sex offender list
 *   - Warrant check result
 *   - Emergency contacts
 *   - Links to Shelby County Sheriff (warrants + jail roster)
 *   - Leaflet map (lazy-loaded)
 */

"use client";

import { useState, lazy, Suspense } from "react";
import { useSafeCircleData } from "@/hooks/useSafeCircleData";
import type { CrimeIncident } from "@/app/api/crimes/route";

// Lazy-load the Leaflet map so it doesn't block SSR
const SafeCircleMap = lazy(() => import("@/components/SafeCircleMap"));

const TIER_COLOR: Record<string, string> = {
  "3": "bg-red-100 text-red-800",
  "2": "bg-amber-100 text-amber-800",
  "1": "bg-gray-100 text-gray-600",
};

const CAT_COLORS: Record<string, string> = {
  violent: "text-red-700",
  property: "text-blue-700",
  drug: "text-amber-700",
  other: "text-gray-500",
};

function categorizeCrime(c: CrimeIncident): string {
  const t = (c.offense_type + " " + c.category).toLowerCase();
  if (/assault|robbery|weapon|homicide|rape|kidnap/.test(t)) return "violent";
  if (/drug|narcotic|controlled/.test(t)) return "drug";
  if (/theft|burglary|auto|vandal|arson|break/.test(t)) return "property";
  return "other";
}

const WARRANT_BASE =
  "https://warrants.shelby-sheriff.org/w_warrant_result.php";
const JAIL_URL = "https://www.shelby-sheriff.org/";
const NSOPW_URL = "https://www.nsopw.gov/";
const TN_SOR_URL = "https://sor.tbi.tn.gov/";

export default function SafeCirclePage() {
  const [inputAddr, setInputAddr] = useState("4128 Weymouth Cove, Memphis TN");
  const [searchAddr, setSearchAddr] = useState<string | null>(null);
  const [crimeFilter, setCrimeFilter] = useState("all");

  const { data, loading, errors } = useSafeCircleData(searchAddr);

  function handleSearch() {
    setCrimeFilter("all");
    setSearchAddr(inputAddr.trim());
  }

  const filteredCrimes =
    crimeFilter === "all"
      ? data.crimes
      : data.crimes.filter((c) => categorizeCrime(c) === crimeFilter);

  const violentCount = data.crimes.filter((c) => categorizeCrime(c) === "violent").length;
  const tier3Count = data.offenders.filter((o) => o.tier === "3" || o.tier === "Tier 3").length;

  const riskLevel =
    violentCount >= 5 || tier3Count >= 3
      ? "HIGH"
      : violentCount >= 2 || tier3Count >= 1
      ? "MODERATE"
      : "LOW";

  const riskStyle =
    riskLevel === "HIGH"
      ? "text-red-700 bg-red-50 border border-red-200"
      : riskLevel === "MODERATE"
      ? "text-amber-700 bg-amber-50 border border-amber-200"
      : "text-green-700 bg-green-50 border border-green-200";

  return (
    <main className="max-w-3xl mx-auto px-4 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 py-5 border-b border-gray-100 mb-5">
        <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center">
          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-medium">SafeCircle</h1>
          <p className="text-xs text-gray-400">neighborhood safety · Shelby County, TN</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-5">
        <input
          className="flex-1 h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          value={inputAddr}
          onChange={(e) => setInputAddr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter address"
        />
        <button
          className="px-4 h-10 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "Checking…" : "Check address"}
        </button>
      </div>

      {/* Errors */}
      {Object.entries(errors).map(([key, msg]) => (
        <div key={key} className="mb-3 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
          {key}: {msg}
        </div>
      ))}

      {/* Results — only show after first search */}
      {searchAddr && !loading && (
        <>
          {/* Info banner */}
          <div className="mb-5 px-4 py-2 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-100">
            Results for: <strong>{searchAddr}</strong> &nbsp;·&nbsp; Crimes: past 14 days, 0.5 mi radius
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className={`rounded-xl px-4 py-3 text-center ${riskStyle}`}>
              <div className="text-xl font-medium">{riskLevel}</div>
              <div className="text-xs mt-0.5 opacity-70">Risk level</div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <div className="text-xl font-medium text-red-700">{data.crimes.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Total crimes</div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <div className="text-xl font-medium text-red-700">{data.offenders.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">Sex offenders</div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <div className="text-xl font-medium text-red-700">{tier3Count}</div>
              <div className="text-xs text-gray-400 mt-0.5">Tier 3 (high risk)</div>
            </div>
          </div>

          {/* Alert banner if high risk */}
          {riskLevel === "HIGH" && (
            <div className="mb-5 px-4 py-3 bg-red-50 text-red-800 text-sm rounded-lg border border-red-200">
              <strong>High-risk area.</strong> {tier3Count} Tier 3 sex offenders and {violentCount} violent crimes
              reported within 0.5 miles in the past 14 days. Stay alert and share this with people you care about.
            </div>
          )}

          {/* Map */}
          {data.center && (
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Map</p>
              <div className="rounded-xl overflow-hidden border border-gray-100 h-64">
                <Suspense fallback={<div className="h-full bg-gray-50 flex items-center justify-center text-sm text-gray-400">Loading map…</div>}>
                  <SafeCircleMap
                    center={data.center}
                    crimes={data.crimes}
                    offenders={data.offenders}
                  />
                </Suspense>
              </div>
            </div>
          )}

          {/* Crimes */}
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
              Reported crimes nearby ({data.crimes.length})
            </p>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              {/* Filter pills */}
              <div className="flex gap-2 flex-wrap mb-3">
                {["all","violent","property","drug","other"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCrimeFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      crimeFilter === cat
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {cat === "all" ? `All (${data.crimes.length})` : `${cat.charAt(0).toUpperCase()+cat.slice(1)} (${data.crimes.filter(c=>categorizeCrime(c)===cat).length})`}
                  </button>
                ))}
              </div>

              {filteredCrimes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No crimes found in this category.</p>
              ) : (
                filteredCrimes.map((c) => (
                  <div key={c.crime_id} className="grid grid-cols-[1fr_60px_55px] gap-x-3 py-2 border-b border-gray-50 last:border-0 text-sm">
                    <div>
                      <div className={`font-medium ${CAT_COLORS[categorizeCrime(c)]}`}>{c.offense_type}</div>
                      <div className="text-xs text-gray-400">{c.address}</div>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                      {new Date(c.offense_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                      {c.distance_mi != null ? `${c.distance_mi} mi` : ""}
                    </div>
                  </div>
                ))
              )}

              <div className="pt-3 mt-2 border-t border-gray-50">
                <a
                  href="https://data.memphistn.gov/Public-Safety/Memphis-Police-Department-Public-Safety-Incidents/puh4-eea4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Source: Memphis MPD Public Safety Incidents (data.memphistn.gov) ↗
                </a>
              </div>
            </div>
          </div>

          {/* Sex offenders */}
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
              Registered sex offenders within 0.5 mi ({data.offenders.length})
            </p>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-3 pb-3 border-b border-gray-50">
                Tier 3 = highest risk of re-offense · Tier 2 = moderate · Tier 1 = lower risk.
                Click any name to view full registry record.
              </p>

              {data.offenders.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No registered offenders found.</p>
              ) : (
                data.offenders.map((o) => {
                  const tierKey = String(o.tier ?? "").replace(/tier\s*/i, "").trim();
                  return (
                    <div key={o.offenderId} className="grid grid-cols-[36px_1fr_auto] gap-3 items-center py-2 border-b border-gray-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-red-50 text-red-700 flex items-center justify-center text-xs font-medium">
                        {o.firstName.charAt(0)}{o.lastName.charAt(0)}
                      </div>
                      <div>
                        <a
                          href={o.registryUrl || NSOPW_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline text-gray-900"
                        >
                          {o.firstName} {o.lastName}
                        </a>
                        <div className="text-xs text-gray-400">
                          {o.offenseDescription} · {o.address}, {o.city}
                          {o.distanceMi != null ? ` · ${o.distanceMi} mi` : ""}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLOR[tierKey] ?? "bg-gray-100 text-gray-600"}`}>
                        {o.tier ? `Tier ${tierKey}` : "—"}
                      </span>
                    </div>
                  );
                })
              )}

              <div className="pt-3 mt-2 border-t border-gray-50 flex gap-4">
                <a href={NSOPW_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:underline">
                  National Sex Offender Registry ↗
                </a>
                <a href={TN_SOR_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-red-600 hover:underline">
                  Tennessee SOR ↗
                </a>
              </div>
            </div>
          </div>

          {/* Warrants */}
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
              Shelby County warrant check
            </p>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              {data.warrants ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-700">Active warrants at this address</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.warrants.found ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {data.warrants.found ? `${data.warrants.count} found` : "None found"}
                    </span>
                  </div>

                  {data.warrants.warrants.map((w, i) => (
                    <div key={i} className="py-2 border-b border-gray-50 last:border-0 text-sm">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-gray-400">{w.chargeDescription} · Warrant #{w.warrantNumber} · {w.issueDate}</div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-gray-400">Warrant data unavailable. Search directly below.</p>
              )}

              <div className="pt-3 mt-2 border-t border-gray-50 flex gap-3">
                <a
                  href={data.warrants?.search_url ?? `${WARRANT_BASE}?w=&l=&f=&s=4128&st=weymouth`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-700 hover:underline"
                >
                  Shelby County warrant search ↗
                </a>
                <a href={JAIL_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-700 hover:underline">
                  Shelby County jail roster ↗
                </a>
              </div>
            </div>
          </div>

          {/* Emergency contacts */}
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Emergency contacts</p>
            <div className="grid grid-cols-3 gap-3">
              {data.contacts.length > 0 ? (
                data.contacts.map((c) => (
                  <div key={c.type} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs font-medium text-gray-700 mb-1 capitalize">{c.type === "police" ? "Police" : c.type === "fire" ? "Fire" : "Hospital"}</div>
                    <div className="text-xs text-gray-500 mb-2 leading-snug">{c.name}</div>
                    <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-sm text-blue-600 hover:underline">
                      {c.phone || "—"}
                    </a>
                    {c.distance_mi != null && (
                      <div className="text-xs text-gray-400 mt-1">{c.distance_mi} mi away</div>
                    )}
                  </div>
                ))
              ) : (
                <>
                  {[
                    { type: "Police", name: "Ridgeway Precinct", phone: "(901) 545-5999" },
                    { type: "Fire", name: "Fire Station #40", phone: "(901) 458-4700" },
                    { type: "Hospital", name: "Methodist Le Bonheur", phone: "(901) 516-5200" },
                  ].map((c) => (
                    <div key={c.type} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-xs font-medium text-gray-700 mb-1">{c.type}</div>
                      <div className="text-xs text-gray-500 mb-2">{c.name}</div>
                      <a href={`tel:${c.phone.replace(/\D/g,"")}`} className="text-sm text-blue-600 hover:underline">{c.phone}</a>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Initial state */}
      {!searchAddr && !loading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Enter an address above to check safety data.
        </div>
      )}
    </main>
  );
}
