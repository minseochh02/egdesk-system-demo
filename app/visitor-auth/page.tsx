'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDemoNavLinks } from '@/lib/demo-pages';
import { getEgdeskBasePath } from '@/lib/api';
import {
  exchangeVisitorAuthCode,
  getVisitorGoogleStatus,
  getVisitorSheetRange,
  listVisitorDriveFiles,
  signOutVisitorGoogle,
  startVisitorGoogleLogin,
  VISITOR_BASIC_SCOPES,
  VISITOR_WORKSPACE_SCOPES,
} from '@/egdesk-visitor-google';

type VisitorStatus = {
  connected?: boolean;
  email?: string | null;
  userId?: string | null;
  audience?: string | null;
  message?: string;
};

type StepState = 'idle' | 'running' | 'ok' | 'error';

type FlowStep = {
  id: string;
  title: string;
  description: string;
  state: StepState;
  detail?: string;
};

const VISITOR_SESSION_KEY = 'egdesk_visitor_session';

function maskSessionId(value: string | null): string {
  if (!value) return '—';
  if (value.length <= 12) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export default function VisitorAuthDemoPage() {
  const [basePath, setBasePath] = useState('');
  const [siteOrigin, setSiteOrigin] = useState('');
  const [status, setStatus] = useState<VisitorStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ id: string; name?: string | null; webViewLink?: string | null }>>([]);
  const [sheetSpreadsheetId, setSheetSpreadsheetId] = useState('');
  const [sheetRange, setSheetRange] = useState('Sheet1!A1:D10');
  const [sheetPreview, setSheetPreview] = useState<unknown[] | null>(null);
  const [lastExchange, setLastExchange] = useState<Record<string, unknown> | null>(null);
  const [steps, setSteps] = useState<FlowStep[]>([
    {
      id: 'start',
      title: '1. startVisitorGoogleLogin()',
      description: 'Hosted site asks EGDesk to start Google OAuth. User never sees Supabase keys.',
      state: 'idle',
    },
    {
      id: 'callback',
      title: '2. /auth/callback?code=…',
      description: 'EGDesk redirects back with a one-time code. This page exchanges it for an opaque session id.',
      state: 'idle',
    },
    {
      id: 'status',
      title: '3. getVisitorGoogleStatus()',
      description: 'Hosted coding reads email, userId, and audience bound to this site origin.',
      state: 'idle',
    },
    {
      id: 'google',
      title: '4. Visitor Google tools',
      description: 'Drive list + Sheets read go through EGDesk with Authorization: Bearer {sessionId}.',
      state: 'idle',
    },
  ]);

  const navLinks = useMemo(
    () => getDemoNavLinks(basePath, '/visitor-auth'),
    [basePath],
  );

  const patchStep = useCallback((id: string, patch: Partial<FlowStep>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }, []);

  const readLocalSession = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(VISITOR_SESSION_KEY);
  }, []);

  const refreshStatus = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await getVisitorGoogleStatus();
      setStatus(next);
      setSessionId(readLocalSession());
      patchStep('status', {
        state: next.connected ? 'ok' : 'idle',
        detail: next.connected
          ? `${next.email || 'signed in'} · userId ${next.userId || '—'} · audience ${next.audience || siteOrigin}`
          : next.message || 'Not signed in',
      });
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      patchStep('status', { state: 'error', detail: message });
      return null;
    } finally {
      setBusy(false);
    }
  }, [patchStep, readLocalSession, siteOrigin]);

  useEffect(() => {
    setBasePath(getEgdeskBasePath());
    setSiteOrigin(window.location.origin);
    setSessionId(readLocalSession());

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      patchStep('callback', { state: 'running', detail: 'Exchanging one-time code…' });
      void exchangeVisitorAuthCode(code)
        .then((result) => {
          setLastExchange(result as Record<string, unknown>);
          setSessionId(result.sessionId);
          patchStep('start', { state: 'ok', detail: 'OAuth completed on EGDesk' });
          patchStep('callback', {
            state: 'ok',
            detail: `sessionId ${maskSessionId(result.sessionId)} · email ${result.email || '—'}`,
          });
          window.history.replaceState(null, '', `${window.location.pathname}`);
          return refreshStatus();
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          patchStep('callback', { state: 'error', detail: message });
        });
      return;
    }

    void refreshStatus();
  }, [patchStep, readLocalSession, refreshStatus, siteOrigin]);

  const handleSignIn = useCallback(async (scopes: typeof VISITOR_BASIC_SCOPES | typeof VISITOR_WORKSPACE_SCOPES) => {
    setBusy(true);
    setError(null);
    patchStep('start', { state: 'running', detail: 'Redirecting to Google via EGDesk…' });
    try {
      await startVisitorGoogleLogin({ next: '/visitor-auth', scopes });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      patchStep('start', { state: 'error', detail: message });
      setBusy(false);
    }
  }, [patchStep]);

  const handleSignOut = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signOutVisitorGoogle();
      setStatus(null);
      setSessionId(null);
      setFiles([]);
      setSheetPreview(null);
      setLastExchange(null);
      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          state: 'idle',
          detail: undefined,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleListFiles = useCallback(async () => {
    setBusy(true);
    setError(null);
    patchStep('google', { state: 'running', detail: 'Calling listVisitorDriveFiles()…' });
    try {
      const result = await listVisitorDriveFiles({ pageSize: 8 });
      const nextFiles = Array.isArray(result?.files) ? result.files : [];
      setFiles(nextFiles);
      patchStep('google', {
        state: 'ok',
        detail: `Listed ${nextFiles.length} Drive file(s) for ${result?.email || status?.email || 'visitor'}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      patchStep('google', { state: 'error', detail: message });
    } finally {
      setBusy(false);
    }
  }, [patchStep, status?.email]);

  const handleReadSheet = useCallback(async () => {
    if (!sheetSpreadsheetId.trim() || !sheetRange.trim()) {
      setError('Spreadsheet ID and range are required.');
      return;
    }
    setBusy(true);
    setError(null);
    patchStep('google', { state: 'running', detail: 'Calling getVisitorSheetRange()…' });
    try {
      const result = await getVisitorSheetRange(sheetSpreadsheetId.trim(), sheetRange.trim());
      setSheetPreview(Array.isArray(result?.values) ? result.values : []);
      patchStep('google', {
        state: 'ok',
        detail: `Read ${Array.isArray(result?.values) ? result.values.length : 0} row(s) from ${result?.range || sheetRange}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      patchStep('google', { state: 'error', detail: message });
    } finally {
      setBusy(false);
    }
  }, [patchStep, sheetRange, sheetSpreadsheetId]);

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div style={eyebrowStyle}>Hosted coding auth</div>
        <h1 style={titleStyle}>Visitor Google login test</h1>
        <p style={introStyle}>
          This page exercises the brokered login flow: the hosted Next.js site never receives Supabase keys.
          Google bounces through EGDesk&apos;s local callback, then this page gets an opaque session id plus
          user info for <strong>this localhost origin</strong> — not egdesk.cloud.
        </p>
        <nav style={navStyle} aria-label="Demo navigation">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} style={navLinkStyle}>
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={miniLabelStyle}>Current visitor session</div>
            <div style={statusLineStyle}>
              <span
                style={{
                  ...dotStyle,
                  background: status?.connected ? '#2563eb' : '#9ca3af',
                }}
              />
              {status?.connected ? status.email || 'Signed in' : 'Not signed in'}
            </div>
          </div>
          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={() => void handleSignIn(VISITOR_BASIC_SCOPES)}
              disabled={busy}
              style={secondaryBtnStyle}
            >
              Sign in (email only)
            </button>
            <button
              type="button"
              onClick={() => void handleSignIn(VISITOR_WORKSPACE_SCOPES)}
              disabled={busy}
              style={primaryBtnStyle}
            >
              {busy ? 'Working…' : status?.connected ? 'Re-sign in (Drive/Sheets)' : 'Sign in with Google'}
            </button>
            <button type="button" onClick={() => void refreshStatus()} disabled={busy} style={secondaryBtnStyle}>
              Refresh status
            </button>
            {status?.connected && (
              <button type="button" onClick={() => void handleSignOut()} disabled={busy} style={secondaryBtnStyle}>
                Sign out
              </button>
            )}
          </div>
        </div>

        <dl style={kvGridStyle}>
          <dt style={kvTermStyle}>Connected</dt>
          <dd style={kvDescStyle}>{status?.connected ? 'yes' : 'no'}</dd>
          <dt style={kvTermStyle}>Email</dt>
          <dd style={kvDescStyle}>{status?.email || '—'}</dd>
          <dt style={kvTermStyle}>User ID</dt>
          <dd style={kvDescStyle}>
            <code style={codeStyle}>{status?.userId || '—'}</code>
          </dd>
          <dt style={kvTermStyle}>Audience</dt>
          <dd style={kvDescStyle}>
            <code style={codeStyle}>{status?.audience || siteOrigin || '—'}</code>
          </dd>
          <dt style={kvTermStyle}>Opaque session id</dt>
          <dd style={kvDescStyle}>
            <code style={codeStyle}>{maskSessionId(sessionId)}</code>
          </dd>
          <dt style={kvTermStyle}>Message</dt>
          <dd style={kvDescStyle}>{status?.message || '—'}</dd>
        </dl>

        {lastExchange && (
          <pre style={preStyle}>{JSON.stringify(lastExchange, null, 2)}</pre>
        )}
        {error && <p style={errorStyle}>{error}</p>}
      </section>

      <section style={panelStyle}>
        <div style={miniLabelStyle}>Flow checklist</div>
        <ol style={stepListStyle}>
          {steps.map((step) => (
            <li key={step.id} style={stepItemStyle(step.state)}>
              <strong>{step.title}</strong>
              <span>{step.description}</span>
              {step.detail && <code style={stepDetailStyle}>{step.detail}</code>}
            </li>
          ))}
        </ol>
      </section>

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={miniLabelStyle}>After sign-in: visitor Google tools</div>
            <p style={helperTextStyle}>
              These calls proxy through EGDesk with the stored opaque session id. They do not use owner MCP credentials.
            </p>
          </div>
          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={() => void handleListFiles()}
              disabled={busy || !status?.connected}
              style={secondaryBtnStyle}
            >
              listVisitorDriveFiles()
            </button>
          </div>
        </div>

        <div style={fieldGridStyle}>
          <label style={labelStyle}>
            Spreadsheet ID
            <input
              value={sheetSpreadsheetId}
              onChange={(event) => setSheetSpreadsheetId(event.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Range
            <input
              value={sheetRange}
              onChange={(event) => setSheetRange(event.target.value)}
              placeholder="Sheet1!A1:D10"
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleReadSheet()}
            disabled={busy || !status?.connected}
            style={{ ...secondaryBtnStyle, alignSelf: 'end' }}
          >
            getVisitorSheetRange()
          </button>
        </div>

        {files.length > 0 && (
          <ul style={listStyle}>
            {files.map((file) => (
              <li key={file.id}>
                {file.webViewLink ? (
                  <a href={file.webViewLink} target="_blank" rel="noreferrer" style={linkStyle}>
                    {file.name || file.id}
                  </a>
                ) : (
                  file.name || file.id
                )}
              </li>
            ))}
          </ul>
        )}

        {sheetPreview && (
          <pre style={preStyle}>{JSON.stringify(sheetPreview, null, 2)}</pre>
        )}
      </section>

      <section style={panelStyle}>
        <div style={miniLabelStyle}>Setup prerequisites</div>
        <ul style={listStyle}>
          <li>EGDesk HTTP server running with visitor auth enabled.</li>
          <li>
            Local hosted coding returns through{' '}
            <code style={codeStyle}>http://localhost:54321/auth/callback</code>, then back to this origin.
            The public tunnel uses{' '}
            <code style={codeStyle}>
              https://tunneling-service.onrender.com/t/{'{id}'}/visitor-auth/callback
            </code>{' '}
            (allowlist that URL or <code style={codeStyle}>https://tunneling-service.onrender.com/**</code>
            ) and then returns to{' '}
            <code style={codeStyle}>/t/{'{id}'}/p/{'{project}'}/auth/callback</code>.
          </li>
          <li>
            This demo uses <code style={codeStyle}>app/auth/callback/page.tsx</code> to exchange the one-time code.
          </li>
          <li>
            Owner MCP login (<code style={codeStyle}>drive_auth_login</code>) is separate and is not overwritten by visitor sign-in.
          </li>
        </ul>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  maxWidth: 920,
  margin: '0 auto',
  padding: '40px 24px 64px',
  display: 'grid',
  gap: 20,
};

const headerStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#1d4ed8',
  fontSize: 13,
  fontWeight: 800,
  textTransform: 'uppercase',
};

