'use client';

import { useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// WHERE IT WORKS — Nested sub-accordion city selector
//
// HOW TO ADD TO page.tsx:
//   1. Paste this entire block above the SafeCirclePage export default.
//   2. Replace the existing "Where It Works accordion" section in Tab 1 with:
//        <WhereItWorks onCitySelect={handleCitySelect} selectedCity={selectedCity} />
//   3. Add to SafeCirclePage state:
//        const [selectedCity, setSelectedCity] = useState<CityConfig>(() => {
//          try {
//            const s = typeof window !== 'undefined' ? localStorage.getItem('sc_city') : null;
//            return s ? JSON.parse(s) : CITY_CONFIGS[0];
//          } catch { return CITY_CONFIGS[0]; }
//        });
//   4. Add handleCitySelect function:
//        function handleCitySelect(city: CityConfig) {
//          setSelectedCity(city);
//          setAddress('');
//          setAddrSet(false);
//          setGeoLabel('');
//          lastGeoRef.current = '';
//          setServices({ police: null, fire: null, hospital: null });
//          try {
//            localStorage.setItem('sc_city', JSON.stringify(city));
//            localStorage.removeItem('sc_address');
//            localStorage.removeItem('sc_addrSet');
//            localStorage.removeItem('sc_geoLabel');
//          } catch {}
//        }
//   5. Pass selectedCity into LeafletMapComponent and geocodeAddress calls so
//      the map centers on the selected city and geocoder appends the right city name.
//      In geocodeAddress, change: raw + ', Memphis, TN'  →  raw + ', ' + selectedCity.geocodeSuffix
// ═══════════════════════════════════════════════════════════════════════════════

// ── City config type ──────────────────────────────────────────────────────────

export interface CityConfig {
  id: string;
  name: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  zoom: number;
  geocodeSuffix: string;        // appended to address for geocoding, e.g. "Memphis, TN"
  esriLayer: string;            // FeatureServer URL or 'socrata' or 'uk-police' etc.
  crimeField: string;           // field name for crime type
  updateFreq: string;
  apiStatus: '✅' | '~' | '🔧';
  warrantUrl: string;           // county sheriff warrant search URL
  jailUrl: string;              // jail roster URL
  warrantNote?: string;
  jailNote?: string;
  placeholderAddress: string;   // example address for input placeholder
}

// ── City configs ──────────────────────────────────────────────────────────────

export const CITY_CONFIGS: CityConfig[] = [
  // ── United States ──────────────────────────────────────────────────────────
  { id:'memphis',       name:'Memphis',        state:'TN', country:'US',
    lat:35.1495, lng:-90.0490, zoom:13, geocodeSuffix:'Memphis, TN',
    esriLayer:'https://services2.arcgis.com/saWmpKJIUAjyyNVc/arcgis/rest/services/MPD_Public_Safety_Incidents/FeatureServer/0',
    crimeField:'UCR_Category', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://warrants.shelby-sheriff.org/w_warrant_result.php',
    jailUrl:'https://imljail.shelbycountytn.gov/IML',
    placeholderAddress:'4128 Weymouth' },
  { id:'denver',        name:'Denver',         state:'CO', country:'US',
    lat:39.7392, lng:-104.9903, zoom:13, geocodeSuffix:'Denver, CO',
    esriLayer:'https://services1.arcgis.com/geospatialDenver/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'offense_type_id', updateFreq:'Mon–Fri', apiStatus:'✅',
    warrantUrl:'https://www.denvercountycourt.org/records/',
    jailUrl:'https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Sheriff-Department/Inmate-Search',
    warrantNote:'Denver County Court — web search',
    placeholderAddress:'1600 Broadway' },
  { id:'neworleans',    name:'New Orleans',    state:'LA', country:'US',
    lat:29.9511, lng:-90.0715, zoom:13, geocodeSuffix:'New Orleans, LA',
    esriLayer:'https://services3.arcgis.com/dty2kHktVXHrqO8i/arcgis/rest/services/Crime_Incidents/FeatureServer/0',
    crimeField:'TypeText', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.opcso.org/index.php?page=warrant_search',
    jailUrl:'https://opso.us/inmate-search/',
    placeholderAddress:'900 Bourbon St' },
  { id:'chicago',       name:'Chicago',        state:'IL', country:'US',
    lat:41.8781, lng:-87.6298, zoom:13, geocodeSuffix:'Chicago, IL',
    esriLayer:'socrata:data.cityofchicago.org/ijzp-q8t2',
    crimeField:'primary_type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://publicsearch1.chicagopolice.org/',
    jailUrl:'https://iic.ccsheriff.org/',
    placeholderAddress:'233 S Wacker Dr' },
  { id:'dc',            name:'Washington DC',  state:'DC', country:'US',
    lat:38.9072, lng:-77.0369, zoom:13, geocodeSuffix:'Washington, DC',
    esriLayer:'https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/MPD/MapServer/8',
    crimeField:'OFFENSE', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.dccourts.gov/superior-court/criminal-division',
    jailUrl:'https://doc.dc.gov/page/inmate-locator',
    placeholderAddress:'1600 Pennsylvania Ave' },
  { id:'losangeles',    name:'Los Angeles',    state:'CA', country:'US',
    lat:34.0522, lng:-118.2437, zoom:13, geocodeSuffix:'Los Angeles, CA',
    esriLayer:'https://data.lacity.org/resource/2nrs-mtv8.json',
    crimeField:'Crm Cd Desc', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.lasd.org/transparency/arrdivisions.html',
    jailUrl:'https://app5.lasd.org/iic/',
    placeholderAddress:'6801 Hollywood Blvd' },
  { id:'houston',       name:'Houston',        state:'TX', country:'US',
    lat:29.7604, lng:-95.3698, zoom:13, geocodeSuffix:'Houston, TX',
    esriLayer:'socrata:www.houstontx.gov',
    crimeField:'Offense Type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.hcso.hctx.net/warrant/',
    jailUrl:'https://www.hcso.hctx.net/jailinfo/',
    placeholderAddress:'1001 Avenida de las Americas' },
  { id:'phoenix',       name:'Phoenix',        state:'AZ', country:'US',
    lat:33.4484, lng:-112.0740, zoom:13, geocodeSuffix:'Phoenix, AZ',
    esriLayer:'https://maps.phoenix.gov/arcgis/rest/services/PHX_Crime/FeatureServer/0',
    crimeField:'UCR_CRIME_CATEGORY', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.maricopa.gov/5593/Warrant-Search',
    jailUrl:'https://www.mcso.org/Jail/InmateSearch',
    placeholderAddress:'200 W Washington St' },
  { id:'philadelphia',  name:'Philadelphia',   state:'PA', country:'US',
    lat:39.9526, lng:-75.1652, zoom:13, geocodeSuffix:'Philadelphia, PA',
    esriLayer:'socrata:www.opendataphilly.org',
    crimeField:'text_general_code', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://ujsportal.pacourts.us/',
    jailUrl:'https://www.phila.gov/departments/philadelphia-department-of-prisons/',
    placeholderAddress:'1 Penn Sq' },
  { id:'sanantonio',    name:'San Antonio',    state:'TX', country:'US',
    lat:29.4241, lng:-98.4936, zoom:13, geocodeSuffix:'San Antonio, TX',
    esriLayer:'https://cosagis.maps.arcgis.com/arcgis/rest/services/SAPD/FeatureServer/0',
    crimeField:'Highest NIBRS', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.bexar.org/2704/Active-Warrants',
    jailUrl:'https://jailrecords.bexar.org/',
    placeholderAddress:'300 Alamo Plaza' },
  { id:'dallas',        name:'Dallas',         state:'TX', country:'US',
    lat:32.7767, lng:-96.7970, zoom:13, geocodeSuffix:'Dallas, TX',
    esriLayer:'socrata:www.dallasopendata.com',
    crimeField:'Type of Incident', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.dallascounty.org/departments/sheriff/warrants.php',
    jailUrl:'https://www.dallascounty.org/departments/jail/',
    placeholderAddress:'1500 Marilla St' },
  { id:'austin',        name:'Austin',         state:'TX', country:'US',
    lat:30.2672, lng:-97.7431, zoom:13, geocodeSuffix:'Austin, TX',
    esriLayer:'https://data.austintexas.gov/resource/fdj4-gpfu.json',
    crimeField:'crime_type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.traviscountytx.gov/sheriff/warrants',
    jailUrl:'https://www.tcso.org/inmate-search',
    placeholderAddress:'301 W 2nd St' },
  { id:'jacksonville',  name:'Jacksonville',   state:'FL', country:'US',
    lat:30.3322, lng:-81.6557, zoom:13, geocodeSuffix:'Jacksonville, FL',
    esriLayer:'https://gis.coj.net/arcgis/rest/services/JSO/FeatureServer/0',
    crimeField:'CRIME_TYPE', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.jaxsheriff.org/services/warrant-search',
    jailUrl:'https://www.jaxsheriff.org/services/inmate-search',
    placeholderAddress:'117 W Duval St' },
  { id:'columbus',      name:'Columbus',       state:'OH', country:'US',
    lat:39.9612, lng:-82.9988, zoom:13, geocodeSuffix:'Columbus, OH',
    esriLayer:'https://columbus.maps.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'OFFENSE', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.franklincountyohio.gov/Sheriff/Warrants',
    jailUrl:'https://fcciportal.franklincountyohio.gov/',
    placeholderAddress:'90 W Broad St' },
  { id:'seattle',       name:'Seattle',        state:'WA', country:'US',
    lat:47.6062, lng:-122.3321, zoom:13, geocodeSuffix:'Seattle, WA',
    esriLayer:'https://data.seattle.gov/resource/tazs-3rd5.json',
    crimeField:'Primary Type', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.kingcounty.gov/courts/district-court/warrants.aspx',
    jailUrl:'https://www.kingcounty.gov/depts/adult-and-juvenile-detention/jails/inmate-search.aspx',
    placeholderAddress:'600 4th Ave' },
  { id:'nashville',     name:'Nashville',      state:'TN', country:'US',
    lat:36.1627, lng:-86.7816, zoom:13, geocodeSuffix:'Nashville, TN',
    esriLayer:'https://data.nashville.gov/resource/2u6v-ujjs.json',
    crimeField:'OFFENSE_DESCRIPTION', updateFreq:'Daily', apiStatus:'~',
    warrantUrl:'https://www.dcso.com/inmate-search/',
    jailUrl:'https://www.dcso.com/inmate-search/',
    placeholderAddress:'1 Public Square' },
  { id:'baltimore',     name:'Baltimore',      state:'MD', country:'US',
    lat:39.2904, lng:-76.6122, zoom:13, geocodeSuffix:'Baltimore, MD',
    esriLayer:'https://gis-baltimore.opendata.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'Description', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.baltimorecountymd.gov/departments/police/warrants',
    jailUrl:'https://www.bcboc.org/inmate-search',
    placeholderAddress:'100 N Holliday St' },
  { id:'portland',      name:'Portland',       state:'OR', country:'US',
    lat:45.5231, lng:-122.6765, zoom:13, geocodeSuffix:'Portland, OR',
    esriLayer:'https://pdx.maps.arcgis.com/arcgis/rest/services/PPB/FeatureServer/0',
    crimeField:'OFFENSE_CATEGORY', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.mcso.us/inmate-search',
    jailUrl:'https://www.mcso.us/inmate-search',
    placeholderAddress:'1221 SW 4th Ave' },
  { id:'charlotte',     name:'Charlotte',      state:'NC', country:'US',
    lat:35.2271, lng:-80.8431, zoom:13, geocodeSuffix:'Charlotte, NC',
    esriLayer:'https://cmpd.maps.arcgis.com/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'CATEGORY', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.mecksheriff.com/services/warrant-search',
    jailUrl:'https://www.mecksheriff.com/services/inmate-search',
    placeholderAddress:'600 E Trade St' },
  { id:'atlanta',       name:'Atlanta',        state:'GA', country:'US',
    lat:33.7490, lng:-84.3880, zoom:13, geocodeSuffix:'Atlanta, GA',
    esriLayer:'https://gis.atlantaga.gov/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'UC2_Literal', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/warrants',
    jailUrl:'https://ody.fultoncountyga.gov/portal/',
    placeholderAddress:'68 Mitchell St SW' },
  // ── Canada ─────────────────────────────────────────────────────────────────
  { id:'toronto',       name:'Toronto',        state:'ON', country:'CA',
    lat:43.6532, lng:-79.3832, zoom:13, geocodeSuffix:'Toronto, ON, Canada',
    esriLayer:'https://services.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Major_Crime_Indicators_Open_Data/FeatureServer/0',
    crimeField:'MCI_CATEGORY', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.torontopolice.on.ca/services/warrants.php',
    jailUrl:'https://www.mcscs.jus.gov.on.ca/english/corr_serv/InstitutionalServices/FindInmate/findInmate.html',
    placeholderAddress:'100 Queen St W' },
  { id:'vancouver',     name:'Vancouver',      state:'BC', country:'CA',
    lat:49.2827, lng:-123.1207, zoom:13, geocodeSuffix:'Vancouver, BC, Canada',
    esriLayer:'https://geodata.vancouver.ca/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'TYPE', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.vancouvercourts.ca/',
    jailUrl:'https://www.bcjails.gov.bc.ca/',
    placeholderAddress:'453 W 12th Ave' },
  { id:'calgary',       name:'Calgary',        state:'AB', country:'CA',
    lat:51.0447, lng:-114.0719, zoom:13, geocodeSuffix:'Calgary, AB, Canada',
    esriLayer:'https://data.calgary.ca/resource/crime-stats',
    crimeField:'category', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.calgary.ca/cps/Pages/Police-Home.aspx',
    jailUrl:'https://www.albertacourts.ca/',
    placeholderAddress:'800 Macleod Trail SE' },
  { id:'ottawa',        name:'Ottawa',         state:'ON', country:'CA',
    lat:45.4215, lng:-75.6919, zoom:13, geocodeSuffix:'Ottawa, ON, Canada',
    esriLayer:'https://ottawa.ca/arcgis/rest/services/Crime/FeatureServer/0',
    crimeField:'offence_type', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.ottawapolice.ca/en/services-and-community/warrants.aspx',
    jailUrl:'https://www.mcscs.jus.gov.on.ca/english/corr_serv/InstitutionalServices/FindInmate/findInmate.html',
    placeholderAddress:'110 Laurier Ave W' },
  // ── United Kingdom ─────────────────────────────────────────────────────────
  { id:'london',        name:'London',         state:'England', country:'GB',
    lat:51.5074, lng:-0.1278, zoom:13, geocodeSuffix:'London, UK',
    esriLayer:'uk-police:metropolitan',
    crimeField:'category', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.met.police.uk/advice/advice-and-information/wsi/wanted/',
    jailUrl:'https://www.gov.uk/find-prisoner',
    placeholderAddress:'10 Downing Street' },
  { id:'manchester',    name:'Manchester',     state:'England', country:'GB',
    lat:53.4808, lng:-2.2426, zoom:13, geocodeSuffix:'Manchester, UK',
    esriLayer:'uk-police:greater-manchester',
    crimeField:'category', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.gmp.police.uk/advice/advice-and-information/wsi/wanted/',
    jailUrl:'https://www.gov.uk/find-prisoner',
    placeholderAddress:'Albert Square' },
  { id:'birmingham',    name:'Birmingham',     state:'England', country:'GB',
    lat:52.4862, lng:-1.8904, zoom:13, geocodeSuffix:'Birmingham, UK',
    esriLayer:'uk-police:west-midlands',
    crimeField:'category', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.westmidlands.police.uk/advice/advice-and-information/wsi/wanted/',
    jailUrl:'https://www.gov.uk/find-prisoner',
    placeholderAddress:'Victoria Square' },
  // ── Australia ──────────────────────────────────────────────────────────────
  { id:'sydney',        name:'Sydney',         state:'NSW', country:'AU',
    lat:-33.8688, lng:151.2093, zoom:13, geocodeSuffix:'Sydney, NSW, Australia',
    esriLayer:'bocsar:nsw',
    crimeField:'offence', updateFreq:'Quarterly', apiStatus:'✅',
    warrantUrl:'https://www.police.nsw.gov.au/crime/wanted_persons',
    jailUrl:'https://www.correctiveservices.dcj.nsw.gov.au/inmate-search',
    placeholderAddress:'1 Martin Place' },
  { id:'melbourne',     name:'Melbourne',      state:'VIC', country:'AU',
    lat:-37.8136, lng:144.9631, zoom:13, geocodeSuffix:'Melbourne, VIC, Australia',
    esriLayer:'csa:victoria',
    crimeField:'offence_category', updateFreq:'Annual', apiStatus:'✅',
    warrantUrl:'https://www.police.vic.gov.au/wanted',
    jailUrl:'https://www.corrections.vic.gov.au/',
    placeholderAddress:'1 Swanston St' },
  // ── New Zealand ────────────────────────────────────────────────────────────
  { id:'auckland',      name:'Auckland',       state:'Auckland', country:'NZ',
    lat:-36.8509, lng:174.7645, zoom:13, geocodeSuffix:'Auckland, New Zealand',
    esriLayer:'nz-police:auckland-city',
    crimeField:'anzsoc_division', updateFreq:'Monthly', apiStatus:'✅',
    warrantUrl:'https://www.police.govt.nz/wanted',
    jailUrl:'https://www.corrections.govt.nz/our_prison_system/find_an_inmate',
    placeholderAddress:'1 Queen St' },
  // ── Mexico ─────────────────────────────────────────────────────────────────
  { id:'mexicocity',    name:'Mexico City',    state:'CDMX', country:'MX',
    lat:19.4326, lng:-99.1332, zoom:13, geocodeSuffix:'Ciudad de Mexico, Mexico',
    esriLayer:'https://services.arcgis.com/CDMX/arcgis/rest/services/Carpetas/FeatureServer/0',
    crimeField:'delito', updateFreq:'Daily', apiStatus:'✅',
    warrantUrl:'https://www.fgjcdmx.gob.mx/',
    jailUrl:'https://reclusorios.cdmx.gob.mx/',
    placeholderAddress:'Plaza de la Constitucion' },
];

// ── Group configs by country ──────────────────────────────────────────────────

const COUNTRY_GROUPS = [
  { code:'US', flag:'🇺🇸', label:'United States', cities: CITY_CONFIGS.filter(c=>c.country==='US') },
  { code:'CA', flag:'🇨🇦', label:'Canada',         cities: CITY_CONFIGS.filter(c=>c.country==='CA') },
  { code:'GB', flag:'🇬🇧', label:'United Kingdom', cities: CITY_CONFIGS.filter(c=>c.country==='GB') },
  { code:'AU', flag:'🇦🇺', label:'Australia',      cities: CITY_CONFIGS.filter(c=>c.country==='AU') },
  { code:'NZ', flag:'🇳🇿', label:'New Zealand',    cities: CITY_CONFIGS.filter(c=>c.country==='NZ') },
  { code:'MX', flag:'🇲🇽', label:'Mexico',         cities: CITY_CONFIGS.filter(c=>c.country==='MX') },
];

// ── Sub-accordion ─────────────────────────────────────────────────────────────

function CountryGroup({
  flag, label, cities, selectedCity, onSelect, openKey, setOpenKey
}: {
  flag: string; label: string; cities: CityConfig[];
  selectedCity: CityConfig; onSelect: (c: CityConfig) => void;
  openKey: string; setOpenKey: (k: string) => void;
}) {
  const isOpen = openKey === label;
  const hasSelected = cities.some(c => c.id === selectedCity.id);

  return (
    <div style={{
      borderRadius: 14,
      border: isOpen
        ? '1px solid rgba(34,211,238,0.35)'
        : hasSelected
          ? '1px solid rgba(16,185,129,0.4)'
          : '1px solid rgba(255,255,255,0.07)',
      background: isOpen ? 'rgba(34,211,238,0.04)' : 'rgba(255,255,255,0.02)',
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Header */}
      <button
        onClick={() => setOpenKey(isOpen ? '' : label)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '11px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{flag}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{label}</span>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 20,
            background: 'rgba(34,211,238,0.12)', color: '#22d3ee',
          }}>{cities.length} cities</span>
          {hasSelected && (
            <span style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 20,
              background: 'rgba(16,185,129,0.15)', color: '#10b981',
            }}>✓ selected</span>
          )}
        </div>
        <span style={{
          fontSize: 18, fontWeight: 900, color: isOpen ? '#22d3ee' : '#475569',
          lineHeight: 1, userSelect: 'none',
        }}>{isOpen ? '−' : '+'}</span>
      </button>

      {/* City list */}
      {isOpen && (
        <div style={{ padding: '0 10px 12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 7 }}>
            {cities.map(city => {
              const active = city.id === selectedCity.id;
              return (
                <button
                  key={city.id}
                  onClick={() => onSelect(city)}
                  style={{
                    padding: '7px 13px', borderRadius: 20, fontSize: 12,
                    fontWeight: active ? 700 : 500, cursor: 'pointer',
                    border: active
                      ? '1px solid rgba(16,185,129,0.6)'
                      : '1px solid rgba(34,211,238,0.2)',
                    background: active
                      ? 'linear-gradient(90deg,#10b981,#059669)'
                      : 'rgba(255,255,255,0.04)',
                    color: active ? 'white' : '#94a3b8',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {active ? '✓ ' : ''}{city.name}
                  {city.state ? `, ${city.state}` : ''}
                  <span style={{
                    marginLeft: 5, fontSize: 10,
                    color: city.apiStatus === '✅'
                      ? (active ? 'rgba(255,255,255,0.8)' : '#10b981')
                      : '#f59e0b',
                  }}>{city.apiStatus}</span>
                </button>
              );
            })}
          </div>

          {/* Selected city detail */}
          {hasSelected && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#10b981', margin: '0 0 6px' }}>
                ✓ {selectedCity.name} is your active city
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {[
                  ['Crime data', selectedCity.esriLayer.startsWith('http') ? 'ESRI FeatureServer' : selectedCity.esriLayer.split(':')[0].toUpperCase()],
                  ['Updates', selectedCity.updateFreq],
                  ['Warrants', selectedCity.warrantNote || 'Sheriff website'],
                  ['Geocoder suffix', selectedCity.geocodeSuffix],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span style={{ fontSize: 10, color: '#475569' }}>{k}: </span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main WhereItWorks component ───────────────────────────────────────────────

function WhereItWorks({
  onCitySelect, selectedCity
}: {
  onCitySelect: (city: CityConfig) => void;
  selectedCity: CityConfig;
}) {
  const [openCountry, setOpenCountry] = useState('');

  return (
    <Section title={`🌎  Where It Works — ${selectedCity.flag || '📍'} ${selectedCity.name} active`} dark={true}>
      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
        Select your city to set the crime map, geocoder, warrant links, and address bar.
        Your selection is saved for next time. ✅ = full API · ~ = web form link
      </p>

      {/* Currently active city pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        borderRadius: 12, background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.3)', marginBottom: 14,
      }}>
        <span style={{ fontSize: 14 }}>📍</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>
            Active city: {selectedCity.name}{selectedCity.state ? `, ${selectedCity.state}` : ''}
          </span>
          <span style={{ fontSize: 10, color: '#475569', marginLeft: 8 }}>
            {selectedCity.geocodeSuffix} · {selectedCity.updateFreq} updates
          </span>
        </div>
        <span style={{ fontSize: 12, color: selectedCity.apiStatus === '✅' ? '#10b981' : '#f59e0b' }}>
          {selectedCity.apiStatus}
        </span>
      </div>

      {/* Country sub-accordions */}
      {COUNTRY_GROUPS.map(group => (
        <CountryGroup
          key={group.code}
          flag={group.flag}
          label={group.label}
          cities={group.cities}
          selectedCity={selectedCity}
          onSelect={city => {
            onCitySelect(city);
            setOpenCountry('');
          }}
          openKey={openCountry}
          setOpenKey={setOpenCountry}
        />
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginTop: 12 }}>
        {[['✅', 'Full ESRI/REST API', '#10b981'], ['~', 'Web form / partial', '#f59e0b']].map(([icon, label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13, color: color as string }}>{icon}</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 10, color: '#475569', lineHeight: 1.6, margin: '10px 0 0' }}>
        Modules 3–7 (sex offenders, nearest services, circle/SOS, GPS, panic) work in every city with no changes.
        Selecting a city clears your current address for a fresh start.
      </p>
    </Section>
  );
}

