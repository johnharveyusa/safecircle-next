'use client'
import { NSOPW_URL, JAIL_ROSTER_URL } from '@/lib/config'
import type { GeoResult } from './AddressBar'

interface Props { geo: GeoResult | null }

export function SexOffenderPanel({ geo }: Props) {
  // NSOPW search — we link to the national registry with address pre-filled where possible
  const nsopwSearch = geo
    ? `https://www.nsopw.gov/Search/Results?street=${encodeURIComponent(geo.houseNumber + ' ' + geo.streetName)}&city=Memphis&state=TN&zip=&radius=0.5&radiusType=Miles`
    : NSOPW_URL

  return (
    <div className="card" style={{ borderLeft: '4px solid #7C3AED' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className="section-pill" style={{ background: '#F5F3FF', color: '#7C3AED' }}>
            ⚠️ Sex Offender Registry
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            National Sex Offender Public Website (NSOPW) — address search
          </p>
        </div>
        <a className="btn btn-purple" href={nsopwSearch} target="_blank" rel="noopener noreferrer">
          Search Registry ↗
        </a>
      </div>
    </div>
  )
}

export function JailRosterPanel() {
  return (
    <div className="card" style={{ borderLeft: '4px solid #D97706' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className="section-pill" style={{ background: '#FFFBEB', color: '#D97706' }}>
            🔒 Jail Roster
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Shelby County Sheriff — who is currently in jail?
          </p>
        </div>
        <a className="btn btn-amber" href={JAIL_ROSTER_URL} target="_blank" rel="noopener noreferrer">
          View Jail Roster ↗
        </a>
      </div>
    </div>
  )
}
