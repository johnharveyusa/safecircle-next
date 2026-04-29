'use client';

import { useState } from 'react';
import { CITY_COUNTY } from './city-county-data';

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

// ── Cities by state (major cities — user can also type any city) ──────────────
const CITIES_BY_STATE: Record<string, string[]> = {
  AL: ['Birmingham','Montgomery','Huntsville','Mobile','Tuscaloosa','Hoover','Dothan','Auburn','Decatur','Madison'],
  AK: ['Anchorage','Fairbanks','Juneau','Sitka','Ketchikan','Wasilla','Kenai','Kodiak'],
  AZ: ['Phoenix','Tucson','Mesa','Chandler','Scottsdale','Gilbert','Glendale','Tempe','Peoria','Surprise'],
  AR: ['Little Rock','Fort Smith','Fayetteville','Springdale','Jonesboro','North Little Rock','Conway','Rogers'],
  CA: ['Los Angeles','San Diego','San Jose','San Francisco','Fresno','Sacramento','Long Beach','Oakland','Bakersfield','Anaheim','Santa Ana','Riverside','Stockton','Chula Vista','Irvine'],
  CO: ['Denver','Colorado Springs','Aurora','Fort Collins','Lakewood','Thornton','Arvada','Westminster','Pueblo','Centennial'],
  CT: ['Bridgeport','New Haven','Stamford','Hartford','Waterbury','Norwalk','Danbury','New Britain'],
  DE: ['Wilmington','Dover','Newark','Middletown','Smyrna','Milford'],
  FL: ['Jacksonville','Miami','Tampa','Orlando','St. Petersburg','Hialeah','Port St. Lucie','Cape Coral','Tallahassee','Fort Lauderdale','Pembroke Pines','Hollywood','Gainesville','Miramar'],
  GA: ['Atlanta','Columbus','Augusta','Macon','Savannah','Athens','Sandy Springs','Roswell','Albany','Warner Robins'],
  HI: ['Honolulu','Pearl City','Hilo','Kailua','Waipahu','Kaneohe'],
  ID: ['Boise','Meridian','Nampa','Idaho Falls','Pocatello','Caldwell','Coeur d\'Alene','Twin Falls'],
  IL: ['Chicago','Aurora','Joliet','Rockford','Springfield','Elgin','Naperville','Peoria','Champaign','Waukegan'],
  IN: ['Indianapolis','Fort Wayne','Evansville','South Bend','Carmel','Fishers','Bloomington','Hammond','Gary','Muncie'],
  IA: ['Des Moines','Cedar Rapids','Davenport','Sioux City','Iowa City','Waterloo','Ames','West Des Moines'],
  KS: ['Wichita','Overland Park','Kansas City','Olathe','Topeka','Lawrence','Shawnee','Manhattan'],
  KY: ['Louisville','Lexington','Bowling Green','Owensboro','Covington','Hopkinsville','Richmond','Florence'],
  LA: ['New Orleans','Baton Rouge','Shreveport','Metairie','Lafayette','Lake Charles','Kenner','Bossier City','Monroe'],
  ME: ['Portland','Lewiston','Bangor','South Portland','Auburn','Biddeford'],
  MD: ['Baltimore','Frederick','Rockville','Gaithersburg','Bowie','Hagerstown','Annapolis','College Park'],
  MA: ['Boston','Worcester','Springfield','Lowell','Cambridge','New Bedford','Brockton','Quincy','Lynn','Fall River'],
  MI: ['Detroit','Grand Rapids','Warren','Sterling Heights','Ann Arbor','Lansing','Flint','Dearborn','Livonia','Troy'],
  MN: ['Minneapolis','Saint Paul','Rochester','Duluth','Bloomington','Brooklyn Park','Plymouth','Saint Cloud','Eagan'],
  MS: ['Jackson','Gulfport','Southaven','Hattiesburg','Biloxi','Meridian','Tupelo','Greenville','Olive Branch'],
  MO: ['Kansas City','Saint Louis','Springfield','Columbia','Independence','Lee\'s Summit','O\'Fallon','Saint Joseph','Saint Charles'],
  MT: ['Billings','Missoula','Great Falls','Bozeman','Butte','Helena','Kalispell'],
  NE: ['Omaha','Lincoln','Bellevue','Grand Island','Kearney','Fremont','Hastings','Norfolk'],
  NV: ['Las Vegas','Henderson','Reno','North Las Vegas','Sparks','Carson City','Fernley'],
  NH: ['Manchester','Nashua','Concord','Derry','Dover','Rochester','Salem','Merrimack'],
  NJ: ['Newark','Jersey City','Paterson','Elizabeth','Edison','Woodbridge','Lakewood','Toms River','Hamilton','Trenton'],
  NM: ['Albuquerque','Las Cruces','Rio Rancho','Santa Fe','Roswell','Farmington','Clovis','Hobbs'],
  NY: ['New York City','Buffalo','Rochester','Yonkers','Syracuse','Albany','New Rochelle','Mount Vernon','Schenectady','Utica'],
  NC: ['Charlotte','Raleigh','Greensboro','Durham','Winston-Salem','Fayetteville','Cary','Wilmington','High Point','Asheville'],
  ND: ['Fargo','Bismarck','Grand Forks','Minot','West Fargo','Mandan'],
  OH: ['Columbus','Cleveland','Cincinnati','Toledo','Akron','Dayton','Parma','Canton','Youngstown','Lorain'],
  OK: ['Oklahoma City','Tulsa','Norman','Broken Arrow','Lawton','Edmond','Moore','Midwest City','Enid'],
  OR: ['Portland','Salem','Eugene','Gresham','Hillsboro','Beaverton','Bend','Medford','Springfield','Corvallis'],
  PA: ['Philadelphia','Pittsburgh','Allentown','Erie','Reading','Scranton','Bethlehem','Lancaster','Harrisburg','York'],
  RI: ['Providence','Cranston','Warwick','Pawtucket','East Providence','Woonsocket','Coventry','Cumberland'],
  SC: ['Columbia','Charleston','North Charleston','Mount Pleasant','Rock Hill','Greenville','Summerville','Sumter','Goose Creek'],
  SD: ['Sioux Falls','Rapid City','Aberdeen','Brookings','Watertown','Mitchell','Yankton'],
  TN: ['Memphis','Nashville','Knoxville','Chattanooga','Clarksville','Murfreesboro','Franklin','Jackson','Johnson City','Kingsport'],
  TX: ['Houston','San Antonio','Dallas','Austin','Fort Worth','El Paso','Arlington','Corpus Christi','Plano','Lubbock','Laredo','Irving','Garland','Frisco','McKinney','Amarillo','Grand Prairie','Brownsville','Pasadena','Mesquite'],
  UT: ['Salt Lake City','West Valley City','Provo','West Jordan','Orem','Sandy','Ogden','St. George','Layton','Taylorsville','South Jordan','Lehi','Millcreek','Herriman','Logan'],
  VT: ['Burlington','South Burlington','Rutland','Barre','Montpelier'],
  VA: ['Virginia Beach','Norfolk','Chesapeake','Richmond','Newport News','Alexandria','Hampton','Roanoke','Portsmouth','Suffolk'],
  WA: ['Seattle','Spokane','Tacoma','Vancouver','Bellevue','Kent','Everett','Renton','Spokane Valley','Kirkland','Bellingham','Kennewick'],
  WV: ['Charleston','Huntington','Morgantown','Parkersburg','Wheeling','Weirton','Fairmont'],
  WI: ['Milwaukee','Madison','Green Bay','Kenosha','Racine','Appleton','Waukesha','Oshkosh','Eau Claire','Janesville'],
  WY: ['Cheyenne','Casper','Laramie','Gillette','Rock Springs','Sheridan','Green River'],
  DC: ['Washington'],
};

