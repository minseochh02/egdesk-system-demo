'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';
import { getDemoNavLinks } from '@/lib/demo-pages';

type RunStatus = 'idle' | 'generating' | 'uploading' | 'success' | 'error';

type UploadRun = {
  id: string;
  label: string;
  targetBytes: number;
  status: RunStatus;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  httpStatus?: number;
  requestId?: string;
  error?: string;
  retryable?: boolean;
  rowId?: number;
  payloadBase64Chars?: number;
  pathHint?: string;
};

const PRESETS: Array<{ label: string; bytes: number }> = [
  { label: '100 KB', bytes: 100 * 1024 },
  { label: '1 MB', bytes: 1 * 1024 * 1024 },
  { label: '5 MB', bytes: 5 * 1024 * 1024 },
  { label: '10 MB', bytes: 10 * 1024 * 1024 },
  { label: '20 MB', bytes: 20 * 1024 * 1024 },
  { label: '50 MB', bytes: 50 * 1024 * 1024 },
  { label: '100 MB', bytes: 100 * 1024 * 1024 },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Chunked base64 so large payloads do not blow call-stack / argument limits. */
function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

/**
 * Synthetic "image" payload: JPEG SOI + APP0-ish header + filler + EOI.
 * Size is exact so limit tests are reproducible.
 */
function makeSyntheticJpeg(byteLength: number): Uint8Array {
  const min = 24;
  const size = Math.max(min, Math.floor(byteLength));
  const out = new Uint8Array(size);
  // SOI
  out[0] = 0xff;
  out[1] = 0xd8;
  // APP0 marker + length placeholder + 'JFIF\0'
  out[2] = 0xff;
  out[3] = 0xe0;
  out[4] = 0x00;
  out[5] = 0x10;
  out[6] = 0x4a; // J
  out[7] = 0x46; // F
  out[8] = 0x49; // I
  out[9] = 0x46; // F
  out[10] = 0x00;
  for (let i = 11; i < size - 2; i++) {
    out[i] = (i * 37 + 91) & 0xff;
  }
  out[size - 2] = 0xff;
  out[size - 1] = 0xd9; // EOI
  return out;
}

function parseErrorPayload(json: any, httpStatus: number): {
  message: string;
  requestId?: string;
  retryable?: boolean;
} {
  if (!json || typeof json !== 'object') {
    return { message: `HTTP ${httpStatus}` };
  }
  const err = json.error;
  const message =
    (typeof json.message === 'string' && json.message) ||
    (typeof err === 'string' && err) ||
    (err && typeof err === 'object' && typeof err.message === 'string' && err.message) ||
    `HTTP ${httpStatus}`;
  const requestId =
    (typeof json.request_id === 'string' && json.request_id) ||
    (typeof json.requestId === 'string' && json.requestId) ||
    undefined;
  const retryable =
    json.retryable === true ||
    err === 'tunnel_timeout' ||
    /tunnel_timeout|gateway timeout|504/i.test(String(message));
  return { message, requestId, retryable };
}

export default function UploadLimitTesterPage() {
  const [navLinks, setNavLinks] = useState<{ href: string; label: string }[]>([]);
  const [landingHref, setLandingHref] = useState('/');
  const [selected, setSelected] = useState<Record<string, boolean>>({
    '1 MB': true,
    '5 MB': true,
    '20 MB': true,
  });
  const [customMb, setCustomMb] = useState('2');
  const [useCustom, setUseCustom] = useState(false);
  const [yoloCrop, setYoloCrop] = useState(false);
  const [deleteAfter, setDeleteAfter] = useState(true);
  const [setupNote, setSetupNote] = useState('');
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<UploadRun[]>([]);
  const [envInfo, setEnvInfo] = useState<{
    href: string;
    isTunnel: boolean;
    basePath: string;
  } | null>(null);

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setLandingHref(bp || '/');
    setNavLinks(getDemoNavLinks(bp, '/upload-limit-tester'));
    if (typeof window !== 'undefined') {
      const href = window.location.href;
      setEnvInfo({
        href,
        isTunnel: /\/t\/[^/]+\/p\//.test(window.location.pathname) || /tunneling-service|egdesk\.cloud/.test(href),
        basePath: bp,
      });
    }
  }, []);

  const planned = useMemo(() => {
    const list: Array<{ label: string; bytes: number }> = [];
    for (const p of PRESETS) {
      if (selected[p.label]) list.push(p);
    }
    if (useCustom) {
      const mb = Number(customMb);
      if (Number.isFinite(mb) && mb > 0) {
        list.push({ label: `${mb} MB (custom)`, bytes: Math.round(mb * 1024 * 1024) });
      }
    }
    return list.sort((a, b) => a.bytes - b.bytes);
  }, [selected, useCustom, customMb]);

  const ensureTable = useCallback(async () => {
    setSetupNote('Ensuring images table…');
    const res = await apiFetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helper: 'ensureImagesTable', arguments: {} }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'ensureImagesTable failed');
    setSetupNote(
      json.result?.created
        ? 'Created images table.'
        : 'images table already present.',
    );
  }, []);

  const runUploads = useCallback(async () => {
    if (planned.length === 0 || running) return;
    setRunning(true);
    setRuns([]);

    try {
      await ensureTable();
    } catch (err: any) {
      setSetupNote(err?.message || String(err));
      setRunning(false);
      return;
    }

    const initial: UploadRun[] = planned.map((p, i) => ({
      id: `${Date.now()}-${i}`,
      label: p.label,
      targetBytes: p.bytes,
      status: 'idle',
    }));
    setRuns(initial);

    for (let i = 0; i < planned.length; i++) {
      const plan = planned[i];
      const runId = initial[i].id;
      const patch = (partial: Partial<UploadRun>) => {
        setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, ...partial } : r)));
      };

      patch({ status: 'generating' });
      let base64: string;
      try {
        const bytes = makeSyntheticJpeg(plan.bytes);
        base64 = bytesToBase64(bytes);
      } catch (err: any) {
        patch({
          status: 'error',
          error: `Failed to generate payload: ${err?.message || err}`,
          endedAt: Date.now(),
        });
        continue;
      }

      const startedAt = Date.now();
      patch({
        status: 'uploading',
        startedAt,
        payloadBase64Chars: base64.length,
        pathHint: 'Browser → /api/database (uploadImage) → server callUserDataTool → MCP',
      });

      try {
        const res = await apiFetch('/api/database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            helper: 'uploadImage',
            arguments: {
              filename: `limit-test-${plan.bytes}.jpg`,
              mimeType: 'image/jpeg',
              data: base64,
              yoloCrop,
            },
          }),
        });
        const endedAt = Date.now();
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          const parsed = parseErrorPayload(json, res.status);
          patch({
            status: 'error',
            endedAt,
            durationMs: endedAt - startedAt,
            httpStatus: res.status,
            error: parsed.message,
            requestId: parsed.requestId,
            retryable: parsed.retryable,
          });
          continue;
        }

        const rowId = json.result?.rowId;
        patch({
          status: 'success',
          endedAt,
          durationMs: endedAt - startedAt,
          httpStatus: res.status,
          rowId,
        });

        if (deleteAfter && rowId != null) {
          try {
            await apiFetch('/api/database', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                helper: 'deleteImage',
                arguments: { rowId },
              }),
            });
          } catch {
            // non-fatal
          }
        }
      } catch (err: any) {
        const endedAt = Date.now();
        patch({
          status: 'error',
          endedAt,
          durationMs: endedAt - startedAt,
          error: err?.message || String(err),
          retryable: /timeout|504|Failed to fetch|network/i.test(String(err?.message || err)),
        });
      }
    }

    setRunning(false);
  }, [planned, running, ensureTable, yoloCrop, deleteAfter]);

  const statusColor = (s: RunStatus) => {
    switch (s) {
      case 'success':
        return '#16a34a';
      case 'error':
        return '#dc2626';
      case 'uploading':
      case 'generating':
        return '#d97706';
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      style={{
        maxWidth: 920,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <a href={landingHref} style={{ color: '#666', textDecoration: 'none', fontSize: '0.85rem' }}>
            All demos
          </a>
          {navLinks.slice(0, 8).map((l) => (
            <a key={l.href} href={l.href} style={{ color: '#666', textDecoration: 'none', fontSize: '0.85rem' }}>
              {' / '}
              {l.label}
            </a>
          ))}
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Image upload limit tester</h1>
        <p style={{ color: '#4b5563', margin: '0.5rem 0 0', lineHeight: 1.6, fontSize: 15 }}>
          Generates synthetic JPEGs of exact byte sizes and uploads them through{' '}
          <code>/api/database</code> → <code>uploadImage</code> → MCP{' '}
          <code>user_data_upload_file</code>. Use this on a <strong>prod tunnel URL</strong> to
          verify the 504 / double-hop fix (look for ~60s failures vs success).
        </p>
      </div>

      <section
        style={{
          marginBottom: '1.25rem',
          padding: '1rem 1.25rem',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: envInfo?.isTunnel ? '#ecfdf5' : '#fffbeb',
        }}
      >
        <div style={{ fontWeight: 650, marginBottom: 6 }}>
          {envInfo?.isTunnel ? 'Tunnel / hosted path detected' : 'Local (or non-tunnel) path'}
        </div>
        <div style={{ fontSize: 13, color: '#374151', wordBreak: 'break-all' }}>
          {envInfo?.href || '…'}
        </div>
        {envInfo?.basePath ? (
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>basePath: {envInfo.basePath}</div>
        ) : null}
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
          Success on tunnel after Phase 1 should show <em>one</em> gateway hop in Render logs (
          <code>[tunnel-req …]</code>), not a nested re-entry for the same upload.
        </div>
      </section>

      <section
        style={{
          marginBottom: '1.25rem',
          padding: '1.25rem',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
        }}
      >
        <h2 style={{ fontSize: '1.05rem', fontWeight: 650, margin: '0 0 0.75rem' }}>Sizes to test</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {PRESETS.map((p) => (
            <label
              key={p.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer',
                background: selected[p.label] ? '#eff6ff' : '#fff',
              }}
            >
              <input
                type="checkbox"
                checked={!!selected[p.label]}
                disabled={running}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [p.label]: e.target.checked }))
                }
              />
              {p.label}
            </label>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={useCustom}
            disabled={running}
            onChange={(e) => setUseCustom(e.target.checked)}
          />
          Custom size (MB)
          <input
            type="number"
            min={0.05}
            step={0.05}
            value={customMb}
            disabled={running || !useCustom}
            onChange={(e) => setCustomMb(e.target.value)}
            style={{ width: 88, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={yoloCrop}
            disabled={running}
            onChange={(e) => setYoloCrop(e.target.checked)}
          />
          Run YOLO on upload (slower — leave off for pure transfer timing)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={deleteAfter}
            disabled={running}
            onChange={(e) => setDeleteAfter(e.target.checked)}
          />
          Delete uploaded row after each success (keeps My DB clean)
        </label>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={runUploads}
            disabled={running || planned.length === 0}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: 6,
              border: 'none',
              background: running ? '#9ca3af' : '#2563eb',
              color: '#fff',
              fontWeight: 650,
              cursor: running || planned.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? 'Running…' : `Run ${planned.length} upload${planned.length === 1 ? '' : 's'}`}
          </button>
          <button
            type="button"
            onClick={() => ensureTable().catch((e) => setSetupNote(e.message))}
            disabled={running}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            Ensure images table
          </button>
          {setupNote ? <span style={{ fontSize: 13, color: '#4b5563' }}>{setupNote}</span> : null}
        </div>
        {planned.some((p) => p.bytes >= 50 * 1024 * 1024) ? (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#b45309' }}>
            Large sizes (≥50 MB) inflate ~33% as Base64 in JSON and can stress the browser tab. Prefer
            running one at a time if the tab becomes sluggish.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 650, margin: '0 0 0.75rem' }}>Results</h2>
        {runs.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>No runs yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {runs.map((r) => (
              <div
                key={r.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '12px 14px',
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong>
                    {r.label}{' '}
                    <span style={{ fontWeight: 500, color: '#6b7280' }}>
                      ({formatBytes(r.targetBytes)})
                    </span>
                  </strong>
                  <span style={{ color: statusColor(r.status), fontWeight: 650, textTransform: 'uppercase', fontSize: 12 }}>
                    {r.status}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: '#374151', display: 'grid', gap: 2 }}>
                  {r.durationMs != null ? <div>Duration: {(r.durationMs / 1000).toFixed(2)}s</div> : null}
                  {r.httpStatus != null ? <div>HTTP: {r.httpStatus}</div> : null}
                  {r.payloadBase64Chars != null ? (
                    <div>
                      Base64 payload: {formatBytes(r.payloadBase64Chars)} chars (~
                      {formatBytes(Math.round(r.payloadBase64Chars * 0.75))} decoded)
                    </div>
                  ) : null}
                  {r.rowId != null ? <div>rowId: {r.rowId}{deleteAfter ? ' (deleted after)' : ''}</div> : null}
                  {r.requestId ? (
                    <div>
                      gateway request_id: <code>{r.requestId}</code>
                    </div>
                  ) : null}
                  {r.retryable ? <div style={{ color: '#b45309' }}>retryable timeout / tunnel error</div> : null}
                  {r.error ? <div style={{ color: '#dc2626', whiteSpace: 'pre-wrap' }}>{r.error}</div> : null}
                  {r.pathHint ? <div style={{ color: '#9ca3af', fontSize: 12 }}>{r.pathHint}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
