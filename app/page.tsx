"use client";

import { useState, lazy, Suspense } from "react";
import { useSafeCircleData } from "@/hooks/useSafeCircleData";
import type { CrimeIncident } from "@/app/api/crimes/route";

const SafeCircleMap = lazy(() => import("@/components/SafeCircleMap"));

function categorizeCrime(c: CrimeIncident): string {
  const t = (c.offense_type + " " + c.category).toLowerCase();
  if (/assault|robbery|weapon|homicide|rape|kidnap/.test(t)) return "violent";
  if (/drug|narcotic|controlled/.test(t)) return "drug";
  if (/theft|burglary|auto|vandal|arson|break/.test(t)) return "property";
  return "other";
}

const CAT_STYLE: Record<string, { color: string; background: string; border: string }> = {
  violent:  { color: "#b91c1c", background: "#fef2f2", border: "#fca5a5" },
  property: { color: "#1d4ed8", background: "#eff6ff", border: "#93c5fd" },
  drug:     { color: "#b45309", background: "#fffbeb", border: "#fcd34d" },
  other:    { color: "#4b5563", background: "#f9fafb", border: "#d1d5db" },
};

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

  const filteredCrimes = crimeFilter === "all"
    ? data.crimes
    : data.crimes.filter((c) => categorizeCrime(c) === crimeFilter);

  const violentCount = data.crimes.filter((c) => categorizeCrime(c) === "violent").length;
  const riskLevel = violentCount >= 5 ? "HIGH" : violentCount >= 2 ? "MODERATE" : "LOW";
  const riskColor = riskLevel === "HIGH" ? "#b91c1c" : riskLevel === "MODERATE" ? "#b45309" : "#15803d";
  const riskBg = riskLevel === "HIGH" ? "#fef2f2" : riskLevel === "MODERATE" ? "#fffbeb" : "#f0fdf4";
  const riskBorder = riskLevel === "HIGH" ? "#fca5a5" : riskLevel === "MODERATE" ? "#fcd34d" : "#86efac";

  const page: React.CSSProperties = { maxWidth: 800, margin: "0 auto", padding: "0 16px 64px", fontFamily: "Segoe UI, sans-serif", fontSize: 15 };
  const card = (bc: string, bg: string): React.CSSProperties => ({ marginBottom: 20, borderRadius: 14, border: `2px solid ${bc}`, background: bg, overflow: "hidden" });
  const cardHeader = (bg: string): React.CSSProperties => ({ background: bg, padding: "12px 20px", display: "flex", alignItems: "center", gap: 8 });
  const cardBody: React.CSSProperties = { padding: "16px 20px" };
  const btn = (bg: string, color: string, border?: string): React.CSSProperties => ({
    display: "inline-block", padding: "9px 18px", background: bg, color, fontWeight: 700, fontSize: 14,
    border: border ? `2px solid ${border}` : "none", borderRadius: 10, cursor: "pointer",
    textDecoration: "none", marginRight: 10, marginBottom: 8
  });

  return (
    <main style={page}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0", borderBottom: "2px solid #e5e7eb", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1z" />
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>SafeCircle</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Neighborhood Safety · Shelby County, TN</p>
          </div>
        </div>
        <button style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", borderRadius: 12, cursor: "pointer", boxShadow: "0 4px 12px rgba(220,38,38,0.4)" }} onClick={handleSOS}>
          🆘 {sosTriggered ? "Calling 911…" : "SOS"}
        </button>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <input
          style={{ flex: 1, height: 48, padding: "0 16px", border: "2px solid #d1d5db", borderRadius: 12, fontSize: 15, outline: "none" }}
          value={inputAddr}
          onChange={(e) => setInputAddr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Enter address in Shelby County, TN"
        />
        <button style={{ padding: "0 24px", height: 48, background: "#1d4ed8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 12, cursor: "pointer" }}
          onClick={handleSearch} disabled={loading}>
          {loading ? "Checking…" : "🔍 Check Address"}
        </button>
      </div>

      {/* Errors */}
      {Object.entries(errors).filter(([key]) => key !== "offenders").map(([key, msg]) => (
        <div key={key} style={{ marginBottom: 12, padding: "12px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, color: "#b91c1c", fontSize: 14 }}>
          ⚠️ {key}: {msg}
        </div>
      ))}

      {searchAddr && !loading && (
        <>
          {/* Info banner */}
          <div style={{ marginBottom: 20, padding: "12px 16px", background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 12, color: "#1e40af", fontSize: 14 }}>
            Results for: <strong>{searchAddr}</strong> · Crimes: past 14 days, 0.5 mi radius
          </div>

          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: riskBg, border: `2px solid ${riskBorder}`, borderRadius: 14, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: riskColor }}>{riskLevel}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Risk Level</div>
            </div>
            <div style={{ background: "#f9fafb", border: "2px solid #e5e7eb", borderRadius: 14, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#dc2626" }}>{data.crimes.length}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Total Crimes</div>
            </div>
            <div style={{ background: "#f9fafb", border: "2px solid #e5e7eb", borderRadius: 14, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#dc2626" }}>{violentCount}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Violent Crimes</div>
            </div>
          </div>

          {/* WARRANTS */}
          <div style={card("#f59e0b", "#fffbeb")}>
            <div style={cardHeader("#d97706")}>
              <span style={{ fontSize: 20 }}>🔎</span>
              <h2 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 16 }}>Shelby County Warrant Search</h2>
            </div>
            <div style={cardBody}>
              <p style={{ color: "#78350f", marginBottom: 14, fontSize: 14 }}>Check active warrants by address or name. Written by John Harvey in 1989 — still working today.</p>
              <a href={buildWarrantUrl(searchAddr)} target="_blank" rel="noopener noreferrer" style={btn("#d97706", "#fff")}>🔍 Search by Address ↗</a>
              <a href={`${WARRANT_BASE}?w=&l=&f=&s=&st=`} target="_blank" rel="noopener noreferrer" style={btn("#fff", "#92400e", "#f59e0b")}>Search by Name ↗</a>
              <a href={JAIL_URL} target="_blank" rel="noopener noreferrer" style={btn("#fff", "#92400e", "#f59e0b")}>🔒 Jail Roster ↗</a>
            </div>
          </div>

          {/* CRIMES */}
          <div style={card("#3b82f6", "#fff")}>
            <div style={cardHeader("#2563eb")}>
              <span style={{ fontSize: 20 }}>🚨</span>
              <h2 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 16 }}>Reported Crimes Nearby ({data.crimes.length})</h2>
            </div>
            <div style={cardBody}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {["all","violent","property","drug","other"].map((cat) => (
                  <button key={cat} onClick={() => setCrimeFilter(cat)} style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    border: crimeFilter === cat ? "2px solid #1d4ed8" : "2px solid #d1d5db",
                    background: crimeFilter === cat ? "#1d4ed8" : "#fff",
                    color: crimeFilter === cat ? "#fff" : "#4b5563"
                  }}>
                    {cat === "all" ? `All (${data.crimes.length})` : `${cat.charAt(0).toUpperCase() + cat.slice(1)} (${data.crimes.filter((c) => categorizeCrime(c) === cat).length})`}
                  </button>
                ))}
              </div>
              {filteredCrimes.length === 0 ? (
                <p style={{ color: "#15803d", fontWeight: 600, textAlign: "center", padding: "16px 0" }}>✅ No crimes found in this category.</p>
              ) : (
                filteredCrimes.map((c) => {
                  const cat = categorizeCrime(c);
                  return (
                    <div key={c.crime_id} style={{ borderRadius: 10, padding: "10px 14px", border: `1px solid ${CAT_STYLE[cat].border}`, background: CAT_STYLE[cat].background, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <strong style={{ color: CAT_STYLE[cat].color, fontSize: 14 }}>{c.offense_type}</strong>
                        <span style={{ color: "#6b7280", fontSize: 12 }}>
                          {new Date(c.offense_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {c.distance_mi != null ? ` · ${c.distance_mi} mi` : ""}
                        </span>
                      </div>
                      <div style={{ color: "#4b5563", fontSize: 13, marginTop: 2 }}>{c.address}</div>
                    </div>
                  );
                })
              )}
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12, marginTop: 8 }}>
                <a href="https://data.memphistn.gov/Public-Safety/Memphis-Police-Department-Public-Safety-Incidents/puh4-eea4" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", fontSize: 13 }}>
                  Source: Memphis MPD Public Safety Incidents ↗
                </a>
              </div>
            </div>
          </div>

          {/* SEX OFFENDERS */}
          <div style={card("#a855f7", "#faf5ff")}>
            <div style={cardHeader("#9333ea")}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <h2 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 16 }}>Sex Offender Registry</h2>
            </div>
            <div style={cardBody}>
              <a href={buildNSOPWUrl(searchAddr)} target="_blank" rel="noopener noreferrer" style={btn("#9333ea", "#fff")}>National Registry (NSOPW) ↗</a>
              <a href={TN_SOR_URL} target="_blank" rel="noopener noreferrer" style={btn("#fff", "#6b21a8", "#a855f7")}>Tennessee SOR ↗</a>
            </div>
          </div>

          {/* MAP */}
          {data.center && (
            <div style={card("#0d9488", "#fff")}>
              <div style={cardHeader("#0f766e")}>
                <span style={{ fontSize: 20 }}>🗺️</span>
                <h2 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 16 }}>Crime Map</h2>
              </div>
              <div style={{ height: 300 }}>
                <Suspense fallback={<div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>Loading map…</div>}>
                  <SafeCircleMap center={data.center} crimes={data.crimes} offenders={[]} />
                </Suspense>
              </div>
            </div>
          )}

          {/* EMERGENCY CONTACTS */}
          <div style={card("#22c55e", "#f0fdf4")}>
            <div style={cardHeader("#16a34a")}>
              <span style={{ fontSize: 20 }}>📍</span>
              <h2 style={{ margin: 0, color: "#fff", fontWeight: 700, fontSize: 16 }}>Nearest Emergency Services</h2>
            </div>
            <div style={cardBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {(data.contacts.length > 0 ? data.contacts.map((c) => ({
                  label: c.type === "police" ? "👮 Police" : c.type === "fire" ? "🚒 Fire" : "🏥 Hospital",
                  name: c.name, phone: c.phone,
                  extra: c.distance_mi != null ? `${c.distance_mi} mi away` : ""
                })) : [
                  { label: "👮 Police", name: "Ridgeway Precinct", phone: "(901) 545-5999", extra: "" },
                  { label: "🚒 Fire", name: "Fire Station #40", phone: "(901) 458-4700", extra: "" },
                  { label: "🏥 Hospital", name: "Methodist Le Bonheur", phone: "(901) 516-5200", extra: "" },
                ]).map((c) => (
                  <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #bbf7d0" }}>
                    <div style={{ fontWeight: 700, color: "#15803d", fontSize: 14, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ color: "#4b5563", fontSize: 13, marginBottom: 8 }}>{c.name}</div>
                    <a href={`tel:${c.phone.replace(/\D/g, "")}`} style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>{c.phone}</a>
                    {c.extra && <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>{c.extra}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SOS */}
          <div style={{ marginTop: 32, borderRadius: 14, border: "2px solid #fca5a5", background: "#fef2f2", padding: 24, textAlign: "center" }}>
            <p style={{ color: "#991b1b", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>🆘 Need immediate help? Alert your Safe Circle or call 911.</p>
            <button onClick={handleSOS} style={{ padding: "12px 32px", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", borderRadius: 12, cursor: "pointer", marginRight: 12 }}>
              📞 Call 911
            </button>
            <a href="sms:?body=🚨 EMERGENCY: I need help immediately! Please call me or call 911."
              style={{ padding: "12px 32px", background: "#ea580c", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", borderRadius: 12, textDecoration: "none" }}>
              💬 SMS Alert
            </a>
          </div>
        </>
      )}

      {!searchAddr && !loading && (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🛡️</div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Enter an address above to get started</p>
          <p style={{ fontSize: 15, color: "#6b7280" }}>SafeCircle checks warrants, crimes, sex offenders, and nearest emergency services for any Shelby County address.</p>
        </div>
      )}
    </main>
  );
}