// ── ESRI city configs ─────────────────────────────────────────────────────────
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
  state: string;
  city: string;
  address: string;
  geocodeSuffix: string;
  esriLayer: string;
  crimeField: string;
  warrantUrl: string;
  jailUrl: string;
  spotCrimeUrl: string;
}

interface Props {
  onLocationSet: (loc: UniversalLocation) => void;
  currentLocation: UniversalLocation | null;
}

export default function WhereItWorks({ onLocationSet, currentLocation }: Props) {
  const [state,   setState]   = useState(currentLocation?.state || '');
  const [city,    setCity]    = useState(currentLocation?.city  || '');
  const [address, setAddress] = useState(currentLocation?.address || '');

  // When state changes, reset city and address
  function handleStateChange(newState: string) {
    setState(newState);
    setCity('');
    setAddress('');
  }

  // When city changes, reset address
  function handleCityChange(newCity: string) {
    setCity(newCity);
    setAddress('');
  }

  const citiesForState = state ? (CITIES_BY_STATE[state] || []).sort() : [];
  const canSubmit = state && city.trim() && address.trim();
  const cityKey = city && city !== '__other__' ? `${city}, ${state}` : '';
  const countyInfo = cityKey ? CITY_COUNTY[cityKey] || null : null;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(34,211,238,0.3)',
    color: 'white', outline: 'none', boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none', WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2394a3b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
    paddingRight: 32, cursor: 'pointer',
  };

  const disabledSelectStyle: React.CSSProperties = {
    ...selectStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  function handleSet() {
    if (!canSubmit) return;
    const geocodeSuffix = `${city.trim()}, ${state}`;
    const esri = ESRI_CITIES[geocodeSuffix] || null;
    const loc: UniversalLocation = {
      state,
      city: city.trim(),
      address: address.trim(),
      geocodeSuffix,
      esriLayer: esri?.esriLayer || '',
      crimeField: esri?.crimeField || 'UCR_Category',
      warrantUrl: esri?.warrantUrl || '',
      jailUrl: esri?.jailUrl || '',
      spotCrimeUrl: '',
    };
    onLocationSet(loc);
    try { localStorage.setItem('sc_universal_loc', JSON.stringify(loc)); } catch {}
  }

  return (
    <div style={{
      borderRadius: 20,
      border: '1px solid rgba(34,211,238,0.4)',
      background: 'linear-gradient(135deg,#0f1f3d,#0a1628)',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(34,211,238,0.12)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'rgba(34,211,238,0.06)',
        borderBottom: '1px solid rgba(34,211,238,0.15)',
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          🌎 Enter Your Address — Works Anywhere in the US
        </p>
        <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
          Crime data powered by SpotCrime — covers every city and county in the United States.
        </p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Step 1 — State */}
        <div>
          <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Step 1 — State
          </label>
          <select
            value={state}
            onChange={e => handleStateChange(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ background: '#0a1628' }}>— Select a state —</option>
            {US_STATES.map(s => (
              <option key={s} value={s} style={{ background: '#0a1628' }}>
                {s} — {STATE_NAMES[s]}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2 — City (only after state selected) */}
        <div>
          <label style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            display: 'block', marginBottom: 6,
            color: state ? '#94a3b8' : '#334155',
          }}>
            Step 2 — City {!state && <span style={{ fontSize: 10, fontWeight: 400, color: '#334155' }}>(select a state first)</span>}
          </label>
          {state ? (
            <select
              value={city}
              onChange={e => handleCityChange(e.target.value)}
              style={selectStyle}
            >
              <option value="" style={{ background: '#0a1628' }}>— Select a city —</option>
              {citiesForState.map(c => (
                <option key={c} value={c} style={{ background: '#0a1628' }}>{c}</option>
              ))}
              <option value="__other__" style={{ background: '#0a1628' }}>Other (type below)</option>
            </select>
          ) : (
            <select disabled style={disabledSelectStyle}>
              <option>— Select a state first —</option>
            </select>
          )}
          {/* Show text input if they pick "Other" */}
          {city === '__other__' && (
            <input
              type="text"
              placeholder="Type your city name"
              autoFocus
              onChange={e => setCity(e.target.value === '__other__' ? '' : e.target.value)}
              onBlur={e => { if (e.target.value.trim()) setCity(e.target.value.trim()); }}
              style={{ ...inputStyle, marginTop: 8 }}
            />
          )}
        </div>

        {/* Step 3 — Address (only after city selected) */}
        {city && city !== '__other__' && (
          <div>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Step 3 — Street Address
            </label>
            <p style={{ fontSize: 11, color: '#475569', margin: '0 0 8px' }}>
              Street number and name only — no Rd, St, Ave, or suffix.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="e.g. 4128 Weymouth"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSet(); }}
                autoFocus
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleSet}
                disabled={!canSubmit}
                style={{
                  padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                  color: 'white', border: 'none', whiteSpace: 'nowrap',
                  background: canSubmit ? 'linear-gradient(90deg,#f97316,#ea580c)' : 'rgba(255,255,255,0.1)',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  boxShadow: canSubmit ? '0 4px 15px rgba(249,115,22,0.4)' : 'none',
                  opacity: canSubmit ? 1 : 0.5,
                  touchAction: 'manipulation',
                }}
              >
                Set Address
              </button>
            </div>
          </div>
        )}

        {/* Sheriff / County info — shown after city selected */}
        {countyInfo && city && city !== '__other__' && (
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(249,115,22,0.06)',
            border: '1px solid rgba(249,115,22,0.25)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#f97316', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
              ⚖️ {countyInfo.county}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href={countyInfo.warrantUrl || countyInfo.sheriffUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)',
                  color: '#f97316', textDecoration: 'none' }}>
                🔎 Warrant Search
              </a>
              <a href={countyInfo.jailUrl || countyInfo.sheriffUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)',
                  color: '#f97316', textDecoration: 'none' }}>
                🏛 Who's in Jail
              </a>
              <a href={countyInfo.sheriffUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8', textDecoration: 'none' }}>
                🏠 Sheriff's Office
              </a>
            </div>
          </div>
        )}

        {/* Active location display */}
        {currentLocation && currentLocation.city && (
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
    </div>
  );
}
