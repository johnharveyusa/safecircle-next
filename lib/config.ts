export const MPD_QUERY_URL =
  'https://services.arcgis.com/yF35qBkMcTVn6LAe/arcgis/rest/services/MPD_Incidents/FeatureServer/0/query'

export const RADIUS_MILES = 0.5
export const WINDOW_DAYS = 14

export function metersFromMiles(miles: number): number {
  return Math.round(miles * 1609.34)
}

export function fmtDate(epochMs: number): string {
  if (!epochMs) return ''
  return new Date(epochMs).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function ucrColor(category: string): string {
  const c = (category || '').toUpperCase()
  if (c.includes('HOMICIDE'))  return '#DC2626'
  if (c.includes('ROBBERY'))   return '#EA580C'
  if (c.includes('BURGLARY'))  return '#2563EB'
  if (c.includes('THEFT'))     return '#16A34A'
  if (c.includes('ASSAULT'))   return '#CA8A04'
  if (c.includes('DRUG'))      return '#7C3AED'
  return '#64748B'
}
