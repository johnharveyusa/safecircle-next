'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

// Leaflet must be client-only — no SSR
const LeafletMapComponent = dynamic(() => import('./LeafletMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-40 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

// ─── Warrant URL builder ──────────────────────────────────────────────────────
// John wrote the original warrant search in 1989. Parameters:
//   s = street number, st = street name (dots replace spaces)
//   l = last name, f = first name (optional)
function warrantUrl(streetNum: string, streetName: string) {
  const st = streetName.trim().replace(/\s+/g, '.');
  return `https://warrants.shelby-sheriff.org/w_warrant_result.php?w=&l=&f=&s=${encodeURIComponent(streetNum.trim())}&st=${st}`;
}

// ─── Sex offender registry URL ────────────────────────────────────────────────
function offenderUrl(streetNum: string, streetName: string) {
  const addr = encodeURIComponent(`${streetNum.trim()} ${streetName.trim()}, Memphis, TN`);
  return `https://www.nsopw.gov/en/Search/Results?street=${addr}`;
}

// ─── Jail roster ──────────────────────────────────────────────────────────────
const JAIL_URL = 'https://imljail.shelbycountytn.gov/IML';

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <span className="text-slate-500 text-lg leading-none">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Contact row ─────────────────────────────────────────────────────────────
interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
}

function ContactRow({
  contact,
  onRemove,
}: {
  contact: Contact;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-200">{contact.name}</p>
        <p className="text-xs text-slate-400">{contact.phone} · {contact.email}</p>
      </div>
      <div className="flex gap-2">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Call
          </a>
        )}
        {contact.phone && (
          <a
            href={`sms:${contact.phone}`}
            className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            SMS
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Email
          </a>
        )}
        <button
          onClick={() => onRemove(contact.id)}
          className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-900/40"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SafeCirclePage() {
  // Shared address state — drives warrant + offender links
  const [streetNum,  setStreetNum]  = useState('4128');
  const [streetName, setStreetName] = useState('Weymouth Cove');
  const [addrLocked, setAddrLocked] = useState(false);

  // Contacts
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [newName,  setNewName]    = useState('');
  const [newPhone, setNewPhone]   = useState('');
  const [newEmail, setNewEmail]   = useState('');
  const [csvInput, setCsvInput]   = useState('');
  const [sosActive, setSosActive] = useState(false);

  function addContact() {
    if (!newName.trim()) return;
    setContacts(c => [
      ...c,
      { id: crypto.randomUUID(), name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() },
    ]);
    setNewName(''); setNewPhone(''); setNewEmail('');
  }

  function removeContact(id: string) {
    setContacts(c => c.filter(x => x.id !== id));
  }

  function importCsv() {
    const lines = csvInput.trim().split('\n').filter(Boolean);
    const imported: Contact[] = [];
    for (const line of lines) {
      const [name, email, phone] = line.split(',').map(s => s.trim());
      if (name) imported.push({ id: crypto.randomUUID(), name, email: email || '', phone: phone || '' });
    }
    setContacts(c => [...c, ...imported]);
    setCsvInput('');
  }

  function triggerSos() {
    setSosActive(true);
    // Email every contact with a mailto chain
    for (const c of contacts) {
      if (c.email) {
        window.open(
          `mailto:${c.email}?subject=${encodeURIComponent('🚨 SAFE CIRCLE SOS — I need help NOW')}&body=${encodeURIComponent('This is an emergency alert from SafeCircle. I need immediate help at my current location. Please call or come immediately.')}`,
          '_blank'
        );
      }
    }
    setTimeout(() => setSosActive(false), 4000);
  }

  const lockedAddress = addrLocked
    ? `${streetNum.trim()} ${streetName.trim()}`
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="text-center pb-2">
        <h1 className="text-2xl font-semibold text-white">SafeCircle</h1>
        <p className="text-xs text-slate-400 mt-1">Shelby County public safety — field worker edition</p>
      </div>

      {/* ── Address bar ── */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 space-y-3">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Address</p>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="4128"
            value={streetNum}
            onChange={e => { setStreetNum(e.target.value); setAddrLocked(false); }}
            className="w-20 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="Weymouth Cove"
            value={streetName}
            onChange={e => { setStreetName(e.target.value); setAddrLocked(false); }}
            onKeyDown={e => { if (e.key === 'Enter') setAddrLocked(true); }}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setAddrLocked(true)}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors whitespace-nowrap"
          >
            Set address
          </button>
        </div>
        {addrLocked && (
          <p className="text-xs text-emerald-400">
            ✓ Working address: {streetNum.trim()} {streetName.trim()}, Memphis TN
          </p>
        )}
      </div>

      {/* ── 1. Crime map ── */}
      <Section title="🗺  Crime incidents — last 14 days, 0.5 mi radius" defaultOpen>
        <LeafletMapComponent />
      </Section>

      {/* ── 2. Warrant check ── */}
      <Section title="⚖️  Warrant search">
        <p className="text-xs text-slate-400 mb-3">
          Checks the Shelby County Sheriff's warrant database by address.
          Originally built in 1989 — still running.
        </p>
        {streetNum && streetName ? (
          <a
            href={warrantUrl(streetNum, streetName)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-sm font-medium text-white transition-colors"
          >
            Check warrants for {streetNum} {streetName} →
          </a>
        ) : (
          <p className="text-xs text-slate-500">Enter an address above first.</p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Also search by name:{' '}
          <a
            href="https://warrants.shelby-sheriff.org/w_warrant_result.php"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            Open warrant search
          </a>
        </p>
      </Section>

      {/* ── 3. Sex offender registry ── */}
      <Section title="🔍  Sex offender registry">
        <p className="text-xs text-slate-400 mb-3">
          Checks the National Sex Offender Public Website (NSOPW) against this address.
        </p>
        {streetNum && streetName ? (
          <a
            href={offenderUrl(streetNum, streetName)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-sm font-medium text-white transition-colors"
          >
            Check sex offenders near {streetNum} {streetName} →
          </a>
        ) : (
          <p className="text-xs text-slate-500">Enter an address above first.</p>
        )}
      </Section>

      {/* ── 4. Jail roster ── */}
      <Section title="🏛  Shelby County jail roster">
        <p className="text-xs text-slate-400 mb-3">
          See who is currently in custody at the Shelby County jail.
        </p>
        <a
          href={JAIL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium text-white transition-colors"
        >
          Open jail roster →
        </a>
      </Section>

      {/* ── 5. Nearest emergency contacts ── */}
      <Section title="🚨  Nearest police · fire · hospital">
        <p className="text-xs text-slate-400 mb-3">
          Nearest emergency services to the current address. Phone numbers are stored in Vercel environment config.
        </p>
        <div className="space-y-2">
          {[
            { label: 'Police', env: process.env.NEXT_PUBLIC_POLICE_PHONE, color: 'blue' },
            { label: 'Fire',   env: process.env.NEXT_PUBLIC_FIRE_PHONE,   color: 'red'  },
            { label: 'Hospital', env: process.env.NEXT_PUBLIC_HOSPITAL_PHONE, color: 'emerald' },
          ].map(({ label, env, color }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <span className="text-sm text-slate-300">{label}</span>
              {env ? (
                <a
                  href={`tel:${env}`}
                  className={`text-sm font-medium text-${color}-400 hover:underline`}
                >
                  {env}
                </a>
              ) : (
                <span className="text-xs text-slate-600">Set NEXT_PUBLIC_{label.toUpperCase()}_PHONE in Vercel</span>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── 6 & 7. Circle of friends + SOS ── */}
      <Section title="👥  Circle of friends &amp; SOS alert">
        {/* SOS button */}
        <button
          onClick={triggerSos}
          disabled={contacts.length === 0}
          className={`w-full py-3 rounded-xl text-base font-semibold mb-4 transition-all ${
            sosActive
              ? 'bg-red-500 text-white animate-pulse'
              : contacts.length === 0
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-red-700 hover:bg-red-600 text-white'
          }`}
        >
          {sosActive ? '🚨 SOS SENT' : '🚨 SOS — Alert my circle NOW'}
        </button>
        {contacts.length === 0 && (
          <p className="text-xs text-slate-500 mb-3 -mt-2">Add contacts below to enable SOS.</p>
        )}

        {/* Contact list */}
        {contacts.length > 0 && (
          <div className="mb-4">
            {contacts.map(c => (
              <ContactRow key={c.id} contact={c} onRemove={removeContact} />
            ))}
          </div>
        )}

        {/* Add contact manually */}
        <div className="space-y-2 mb-4">
          <p className="text-xs text-slate-400 font-medium">Add a contact</p>
          <input
            type="text"
            placeholder="Full name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="Phone"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={addContact}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors"
          >
            Add contact
          </button>
        </div>

        {/* CSV import */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-medium">Import from CSV</p>
          <p className="text-xs text-slate-500">One contact per line: Full Name, Email, Phone</p>
          <textarea
            rows={4}
            placeholder={'Jane Smith, jane@example.com, 901-555-1234\nJohn Doe, john@example.com, 901-555-5678'}
            value={csvInput}
            onChange={e => setCsvInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            onClick={importCsv}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-white transition-colors"
          >
            Import contacts
          </button>
        </div>
      </Section>

    </main>
  );
}
