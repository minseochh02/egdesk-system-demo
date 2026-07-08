'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';
import { getDemoNavLinks } from '@/lib/demo-pages';

// ── Types ──────────────────────────────────────────────────────────────────

type StepStatus = 'idle' | 'running' | 'success' | 'error';

type Step = {
  label: string;
  status: StepStatus;
  result?: any;
  error?: string;
  durationMs?: number;
};

type Row = {
  id: number;
  _version: number;
  item: string;
  quantity: number;
  status: string;
};

// ── API helper ─────────────────────────────────────────────────────────────

async function dbCall(helper: string, args: Record<string, any> = {}) {
  const res = await apiFetch('/api/database', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ helper, arguments: args }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Request failed');
  return json.result;
}

const TABLE_NAME = '_concurrency_demo';

// ── Page ───────────────────────────────────────────────────────────────────

export default function ConcurrencyDemo() {
  const [navLinks, setNavLinks] = useState<{ href: string; label: string }[]>([]);
  const [landingHref, setLandingHref] = useState('/');

  // Setup state
  const [setupStatus, setSetupStatus] = useState<'none' | 'ready' | 'error'>('none');
  const [setupError, setSetupError] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);

  // Demo rows
  const [rows, setRows] = useState<Row[]>([]);

  // Scenario states
  const [scenario1Steps, setScenario1Steps] = useState<Step[]>([]);
  const [scenario1Running, setScenario1Running] = useState(false);

  const [scenario2Steps, setScenario2Steps] = useState<Step[]>([]);
  const [scenario2Running, setScenario2Running] = useState(false);

  const [scenario3Steps, setScenario3Steps] = useState<Step[]>([]);
  const [scenario3Running, setScenario3Running] = useState(false);

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setLandingHref(bp || '/');
    setNavLinks(getDemoNavLinks(bp, '/concurrency'));
  }, []);

  // ── Setup: create demo table ─────────────────────────────────────────────

  const refreshRows = useCallback(async () => {
    try {
      const result = await dbCall('queryTable', {
        tableName: TABLE_NAME,
        limit: 100,
        orderBy: 'id',
        orderDirection: 'ASC',
      });
      setRows(result?.rows ?? []);
    } catch {
      setRows([]);
    }
  }, []);

  const setupTable = async () => {
    setSetupLoading(true);
    setSetupError('');
    try {
      // Create (or recreate) the demo table
      await apiFetch('/api/database/concurrency-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });

      // Insert demo rows
      await dbCall('insertRows', {
        tableName: TABLE_NAME,
        rows: [
          { item: 'Widget A', quantity: 100, status: 'in-stock' },
          { item: 'Widget B', quantity: 50, status: 'in-stock' },
          { item: 'Widget C', quantity: 25, status: 'low-stock' },
        ],
      });

      await refreshRows();
      setSetupStatus('ready');
    } catch (err: any) {
      setSetupError(err.message);
      setSetupStatus('error');
    }
    setSetupLoading(false);
  };

  // ── Scenario 1: Version tracking ─────────────────────────────────────────
  // Show that _version auto-increments on each update

  const runScenario1 = async () => {
    setScenario1Running(true);
    const steps: Step[] = [
      { label: 'Read row 1 — check initial _version', status: 'idle' },
      { label: 'Update row 1 (quantity = 90) — _version should +1', status: 'idle' },
      { label: 'Read row 1 again — confirm _version incremented', status: 'idle' },
      { label: 'Update row 1 again (quantity = 80) — _version should +1 again', status: 'idle' },
      { label: 'Final read — confirm _version incremented twice', status: 'idle' },
    ];
    setScenario1Steps([...steps]);

    const run = async (idx: number, fn: () => Promise<any>) => {
      steps[idx].status = 'running';
      setScenario1Steps([...steps]);
      const t0 = performance.now();
      try {
        const result = await fn();
        steps[idx].status = 'success';
        steps[idx].result = result;
        steps[idx].durationMs = Math.round(performance.now() - t0);
      } catch (err: any) {
        steps[idx].status = 'error';
        steps[idx].error = err.message;
        steps[idx].durationMs = Math.round(performance.now() - t0);
      }
      setScenario1Steps([...steps]);
    };

    await run(0, () => dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '1' } }));
    await run(1, () => dbCall('updateRows', { tableName: TABLE_NAME, updates: { quantity: 90 }, ids: [1] }));
    await run(2, () => dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '1' } }));
    await run(3, () => dbCall('updateRows', { tableName: TABLE_NAME, updates: { quantity: 80 }, ids: [1] }));
    await run(4, () => dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '1' } }));

    await refreshRows();
    setScenario1Running(false);
  };

  // ── Scenario 2: Optimistic lock success ──────────────────────────────────
  // Read a row, use its _version in expectedVersion, update succeeds

  const runScenario2 = async () => {
    setScenario2Running(true);
    const steps: Step[] = [
      { label: 'Read row 2 — capture current _version', status: 'idle' },
      { label: 'Update row 2 with correct expectedVersion — should succeed', status: 'idle' },
      { label: 'Confirm update — read row 2 again', status: 'idle' },
    ];
    setScenario2Steps([...steps]);

    let capturedVersion = 0;

    const run = async (idx: number, fn: () => Promise<any>) => {
      steps[idx].status = 'running';
      setScenario2Steps([...steps]);
      const t0 = performance.now();
      try {
        const result = await fn();
        steps[idx].status = 'success';
        steps[idx].result = result;
        steps[idx].durationMs = Math.round(performance.now() - t0);
      } catch (err: any) {
        steps[idx].status = 'error';
        steps[idx].error = err.message;
        steps[idx].durationMs = Math.round(performance.now() - t0);
      }
      setScenario2Steps([...steps]);
    };

    await run(0, async () => {
      const result = await dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '2' } });
      capturedVersion = result?.rows?.[0]?._version ?? 1;
      return result;
    });

    await run(1, () =>
      dbCall('updateRows', {
        tableName: TABLE_NAME,
        updates: { quantity: 42, status: 'updated-with-lock' },
        ids: [2],
        expectedVersion: capturedVersion,
      })
    );

    await run(2, () => dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '2' } }));

    await refreshRows();
    setScenario2Running(false);
  };

  // ── Scenario 3: Optimistic lock conflict ─────────────────────────────────
  // Two "users" read the same row, both try to update with same expectedVersion
  // The second update should fail with a version conflict

  const runScenario3 = async () => {
    setScenario3Running(true);
    const steps: Step[] = [
      { label: 'User A reads row 3 — captures _version', status: 'idle' },
      { label: 'User B reads row 3 — captures same _version', status: 'idle' },
      { label: 'User A updates row 3 with expectedVersion — succeeds', status: 'idle' },
      { label: 'User B updates row 3 with same expectedVersion — CONFLICT expected', status: 'idle' },
      { label: 'Final read — only User A\'s change persisted', status: 'idle' },
    ];
    setScenario3Steps([...steps]);

    let versionA = 0;
    let versionB = 0;

    const run = async (idx: number, fn: () => Promise<any>) => {
      steps[idx].status = 'running';
      setScenario3Steps([...steps]);
      const t0 = performance.now();
      try {
        const result = await fn();
        steps[idx].status = 'success';
        steps[idx].result = result;
        steps[idx].durationMs = Math.round(performance.now() - t0);
      } catch (err: any) {
        steps[idx].status = 'error';
        steps[idx].error = err.message;
        steps[idx].durationMs = Math.round(performance.now() - t0);
      }
      setScenario3Steps([...steps]);
    };

    // Both "users" read the same version
    await run(0, async () => {
      const result = await dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '3' } });
      versionA = result?.rows?.[0]?._version ?? 1;
      return { ...result, note: `User A captured _version = ${versionA}` };
    });

    await run(1, async () => {
      const result = await dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '3' } });
      versionB = result?.rows?.[0]?._version ?? 1;
      return { ...result, note: `User B captured _version = ${versionB}` };
    });

    // User A updates first — succeeds
    await run(2, () =>
      dbCall('updateRows', {
        tableName: TABLE_NAME,
        updates: { quantity: 999, status: 'user-a-wins' },
        ids: [3],
        expectedVersion: versionA,
      })
    );

    // User B tries with stale version — should fail
    await run(3, () =>
      dbCall('updateRows', {
        tableName: TABLE_NAME,
        updates: { quantity: 0, status: 'user-b-wins' },
        ids: [3],
        expectedVersion: versionB,
      })
    );

    await run(4, () => dbCall('queryTable', { tableName: TABLE_NAME, filters: { id: '3' } }));

    await refreshRows();
    setScenario3Running(false);
  };

  // ── Cleanup ──────────────────────────────────────────────────────────────

  const cleanupTable = async () => {
    try {
      await apiFetch('/api/database/concurrency-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      setSetupStatus('none');
      setRows([]);
      setScenario1Steps([]);
      setScenario2Steps([]);
      setScenario3Steps([]);
    } catch {
      // ignore
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const statusIcon = (s: StepStatus) => {
    switch (s) {
      case 'idle': return '○';
      case 'running': return '◌';
      case 'success': return '●';
      case 'error': return '✕';
    }
  };

  const statusColor = (s: StepStatus) => {
    switch (s) {
      case 'idle': return '#666';
      case 'running': return '#f59e0b';
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <a href={landingHref} style={{ color: '#666', textDecoration: 'none', fontSize: '0.85rem' }}>All demos</a>
          {navLinks.slice(0, 6).map(l => (
            <a key={l.href} href={l.href} style={{ color: '#666', textDecoration: 'none', fontSize: '0.85rem' }}>
              {' / '}{l.label}
            </a>
          ))}
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>Concurrency & Optimistic Locking</h1>
        <p style={{ color: '#666', margin: '0.5rem 0 0' }}>
          Interactive demo of <code>_version</code> column tracking, optimistic locking with <code>expectedVersion</code>,
          and conflict detection in EGDesk's SQLite database.
        </p>
      </div>

      {/* Setup */}
      <section style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>1. Setup Demo Table</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1rem' }}>
          Creates a <code>{TABLE_NAME}</code> table with 3 inventory rows. Each row gets a <code>_version</code> column starting at 1.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={setupTable}
            disabled={setupLoading}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: 6, border: 'none',
              background: setupStatus === 'ready' ? '#22c55e' : '#2563eb',
              color: '#fff', fontWeight: 600, cursor: setupLoading ? 'wait' : 'pointer',
              opacity: setupLoading ? 0.7 : 1,
            }}
          >
            {setupLoading ? 'Setting up...' : setupStatus === 'ready' ? 'Reset & Rebuild' : 'Create Demo Table'}
          </button>
          {setupStatus === 'ready' && (
            <button
              onClick={cleanupTable}
              style={{
                padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #e5e7eb',
                background: '#fff', cursor: 'pointer', color: '#666',
              }}
            >
              Cleanup
            </button>
          )}
          {setupStatus === 'ready' && <span style={{ color: '#22c55e', fontWeight: 600 }}>Ready</span>}
          {setupError && <span style={{ color: '#ef4444' }}>{setupError}</span>}
        </div>
      </section>

      {/* Current state */}
      {rows.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem' }}>Current Table State</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>id</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', color: '#2563eb', fontWeight: 700 }}>_version</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>item</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>quantity</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem' }}>{r.id}</td>
                    <td style={{ padding: '0.5rem', color: '#2563eb', fontWeight: 700, fontFamily: 'monospace' }}>{r._version}</td>
                    <td style={{ padding: '0.5rem' }}>{r.item}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>{r.quantity}</td>
                    <td style={{ padding: '0.5rem' }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={refreshRows}
            style={{
              marginTop: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: 4,
              border: '1px solid #e5e7eb', background: '#fff', fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </section>
      )}

      {/* Scenario 1: Version tracking */}
      <ScenarioCard
        number={2}
        title="Version Tracking"
        description="Each update auto-increments _version. No expectedVersion needed — just observe the counter."
        steps={scenario1Steps}
        running={scenario1Running}
        disabled={setupStatus !== 'ready'}
        onRun={runScenario1}
        statusIcon={statusIcon}
        statusColor={statusColor}
      />

      {/* Scenario 2: Optimistic lock success */}
      <ScenarioCard
        number={3}
        title="Optimistic Lock — Success"
        description="Read row 2's _version, then update with expectedVersion matching. The update succeeds because nobody else modified the row."
        steps={scenario2Steps}
        running={scenario2Running}
        disabled={setupStatus !== 'ready'}
        onRun={runScenario2}
        statusIcon={statusIcon}
        statusColor={statusColor}
      />

      {/* Scenario 3: Conflict detection */}
      <ScenarioCard
        number={4}
        title="Conflict Detection"
        description="Two users read the same row (same _version). User A updates first (succeeds, _version increments). User B tries with the stale version — gets a conflict error."
        steps={scenario3Steps}
        running={scenario3Running}
        disabled={setupStatus !== 'ready'}
        onRun={runScenario3}
        statusIcon={statusIcon}
        statusColor={statusColor}
        highlight={3}
      />

      {/* Architecture note */}
      <section style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem' }}>How It Works</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#555', fontSize: '0.9rem', lineHeight: 1.7 }}>
          <li><strong>_version column</strong> — Auto-added to every user table (INTEGER DEFAULT 1, isSystem: true). Hidden from normal UI.</li>
          <li><strong>Auto-increment</strong> — Every <code>updateRows()</code> call adds <code>SET "_version" = "_version" + 1</code> to the SQL.</li>
          <li><strong>expectedVersion</strong> — Optional parameter. When provided, the UPDATE includes <code>WHERE "_version" = ?</code>. If 0 rows match, a "Version conflict" error is thrown.</li>
          <li><strong>Transaction wrapping</strong> — Both <code>updateRows()</code> and <code>deleteRows()</code> use <code>BEGIN IMMEDIATE / COMMIT / ROLLBACK</code> for atomicity.</li>
          <li><strong>WriteMutex</strong> — Promise-based queue for handler-level serialization. Prevents read-yield-write races across async handlers.</li>
        </ul>
      </section>
    </div>
  );
}

