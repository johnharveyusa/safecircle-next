// src/Page.tsx
import React, { useState } from 'react';
import Papa from 'papaparse';

interface Contact {
  name: string;
  email: string;
  phone: string;
}

const SafetyCirclePage: React.FC = () => {
  const [circles, setCircles] = useState<Contact[]>([]);
  const [address, setAddress] = useState({
    streetNum: '',
    streetName: '',
    city: 'Memphis',
    state: 'TN',
  });

  // CSV Upload Handler (multiple files OK)
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result: any) => {
          const newContacts: Contact[] = result.data
            .map((row: any) => ({
              name: (row.Name || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim()) || 'Unknown',
              email: row.Email || row.email || '',
              phone: row.Phone || row.phone || '',
            }))
            .filter((c: Contact) => c.name && (c.email || c.phone));

          setCircles((prev) => [...prev, ...newContacts]);
        },
      });
    });
  };

  // Shelby County Warrant Search (pre-filled)
  const checkWarrants = () => {
    if (!address.streetNum || !address.streetName) {
      alert('Please enter both Street Number and Street Name.');
      return;
    }
    const baseUrl = 'https://warrants.shelby-sheriff.org/w_warrant_result.php';
    const params = new URLSearchParams({
      w: '',
      l: '',
      f: '',
      s: address.streetNum,
      st: address.streetName.toLowerCase(),
    });
    window.open(`${baseUrl}?${params.toString()}`, '_blank');
  };

  // Sex Offender Checks
  const checkSexOffenders = () => {
    window.open('https://www.nsopw.gov/', '_blank');
    window.open('https://sor.tbi.tn.gov/search', '_blank');
    alert('Opened National Sex Offender Registry + Tennessee SOR.\nSearch the entered address to check for registered offenders nearby.');
  };

  // NEW: ESRI Memphis Safer Communities Dashboard (0.5 mile radius offenses)
  const checkPublicSafetyESRI = () => {
    if (!address.streetNum || !address.streetName) {
      alert('Please enter Street Number and Street Name first.');
      return;
    }
    const fullAddress = `${address.streetNum} ${address.streetName}, ${address.city}, ${address.state}`;
    const esriUrl = 'https://experience.arcgis.com/experience/7fe3d1d471984096ad287080e3cd5e60';
    window.open(esriUrl, '_blank');
    alert(`✅ Memphis Safer Communities Dashboard opened (built with ESRI).\n\nSearch for "${fullAddress}" on the map to see reported offenses, crimes, and incidents within approximately 0.5 mile radius.`);
  };

  // Geofencing Demo
  const startGeofencing = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        alert(`📍 Current location acquired!\nLat: ${pos.coords.latitude.toFixed(6)}\nLon: ${pos.coords.longitude.toFixed(6)}\n\nWe can build real 0.5-mile safe-zone geofencing in the next phase.`);
      },
      (err) => alert('Location error: ' + err.message)
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px', color: '#1e40af' }}>
        <h1>🛡️ Safety Circle</h1>
        <p>For teens in Memphis • Build your circle • Check every address</p>
      </header>

      {/* 1. Friend Circles */}
      <section style={{ background: '#f0f9ff', padding: '25px', borderRadius: '16px', marginBottom: '25px' }}>
        <h2>1. Build Your Friend Circles</h2>
        <p>Upload one or more CSV files (columns: Name, Email, Phone)</p>
        <input type="file" accept=".csv" multiple onChange={handleCSVUpload} style={{ marginBottom: '15px' }} />
        <p><strong>Total contacts in circles: {circles.length}</strong></p>
        <ul style={{ maxHeight: '180px', overflowY: 'auto' }}>
          {circles.slice(0, 12).map((c, i) => (
            <li key={i}>{c.name} — {c.email || c.phone}</li>
          ))}
          {circles.length > 12 && <li>... and {circles.length - 12} more</li>}
        </ul>
      </section>

      {/* 2. Address Safety Checks (including new ESRI) */}
      <section style={{ background: '#fefce8', padding: '25px', borderRadius: '16px', marginBottom: '25px' }}>
        <h2>2. Check Any Address Safety</h2>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'end', marginBottom: '20px' }}>
          <div>
            <label>Street Number:</label><br />
            <input
              type="text"
              value={address.streetNum}
              onChange={(e) => setAddress({ ...address, streetNum: e.target.value })}
              placeholder="4128"
              style={{ width: '130px', padding: '10px', fontSize: '1rem' }}
            />
          </div>
          <div>
            <label>Street Name:</label><br />
            <input
              type="text"
              value={address.streetName}
              onChange={(e) => setAddress({ ...address, streetName: e.target.value })}
              placeholder="Weymouth Cove"
              style={{ width: '280px', padding: '10px', fontSize: '1rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <button onClick={checkWarrants} style={{ background: '#dc2626', color: 'white', padding: '14px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.05rem' }}>
            🔍 Warrants (Shelby Sheriff)
          </button>
          <button onClick={checkSexOffenders} style={{ background: '#ea580c', color: 'white', padding: '14px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.05rem' }}>
            🔍 Sex Offenders (National + TN)
          </button>
          <button onClick={checkPublicSafetyESRI} style={{ background: '#10b981', color: 'white', padding: '14px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.05rem' }}>
            📍 Reported Offenses (ESRI 0.5 mi Dashboard)
          </button>
        </div>
      </section>

      {/* 3. Extra Tools */}
      <section style={{ background: '#ecfdf5', padding: '25px', borderRadius: '16px' }}>
        <h2>3. More Safety Tools</h2>
        <button onClick={startGeofencing} style={{ background: '#10b981', color: 'white', padding: '14px 28px', border: 'none', borderRadius: '8px', margin: '8px 8px 8px 0', cursor: 'pointer', fontSize: '1.05rem' }}>
          📍 Test Geofencing (Get My Location)
        </button>
        <button style={{ background: '#3b82f6', color: 'white', padding: '14px 28px', border: 'none', borderRadius: '8px', margin: '8px', cursor: 'pointer', fontSize: '1.05rem' }}>
          🚨 Emergency Alert My Circle (coming next phase)
        </button>
      </section>

      <footer style={{ textAlign: 'center', marginTop: '40px', fontSize: '0.9rem', color: '#555' }}>
        <p>🛡️ Safety Circle links only to official public sources (Shelby Sheriff, NSOPW, Memphis ESRI Dashboard). Always verify with authorities. Do not attempt arrests.</p>
      </footer>
    </div>
  );
};

export default SafetyCirclePage;