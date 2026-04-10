"use client";

import { useState, lazy, Suspense } from "react";
import { useSafeCircleData } from "@/hooks/useSafeCircleData";
import type { CrimeIncident } from "@/app/api/crimes/route";

const SafeCircleMap = lazy(() => import("@/components/SafeCircleMap"));

const CAT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  violent:  { text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  property: { text: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  drug:     { text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  other:    { text: "text-gray-600",   bg: "bg-gray-50",   border: "border-gray-200" },
};

function categorizeCrime(c: CrimeIncident): string {
  const t = (c.offense_type + " " + c.category).toLowerCase();
  if (/assault|robbery|weapon|homicide|rape|kidnap/.test(t)) return "violent";
  if (/drug|narcotic|controlled/.test(t)) return "drug";
  if (/theft|burglary|auto|vandal|arson|break/.test(t)) return "property";
  return "other";
}

const WARRANT_BASE = "https://warrants.shelby-sheriff.org/w_warrant_result.php";
const JAIL_URL = "https://imljail.shelbycountytn.gov/IML";
const TN_SOR_URL = "https://sor.tbi.tn.gov/";

function buildWarrantUrl(address: string): string {
  const match = address.match(/^(\d+)\s+([a-zA-Z]+)/);
  if (!match) return `${WARRANT_BASE}?w=&l=&f=&s=&st=`;
  return `${WARRANT_BASE}?w=&l=&f=&s=${match[1]}&st=${match[2].toLowerCase()}`;
}

function buildNSOPWUrl(address: string): string {
  const parts = address.split(",");
  const street = parts[0]?.trim() ?? "";
  const cityState = parts[1]?.trim() ?? "";
  const cityParts = cityState.split(" ");
  const state = cityParts.pop() ?? "TN";
  const city = cityParts.join(" ").trim() || "Memphis";
  const url = new URL("https://www.nsopw.gov/Search/Results");
  url.searchParams.set("byAddressStreet", street);
  url.searchParams.set("byAddressCity", city);
  url.searchParams.set("byAddressState", state);
  url.searchParams.set("radius", "0.5");
  return url.toString();
}

export default function SafeCirclePage() {
  const [inputAddr, setInputAddr] = useState("4128 Weymouth Cove, Memphis TN");
  const [searchAddr, setSearchAddr] = useState<string | null>(null);
  const [crimeFilter, setCrimeFilter] = useState("all");
  const [sosTriggered, setSosTriggered] = useState(false);

  const { data, loading, errors } = useSafeCircleData(searchAddr);

  function handleSearch() {
    setCrimeFilter("all");
    setSearchAddr(inputAddr.trim());
  }

  function handleSOS() {
    setSosTriggered(true);
    setTimeout(() => setSosTriggered(false), 5000);
    window.location.href = "tel:911";
  }

  const filteredCrimes =
    crimeFilter === "all"
      ? data.crimes
      : data.crimes.filter((c) => categorizeCrime(c) === crimeFilter);

  const violentCount = data.crimes.filter((c) => categorizeCrime(c) === "violent").length;

  const riskLevel =
    violentCount >= 5 ? "HIGH" : violentCount >= 2 ? "MODERATE" : "LOW";

  const riskStyle =
    riskLevel === "HIGH"
      ? "text-red-700 bg-red-50 border-red-300"
      : riskLevel === "MODERATE"
      ? "text-amber-700 bg-amber-50 border-amber-300"
      : "text-green-700 bg-green-50 border-green-300";

  return (
    <main className="max-w-3xl mx-auto px-4 pb-16" style={{ fontSize: 15 }}>

      {/* Header */}
      <div className="flex items-center justify-between py-5 border-b border-gray-200 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center shadow">
            <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">SafeCircle</h1>
            <p className="text-sm text-gray-500">Neighborhood Safety · Shelby County, TN</p>
          </div>
        </div>
        {/* SOS Button — always visible */}
        <button
          onClick={handleSOS}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-base shadow-lg"
          style={{ animation: "pulse 2s infinite" }}
        >
          🆘 {sosTriggered ? "Calling 911…" : "SOS"}
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          className="flex-1 h-12 px-4 border-2 border-gray-300 rounded-xl text-base focus:outline-none focus:border-blue-500"
          value={inputAddr}
          onChange={(e) => setInputAddr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter address in Shelby County, TN"
        />
        <button
          className="px-6 h-12 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-base font-bold shadow disabled:opacity-50"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "Checking…" : "🔍 Check"}
        </button>
      </div>

      {/* Errors */}
      {Object.entries(errors)
        .filter(([key]) => key !== "offenders")
        .map(([key, msg]) => (
          <div key={key} className="mb-3 px-4 py-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
            ⚠️ {key}: {msg}
          </div>
        ))}

      {/* Results */}
      {searchAddr && !loading && (
        <>
          {/* Info banner */}
          <div className="mb-5 px-4 py-3 bg-blue-50 text-blue-900 text-sm rounded-xl border border-blue-200">
            Results for: <strong>{searchAddr}</strong> &nbsp;·&nbsp; Crimes: past 14 days, 0.5 mi radius
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className={`rounded-xl px-4 py-4 text-center border-2 ${riskStyle}`}>
              <div className="text-2xl font-bold">{riskLevel}</div>
              <div className="text-sm mt-1 font-medium">Risk level</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center">
              <div className="text-2xl font-bold text-red-600">{data.crimes.length}</div>
              <div className="text-sm text-gray-500 mt-1">Total crimes</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center">
              <div className="text-2xl font-bold text-red-700">{violentCount}</div>
              <div className="text-sm text-gray-500 mt-1">Violent crimes</div>
            </div>
          </div>

          {/* High risk alert */}
          {riskLevel === "HIGH" && (
            <div className="mb-5 px-4 py-3 bg-red-50 text-red-800 text-sm rounded-xl border-2 border-red-300 font-medium">
              🚨 <strong>High-risk area.</strong> {violentCount} violent crimes within 0.5 miles in the past 14 days.
            </div>
          )}

          {/* ── WARRANTS ── prominent card */}
          <div className="mb-5 rounded-xl border-2 border-amber-400 bg-amber-50 overflow-hidden">
            <div className="bg-amber-500 px-5 py-3 flex items-center gap-2">
              <span className="text-xl">🔎</span>
              <span className="text-white font-bold text-base">Shelby County Warrant Search</span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-amber-900 mb-4">
                Check active warrants for this address with the Shelby County Sheriff's Office. Written by John Harvey in 1989 — still working today.
              </p>
              <div className="flex gap-3 flex-wrap">
                <a
                  href={buildWarrantUrl(searchAddr)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm shadow"
                >
                  🔍 Search Warrants by Address ↗
                </a>
                <a
                  href={`${WARRANT_BASE}?w=&l=&f=&s=&st=`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 bg-white hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-sm border-2 border-amber-400"
                >
                  Search by Name ↗
                </a>
                <a
                  href={JAIL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 bg-white hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-sm border-2 border-amber-400"
                >
                  🔒 Jail Roster ↗
                </a>
              </div>
            </div>
          </div>

          {/* ── CRIMES ── */}
          <div className="mb-5 rounded-xl border-2 border-blue-400 bg-white overflow-hidden">
            <div className="bg-blue-600 px-5 py-3 flex items-center gap-2">
              <span className="text-xl">🚨</span>
              <span className="text-white font-bold text-base">Reported Crimes Nearby ({data.crimes.length})</span>
            </div>
            <div className="px-5 py-4">
              <div className="flex gap-2 flex-wrap mb-4">
                {["all","violent","property","drug","other"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCrimeFilter(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                      crimeFilter === cat
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {cat === "all"
                      ? `All (${data.crimes.length})`
                      : `${cat.charAt(0).toUpperCase() + cat.slice(1)} (${data.crimes.filter((c) => categorizeCrime(c) === cat).length})`}
                  </button>
                ))}
              </div>

              {filteredCrimes.length === 0 ? (
                <p className="text-base text-green-700 font-medium py-4 text-center">✅ No crimes found in this category.</p>
              ) : (
                <div className="space-y-2">
                  {filteredCrimes.map((c) => {
                    const cat = categorizeCrime(c);
                    const colors = CAT_COLORS[cat];
                    return (
                      <div key={c.crime_id} className={`rounded-lg px-4 py-3 border ${colors.bg} ${colors.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className={`font-bold text-sm ${colors.text}`}>{c.offense_type}</div>
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            {new Date(c.offense_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {c.distance_mi != null ? ` · ${c.distance_mi} mi` : ""}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5">{c.address}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="pt-3 mt-3 border-t border-gray-100">
                <a
                  href="https://data.memphistn.gov/Public-Safety/Memphis-Police-Department-Public-Safety-Incidents/puh4-eea4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Source: Memphis MPD Public Safety Incidents ↗
                </a>
              </div>
            </div>
          </div>

          {/* ── SEX OFFENDERS ── */}
          <div className="mb-5 rounded-xl border-2 border-purple-400 bg-purple-50 overflow-hidden">
            <div className="bg-purple-600 px-5 py-3 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="text-white font-bold text-base">Sex Offender Registry</span>
            </div>
            <div className="px-5 py-4 flex gap-3 flex-wrap">
              <a
                href={buildNSOPWUrl(searchAddr)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm shadow"
              >
                National Registry (NSOPW) ↗
              </a>
              <a
                href={TN_SOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 bg-white hover:bg-purple-100 text-purple-800 font-bold rounded-xl text-sm border-2 border-purple-400"
              >
                Tennessee SOR ↗
              </a>
            </div>
          </div>

          {/* ── MAP ── */}
          {data.center && (
            <div className="mb-5 rounded-xl border-2 border-teal-400 bg-white overflow-hidden">
              <div className="bg-teal-600 px-5 py-3 flex items-center gap-2">
                <span className="text-xl">🗺️</span>
                <span className="text-white font-bold text-base">Crime Map</span>
              </div>
              <div className="h-72">
                <Suspense fallback={<div className="h-full bg-gray-50 flex items-center justify-center text-sm text-gray-400">Loading map…</div>}>
                  <SafeCircleMap center={data.center} crimes={data.crimes} offenders={[]} />
                </Suspense>
              </div>
            </div>
          )}

          {/* ── EMERGENCY CONTACTS ── */}
          <div className="mb-5 rounded-xl border-2 border-green-400 bg-green-50 overflow-hidden">
            <div className="bg-green-600 px-5 py-3 flex items-center gap-2">
              <span className="text-xl">📍</span>
              <span className="text-white font-bold text-base">Nearest Emergency Services</span>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-3 gap-3">
                {data.contacts.length > 0 ? (
                  data.contacts.map((c) => (
                    <div key={c.type} className="bg-white rounded-xl p-3 border border-green-200 shadow-sm">
                      <div className="text-sm font-bold text-green-800 mb-1 capitalize">
                        {c.type === "police" ? "👮 Police" : c.type === "fire" ? "🚒 Fire" : "🏥 Hospital"}
                      </div>
                      <div className="text-sm text-gray-600 mb-2 leading-snug">{c.name}</div>
                      <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-base font-bold text-blue-600 hover:underline">
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
                      { type: "👮 Police", name: "Ridgeway Precinct", phone: "(901) 545-5999" },
                      { type: "🚒 Fire", name: "Fire Station #40", phone: "(901) 458-4700" },
                      { type: "🏥 Hospital", name: "Methodist Le Bonheur", phone: "(901) 516-5200" },
                    ].map((c) => (
                      <div key={c.type} className="bg-white rounded-xl p-3 border border-green-200 shadow-sm">
                        <div className="text-sm font-bold text-green-800 mb-1">{c.type}</div>
                        <div className="text-sm text-gray-600 mb-2">{c.name}</div>
                        <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="text-base font-bold text-blue-600 hover:underline">
                          {c.phone}
                        </a>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── SOS ALERT ── big bottom button */}
          <div className="mt-8 rounded-xl border-2 border-red-400 bg-red-50 p-5 text-center">
            <p className="text-base font-bold text-red-800 mb-4">
              🆘 Need immediate help? Alert your Safe Circle or call 911.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={handleSOS}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-lg shadow-lg"
              >
                📞 Call 911
              </button>
              <a
                href="sms:?body=🚨 EMERGENCY: I need help immediately! Please call me or call 911."
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-lg shadow-lg"
              >
                💬 SMS Alert
              </a>
            </div>
          </div>
        </>
      )}

      {/* Initial state */}
      {!searchAddr && !loading && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🛡️</div>
          <p className="text-lg font-medium text-gray-700 mb-2">Enter an address above to get started</p>
          <p className="text-base text-gray-500">SafeCircle checks warrants, crimes, sex offenders, and nearest emergency services for any address in Shelby County.</p>
        </div>
      )}
    </main>
  );
}