// ── Scenario card component ────────────────────────────────────────────────

function ScenarioCard({
  number, title, description, steps, running, disabled, onRun,
  statusIcon, statusColor, highlight,
}: {
  number: number;
  title: string;
  description: string;
  steps: Step[];
  running: boolean;
  disabled: boolean;
  onRun: () => void;
  statusIcon: (s: StepStatus) => string;
  statusColor: (s: StepStatus) => string;
  highlight?: number; // 0-based index of step to highlight (e.g. the conflict step)
}) {
  return (
    <section style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.25rem' }}>
        {number}. {title}
      </h2>
      <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1rem' }}>{description}</p>

      <button
        onClick={onRun}
        disabled={disabled || running}
        style={{
          padding: '0.5rem 1.25rem', borderRadius: 6, border: 'none',
          background: disabled ? '#d1d5db' : '#2563eb', color: '#fff',
          fontWeight: 600, cursor: disabled || running ? 'not-allowed' : 'pointer',
          opacity: running ? 0.7 : 1, marginBottom: '1rem',
        }}
      >
        {running ? 'Running...' : steps.length > 0 ? 'Run Again' : 'Run Scenario'}
      </button>

      {steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 6,
                border: `1px solid ${highlight === i && step.status === 'error' ? '#fca5a5' : '#e5e7eb'}`,
                background: highlight === i && step.status === 'error' ? '#fef2f2' : step.status === 'running' ? '#fffbeb' : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: statusColor(step.status), fontWeight: 700, fontSize: '0.9rem' }}>
                  {statusIcon(step.status)}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{step.label}</span>
                {step.durationMs !== undefined && (
                  <span style={{ marginLeft: 'auto', color: '#999', fontSize: '0.75rem' }}>
                    {step.durationMs}ms
                  </span>
                )}
              </div>
              {step.error && (
                <pre style={{
                  marginTop: '0.5rem', padding: '0.5rem', borderRadius: 4,
                  background: '#fef2f2', color: '#dc2626', fontSize: '0.8rem',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
                }}>
                  {step.error}
                </pre>
              )}
              {step.result && (
                <details style={{ marginTop: '0.5rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#666' }}>
                    Response
                  </summary>
                  <pre style={{
                    marginTop: '0.25rem', padding: '0.5rem', borderRadius: 4,
                    background: '#f9fafb', fontSize: '0.75rem', maxHeight: 200, overflow: 'auto',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {JSON.stringify(step.result, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
