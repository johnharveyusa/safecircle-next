// /* "use client";

// /**
//  * app/page.tsx
//  *
//  * SafeCircle — full feature page.
//  *
//  * Features:
//  *  1. Address input — locks address, enables all checks
//  *  2. Warrant search  — opens Shelby Co. Sheriff site in new tab (parameterized URL)
//  *  3. Sex offender    — opens NSOPW in new tab
//  *  4. Crime reports   — live ESRI/MPD query, table + map
//  *  5. Jail roster     — direct link to Shelby Co. jail
//  *  6. Circle of friends — manual entry or CSV import, export CSV
//  *  7. SOS alert       — one button emails/SMS entire circle
//  */

// import { useState, useRef } from "react";
// import dynamic from "next/dynamic";

// const LeafletMapComponent = dynamic(() => import("./LeafletMapComponent"), {
//   ssr: false,
// });

// // ── Types ──────────────────────────────────────────────────────────────────

// interface WarrantResult {
//   address_url: string;
//   name_url: string;
//   parsed: { street_number: string; street_name: string };
// }

// interface CrimeFeature {
//   UCR_Category: string;
//   UCR_Description: string;
//   Street_Address: string;
//   Offense_Datetime: number | null;
//   Latitude: number | null;
//   Longitude: number | null;
// }

// interface CrimesResult {
//   total: number;
//   matched: string;
//   by_category: Record<string, number>;
//   features: CrimeFeature[];
//   date_range: { from: string; to: string };
//   center: { lat: number; lon: number };
//   error?: string;
// }

// interface Contact {
//   name: string;
//   email: string;
//   phone: string;
// }

// type CheckState = "idle" | "loading" | "done" | "error";

// // ── Helpers ────────────────────────────────────────────────────────────────

// function initials(name: string) {
//   return name
//     .trim()
//     .split(/\s+/)
//     .map((w) => w[0] ?? "")
//     .slice(0, 2)
//     .join("")
//     .toUpperCase();
// }

// function fmtDate(ms: number | null) {
//   if (!ms) return "";
//   return new Date(ms).toLocaleString();
// }

// function buildNSOPWUrl(address: string) {
//   return `https://www.nsopw.gov/en/Search/Results?street=${encodeURIComponent(
//     address
//   )}&city=Memphis&state=TN&radius=0.5`;
// }

// const UCR_COLOR: Record<string, string> = {
//   VIOLENT: "#ef4444",
//   ROBBERY: "#ef4444",
//   HOMICIDE: "#ef4444",
//   ASSAULT: "#ef4444",
//   BURGLARY: "#f59e0b",
//   THEFT: "#f59e0b",
//   PROPERTY: "#f59e0b",
//   VANDAL: "#f59e0b",
//   FRAUD: "#8b5cf6",
// };

// function crimeColor(cat: string) {
//   const up = cat.toUpperCase();
//   for (const [key, color] of Object.entries(UCR_COLOR)) {
//     if (up.includes(key)) return color;
//   }
//   return "#64748b";
// }

// // ── Component ──────────────────────────────────────────────────────────────

// export default function SafeCirclePage() {
//   // Address
//   const [address, setAddress] = useState("");
//   const [lockedAddress, setLockedAddress] = useState("");

//   // Warrant
//   const [warrantState, setWarrantState] = useState<CheckState>("idle");
//   const [warrantData, setWarrantData] = useState<WarrantResult | null>(null);

//   // Sex offender
//   const [offenderState, setOffenderState] = useState<CheckState>("idle");

//   // Crimes
//   const [crimesState, setCrimesState] = useState<CheckState>("idle");
//   const [crimesData, setCrimesData] = useState<CrimesResult | null>(null);

//   // Circle of friends
//   const [contacts, setContacts] = useState<Contact[]>(() => {
//     try {
//       return JSON.parse(localStorage.getItem("sc_contacts") ?? "[]");
//     } catch {
//       return [];
//     }
//   });
//   const [newName, setNewName] = useState("");
//   const [newEmail, setNewEmail] = useState("");
//   const [newPhone, setNewPhone] = useState("");
//   const [formError, setFormError] = useState("");
//   const [sosState, setSosState] = useState<"idle" | "sent">("idle");
//   const fileRef = useRef<HTMLInputElement>(null);

