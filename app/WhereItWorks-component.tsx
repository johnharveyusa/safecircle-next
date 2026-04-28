'use client';

import { useState } from 'react';

// ── US States ─────────────────────────────────────────────────────────────────
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia',
  HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa',
  KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland',
  MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri',
  MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey',
  NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio',
  OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina',
  SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont',
  VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming',
  DC:'Washington DC',
};

// ── ESRI city configs (kept for fallback) ─────────────────────────────────────
const ESRI_CITIES: Record<string, { esriLayer: string; crimeField: string; warrantUrl: string; jailUrl: string }> = {
  'Memphis, TN': {
    esriLayer: 'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0',
    crimeField: 'UCR_Category',
    warrantUrl: 'https://warrants.shelby-sheriff.org/w_warrant_result.php',
    jailUrl: 'https://www.shelby-sheriff.org/inmate-lookup',
  },
  'Denver, CO': {
    esriLayer: 'https://services1.arcgis.com/geospatialDenver/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField: 'offense_type_id',
    warrantUrl: 'https://www.denvercountycourt.org/warrants',
    jailUrl: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Department-of-Safety/Sheriff-Division/Jail-Roster',
  },
  'Phoenix, AZ': {
    esriLayer: 'https://maps.phoenix.gov/arcgis/rest/services/PHX_Crime/FeatureServer/0',
    crimeField: 'UCR_CRIME_CATEGORY',
    warrantUrl: 'https://www.maricopacountyattorney.org/warrants',
    jailUrl: 'https://www.mcso.org/Inmate',
  },
  'San Antonio, TX': {
    esriLayer: 'https://cosagis.maps.arcgis.com/arcgis/rest/services/SAPD/FeatureServer/0',
    crimeField: 'Highest NIBRS',
    warrantUrl: 'https://www.bexar.org/2408/Active-Warrants',
    jailUrl: 'https://www.bexar.org/1667/Inmate-Information',
  },
  'Jacksonville, FL': {
    esriLayer: 'https://gis.coj.net/arcgis/rest/services/JSO/FeatureServer/0',
    crimeField: 'Description',
    warrantUrl: 'https://www.jaxsheriff.org/services/warrant-search',
    jailUrl: 'https://www.jaxsheriff.org/services/inmate-search',
  },
  'New Orleans, LA': {
    esriLayer: 'https://services3.arcgis.com/dty2kHktVXHrqO8i/arcgis/rest/services/Crime_Incidents/FeatureServer/0',
    crimeField: 'TypeText',
    warrantUrl: 'https://www.opcso.org/warrants',
    jailUrl: 'https://opcso.org/inmate-search',
  },
  'Washington, DC': {
    esriLayer: 'https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/MPD/MapServer/8',
    crimeField: 'OFFENSE',
    warrantUrl: 'https://www.dccourts.gov/superior-court/criminal-division/warrants',
    jailUrl: 'https://doc.dc.gov/service/inmate-lookup',
  },
  'Columbus, OH': {
    esriLayer: 'https://columbus.maps.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField: 'OFFENSE_CATEGORY',
    warrantUrl: 'https://www.franklincountyohio.gov/Residents/Courts/Warrant-Search',
    jailUrl: 'https://www.franklincountysheriff.org/inmate-search',
  },
  'Portland, OR': {
    esriLayer: 'https://pdx.maps.arcgis.com/arcgis/rest/services/PPB/FeatureServer/0',
    crimeField: 'offense_type',
    warrantUrl: 'https://www.mcda.us/index.php/warrants',
    jailUrl: 'https://multcosheriff.org/jail/inmate-search/',
  },
  'Charlotte, NC': {
    esriLayer: 'https://cmpd.maps.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField: 'CATEGORY',
    warrantUrl: 'https://www.mecksheriff.com/services/warrant-search',
    jailUrl: 'https://www.mecksheriff.com/services/inmate-search',
  },
  'Atlanta, GA': {
    esriLayer: 'https://gis.atlantaga.gov/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField: 'UC2_Literal',
    warrantUrl: 'https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/warrants',
    jailUrl: 'https://ody.fultoncountyga.gov/portal/',
  },
};

export interface UniversalLocation {
  state: string;           // e.g. "TN"
  city: string;            // e.g. "Memphis"
  address: string;         // street only, e.g. "4128 Weymouth"
  geocodeSuffix: string;   // e.g. "Memphis, TN"
  esriLayer: string;       // ESRI URL or empty string
  crimeField: string;
  warrantUrl: string;
  jailUrl: string;
  spotCrimeUrl: string;    // always populated
}

