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
      const params = new URLSearchParams({
        where: '1=1',
        geometry: `${geo.lon},${geo.lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        distance: String(metersFromMiles(RADIUS_MILES)),
        units: 'esriSRUnit_Meter',
        outFields: 'Offense_Datetime,UCR_Category,UCR_Description,Street_Address,Latitude,Longitude,Precinct,Crime_ID',
        orderByFields: 'Offense_Datetime DESC',
        resultRecordCount: '200',
        returnGeometry: 'true',
        time: `${start},${end}`,
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
      if (!geo) return   // ← THIS IS THE ONE LINE THAT WAS ADDED
      const L = (await import('leaflet')).default
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/lib