//   // ── Address lock ─────────────────────────────────────────────────────────

//   function lockAddress() {
//     const val = address.trim();
//     if (!val) return;
//     setLockedAddress(val);
//     setWarrantState("idle");
//     setWarrantData(null);
//     setOffenderState("idle");
//     setCrimesState("idle");
//     setCrimesData(null);
//     setSosState("idle");
//   }

//   const checksEnabled = !!lockedAddress;

//   // ── Warrant ───────────────────────────────────────────────────────────────

//   async function runWarrant() {
//     if (!lockedAddress) return;
//     setWarrantState("loading");
//     try {
//       const res = await fetch(
//         `/api/warrants?address=${encodeURIComponent(lockedAddress)}`
//       );
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       const data: WarrantResult = await res.json();
//       setWarrantData(data);
//       setWarrantState("done");
//       // Open the sheriff site immediately in a new tab
//       window.open(data.address_url, "_blank", "noopener,noreferrer");
//     } catch {
//       setWarrantState("error");
//     }
//   }

//   // ── Sex offender ──────────────────────────────────────────────────────────

//   function runOffender() {
//     if (!lockedAddress) return;
//     setOffenderState("loading");
//     setTimeout(() => {
//       window.open(buildNSOPWUrl(lockedAddress), "_blank", "noopener,noreferrer");
//       setOffenderState("done");
//     }, 400);
//   }

//   // ── Crimes ────────────────────────────────────────────────────────────────

//   async function runCrimes() {
//     if (!lockedAddress) return;
//     setCrimesState("loading");
//     try {
//       const res = await fetch(
//         `/api/crimes?address=${encodeURIComponent(lockedAddress)}`
//       );
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       const data: CrimesResult = await res.json();
//       setCrimesData(data);
//       setCrimesState("done");
//     } catch (e) {
//       setCrimesData({
//         total: 0,
//         matched: lockedAddress,
//         by_category: {},
//         features: [],
//         date_range: { from: "", to: "" },
//         center: { lat: 35.1495, lon: -90.049 },
//         error: String(e),
//       });
//       setCrimesState("error");
//     }
//   }

//   // ── Contacts ──────────────────────────────────────────────────────────────

//   function saveContacts(updated: Contact[]) {
//     setContacts(updated);
//     try {
//       localStorage.setItem("sc_contacts", JSON.stringify(updated));
//     } catch {}
//   }

//   function addContact() {
//     const name = newName.trim();
//     const email = newEmail.trim();
//     const phone = newPhone.trim();
//     if (!name) { setFormError("Full name is required."); return; }
//     if (!email || !email.includes("@")) { setFormError("A valid email is required."); return; }
//     if (!phone) { setFormError("Phone number is required."); return; }
//     setFormError("");
//     saveContacts([...contacts, { name, email, phone }]);
//     setNewName(""); setNewEmail(""); setNewPhone("");
//   }

//   function removeContact(i: number) {
//     saveContacts(contacts.filter((_, idx) => idx !== i));
//   }

//   function exportCSV() {
//     if (!contacts.length) return;
//     const rows = [
//       ["Full Name", "Email", "Phone"],
//       ...contacts.map((c) => [c.name, c.email, c.phone]),
//     ];
//     const csv = rows
//       .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
//       .join("\r\n");
//     const a = document.createElement("a");
//     a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
//     a.download = "safecircle_friends.csv";
//     a.click();
//   }

//   function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onload = (ev) => {
//       const lines = (ev.target?.result as string).trim().split(/\r?\n/);
//       const imported: Contact[] = [];
//       lines.forEach((line, idx) => {
//         const cols = line
//           .split(",")
//           .map((c) => c.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
//         if (idx === 0 && cols[0].toLowerCase().includes("name")) return;
//         if (cols.length >= 3 && cols[0])
//           imported.push({
//             name: cols[0],
//             email: cols[1] ?? "",
//             phone: cols[2] ?? "",
//           });
//       });
//       saveContacts([...contacts, ...imported]);
//       if (fileRef.current) fileRef.current.value = "";
//     };
//     reader.readAsText(file);
//   }

//   // ── SOS Alert ─────────────────────────────────────────────────────────────