interface Props {
  onLocationSet: (loc: UniversalLocation) => void;
  currentLocation: UniversalLocation | null;
}

export default function WhereItWorks({ onLocationSet, currentLocation }: Props) {
  const [open,    setOpen]    = useState(true);
  const [state,   setState]   = useState(currentLocation?.state   || '');
  const [city,    setCity]    = useState(currentLocation?.city    || '');
  const [address, setAddress] = useState(currentLocation?.address || '');

  const btnStyle: React.CSSProperties = {
    padding: '11px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
    color: 'white', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(90deg,#22d3ee,#3b82f6)',
    boxShadow: '0 4px 15px rgba(34,211,238,0.3)', whiteSpace: 'nowrap',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(34,211,238,0.3)',
    color: 'white', outline: 'none',
  };

  function handleSet() {
    if (!state || !city.trim() || !address.trim()) return;
    const geocodeSuffix = `${city.trim()}, ${state}`;
    const cityKey = geocodeSuffix;
    const esri = ESRI_CITIES[cityKey] || null;
    const loc: UniversalLocation = {
      state,
      city: city.trim(),
      address: address.trim(),
      geocodeSuffix,
      esriLayer: esri?.esriLayer || '',
      crimeField: esri?.crimeField || 'UCR_Category',
      warrantUrl: esri?.warrantUrl || '',
      jailUrl: esri?.jailUrl || '',
      spotCrimeUrl: '',  // filled after geocode in LeafletMapComponent
    };
    onLocationSet(loc);
    try {
      localStorage.setItem('sc_universal_loc', JSON.stringify(loc));
    } catch {}
  }

  return (
    <div style={{
      borderRadius: 20,
      border: open ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(168,85,247,0.3)',
      background: 'linear-gradient(135deg,#0f1f3d,#0a1628)',
      overflow: 'hidden',
      boxShadow: open ? '0 4px 24px rgba(34,211,238,0.12)' : '0 4px 24px rgba(0,0,0,0.35)',
    }}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px', background: open ? 'rgba(34,211,238,0.06)' : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 56,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
          🌎 Enter Your Address — Works Anywhere in the US
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: '50%',
          background: open ? 'linear-gradient(135deg,#22d3ee,#3b82f6)' : 'linear-gradient(135deg,#a855f7,#7c3aed)',
          color: 'white', fontSize: 24, fontWeight: 900,
        }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '12px 16px 20px', borderTop: '1px solid rgba(34,211,238,0.15)', display: 'flex', flexDirection: 'column', gap: 12 }}>

          <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
            Crime data powered by SpotCrime — covers every city and county in the United States.
          </p>

          {/* Row 1: State + City */}
          <div style={{ display: 'flex', gap: 10 }}>
            {/* State dropdown */}
            <div style={{ flex: '0 0 140px' }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>State</label>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                style={{
                  ...inputStyle,
                  appearance: 'none', WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                  paddingRight: 32, cursor: 'pointer',
                }}
              >
                <option value="" style={{ background: '#0a1628' }}>— State —</option>
                {US_STATES.map(s => (
                  <option key={s} value={s} style={{ background: '#0a1628' }}>
                    {s} — {STATE_NAMES[s]}
                  </option>
                ))}
              </select>
            </div>

            {/* City */}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>City</label>
              <input
                type="text"
                placeholder="e.g. Memphis"
                value={city}
                onChange={e => setCity(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSet(); }}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 2: Street address */}
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
              Street address — number and name only
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="e.g. 4128 Weymouth"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSet(); }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleSet}
                disabled={!state || !city.trim() || !address.trim()}
                style={{
                  ...btnStyle,
                  opacity: (!state || !city.trim() || !address.trim()) ? 0.4 : 1,
                  cursor: (!state || !city.trim() || !address.trim()) ? 'not-allowed' : 'pointer',
                }}
              >
                Set Address
              </button>
            </div>
          </div>

          {/* Active location display */}
          {currentLocation && (
            <div style={{
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(34,211,238,0.06)',
              border: '1px solid rgba(34,211,238,0.2)',
              fontSize: 12, color: '#22d3ee',
            }}>
              ✓ Active: {currentLocation.address}, {currentLocation.city}, {currentLocation.state}
              {currentLocation.esriLayer
                ? <span style={{ color: '#10b981', marginLeft: 8 }}>· ESRI + SpotCrime</span>
                : <span style={{ color: '#f59e0b', marginLeft: 8 }}>· SpotCrime</span>
              }
            </div>
          )}

        </div>
      )}
    </div>
  );
}
