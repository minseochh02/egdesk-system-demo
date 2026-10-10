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
  fontSize: 12,
  background: 'rgba(0,0,0,0.06)',
  padding: '1px 5px',
  borderRadius: 4,
};

function calloutShell(border: string, bg: string): React.CSSProperties {
  return {
    margin: '0 0 20px',
    padding: '14px 16px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: bg,
    fontSize: 13,
    lineHeight: 1.55,
    color: '#1f2937',
  };
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  margin: '10px 0',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid #d1d5db',
  fontWeight: 700,
  color: '#374151',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'top',
};

/** Owner MCP playgrounds (Drive/Sheets/Gmail on EGDesk operator credentials). */
export function OwnerGcpApiLaneCallout({ visitorAuthHref = '/visitor-auth' }: { visitorAuthHref?: string }) {
  return (
    <div style={calloutShell('#a7f3d0', '#ecfdf5')}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: '#065f46' }}>
        Which GCP project do API calls use on this page?
      </div>
      <p style={{ margin: '0 0 8px' }}>
        <strong>Owner lane</strong> — tools below run as the EGDesk operator (or service account), not as a website
        visitor.
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Pick connection</th>
            <th style={thStyle}>OAuth client slot</th>
            <th style={thStyle}>Where to configure</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>
              Per tool: <code style={mono}>oauthClientProfileId</code> (id or label)
              <br />
              Or server env: <code style={mono}>EGDESK_OWNER_OAUTH_PROFILE</code>
              <br />
              Or default connection on EGDesk
            </td>
            <td style={tdStyle}>
              <strong>Desktop</strong> (<code style={mono}>installed</code> JSON) for each GCP connection
            </td>
            <td style={tdStyle}>
              EGDesk → Google Workspace → upload Desktop JSON → <strong>Sign in</strong> on that row; optional hosted-project{' '}
              <strong>owner pin</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ margin: 0, color: '#047857' }}>
        Enable Sheets/Drive APIs on <em>that</em> GCP project. Website visitors use a different path —{' '}
        <a href={visitorAuthHref} style={{ color: '#1d4ed8', fontWeight: 600 }}>
          Visitor auth demo
        </a>{' '}
        (GCP chosen at login only; <strong>Web</strong> client for <code style={mono}>operator:</code>).
      </p>
    </div>
  );
}

/** /visitor-auth — Drive/Sheets visitor tools after sign-in. */
export function VisitorGcpApiLaneCallout({
  loginMode,
  operatorLabel,
  connected,
  connection,
}: {
  loginMode: 'platform' | 'operator';
  operatorLabel: string;
  connected: boolean;
  connection: ConnectionSummary | null;
}) {
  const operatorRef = operatorLabel.trim() ? `operator:${operatorLabel.trim()}` : 'operator:(pick connection)';

  let activeGcp = 'Sign in first — GCP is chosen during login, not on each Drive/Sheets call.';
  let clientSlot = '—';
  let project = '—';

  if (connected) {
    if (loginMode === 'platform') {
      activeGcp = 'platform — EGDesk Supabase Google app (shared)';
      clientSlot = 'Platform Web (brokered)';
      project = 'EGDesk platform project (not your BYO row)';
    } else {
      activeGcp = operatorRef;
      clientSlot = 'Your connection’s Web OAuth client';
      project = connection?.projectId || '(from Web JSON project_id)';
    }
  } else if (loginMode === 'operator' && connection?.clients.web) {
    activeGcp = `Ready to use ${operatorRef} when you sign in`;
    clientSlot = 'Web ✓ on selected connection';
    project = connection.projectId || '—';
  }

  return (
    <div style={calloutShell('#bfdbfe', '#eff6ff')}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: '#1e40af' }}>
        Which GCP project do Drive / Sheets calls use?
      </div>
      <p style={{ margin: '0 0 8px' }}>
        <strong>Visitor lane</strong> — locked at <strong>sign-in</strong>. You cannot pass{' '}
        <code style={mono}>oauthClientProfileId</code> on visitor tools.
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Sign-in button</th>
            <th style={thStyle}>GCP source</th>
            <th style={thStyle}>Client used for APIs</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Platform · Drive/Sheets</td>
            <td style={tdStyle}><code style={mono}>platform</code></td>
            <td style={tdStyle}>EGDesk Supabase app</td>
          </tr>
          <tr>
            <td style={tdStyle}>Sign in with YOUR Web client</td>
            <td style={tdStyle}><code style={mono}>operator:&lt;label&gt;</code></td>
            <td style={tdStyle}>
              <strong>Web</strong> JSON on that connection (upload above; Desktop is for owner tools only)
            </td>
          </tr>
        </tbody>
      </table>
      <dl
        style={{
          margin: '10px 0 0',
          display: 'grid',
          gridTemplateColumns: '140px 1fr',
          gap: '4px 12px',
          fontSize: 12,
        }}
      >
        <dt style={{ fontWeight: 700, color: '#6b7280' }}>This session</dt>
        <dd style={{ margin: 0 }}>{activeGcp}</dd>
        <dt style={{ fontWeight: 700, color: '#6b7280' }}>Client slot</dt>
        <dd style={{ margin: 0 }}>{clientSlot}</dd>
        <dt style={{ fontWeight: 700, color: '#6b7280' }}>GCP project</dt>
        <dd style={{ margin: 0 }}>
          <code style={mono}>{project}</code>
          {connection?.clientIdMasked ? ` · ${connection.clientIdMasked}` : ''}
        </dd>
      </dl>
    </div>
  );
}
