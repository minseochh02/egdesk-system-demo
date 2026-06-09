'use client';

/**
 * EGDesk System Demo — Main Page
 *
 * This page demonstrates how to:
 *  1. Fetch rows from an EGDesk table via the /api/data route
 *  2. Insert a new row via the /api/create-row route
 *  3. Display the result in a simple table
 *
 * The actual database connection is handled by EGDesk automatically.
 * You never write SQL — just call the helper functions.
 *
 * HOW IT WORKS:
 *  - proxy.ts (auto-generated) intercepts all fetch calls and attaches
 *    the correct EGDesk routing headers (project ID + environment).
 *  - egdesk-helpers.ts (auto-generated) provides queryTable, insertRow, etc.
 *  - egdesk.config.ts (auto-generated) contains your table definitions (TABLES).
 *
 * To regenerate these files, run:
 *   npx egdesk-next-setup
 * or let EGDesk regenerate them automatically when you import data.
 */

import { useState, useEffect } from 'react';

type Row = Record<string, unknown>;

export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [tableName, setTableName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [insertMsg, setInsertMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      setRows(json.rows ?? []);
      setColumns(json.columns ?? []);
      setTableName(json.tableName ?? '');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInsertDemo = async () => {
    setInserting(true);
    setInsertMsg(null);
    try {
      const res = await fetch('/api/create-row', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Insert failed');
      setInsertMsg('Row inserted successfully!');
      fetchData();
    } catch (e: any) {
      setInsertMsg(`Error: ${e.message}`);
    } finally {
      setInserting(false);
    }
  };

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          EGDesk System Demo
        </h1>
        <p style={{ color: '#666', fontSize: 15 }}>
          Live data from your EGDesk database — no Supabase, no Firebase, no SQL.
        </p>
      </div>

      {/* How it works callout */}
      <div style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 28,
        fontSize: 14,
        color: '#1e40af',
        lineHeight: 1.7,
      }}>
        <strong>How EGDesk works in this app:</strong>
        <ol style={{ marginTop: 8, paddingLeft: 20 }}>
          <li><code>proxy.ts</code> — auto-generated, intercepts every fetch and routes to the right database</li>
          <li><code>egdesk.config.ts</code> — auto-generated, contains your table names &amp; column definitions</li>
          <li><code>egdesk-helpers.ts</code> — auto-generated, exposes <code>queryTable</code>, <code>insertRow</code>, <code>updateRow</code>, etc.</li>
          <li>Your code just calls helpers — <strong>no connection strings, no credentials in code</strong></li>
        </ol>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={fetchData}
          style={btnStyle('#1d4ed8', '#fff')}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh Data'}
        </button>
        <button
          onClick={handleInsertDemo}
          style={btnStyle('#15803d', '#fff')}
          disabled={inserting}
        >
          {inserting ? 'Inserting…' : '+ Insert Demo Row'}
        </button>
        {insertMsg && (
          <span style={{ fontSize: 13, color: insertMsg.startsWith('Error') ? '#dc2626' : '#15803d' }}>
            {insertMsg}
          </span>
        )}
      </div>

      {/* Table */}
      {error ? (
        <ErrorCard message={error} />
      ) : loading ? (
        <LoadingCard />
      ) : rows.length === 0 ? (
        <EmptyCard tableName={tableName} />
      ) : (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            Table: <strong>{tableName}</strong> · {rows.length} row{rows.length !== 1 ? 's' : ''}
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {columns.map(col => (
                    <th key={col} style={thStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    {columns.map(col => (
                      <td key={col} style={tdStyle}>
                        {row[col] == null ? <span style={{ color: '#aaa' }}>—</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 40, fontSize: 12, color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
        <p>
          <strong>Dev tip:</strong> Import data in EGDesk → tables appear here automatically.
          EGDesk regenerates <code>egdesk.config.ts</code> and <code>egdesk-helpers.ts</code> every time your schema changes.
        </p>
      </div>
    </main>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
      padding: '20px 24px', color: '#dc2626'
    }}>
      <strong>Error:</strong> {message}
      <p style={{ marginTop: 8, fontSize: 13, color: '#991b1b' }}>
        Make sure EGDesk is running and you have imported at least one table.
        Then run <code>npx egdesk-next-setup</code> to regenerate config files.
      </p>
    </div>
  );
}

function LoadingCard() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 15
    }}>
      Fetching data from EGDesk…
    </div>
  );
}

function EmptyCard({ tableName }: { tableName: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '40px 24px', textAlign: 'center', color: '#6b7280', fontSize: 15
    }}>
      <p>No rows found in <strong>{tableName || 'your table'}</strong>.</p>
      <p style={{ marginTop: 8, fontSize: 13 }}>
        Import data in EGDesk or click <strong>Insert Demo Row</strong> above.
      </p>
    </div>
  );
}

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: '9px 18px',
  background: bg,
  color,
  border: 'none',
  borderRadius: 7,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
});

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 13,
  color: '#374151',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
  color: '#374151',
  maxWidth: 300,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
