// SafeCircle config — Shelby County, TN

export const GEOCODE_URL =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates'

export const MPD_QUERY_URL =
  'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0/query'

export const WARRANT_BASE =
  'https://warrants.shelby-sheriff.org/w_warrant_result.php'

export const JAIL_ROSTER_URL = 'https://imljail.shelbycountytn.gov/IML'

export const NSOPW_URL = 'https://www.nsopw.gov/'

export const RADIUS_MILES = 0.5
export const WINDOW_DAYS  = 14

export function metersFromMiles(mi: number) {
  return mi * 1609.344
}

export function fmtDate(ms: number | null | undefined) {
  if (!ms) return ''
  return new Date(ms).toLocaleString()
}

export function esc(s: unknown) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c)
  )
}

// UCR category → color mapping
export const UCR_COLORS: Record<string, string> = {
  HOMICIDE:       '#DC2626',
  ROBBERY:        '#EA580C',
  'AGG. ASSAULT': '#D97706',
  ASSAULT:        '#CA8A04',
  RAPE:           '#9333EA',
  BURGLARY:       '#2563EB',
  'AUTO THEFT':   '#0891B2',
  THEFT:          '#16A34A',
  ARSON:          '#EF4444',
  DRUGS:          '#7C3AED',
  OTHER:          '#64748B',
}

export function ucrColor(cat: string) {
  const key = (cat || '').toUpperCase()
  for (const [k, v] of Object.entries(UCR_COLORS)) {
    if (key.includes(k)) return v
  }
  return UCR_COLORS.OTHER
}
