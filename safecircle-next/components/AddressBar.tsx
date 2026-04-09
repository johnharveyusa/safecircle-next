'use client'
import { useState, useCallback } from 'react'
import { GEOCODE_URL } from '@/lib/config'

export interface GeoResult {
  lat: number
  lon: number
  matched: string
  houseNumber: string
  streetName: string
}

interface Props {
  onGeocode: (result: GeoResult | null) => void
  defaultAddress?: string
}

export default function AddressBar({ onGeocode, defaultAddress = '' }: Props) {
  const [addr, setAddr] = useState(defaultAddress)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const geocode = useCallback(async (value: string) => {
    if (!value.trim()) { onGeocode(null); setStatus(''); return }
    setLoading(true)
    setStatus('Locating…')
    try {
      const url = `${GEOCODE_URL}?SingleLine=${encodeURIComponent(value)}&maxLocations=1&outFields=*&f=pjson`
      const r = await fetch(url)
      const j = await r.json()
      if (!j.candidates?.length) {
        setStatus('❌ No match found — try a full address')
        onGeocode(null)
        return
      }
      const best = j.candidates[0]
      const attrs = best.attributes || {}
      // parse house number and street from address
      const parts = (best.address || '').split(',')[0].trim().split(' ')
      const houseNumber = /^\d/.test(parts[0]) ? parts[0] : ''
      const streetName  = houseNumber ? parts.slice(1).join(' ') : parts.join(' ')
      setStatus(`✅ ${best.address} (score ${best.score})`)
      onGeocode({
        lat: best.location.y,
        lon: best.location.x,
        matched: best.address,
        houseNumber,
        streetName,
      })
    } catch {
      setStatus('❌ Geocode error')
      onGeocode(null)
    } finally {
      setLoading(false)
    }
  }, [onGeocode])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="sc-input"
          style={{ flex: 1 }}
          placeholder="Enter address in Shelby County, TN…"
          value={addr}
          onChange={e => setAddr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && geocode(addr)}
        />
        <button
          className="btn btn-blue"
          onClick={() => geocode(addr)}
          disabled={loading}
        >
          {loading ? '…' : '🔍 Look Up'}
        </button>
      </div>
      {status && (
        <p style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>{status}</p>
      )}
    </div>
  )
}
