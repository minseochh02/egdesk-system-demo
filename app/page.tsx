'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { getEgdeskBasePath } from '@/lib/api';

type DemoPage = {
  title: string;
  description: string;
  href: string;
  eyebrow: string;
  items: string[];
};

const pages: DemoPage[] = [
  {
    title: 'Database Demo',
    description: 'Fetch rows, insert demo data, and inspect how EGDesk routes database calls through generated helpers.',
    href: '/database',
    eyebrow: 'Data helpers',
    items: ['queryTable', 'insertRows', 'apiFetch'],
  },
  {
    title: 'Kakao MCP Guide',
    description: 'Review every Kakao Channel MCP tool with helper examples, raw calls, inputs, and setup notes.',
    href: '/kakao-mcp',
    eyebrow: 'Kakao automation',
    items: ['channels', 'bots', 'callbacks'],
  },
];

export default function Home() {
  const [basePath, setBasePath] = useState('');

  useEffect(() => {
    setBasePath(getEgdeskBasePath());
  }, []);

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={eyebrowStyle}>EGDesk System Demo</div>
        <h1 style={titleStyle}>Choose a demo page</h1>
        <p style={introStyle}>
          This workspace shows the generated EGDesk integration surface: database helpers for app data and
          Kakao MCP helpers for Kakao Channel setup and management.
        </p>
      </section>

      <section style={gridStyle} aria-label="Demo pages">
        {pages.map((page) => (
          <a key={page.href} href={`${basePath}${page.href}`} style={cardStyle}>
            <span style={cardEyebrowStyle}>{page.eyebrow}</span>
            <strong style={cardTitleStyle}>{page.title}</strong>
            <span style={cardDescStyle}>{page.description}</span>
            <span style={tagRowStyle}>
              {page.items.map((item) => (
                <code key={item} style={tagStyle}>{item}</code>
              ))}
            </span>
            <span style={cardActionStyle}>Open page</span>
          </a>
        ))}
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  maxWidth: 1040,
  margin: '0 auto',
  padding: '56px 24px',
};

const heroStyle: React.CSSProperties = {
  marginBottom: 32,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#047857',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0,
  marginBottom: 10,
  textTransform: 'uppercase',
};

const titleStyle: React.CSSProperties = {
  color: '#111827',
  fontSize: 38,
  lineHeight: 1.12,
  fontWeight: 800,
  marginBottom: 12,
};

const introStyle: React.CSSProperties = {
  color: '#4b5563',
  fontSize: 16,
  lineHeight: 1.7,
  maxWidth: 760,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 18,
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  alignContent: 'start',
  minHeight: 250,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 24,
  color: '#111827',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const cardEyebrowStyle: React.CSSProperties = {
  color: '#2563eb',
  fontSize: 13,
  fontWeight: 750,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 22,
  lineHeight: 1.25,
};

const cardDescStyle: React.CSSProperties = {
  color: '#4b5563',
  fontSize: 14,
  lineHeight: 1.65,
};

const tagRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 4,
};

const tagStyle: React.CSSProperties = {
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 6,
  padding: '3px 7px',
  fontSize: 12,
};

const cardActionStyle: React.CSSProperties = {
  alignSelf: 'end',
  marginTop: 8,
  color: '#2563eb',
  fontSize: 14,
  fontWeight: 700,
};
