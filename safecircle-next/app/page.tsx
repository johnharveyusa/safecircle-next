'use client'
import { useState } from 'react'
import AddressBar, { type GeoResult } from '@/components/AddressBar'
import WarrantPanel from '@/components/WarrantPanel'
import CrimePanel from '@/components/CrimePanel'
import NearbyServicesPanel from '@/components/NearbyServicesPanel'
import { SexOffenderPanel, JailRosterPanel } from '@/components/RegistryPanels'
import SafeCirclePanel from '@/components/SafeCirclePanel'

export default function Home() {
  const [geo, setGeo] = useState<GeoResult | null>(null)

  return (
    <>
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap" rel="stylesheet" />

      <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
        {/* ── Header ── */}
        <header style={{
          background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
          color: '#fff',
          padding: '24px 20px',
          boxShadow: '0 4px 24px rgba(37,99,235,0.3)',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 36 }}>🛡️</span>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px', fontFamily: 'Nunito, sans-serif' }}>
                  SafeCircle
                </h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                  Shelby County Public Safety Lookup — protecting field workers &amp; families since 2024
                </p>
              </div>
            </div>

            {/* Quick stat pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { label: 'Warrant Search', color: '#FCA5A5' },
                { label: 'Crime Activity', color: '#93C5FD' },
                { label: 'Sex Offender Registry', color: '#C4B5FD' },
                { label: 'Jail Roster', color: '#FCD34D' },
                { label: 'Nearby Services', color: '#6EE7B7' },
                { label: 'Safe Circle Alerts', color: '#FDA4AF' },
              ].map(p => (
                <span key={p.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: p.color }}>
                  {p.label}
                </span>
              ))}
            </div>

            {/* Address input */}
            <AddressBar
              onGeocode={setGeo}
              defaultAddress="4128 Weymouth Cove, Memphis, TN"
            />
          </div>
        </header>

        {/* ── Main content ── */}
        <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 16 }}>
          {!geo && (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              background: '#fff',
              borderRadius: 16,
              border: '2px dashed #CBD5E1',
              color: '#94A3B8',
            }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#475569', margin: '0 0 8px' }}>
                Enter an address above to get started
              </p>
              <p style={{ fontSize: 14, margin: 0 }}>
                SafeCircle will check warrants, sex offender registry, recent crime activity, and nearest emergency services for any address in Shelby County.
              </p>
            </div>
          )}

          {/* Panels — appear after geocode */}
          <WarrantPanel geo={geo} />
          <CrimePanel geo={geo} />
          <SexOffenderPanel geo={geo} />
          <JailRosterPanel />
          <NearbyServicesPanel geo={geo} />
          <SafeCirclePanel />
        </main>

        {/* ── Footer ── */}
        <footer style={{ textAlign: 'center', padding: '24px 16px', color: '#94A3B8', fontSize: 12 }}>
          <p style={{ margin: 0 }}>
            SafeCircle · Built for Memphis field workers, home health nurses, social workers, and families ·{' '}
            <a href="https://www.shelby-sheriff.org/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB' }}>
              Shelby County Sheriff's Office
            </a>
          </p>
          <p style={{ margin: '4px 0 0' }}>
            Data sources: SCSO Warrant Search · MPD via ESRI ArcGIS · National Sex Offender Public Website · Shelby County IML Jail Roster
          </p>
        </footer>
      </div>
    </>
  )
}
