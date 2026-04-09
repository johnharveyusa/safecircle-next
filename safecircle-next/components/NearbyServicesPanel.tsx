'use client'
import { useState } from 'react'
import type { GeoResult } from './AddressBar'

interface Service {
  label: string
  type: string
  keyword: string
  color: string
  bg: string
  emoji: string
  phone?: string
}

const SERVICES: Service[] = [
  { label: 'Police Station', type: 'police', keyword: 'police station Memphis TN', color: '#2563EB', bg: '#EFF6FF', emoji: '👮' },
  { label: 'Fire Station', type: 'fire_station', keyword: 'fire station Memphis TN', color: '#DC2626', bg: '#FEF2F2', emoji: '🚒' },
  { label: 'Hospital', type: 'hospital', keyword: 'hospital Memphis TN', color: '#16A34A', bg: '#F0FDF4', emoji: '🏥' },
]

interface Props { geo: GeoResult | null }

export default function NearbyServicesPanel({ geo }: Props) {
  if (!geo) return null

  function mapsSearch(keyword: string) {
    const q = `${keyword} near ${geo!.lat},${geo!.lon}`
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, '_blank')
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid #16A34A' }}>
      <div style={{ marginBottom: 14 }}>
        <span className="section-pill" style={{ background: '#F0FDF4', color: '#16A34A' }}>
          📍 Nearest Services
        </span>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
          Closest police, fire, and medical for <strong>{geo.matched?.split(',')[0]}</strong>
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {SERVICES.map(s => (
          <div key={s.type} style={{ background: s.bg, borderRadius: 12, padding: '16px', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.emoji}</div>
            <div style={{ fontWeight: 700, color: s.color, fontSize: 14, marginBottom: 4 }}>{s.label}</div>
            <button
              className="btn"
              style={{ background: s.color, color: '#fff', fontSize: 12, padding: '6px 12px', marginTop: 8 }}
              onClick={() => mapsSearch(s.keyword)}
            >
              Find Nearest ↗
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
