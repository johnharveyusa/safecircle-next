'use client'
import { useState, useRef } from 'react'
import type { Contact } from '@/lib/types'

const STORAGE_KEY = 'safecircle-contacts'

function loadContacts(): Contact[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveContacts(contacts: Contact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export default function SafeCirclePanel() {
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts())
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [alertSent, setAlertSent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function persist(list: Contact[]) {
    setContacts(list)
    saveContacts(list)
  }

  function addContact() {
    if (!form.name.trim()) return
    const updated = [...contacts, { id: uid(), ...form }]
    persist(updated)
    setForm({ name: '', email: '', phone: '' })
    setAdding(false)
  }

  function removeContact(id: string) {
    persist(contacts.filter(c => c.id !== id))
  }

  function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter(Boolean)
      const imported: Contact[] = []
      for (const line of lines) {
        // skip header row
        if (/^name/i.test(line)) continue
        const [name, email, phone] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
        if (name) imported.push({ id: uid(), name: name || '', email: email || '', phone: phone || '' })
      }
      persist([...contacts, ...imported])
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function alertAll() {
    // Build mailto with all email contacts
    const emails = contacts.filter(c => c.email).map(c => c.email).join(',')
    if (emails) {
      window.location.href = `mailto:${emails}?subject=🚨 I NEED HELP IMMEDIATELY&body=I need immediate assistance. Please contact me or call 911. This is an emergency alert from SafeCircle.`
    }
    // SMS: open sms: for first phone contact (mobile browsers)
    const phone = contacts.find(c => c.phone)?.phone
    if (phone) {
      window.open(`sms:${phone}?body=🚨 EMERGENCY: I need help immediately! Please call me or call 911.`, '_blank')
    }
    setAlertSent(true)
    setTimeout(() => setAlertSent(false), 5000)
  }

  function callContact(phone: string) {
    window.location.href = `tel:${phone}`
  }

  function emailContact(email: string) {
    window.location.href = `mailto:${email}`
  }

  function smsContact(phone: string) {
    window.open(`sms:${phone}?body=Hi, checking in from SafeCircle.`, '_blank')
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #DB2777' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <span className="section-pill" style={{ background: '#FDF2F8', color: '#DB2777' }}>
            👥 My Safe Circle
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Your trusted contacts — alert all with one tap
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>
            📤 Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
          <button className="btn btn-pink" onClick={() => setAdding(v => !v)}>
            ➕ Add Contact
          </button>
        </div>
      </div>

      {/* 🚨 Alert All button */}
      <button
        className={`btn btn-red ${contacts.length > 0 ? 'btn-alert-pulse' : ''}`}
        style={{ width: '100%', justifyContent: 'center', fontSize: 18, padding: '14px', marginBottom: 16, borderRadius: 14 }}
        onClick={alertAll}
        disabled={contacts.length === 0}
      >
        🆘 {alertSent ? 'Alert Sent! Stay Safe.' : 'SEND EMERGENCY ALERT TO ALL CONTACTS'}
      </button>

      {alertSent && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px', marginBottom: 12, color: '#DC2626', fontWeight: 600, fontSize: 14 }}>
          ✅ Emergency email opened. Also triggering SMS to first phone contact.
        </div>
      )}

      {/* Add contact form */}
      {adding && (
        <div style={{ background: '#FDF2F8', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #FBCFE8' }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700, color: '#DB2777' }}>Add New Contact</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <input className="sc-input" placeholder="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="sc-input" placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="sc-input" placeholder="Phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-pink" onClick={addContact}>Save Contact</button>
              <button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV hint */}
      {contacts.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>
          No contacts yet. Add contacts manually or import a CSV file.<br />
          <span style={{ fontSize: 11 }}>CSV format: Name, Email, Phone</span>
        </p>
      )}

      {/* Contact list */}
      {contacts.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {contacts.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FDF2F8', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  {c.email && <span style={{ marginRight: 8 }}>✉️ {c.email}</span>}
                  {c.phone && <span>📱 {c.phone}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {c.phone && (
                  <>
                    <button className="btn btn-green" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => callContact(c.phone)}>📞 Call</button>
                    <button className="btn btn-teal" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => smsContact(c.phone)}>💬 SMS</button>
                  </>
                )}
                {c.email && (
                  <button className="btn btn-blue" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => emailContact(c.email)}>✉️ Email</button>
                )}
                <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: 12, color: '#DC2626' }} onClick={() => removeContact(c.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