//   function sendSOS() {
//     if (!contacts.length) return;
//     const subject = encodeURIComponent("🚨 SAFECIRCLE SOS — I need help immediately");
//     const body = encodeURIComponent(
//       `This is an emergency alert from SafeCircle.\n\nI need help immediately.\n\nAddress: ${lockedAddress || "unknown"}\n\nPlease call or come to my location now.\n\nSent via SafeCircle.`
//     );
//     const emails = contacts.map((c) => encodeURIComponent(c.email)).join(",");
//     window.location.href = `mailto:${emails}?subject=${subject}&body=${body}`;
//     setSosState("sent");
//   }

//   // ── Render ────────────────────────────────────────────────────────────────

//   const mapIncidents = (crimesData?.features ?? []).map((f) => ({
//     attributes: {
//       Latitude: f.Latitude,
//       Longitude: f.Longitude,
//       UCR_Category: f.UCR_Category,
//       UCR_Description: f.UCR_Description,
//       Street_Address: f.Street_Address,
//       Offense_Datetime: f.Offense_Datetime,
//     },
//   }));

//   return (
//     <main className="min-h-screen bg-gray-950 text-gray-100">

//       {/* Header */}
//       <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur px-6 h-14 flex items-center justify-between">
//         <span className="font-mono text-sm font-medium text-emerald-400 tracking-wider">
//           ● SAFECIRCLE
//         </span>
//         <span className="font-mono text-xs text-gray-500 hidden sm:block">
//           neighborhood safety · memphis
//         </span>
//       </header>

//       <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

//         {/* ── Address Input ── */}
//         <section>
//           <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">
//             Address lookup
//           </p>
//           <div className="flex gap-2">
//             <input
//               type="text"
//               value={address}
//               onChange={(e) => setAddress(e.target.value)}
//               onKeyDown={(e) => e.key === "Enter" && lockAddress()}
//               placeholder="4128 Weymouth Cove"
//               className="flex-1 bg-gray-900 border border-gray-700 rounded-md px-4 h-11 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
//             />
//             <button
//               onClick={lockAddress}
//               className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-mono text-sm font-medium px-5 h-11 rounded-md transition-opacity"
//             >
//               Set address
//             </button>
//           </div>
//           {lockedAddress && (
//             <p className="font-mono text-xs text-gray-500 mt-2">
//               ▸ {lockedAddress}
//             </p>
//           )}
//         </section>

//         {/* ── Safety Checks ── */}
//         <section className="space-y-3">

//           {/* Warrant */}
//           <CheckCard
//             icon="⚖️"
//             title="Warrant search"
//             desc="Shelby County Sheriff's Office — opens in new tab"
//             state={warrantState}
//             disabled={!checksEnabled}
//             onRun={runWarrant}
//           >
//             {warrantState === "done" && warrantData && (
//               <div className="space-y-2">
//                 <StatusRow color="yellow" label="Sheriff site opened — review results there" />
//                 <div className="flex gap-2 flex-wrap mt-2">
//                   <a href={warrantData.address_url} target="_blank" rel="noopener noreferrer"
//                     className="result-link">
//                     ↗ Search by address
//                   </a>
//                   <a href={`https://warrants.shelby-sheriff.org/w_warrant_result.php?w=&l=&f=&s=&st=`}
//                     target="_blank" rel="noopener noreferrer"
//                     className="result-link">
//                     ↗ Search by name
//                   </a>
//                 </div>
//                 <p className="font-mono text-xs text-gray-500 mt-1">
//                   Parsed: street #{warrantData.parsed.street_number} · street "{warrantData.parsed.street_name}"
//                 </p>
//               </div>
//             )}
//             {warrantState === "error" && (
//               <StatusRow color="red" label="Could not build warrant URL" />
//             )}
//           </CheckCard>

//           {/* Sex Offender */}
//           <CheckCard
//             icon="🔍"
//             title="Sex offender registry"
//             desc="National Sex Offender Public Website — opens in new tab"
//             state={offenderState}
//             disabled={!checksEnabled}
//             onRun={runOffender}
//           >
//             {offenderState === "done" && (
//               <div className="space-y-2">
//                 <StatusRow color="yellow" label="NSOPW opened — review results there" />
//                 <a
//                   href={buildNSOPWUrl(lockedAddress)}
//                   target="_blank" rel="noopener noreferrer"
//                   className="result-link mt-2 inline-flex"
//                 >
//                   ↗ Open National Sex Offender Registry
//                 </a>
//               </div>
//             )}
//           </CheckCard>

