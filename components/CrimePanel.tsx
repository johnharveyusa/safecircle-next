'use client'
import { useState, useRef, useEffect } from 'react'
import { MPD_QUERY_URL, RADIUS_MILES, WINDOW_DAYS, metersFromMiles, fmtDate, ucrColor } from '@/lib/config'
import type { GeoResult } from './AddressBar'

interface Incident {
  attributes: {
    Offense_Datetime: number
    UCR_Category: string
    UCR_Description: string
    Street_Address: string
    Latitude: number
    Longitude: number
    Crime_ID: string
    Precinct: string
  }
}

interface Props { geo: GeoResult | null }

export default function CrimePanel({ geo }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [showMap, setShowMap] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)

  async function load() {
    if (!geo) return
    setLoading(true); setError(''); setLoaded(false)
    try {
      const end = Date.now()
      const start = end - WINDOW_DAYS * 24 * 60 * 60 * 1000
      // Use where clause for date filter — more reliable than the time parameter
      // Offense_Datetime is stored as epoch milliseconds in this layer
      const whereClause = `Offense_Datetime >= ${start} AND Offense_Datetime <= ${end}`
      const params = new URLSearchParams({
        where: whereClause,
        geometry: `${geo.lon},${geo.lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        distance: String(metersFromMiles(RADIUS_MILES)),
        units: 'esriSRUnit_Meter',
        outFields: 'Offense_Datetime,UCR_Category,UCR_Description,Street_Address,Latitude,Longitude,Precinct,Crime_ID',
        orderByFields: 'Offense_Datetime DESC',
        resultRecordCount: '200',
        returnGeometry: 'true',
        f: 'json',
      })
      const r = await fetch(`${MPD_QUERY_URL}?${params}`)
      const j = await r.json()
      if (j.error) { setError(j.error.message || 'Query error'); return }
      setIncidents(j.features || [])
      setLoaded(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Build/update Leaflet map
  useEffect(() => {
    if (!showMap || !mapRef.current || !geo) return
    let isMounted = true

    async function buildMap() {
      const L = (await import('leaflet')).default
      // Fix default icon path for Next.js
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      if (leafletMap.current) {
        leafletMap.current.remove()
        leafletMap.current = null
      }
      if (!mapRef.current || !isMounted) return

      const map = L.map(mapRef.current).setView([geo.lat, geo.lon], 14)
      leafletMap.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      const layer = L.layerGroup().addTo(map)

      // Center marker
      L.circleMarker([geo.lat, geo.lon], { radius: 10, color: '#2563EB', fillColor: '#2563EB', fillOpacity: 1 })
        .addTo(layer)
        .bindPopup(`<b>📍 ${geo.matched?.split(',')[0]}</b>`)

      // Radius circle
      L.circle([geo.lat, geo.lon], { radius: metersFromMiles(RADIUS_MILES), color: '#2563EB', weight: 1.5, fillOpacity: 0.05 }).addTo(layer)

      // Incident markers
      const bounds = L.latLngBounds([[geo.lat, geo.lon]])
      for (const f of incidents) {
        const a = f.attributes
        if (typeof a.Latitude !== 'number' || typeof a.Longitude !== 'number') continue
        bounds.extend([a.Latitude, a.Longitude])
        const color = ucrColor(a.UCR_Category)
        L.circleMarker([a.Latitude, a.Longitude], { radius: 7, color, fillColor: color, fillOpacity: 0.85, weight: 1 })
          .addTo(layer)
          .bindPopup(`<div style="font-size:13px;"><b>${a.UCR_Category}</b><br/>${a.UCR_Description}<br/>${a.Street_Address}<br/><span style="opacity:.7">${fmtDate(a.Offense_Datetime)}</span></div>`)
      }
      if (incidents.length > 0) {
        map.fitBounds(bounds.pad(0.15), { maxZoom: 16 })
        if (map.getZoom() < 13) map.setZoom(13)
      }
    }

    buildMap()
    return () => { isMounted = false }
  }, [showMap, incidents, geo])

  // cleanup on unmount
  useEffect(() => () => { leafletMap.current?.remove() }, [])

  if (!geo) return null

  return (
    <div className="card" style={{ borderLeft: '4px solid #2563EB' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <span className="section-pill" style={{ background: '#EFF6FF', color: '#2563EB' }}>
            🚨 Crime Activity
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
            Reported offenses within ½ mile — last 14 days
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-blue" onClick={load} disabled={loading}>
            {loading ? '⏳ Loading…' : '📋 Load Incidents'}
          </button>
          {loaded && (
            <button className="btn btn-teal" onClick={() => setShowMap(v => !v)}>
              {showMap ? '🗺 Hide Map' : '🗺 Show Map'}
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: '#DC2626', fontSize: 13 }}>❌ {error}</p>}

      {showMap && (
        <div ref={mapRef} id="psMap" style={{ marginBottom: 16 }} />
      )}

      {loaded && (
        <>
          {/* UCR legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {Object.entries({ HOMICIDE: '#DC2626', ROBBERY: '#EA580C', BURGLARY: '#2563EB', THEFT: '#16A34A', ASSAULT: '#CA8A04', DRUGS: '#7C3AED', OTHER: '#64748B' }).map(([k, v]) => (
              <span key={k} style={{ background: v + '18', color: v, border: `1px solid ${v}40`, borderRadius: 6, fontSize: 11, padding: '2px 8px', fontWeight: 700 }}>{k}</span>
            ))}
          </div>

          {incidents.length === 0 ? (
            <p style={{ color: '#16A34A', fontWeight: 600 }}>✅ No incidents reported in this window.</p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>
                <strong>{incidents.length}</strong> incident{incidents.length !== 1 ? 's' : ''} found — showing up to 40
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.slice(0, 40).map((f, i) => {
                      const a = f.attributes
                      const color = ucrColor(a.UCR_Category)
                      return (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(a.Offense_Datetime)}</td>
                          <td>
                            <span style={{ background: color + '18', color, border: `1px solid ${color}40`, borderRadius: 6, fontSize: 11, padding: '2px 8px', fontWeight: 700 }}>
                              {a.UCR_Category}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>{a.UCR_Description}</td>
                          <td style={{ fontSize: 12 }}>{a.Street_Address}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
