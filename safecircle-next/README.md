# SafeCircle Next

Public safety lookup tool for Shelby County, TN — built for field workers, home health nurses, social workers, and families.

## Features

1. **Warrant Search** — Shelby County Sheriff's Office warrant lookup, parameterized by address (s= house number, st= street name)
2. **Crime Activity** — MPD incidents via ESRI ArcGIS, ½-mile radius, last 14 days, with Leaflet map and UCR color-coded markers
3. **Sex Offender Registry** — Links to NSOPW national registry with address pre-filled
4. **Jail Roster** — Direct link to Shelby County IML jail roster
5. **Nearest Services** — Google Maps search for nearest police station, fire station, and hospital
6. **Safe Circle Contacts** — Add/import contacts (CSV: Name, Email, Phone), call/SMS/email any contact
7. **Emergency Alert** — One-tap button sends emergency email to all contacts + SMS to first phone contact

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + custom CSS
- **Map**: Leaflet + react-leaflet
- **Data**: ESRI ArcGIS REST API (MPD), Shelby County Sheriff warrant search
- **Deploy**: Vercel

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or connect your GitHub repo at vercel.com — auto-deploys on every push.

## Test Address

`4128 Weymouth Cove, Memphis, TN`

Warrant URL: `https://warrants.shelby-sheriff.org/w_warrant_result.php?w=&l=&f=&s=4128&st=weymouth`

## Data Sources

| Source | URL |
|--------|-----|
| SCSO Warrant Search | https://warrants.shelby-sheriff.org |
| MPD Public Safety (ESRI) | https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0 |
| National Sex Offender Registry | https://www.nsopw.gov |
| Shelby County Jail Roster | https://imljail.shelbycountytn.gov/IML |

## Contact CSV Format

```
Name,Email,Phone
John Smith,john@example.com,9015550100
Jane Doe,jane@example.com,9015550101
```