//           {/* Crime Reports */}
//           <CheckCard
//             icon="📍"
//             title="Recent crime reports"
//             desc="Memphis Public Safety · ESRI · ½ mile · last 14 days"
//             state={crimesState}
//             disabled={!checksEnabled}
//             onRun={runCrimes}
//           >
//             {crimesState === "done" && crimesData && !crimesData.error && (
//               <div className="space-y-3">
//                 <StatusRow
//                   color={
//                     crimesData.total === 0
//                       ? "green"
//                       : crimesData.total < 5
//                       ? "yellow"
//                       : "red"
//                   }
//                   label={
//                     crimesData.total === 0
//                       ? "No reported offenses"
//                       : `${crimesData.total} offense${crimesData.total !== 1 ? "s" : ""} reported near ${crimesData.matched}`
//                   }
//                 />

//                 {/* Category badges */}
//                 {Object.keys(crimesData.by_category).length > 0 && (
//                   <div className="flex flex-wrap gap-2">
//                     {Object.entries(crimesData.by_category)
//                       .sort((a, b) => b[1] - a[1])
//                       .map(([cat, cnt]) => (
//                         <span
//                           key={cat}
//                           className="bg-gray-800 border border-gray-700 rounded px-3 py-1 font-mono text-xs"
//                           style={{ borderLeftColor: crimeColor(cat), borderLeftWidth: 3 }}
//                         >
//                           {cat}:{" "}
//                           <span className="font-medium" style={{ color: crimeColor(cat) }}>
//                             {cnt}
//                           </span>
//                         </span>
//                       ))}
//                   </div>
//                 )}

