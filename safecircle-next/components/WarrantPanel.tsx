'use client'
import { WARRANT_BASE } from '@/lib/config'
import type { GeoResult } from './AddressBar'

interface Props {
  geo: GeoResult | null
}

export default function WarrantPanel({ geo }: Props) {
  if (!geo) return null

  const params = new URLSearchParams({
    w: '', l: '', f: '',
    s: geo.houseNumber,
    st: geo.streetName.split(' ')[0].toLowerCase(),
  })
  const url = `${WARRANT_BASE}?${params.toString()}`

  return (
    <div className="card" style={{ borderLeft: '4px solid #DC2626' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="section-pill" style={{ background: '#FEF2F2', color: '#DC2626' }}>
              🔎 Warrants
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
            Shelby County Sheriff — warrant search for <strong>{geo.matched?.split(',')[0]}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-red" href={url} target="_blank" rel="noopener noreferrer">
            Search Address Warrants ↗
          </a>
          <a
            className="btn btn-outline"
            href="https://warrants.shelby-sheriff.org/w_warrant_result.php?w=&l=&f=&s=&st="
            target="_blank" rel="noopener noreferrer"
          >
            Search by Name ↗
          </a>
        </div>
      </div>
    </div>
  )
}
