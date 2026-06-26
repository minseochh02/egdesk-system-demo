'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';

export default function InventoryScannerPage() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [guideHref, setGuideHref] = useState('/inventory-mcp');
  const [landingHref, setLandingHref] = useState('/');

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setGuideHref(`${bp}/inventory-mcp`);
    setLandingHref(bp || '/');

    apiFetch('/api/inventory/status')
      .then(res => res.json())
      .then(json => setInstalled(json.installed === true))
      .catch(() => setInstalled(false));
  }, []);

  if (installed === null) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>Checking scanner installation…</div>
      </main>
    );
  }

  if (installed) {
    return (
      <main style={pageStyle}>
        <header style={{ marginBottom: 24 }}>
          <a href={landingHref} style={navLinkStyle}>Back to landing</a>
          <div style={eyebrowStyle}>Inventory Scanner</div>
          <h1 style={titleStyle}>Scanner files detected</h1>
          <p style={subtitleStyle}>
            The scanner component is present in this project. Restart the dev server if you just ran setup,
            then reload — the injected page should take over with the live camera UI.
          </p>
        </header>
        <div style={calloutStyle}>
          If you still see this message after restart, open{' '}
          <code style={inlineCodeStyle}>app/inventory-scanner/page.tsx</code> and confirm it was replaced by the
          injector with the dynamic scanner import.
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <a href={landingHref} style={navLinkStyle}>Back to landing</a>
        <div style={eyebrowStyle}>Inventory Scanner</div>
        <h1 style={titleStyle}>Not installed yet</h1>
        <p style={subtitleStyle}>
          The camera scanner has not been injected into this project. Use the Inventory MCP guide to run{' '}
          <code style={inlineCodeStyle}>inventory_setup_scanner</code> with this repo&apos;s absolute path.
        </p>
      </header>

      <div style={calloutStyle}>
        <strong>Quick setup</strong>
        <ol style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Open EGDesk with Inventory MCP enabled</li>
          <li>Go to the Inventory MCP guide and paste this project&apos;s path</li>
          <li>Run the tool, then <code>npm install</code> and restart the dev server</li>
          <li>Return here to use the live scanner</li>
        </ol>
      </div>

      <a href={guideHref} style={{ ...primaryBtnStyle, display: 'inline-block', textDecoration: 'none', marginTop: 20 }}>
        Open Inventory MCP guide
      </a>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '48px 24px',
};

const navLinkStyle: React.CSSProperties = {
  color: '#2563eb',
  fontSize: 14,
  fontWeight: 600,
  display: 'inline-block',
  marginBottom: 18,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#047857',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: '#111827',
  marginBottom: 8,
};

const subtitleStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 15,
  lineHeight: 1.65,
};

const calloutStyle: React.CSSProperties = {
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 10,
  padding: '16px 20px',
  fontSize: 14,
  color: '#1e40af',
};

const inlineCodeStyle: React.CSSProperties = {
  fontSize: 12,
  background: '#f3f4f6',
  padding: '1px 5px',
  borderRadius: 4,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 22px',
  fontSize: 14,
  fontWeight: 700,
  background: '#047857',
  color: '#fff',
  borderRadius: 7,
};

const loadingStyle: React.CSSProperties = {
  padding: '48px 24px',
  textAlign: 'center',
  color: '#6b7280',
  fontSize: 15,
};
