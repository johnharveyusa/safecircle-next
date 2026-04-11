"use client";

/**
 * app/page.tsx
 *
 * SafeCircle — unified address safety check + circle of friends.
 * Each safety check fires independently so they never all launch at once.
 */

import { useState, useRef } from "react";
import dynamic from "next/dynamic";

const LeafletMapComponent = dynamic(
  () => import("./LeafletMapComponent"),
  { ssr: false }
);

// ── Types ──────────────────────────────────────────────────────────────────

interface WarrantResult {
  found: boolean;
  count: number;
  search_url: string;
}

interface OffenderResult {
  search_url: string;
}

interface CrimesResult {
  total: number;
  by_category: Record<string, number>;
  date_range: { from: string; to: string };
  error?: string;
}

interface Contact {
  name: string;
  email: string;
  phone: string;
}

type CheckState = "idle" | "loading" | "done" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function buildNSOPWUrl(address: string) {
  const parts = address.trim().split(/\s+/);
  const street = parts.slice(1).join(" ");
  return (
    `https://www.nsopw.gov/en/Search/Results?` +
    `street=${encodeURIComponent(address)}&city=Memphis&state=TN&radius=0.5`
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SafeCirclePage() {
  const [address, setAddress] = useState("");
  const [lockedAddress, setLockedAddress] = useState("");

  // Check states
  const [warrantState, setWarrantState] = useState<CheckState>("idle");
  const [warrantData, setWarrantData] = useState<WarrantResult | null>(null);

  const [offenderState, setOffenderState] = useState<CheckState>("idle");
  const [offenderData, setOffenderData] = useState<OffenderResult | null>(null);

  const [crimesState, setCrimesState] = useState<CheckState>("idle");
  const [crimesData, setCrimesData] = useState<CrimesResult | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [mapIncidents, setMapIncidents] = useState<any[]>([]);

  // Circle of friends
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sc_contacts") ?? "[]");
    } catch {
      return [];
    }
  });
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Address lock ─────────────────────────────────────────────────────────

  function lockAddress() {
    const val = address.trim();
    if (!val) return;
    setLockedAddress(val);
    setWarrantState("idle");
    setWarrantData(null);
    setOffenderState("idle");
    setOffenderData(null);
    setCrimesState("idle");
    setCrimesData(null);
  }

  // ── Safety checks ─────────────────────────────────────────────────────────

  async function runWarrant() {
    if (!lockedAddress) return;
    setWarrantState("loading");
    try {
      const res = await fetch(
        `/api/warrants?address=${encodeURIComponent(lockedAddress)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWarrantData(data);
      setWarrantState("done");
    } catch (e) {
      setWarrantState("error");
    }
  }

  async function runOffender() {
    if (!lockedAddress) return;
    setOffenderState("loading");
    // NSOPW doesn't have a public API — build direct search URL
    setTimeout(() => {
      setOffenderData({ search_url: buildNSOPWUrl(lockedAddress) });
      setOffenderState("done");
    }, 600);
  }

  async function runCrimes() {
    if (!lockedAddress) return;
    setCrimesState("loading");
    try {
      const res = await fetch(
        `/api/crimes?address=${encodeURIComponent(lockedAddress)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCrimesData(data);
      if (data.center) {
        setMapCenter({ lat: data.center.y, lon: data.center.x });
        setMapIncidents(
          (data.features ?? []).map((f: any) => ({
            attributes: {
              Latitude: data.center.y,
              Longitude: data.center.x,
              UCR_Category: f.UCR_Category,
              UCR_Description: f.UCR_Category,
              Street_Address: f.Address,
              Offense_Datetime: null,
            },
          }))
        );
      }
      setCrimesState("done");
    } catch (e) {
      setCrimesState("error");
      setCrimesData({ total: 0, by_category: {}, date_range: { from: "", to: "" }, error: String(e) });
    }
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  function saveContacts(updated: Contact[]) {
    setContacts(updated);
    try {
      localStorage.setItem("sc_contacts", JSON.stringify(updated));
    } catch {}
  }

  function addContact() {
    const name = newName.trim();
    const email = newEmail.trim();
    const phone = newPhone.trim();
    if (!name) { setFormError("Full name is required."); return; }
    if (!email || !email.includes("@")) { setFormError("A valid email is required."); return; }
    if (!phone) { setFormError("Phone number is required."); return; }
    setFormError("");
    saveContacts([...contacts, { name, email, phone }]);
    setNewName(""); setNewEmail(""); setNewPhone("");
  }

  function removeContact(i: number) {
    saveContacts(contacts.filter((_, idx) => idx !== i));
  }

  function exportCSV() {
    if (!contacts.length) return;
    const rows = [
      ["Full Name", "Email", "Phone"],
      ...contacts.map((c) => [c.name, c.email, c.phone]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "safecircle_friends.csv";
    a.click();
  }

  function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).trim().split(/\r?\n/);
      const imported: Contact[] = [];
      lines.forEach((line, idx) => {
        const cols = line
          .split(",")
          .map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
        if (idx === 0 && cols[0].toLowerCase().includes("name")) return;
        if (cols.length >= 3 && cols[0])
          imported.push({ name: cols[0], email: cols[1] ?? "", phone: cols[2] ?? "" });
      });
      saveContacts([...contacts, ...imported]);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const checksEnabled = !!lockedAddress;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur px-6 h-14 flex items-center justify-between">
        <span className="font-mono text-sm font-medium text-emerald-400 tracking-wider">
          ● SAFECIRCLE
        </span>
        <span className="font-mono text-xs text-gray-500">
          neighborhood safety · memphis
        </span>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Address Input */}
        <section>
          <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">
            Address lookup
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lockAddress()}
              placeholder="4128 Weymouth Cove"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-4 h-11 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={lockAddress}
              className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-mono text-sm font-medium px-5 h-11 rounded-md transition-opacity"
            >
              Set address
            </button>
          </div>
          {lockedAddress && (
            <p className="font-mono text-xs text-gray-500 mt-2">
              ▸ Checking: {lockedAddress}
            </p>
          )}
        </section>

        {/* Safety Checks */}
        <section className="space-y-3">

          {/* Warrant */}
          <CheckCard
            icon="⚖️"
            title="Warrant search"
            desc="Shelby County Sheriff's Office"
            state={warrantState}
            disabled={!checksEnabled}
            onRun={runWarrant}
          >
            {warrantState === "done" && warrantData && (
              <div className="space-y-2">
                <StatusRow color="yellow" label="Results open in external site — review manually" />
                <a
                  href={warrantData.search_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-1 px-3 py-2 bg-gray-800 border border-gray-700 hover:border-blue-500 text-blue-400 font-mono text-xs rounded-md transition-colors"
                >
                  ↗ Open Shelby Co. warrant search
                </a>
              </div>
            )}
            {warrantState === "error" && (
              <StatusRow color="red" label="Could not reach warrants API" />
            )}
          </CheckCard>

          {/* Sex Offender */}
          <CheckCard
            icon="🔍"
            title="Sex offender registry"
            desc="National Sex Offender Public Website · ½ mi radius"
            state={offenderState}
            disabled={!checksEnabled}
            onRun={runOffender}
          >
            {offenderState === "done" && offenderData && (
              <div className="space-y-2">
                <StatusRow color="yellow" label="Results open on NSOPW — review manually" />
                <a
                  href={offenderData.search_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-1 px-3 py-2 bg-gray-800 border border-gray-700 hover:border-blue-500 text-blue-400 font-mono text-xs rounded-md transition-colors"
                >
                  ↗ Open National Sex Offender Registry
                </a>
              </div>
            )}
          </CheckCard>

          {/* Crimes */}
          <CheckCard
            icon="📍"
            title="Recent crime reports"
            desc="Memphis Public Safety · ESRI · ½ mile · last 14 days"
            state={crimesState}
            disabled={!checksEnabled}
            onRun={runCrimes}
          >
            {crimesState === "done" && crimesData && !crimesData.error && (
              <div className="space-y-3">
                <StatusRow
                  color={crimesData.total === 0 ? "green" : crimesData.total < 5 ? "yellow" : "red"}
                  label={
                    crimesData.total === 0
                      ? "No reported offenses"
                      : `${crimesData.total} offense${crimesData.total !== 1 ? "s" : ""} reported`
                  }
                />
                {Object.keys(crimesData.by_category).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(crimesData.by_category)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([cat, cnt]) => (
                        <span
                          key={cat}
                          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 font-mono text-xs"
                        >
                          {cat}:{" "}
                          <span className="text-blue-400 font-medium">{cnt}</span>
                        </span>
                      ))}
                  </div>
                )}
                <p className="font-mono text-xs text-gray-500">
                  {crimesData.date_range.from} → {crimesData.date_range.to} · Memphis Public Safety / ESRI
                </p>
              </div>
            )}
            {crimesState === "done" && crimesData?.error && (
              <StatusRow color="red" label={crimesData.error} />
            )}
            {crimesState === "error" && (
              <StatusRow color="red" label="Could not fetch crime data" />
            )}
          </CheckCard>

        </section>

        {/* Map — shows after crimes check runs */}
        {mapCenter && (
          <section>
            <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">
              Crime map · ½ mile radius
            </p>
            <LeafletMapComponent
              lat={mapCenter.lat}
              lon={mapCenter.lon}
              incidents={mapIncidents}
              matchedAddress={lockedAddress}
            />
          </section>
        )}

        <hr className="border-gray-800" />

        {/* Circle of Friends */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-100">Circle of friends</h2>
            <span className="font-mono text-xs text-gray-500">
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Add form */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              {[
                { label: "Full name", val: newName, set: setNewName, type: "text", ph: "Jane Doe" },
                { label: "Email", val: newEmail, set: setNewEmail, type: "email", ph: "jane@example.com" },
                { label: "Phone", val: newPhone, set: setNewPhone, type: "tel", ph: "(901) 555-0100" },
              ].map(({ label, val, set, type, ph }) => (
                <div key={label}>
                  <label className="font-mono text-xs text-gray-500 uppercase tracking-widest block mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addContact()}
                    placeholder={ph}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 h-9 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={addContact}
              className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-mono text-xs px-4 h-8 rounded transition-colors"
            >
              + Add contact
            </button>
            {formError && (
              <p className="font-mono text-xs text-red-400 mt-2">{formError}</p>
            )}
          </div>

          {/* Contacts list */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden mb-3">
            <div className="grid grid-cols-[32px_1fr_1fr_1fr_32px] gap-0 px-4 py-2 bg-gray-800/60 border-b border-gray-800">
              {["", "Name", "Email", "Phone", ""].map((h, i) => (
                <span key={i} className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                  {h}
                </span>
              ))}
            </div>
            {contacts.length === 0 ? (
              <p className="text-center font-mono text-xs text-gray-600 py-8">
                No contacts yet — add someone above or import a CSV.
              </p>
            ) : (
              contacts.map((c, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[32px_1fr_1fr_1fr_32px] gap-0 px-4 py-2.5 border-b border-gray-800 last:border-0 items-center hover:bg-gray-800/40"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono text-xs text-emerald-400">
                    {initials(c.name)}
                  </div>
                  <span className="text-sm font-medium text-gray-100 pr-2 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-gray-400 pr-2 truncate">{c.email}</span>
                  <span className="font-mono text-xs text-gray-400 pr-2 truncate">{c.phone}</span>
                  <button
                    onClick={() => removeContact(i)}
                    className="text-gray-600 hover:text-red-400 text-base leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={exportCSV}
              className="border border-gray-700 hover:border-emerald-500 hover:text-emerald-400 text-gray-400 font-mono text-xs px-4 h-8 rounded transition-colors"
            >
              ↓ Export CSV
            </button>
            <label className="border border-gray-700 hover:border-gray-500 text-gray-400 font-mono text-xs px-4 h-8 rounded transition-colors cursor-pointer flex items-center">
              ↑ Import CSV
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={importCSV}
              />
            </label>
            <button
              onClick={() => { if (contacts.length && confirm("Remove all contacts?")) saveContacts([]); }}
              className="border border-gray-700 hover:border-red-500 hover:text-red-400 text-gray-400 font-mono text-xs px-4 h-8 rounded transition-colors"
            >
              Clear all
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CheckCard({
  icon, title, desc, state, disabled, onRun, children,
}: {
  icon: string;
  title: string;
  desc: string;
  state: CheckState;
  disabled: boolean;
  onRun: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`bg-gray-900 border rounded-lg overflow-hidden transition-colors ${state !== "idle" ? "border-gray-700" : "border-gray-800"}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-100">{title}</p>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={disabled || state === "loading" || state === "done"}
          className="border border-gray-700 hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-default text-gray-400 font-mono text-xs px-3 h-8 rounded transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          {state === "loading" && (
            <span className="w-3 h-3 border border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
          )}
          {state === "idle" && "Run check"}
          {state === "loading" && "Checking…"}
          {state === "done" && "✓ Done"}
          {state === "error" && "Retry"}
        </button>
      </div>
      {state !== "idle" && children && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3">{children}</div>
      )}
    </div>
  );
}

function StatusRow({ color, label }: { color: "green" | "yellow" | "red" | "blue"; label: string }) {
  const dotColor = {
    green: "bg-emerald-400 shadow-emerald-400/50",
    yellow: "bg-yellow-400 shadow-yellow-400/50",
    red: "bg-red-400 shadow-red-400/50",
    blue: "bg-blue-400 shadow-blue-400/50",
  }[color];
  const textColor = {
    green: "text-emerald-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    blue: "text-blue-400",
  }[color];
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full shadow-sm flex-shrink-0 ${dotColor}`} />
      <span className={`font-mono text-xs ${textColor}`}>{label}</span>
    </div>
  );
}
