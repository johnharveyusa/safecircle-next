# SafeCircle — Integration Guide

## What's in this folder

These files wire up the four live data sources into your existing
`safecircle-next` Next.js app. Drop them into your repo at the paths shown.

```
lib/geocode.ts                   ← shared geocoding + warrant param helpers
app/api/crimes/route.ts          ← Memphis MPD crime data (Socrata)
app/api/offenders/route.ts       ← Sex offender registry (NSOPW)
app/api/warrants/route.ts        ← Shelby County Sheriff warrant scrape
app/api/contacts/route.ts        ← Nearest police / fire / hospital (Google Places)
hooks/useSafeCircleData.ts       ← React hook — fans out all four APIs in parallel
app/page.tsx                     ← Full dashboard page wired to live data
components/SafeCircleMap.tsx     ← Leaflet map with crime + offender markers
.env.example                     ← Environment variable template
```

---

## Setup

### 1. Install dependencies

```bash
npm install leaflet react-leaflet @types/leaflet
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where to get it |
|---|---|
| `GOOGLE_MAPS_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/) — enable **Geocoding API** + **Places API** |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Same key — needed client-side for the map |
| `SOCRATA_APP_TOKEN` | Free at [data.memphistn.gov](https://data.memphistn.gov/profile/app_tokens) — optional but reduces throttling |

No key is needed for NSOPW (free federal API) or the Shelby County warrant portal (public HTML scrape).

### 3. Vercel environment variables

In your Vercel dashboard → Project → Settings → Environment Variables, add:
- `GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `SOCRATA_APP_TOKEN`

---

## Data sources

### Memphis MPD crimes
- **Dataset**: `puh4-eea4` on `data.memphistn.gov` (updated daily at 6am)
- **Method**: Socrata SODA API — `within_circle()` geo query, past 14 days
- **Note**: Sex crimes and juvenile offenses are **omitted** by MPD from this dataset.
  Use the NSOPW route for sex offender data.

### Sex offenders (NSOPW)
- **API**: `https://www.nsopw.gov/api/Search/Radius`
- **Method**: Radius search by lat/lng, 0.5 miles
- **Covers**: All participating state registries including Tennessee SOR
- **Note**: NSOPW may not always return lat/lng for individual offenders —
  the Leaflet map will only pin offenders where coordinates are available.

### Warrant check (Shelby County Sheriff)
- **URL**: `https://warrants.shelby-sheriff.org/w_warrant_result.php`
- **Method**: Server-side HTML fetch + table scrape
- **Params**: Street number (`s`) + street name (`st`) parsed from address
- **Limitation**: This is a scrape of a public portal. If the Sheriff's site
  changes its HTML structure, `scrapeWarrants()` in `app/api/warrants/route.ts`
  will need updating.

### Emergency contacts (Google Places)
- **API**: Google Places Nearby Search + Place Details
- **Finds**: Nearest police precinct, fire station, hospital within 5 miles
- **Returns**: Name, address, phone number, distance

---

## API routes

All routes accept `?address=<url-encoded address>` and return JSON.

```
GET /api/crimes?address=4128 Weymouth Cove Memphis TN
GET /api/offenders?address=4128 Weymouth Cove Memphis TN
GET /api/warrants?address=4128 Weymouth Cove Memphis TN
GET /api/contacts?address=4128 Weymouth Cove Memphis TN
```

Responses are cached with `next: { revalidate: 3600 }` (1 hour) via Next.js
fetch caching.

---

## Adding to an existing page

If you don't want to replace your existing `app/page.tsx`, import the hook
directly into any component:

```tsx
import { useSafeCircleData } from "@/hooks/useSafeCircleData";

const { data, loading, errors } = useSafeCircleData("4128 Weymouth Cove, Memphis TN");
```

`data` contains: `crimes[]`, `offenders[]`, `warrants`, `contacts[]`, `center`