//                 {/* Incident table */}
//                 {crimesData.features.length > 0 && (
//                   <div className="overflow-auto rounded-lg border border-gray-800 mt-2">
//                     <table className="min-w-[640px] w-full text-left">
//                       <thead className="bg-gray-800/60">
//                         <tr className="border-b border-gray-800">
//                           {["When", "Category", "Description", "Address"].map((h) => (
//                             <th key={h} className="py-2 px-3 font-mono text-xs text-gray-400">
//                               {h}
//                             </th>
//                           ))}
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {crimesData.features.slice(0, 40).map((f, i) => (
//                           <tr key={i} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
//                             <td className="py-2 px-3 font-mono text-xs text-gray-400 whitespace-nowrap">
//                               {fmtDate(f.Offense_Datetime)}
//                             </td>
//                             <td className="py-2 px-3 text-xs font-medium whitespace-nowrap"
//                               style={{ color: crimeColor(f.UCR_Category) }}>
//                               {f.UCR_Category}
//                             </td>
//                             <td className="py-2 px-3 text-xs text-gray-300">{f.UCR_Description}</td>
//                             <td className="py-2 px-3 font-mono text-xs text-gray-400">{f.Street_Address}</td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                     {crimesData.features.length > 40 && (
//                       <p className="font-mono text-xs text-gray-500 px-3 py-2">
//                         Showing 40 of {crimesData.features.length} incidents
//                       </p>
//                     )}
//                   </div>
//                 )}

//                 <p className="font-mono text-xs text-gray-600">
//                   {crimesData.date_range.from} → {crimesData.date_range.to} · Memphis Public Safety / ESRI
//                 </p>
//               </div>
//             )}
//             {(crimesState === "done" && crimesData?.error) ||
//               crimesState === "error" ? (
//               <StatusRow
//                 color="red"
//                 label={crimesData?.error ?? "Could not fetch crime data"}
//               />
//             ) : null}
//           </CheckCard>

//           {/* Jail Roster */}
//           <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
//             <div className="flex items-center gap-3">
//               <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm">
//                 🏛️
//               </div>
//               <div>
//                 <p className="text-sm font-medium text-gray-100">Shelby Co. jail roster</p>
//                 <p className="text-xs text-gray-500">See who is currently in custody</p>
//               </div>
//             </div>
//             <a
//               href="https://imljail.shelbycountytn.gov/IML"
//               target="_blank"
//               rel="noopener noreferrer"
//               className="border border-gray-700 hover:border-emerald-500 hover:text-emerald-400 text-gray-400 font-mono text-xs px-3 h-8 rounded transition-colors flex items-center"
//             >
//               ↗ Open roster
//             </a>
//           </div>

//         </section>

//         {/* ── Crime Map ── */}
//         {crimesState === "done" && crimesData && !crimesData.error && crimesData.center && (
//           <section>
//             <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mb-2">
//               Crime map · ½ mile radius
//             </p>
//             <LeafletMapComponent
//               lat={crimesData.center.lat}
//               lon={crimesData.center.lon}
//               incidents={mapIncidents}
//               matchedAddress={crimesData.matched}
//             />
//           </section>
//         )}

//         <hr className="border-gray-800" />

//         {/* ── Circle of Friends ── */}
//         <section>
//           <div className="flex items-baseline justify-between mb-4">
//             <h2 className="text-lg font-medium text-gray-100">Circle of friends</h2>
//             <span className="font-mono text-xs text-gray-500">
//               {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
//             </span>
//           </div>

//           {/* SOS Button */}
//           {contacts.length > 0 && (
//             <button
//               onClick={sendSOS}
//               className={`w-full mb-4 h-12 rounded-lg font-mono text-sm font-medium tracking-wider transition-all ${
//                 sosState === "sent"
//                   ? "bg-gray-800 border border-gray-700 text-gray-500 cursor-default"
//                   : "bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:border-red-400"
//               }`}
//               disabled={sosState === "sent"}
//             >
//               {sosState === "sent"
//                 ? "✓ SOS alert sent to your circle"
//                 : "🚨 SOS — Alert my entire circle now"}
//             </button>
//           )}

//           {/* Add form */}
//           <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-3">
//             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
//               {[
//                 { label: "Full name", val: newName, set: setNewName, type: "text", ph: "Jane Doe" },
//                 { label: "Email", val: newEmail, set: setNewEmail, type: "email", ph: "jane@example.com" },
//                 { label: "Phone", val: newPhone, set: setNewPhone, type: "tel", ph: "(901) 555-0100" },
//               ].map(({ label, val, set, type, ph }) => (
//                 <div key={label}>
//                   <label className="font-mono text-xs text-gray-500 uppercase tracking-widest block mb-1">
//                     {label}
//                   </label>
//                   <input
//                     type={type}
//                     value={val}
//                     onChange={(e) => set(e.target.value)}
//                     onKeyDown={(e) => e.key === "Enter" && addContact()}
//                     placeholder={ph}
//                     className="w-full bg-gray-800 border border-gray-700 rounded px-3 h-9 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-500"
//                   />
//                 </div>
//               ))}
//             </div>
//             <button
//               onClick={addContact}
//               className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-mono text-xs px-4 h-8 rounded transition-colors"
//             >
//               + Add contact
//             </button>
//             {formError && (
//               <p className="font-mono text-xs text-red-400 mt-2">{formError}</p>
//             )}
//           </div>

//           {/* Contacts table */}
//           <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden mb-3">
//             <div className="grid grid-cols-[32px_1fr_1fr_1fr_32px] px-4 py-2 bg-gray-800/60 border-b border-gray-800">
//               {["", "Name", "Email", "Phone", ""].map((h, i) => (
//                 <span key={i} className="font-mono text-xs text-gray-500 uppercase tracking-widest">
//                   {h}
//                 </span>
//               ))}
//             </div>
//             {contacts.length === 0 ? (
//               <p className="text-center font-mono text-xs text-gray-600 py-8">
//                 No contacts yet — add someone above or import a CSV.
//               </p>
//             ) : (
//               contacts.map((c, i) => (
//                 <div
//                   key={i}
//                   className="grid grid-cols-[32px_1fr_1fr_1fr_32px] px-4 py-2.5 border-b border-gray-800 last:border-0 items-center hover:bg-gray-800/40"
//                 >
//                   <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono text-xs text-emerald-400">
//                     {initials(c.name)}
//                   </div>
//                   <span className="text-sm font-medium text-gray-100 pr-2 truncate">{c.name}</span>
//                   <span className="font-mono text-xs text-gray-400 pr-2 truncate">{c.email}</span>
//                   <span className="font-mono text-xs text-gray-400 pr-2 truncate">{c.phone}</span>
//                   <button
//                     onClick={() => removeContact(i)}
//                     className="text-gray-600 hover:text-red-400 text-base leading-none transition-colors"
//                   >
//                     ×
//                   </button>
//                 </div>
//               ))
//             )}
//           </div>

//           {/* Actions */}
//           <div className="flex gap-2 flex-wrap">
//             <button
//               onClick={exportCSV}
//               className="border border-gray-700 hover:border-emerald-500 hover:text-emerald-400 text-gray-400 font-mono text-xs px-4 h-8 rounded transition-colors"
//             >
//               ↓ Export CSV
//             </button>
//             <label className="border border-gray-700 hover:border-gray-500 text-gray-400 font-mono text-xs px-4 h-8 rounded transition-colors cursor-pointer flex items-center">
//               ↑ Import CSV
//               <input
//                 ref={fileRef}
//                 type="file"
//                 accept=".csv"
//                 className="hidden"
//                 onChange={importCSV}
//               />
//             </label>
//             <button
//               onClick={() => {
//                 if (contacts.length && confirm("Remove all contacts?"))
//                   saveContacts([]);
//               }}
//               className="border border-gray-700 hover:border-red-500 hover:text-red-400 text-gray-400 font-mono text-xs px-4 h-8 rounded transition-colors"
//             >
//               Clear all
//             </button>
//           </div>
//         </section>

//       </div>

//       {/* Inline styles for reused classes */}
//       <style jsx>{`
//         .result-link {
//           display: inline-flex;
//           align-items: center;
//           gap: 6px;
//           padding: 6px 12px;
//           background: rgb(31 41 55);
//           border: 1px solid rgb(55 65 81);
//           border-radius: 6px;
//           color: rgb(96 165 250);
//           font-family: monospace;
//           font-size: 12px;
//           text-decoration: none;
//           transition: border-color 0.15s;
//         }
//         .result-link:hover {
//           border-color: rgb(96 165 250);
//         }
//       `}</style>
//     </main>
//   );
// }

// // ── Sub-components ─────────────────────────────────────────────────────────

// function CheckCard({
//   icon, title, desc, state, disabled, onRun, children,
// }: {
//   icon: string;
//   title: string;
//   desc: string;
//   state: CheckState;
//   disabled: boolean;
//   onRun: () => void;
//   children?: React.ReactNode;
// }) {
//   return (
//     <div
//       className={`bg-gray-900 border rounded-lg overflow-hidden transition-colors ${
//         state !== "idle" ? "border-gray-700" : "border-gray-800"
//       }`}
//     >
//       <div className="flex items-center justify-between px-4 py-3">
//         <div className="flex items-center gap-3">
//           <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-sm flex-shrink-0">
//             {icon}
//           </div>
//           <div>
//             <p className="text-sm font-medium text-gray-100">{title}</p>
//             <p className="text-xs text-gray-500">{desc}</p>
//           </div>
//         </div>
//         <button
//           onClick={onRun}
//           disabled={disabled || state === "loading" || state === "done"}
//           className="border border-gray-700 hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-default text-gray-400 font-mono text-xs px-3 h-8 rounded transition-colors flex items-center gap-1.5 flex-shrink-0 ml-3"
//         >
//           {state === "loading" && (
//             <span className="w-3 h-3 border border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
//           )}
//           {state === "idle" && "Run check"}
//           {state === "loading" && "Checking…"}
//           {state === "done" && "✓ Done"}
//           {state === "error" && "Retry"}
//         </button>
//       </div>
//       {state !== "idle" && children && (
//         <div className="px-4 pb-4 border-t border-gray-800 pt-3">{children}</div>
//       )}
//     </div>
//   );
// }

// function StatusRow({
//   color,
//   label,
// }: {
//   color: "green" | "yellow" | "red" | "blue";
//   label: string;
// }) {
//   const dot = {
//     green: "bg-emerald-400",
//     yellow: "bg-yellow-400",
//     red: "bg-red-400",
//     blue: "bg-blue-400",
//   }[color];
//   const text = {
//     green: "text-emerald-400",
//     yellow: "text-yellow-400",
//     red: "text-red-400",
//     blue: "text-blue-400",
//   }[color];
//   return (
//     <div className="flex items-center gap-2">
//       <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
//       <span className={`font-mono text-xs ${text}`}>{label}</span>
//     </div>
//   );
// }
//  *//* But */