const titleStyle: React.CSSProperties = {
  color: '#111827',
  fontSize: 34,
  lineHeight: 1.15,
  margin: 0,
};

const introStyle: React.CSSProperties = {
  color: '#4b5563',
  fontSize: 15,
  lineHeight: 1.7,
  margin: 0,
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const navLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#2563eb',
  textDecoration: 'none',
  border: '1px solid #dbeafe',
  borderRadius: 999,
  padding: '6px 12px',
  background: '#eff6ff',
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  display: 'grid',
  gap: 16,
};

const panelHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const statusLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 18,
  fontWeight: 800,
  color: '#111827',
  marginTop: 6,
};

const dotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  display: 'inline-block',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const primaryBtnStyle: React.CSSProperties = {
  border: '1px solid #1d4ed8',
  background: '#1d4ed8',
  color: '#fff',
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#111827',
  borderRadius: 8,
  padding: '10px 14px',
  fontWeight: 600,
  cursor: 'pointer',
};

const kvGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '160px 1fr',
  gap: '10px 16px',
  margin: 0,
};

const kvTermStyle: React.CSSProperties = {
  margin: 0,
  color: '#6b7280',
  fontSize: 13,
  fontWeight: 700,
};

const kvDescStyle: React.CSSProperties = {
  margin: 0,
  color: '#111827',
  fontSize: 14,
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  background: '#f3f4f6',
  padding: '2px 6px',
  borderRadius: 6,
};

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 14,
  borderRadius: 10,
  background: '#0f172a',
  color: '#e2e8f0',
  fontSize: 12,
  overflow: 'auto',
};

const errorStyle: React.CSSProperties = {
  margin: 0,
  color: '#dc2626',
  fontSize: 13,
};

const stepListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: 'grid',
  gap: 12,
};

const stepItemStyle = (state: StepState): React.CSSProperties => ({
  display: 'grid',
  gap: 4,
  color: state === 'error' ? '#dc2626' : state === 'ok' ? '#047857' : '#374151',
});

const stepDetailStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '8px 10px',
  whiteSpace: 'pre-wrap',
};

const helperTextStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#6b7280',
  fontSize: 13,
  lineHeight: 1.5,
};

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr auto',
  gap: 12,
  alignItems: 'end',
};

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: '#374151',
  fontSize: 14,
  lineHeight: 1.6,
};

const linkStyle: React.CSSProperties = {
  color: '#1d4ed8',
};
