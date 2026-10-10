'use client';

import type React from 'react';

type ConnectionSummary = {
  label: string;
  projectId: string | null;
  clientIdMasked?: string | null;
  clients: { desktop: boolean; web: boolean };
};

const mono: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  background: '#f3f4f6',
  padding: '2px 6px',
  borderRadius: 4,
};

/** Owner MCP playgrounds (Drive/Sheets/Gmail on EGDesk operator credentials). */
export function OwnerGcpApiLaneCallout({ visitorAuthHref = '/visitor-auth' }: { visitorAuthHref?: string }) {
  return (
    <div
      style={{
        margin: '0 0 16px',
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px solid #a7f3d0',
        background: '#ecfdf5',
        fontSize: 13,
        lineHeight: 1.5,
        color: '#1f2937',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: '#065f46' }}>
        Owner lane — which GCP for tools on this page?
      </div>
      <p style={{ margin: '0 0 10px' }}>
        Pick connection via <code style={mono}>oauthClientProfileId</code>, server env{' '}
        <code style={mono}>EGDESK_OWNER_OAUTH_PROFILE</code>, or EGDesk default. Uses the{' '}
        <strong>Desktop</strong> OAuth client. Visitors use{' '}
        <a href={visitorAuthHref} style={{ color: '#1d4ed8', fontWeight: 600 }}>/visitor-auth</a> instead.
      </p>
      <details style={{ fontSize: 12, color: '#047857' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Full owner vs visitor reference</summary>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          <li>Owner: Desktop JSON + sign-in on that row in EGDesk → Google Workspace.</li>
          <li>Visitor: GCP locked at sign-in; Web client for <code style={mono}>operator:&lt;label&gt;</code>.</li>
        </ul>
      </details>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'platform' | 'operator' | 'idle' }) {
  const colors =
    tone === 'platform'
      ? { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' }
      : tone === 'operator'
        ? { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' }
        : { bg: '#f3f4f6', border: '#d1d5db', text: '#4b5563' };
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
      }}
    >
      {label}
    </span>
  );
}

function MetricCard({ title, value, sub }: { title: string; value: React.ReactNode; sub?: string }) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: 0,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.35, wordBreak: 'break-word' }}>
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
      ) : null}
    </div>
  );
}

/** Live status for Drive/Sheets on /visitor-auth (place near sign-in controls). */
export function VisitorGcpApiLaneCallout({
  loginMode,
  operatorLabel,
  connected,
  connection,
  compact,
}: {
  loginMode: 'platform' | 'operator';
  operatorLabel: string;
  connected: boolean;
  connection: ConnectionSummary | null;
  /** Smaller variant when embedded in session panel */
  compact?: boolean;
}) {
  const operatorRef = operatorLabel.trim() ? `operator:${operatorLabel.trim()}` : null;

  const tone: 'platform' | 'operator' | 'idle' = !connected
    ? 'idle'
    : loginMode === 'operator'
      ? 'operator'
      : 'platform';

  const pillLabel = !connected
    ? 'Not signed in'
    : loginMode === 'operator'
      ? operatorRef || 'operator BYO'
      : 'platform';

  const sourceValue = !connected
    ? '—'
    : loginMode === 'platform'
      ? 'platform'
      : operatorRef || 'operator';

  const clientValue = !connected
    ? 'Sign in to bind a client'
    : loginMode === 'platform'
      ? 'EGDesk Supabase (shared)'
      : 'Your Web OAuth client';

  const projectValue = !connected
    ? '—'
    : loginMode === 'platform'
      ? 'EGDesk platform GCP'
      : connection?.projectId || 'Set Web JSON project_id';

  const clientIdSub =
    connected && loginMode === 'operator' && connection?.clientIdMasked
      ? `Client ${connection.clientIdMasked}`
      : connected && loginMode === 'platform'
        ? 'Not your BYO connection row'
        : undefined;

  return (
    <div
      style={{
        margin: compact ? '0 0 16px' : '0 0 20px',
        padding: compact ? '14px' : '16px 18px',
        borderRadius: 12,
        border: '1px solid #93c5fd',
        background: 'linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Drive &amp; Sheets use this GCP
          </div>
          {!compact && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4b5563', maxWidth: 520 }}>
              Chosen at <strong>sign-in</strong> only — visitor tools ignore <code style={mono}>oauthClientProfileId</code>.
            </p>
          )}
        </div>
        <StatusPill label={pillLabel} tone={tone} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <MetricCard title="GCP source" value={<code style={mono}>{sourceValue}</code>} />
        <MetricCard title="OAuth client" value={clientValue} sub={clientIdSub} />
        <MetricCard title="GCP project" value={projectValue} />
      </div>

      <details style={{ marginTop: 12, fontSize: 12, color: '#374151' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#1d4ed8' }}>
          Which sign-in button maps to which GCP?
        </summary>
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 320 }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e2e8f0' }}>Button</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e2e8f0' }}>Source</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e2e8f0' }}>Client</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Platform · Drive/Sheets</td>
                <td style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                  <code style={mono}>platform</code>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Supabase app</td>
              </tr>
              <tr>
                <td style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Sign in with YOUR Web client</td>
                <td style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>
                  <code style={mono}>operator:&lt;label&gt;</code>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>Web JSON (BYO panel)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ margin: '10px 0 0', color: '#6b7280' }}>
          Desktop JSON in the BYO panel is for <strong>owner</strong> MCP on Drive/Sheets/Gmail playgrounds — not visitor
          API calls after sign-in here.
        </p>
      </details>
    </div>
  );
}
