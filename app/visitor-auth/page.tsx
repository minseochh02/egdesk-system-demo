'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDemoNavLinks } from '@/lib/demo-pages';
import { getEgdeskBasePath } from '@/lib/api';
import {
  enableDemoVisitorOperatorLogin,
  expectedGatewayRedirectUri,
  listDemoOAuthConnections,
  saveDemoDesktopOAuthClient,
  saveDemoWebOAuthClient,
  type DemoOAuthConnection,
} from '@/lib/demo-workspace-oauth';
import {
  exchangeVisitorAuthCode,
  getVisitorGoogleStatus,
  getVisitorSheetRange,
  listVisitorDriveFiles,
  resolveEgdeskPublicUrl,
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

function isOAuthJsonFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.json') ||
    name.includes('client_secret') ||
    file.type === 'application/json' ||
    file.type === 'text/json' ||
    file.type === ''
  );
}

function maskSessionId(value: string | null): string {
  if (!value) return '—';
  if (value.length <= 12) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export default function VisitorAuthDemoPage() {
  const [basePath, setBasePath] = useState('');
  const [siteOrigin, setSiteOrigin] = useState('');
  const [egdeskPublicUrl, setEgdeskPublicUrl] = useState('');
  const [status, setStatus] = useState<VisitorStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ id: string; name?: string | null; webViewLink?: string | null }>>([]);
  const [sheetSpreadsheetId, setSheetSpreadsheetId] = useState('');
  const [sheetRange, setSheetRange] = useState('Sheet1!A1:D10');
  const [sheetPreview, setSheetPreview] = useState<unknown[] | null>(null);
  const [lastExchange, setLastExchange] = useState<Record<string, unknown> | null>(null);
  const [connections, setConnections] = useState<DemoOAuthConnection[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [redirectMode, setRedirectMode] = useState<'gateway' | 'site-origin'>('gateway');
  const [byoMessage, setByoMessage] = useState<string | null>(null);
  const [redirectHint, setRedirectHint] = useState<string | null>(null);
  const [operatorLabel, setOperatorLabel] = useState<string>('');
  const [loginMode, setLoginMode] = useState<'platform' | 'operator'>('platform');
  const desktopFileRef = useRef<HTMLInputElement>(null);
  const webFileRef = useRef<HTMLInputElement>(null);
  const [steps, setSteps] = useState<FlowStep[]>([
    {
      id: 'start',
      title: '1. startVisitorGoogleLogin()',
      description:
        'Hosted site asks EGDesk to start Google OAuth. Loopback uses :54321/auth/callback; LAN/tunnel uses /visitor-auth/callback/{pendingId}.',
      state: 'idle',
    },
    {
      id: 'callback',
      title: '2. /auth/callback?code=…',
      description:
        'After Google completes on EGDesk, the site receives a one-time code and exchanges it for an opaque session id.',
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

  const refreshConnections = useCallback(async () => {
    try {
      const rows = await listDemoOAuthConnections();
      setConnections(rows);
      if (!selectedProfileId && rows.length > 0) {
        const pick = rows.find((r) => r.isDefault) || rows[0];
        setSelectedProfileId(pick.profileId);
        setOperatorLabel(pick.label);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setByoMessage(message);
    }
  }, [selectedProfileId]);

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
    setEgdeskPublicUrl(resolveEgdeskPublicUrl());
    setSessionId(readLocalSession());

    const params = new URLSearchParams(window.location.search);
    const authError = params.get('visitor_auth_error');
    if (authError) {
      setError('Google sign-in was denied or cancelled.');
      window.history.replaceState(null, '', `${window.location.pathname}`);
    }
    const code = params.get('code');
    if (code) {
      patchStep('callback', { state: 'running', detail: 'Exchanging one-time code…' });
      let finished = false;
      const timer = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        const message = 'Sign-in timed out while exchanging the one-time code.';
        setError(message);
        patchStep('callback', { state: 'error', detail: message });
      }, 20000);
      void exchangeVisitorAuthCode(code)
        .then((result) => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
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
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          patchStep('callback', { state: 'error', detail: message });
        });
      return;
    }

    void refreshStatus();
    void refreshConnections();
  }, [patchStep, readLocalSession, refreshConnections, refreshStatus, siteOrigin]);

  useEffect(() => {
    setRedirectHint(expectedGatewayRedirectUri(egdeskPublicUrl || 'http://localhost:8080'));
  }, [egdeskPublicUrl]);

  const handleDesktopJsonUpload = useCallback(
    async (file: File) => {
      if (!isOAuthJsonFile(file)) {
        setByoMessage('Choose a .json OAuth client file from Google Cloud Console.');
        return;
      }
      setBusy(true);
      setByoMessage(null);
      setError(null);
      try {
        const json = JSON.parse(await file.text());
        const label =
          operatorLabel.trim() ||
          (typeof json?.installed?.project_id === 'string' ? json.installed.project_id : 'demo-gcp');
        const result = await saveDemoDesktopOAuthClient({ oauthClientJson: json, label });
        setByoMessage(
          result.state === 'saved'
            ? `Desktop connection saved (${label}). Upload the Web client JSON next.`
            : 'Desktop upload finished.',
        );
        await refreshConnections();
      } catch (err) {
        setByoMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
        if (desktopFileRef.current) desktopFileRef.current.value = '';
      }
    },
    [operatorLabel, refreshConnections],
  );

  const handleWebJsonUpload = useCallback(
    async (file: File) => {
      if (!isOAuthJsonFile(file)) {
        setByoMessage('Choose a .json Web OAuth client file from Google Cloud Console.');
        return;
      }
      if (!selectedProfileId) {
        setByoMessage('Create or select a GCP connection first (Desktop JSON).');
        return;
      }
      setBusy(true);
      setByoMessage(null);
      setError(null);
      try {
        const json = JSON.parse(await file.text());
        const result = await saveDemoWebOAuthClient({
          oauthClientJson: json,
          profileId: selectedProfileId,
          redirectMode,
        });
        setRedirectHint(result.redirectUriToRegister || redirectHint);
        setByoMessage('Web client saved on EGDesk. Enable visitor login, then sign in with your client.');
        await refreshConnections();
      } catch (err) {
        setByoMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
        if (webFileRef.current) webFileRef.current.value = '';
      }
    },
    [redirectHint, redirectMode, refreshConnections, selectedProfileId],
  );

  const handleEnableOperatorVisitor = useCallback(async () => {
    const label = operatorLabel.trim() || connections.find((c) => c.profileId === selectedProfileId)?.label;
    if (!label) {
      setByoMessage('Pick a connection label first.');
      return;
    }
    setBusy(true);
    setByoMessage(null);
    try {
      const result = await enableDemoVisitorOperatorLogin({
        label,
        siteOrigin: siteOrigin || window.location.origin,
      });
      setLoginMode('operator');
      setByoMessage(
        `Visitor allow-list updated for this demo (default: operator:${label}). You can sign in with your Web client now.`,
      );
      if (typeof result.redirectUri === 'string') setRedirectHint(result.redirectUri);
    } catch (err) {
      setByoMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [connections, operatorLabel, selectedProfileId, siteOrigin]);

  const handleSignIn = useCallback(async (
    scopes: typeof VISITOR_BASIC_SCOPES | typeof VISITOR_WORKSPACE_SCOPES,
    mode: 'platform' | 'operator' = 'platform',
  ) => {
    setBusy(true);
    setError(null);
    const label = operatorLabel.trim() || connections.find((c) => c.profileId === selectedProfileId)?.label;
    patchStep('start', {
      state: 'running',
      detail:
        mode === 'operator' && label
          ? `Redirecting via operator:${label} (direct Google OAuth)…`
          : 'Redirecting to Google via EGDesk (platform)…',
    });
    try {
      await startVisitorGoogleLogin({
        next: '/visitor-auth',
        scopes,
        gcp: mode === 'operator' && label ? `operator:${label}` : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      patchStep('start', { state: 'error', detail: message });
      setBusy(false);
    }
  }, [connections, operatorLabel, patchStep, selectedProfileId]);

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
          Exercise <strong>platform</strong> login (EGDesk-brokered Supabase) or <strong>your own Web OAuth client</strong>{' '}
          (operator BYO → direct Google OAuth to{' '}
          <code style={codeStyle}>/visitor-auth/callback?code&amp;state</code>). Upload clients in the panel below; secrets stay on EGDesk.
          The hosted site never receives Supabase keys. On <strong>localhost / 127.0.0.1</strong>, platform login bounces via{' '}
          <code style={codeStyle}>http://localhost:54321/auth/callback</code>. On{' '}
          <strong>LAN IP or tunnel</strong>, Google bounces through{' '}
          <code style={codeStyle}>/visitor-auth/callback/{'{pendingId}'}</code> on the MCP root.
          This site then receives a one-time code and stores an opaque session id bound to{' '}
          <strong>this origin</strong> (prod :3000 uses basePath{' '}
          <code style={codeStyle}>/t/{'{id}'}/p/{'{project}'}</code>).
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
        <div style={miniLabelStyle}>Operator BYO — your Web client</div>
        <p style={helperTextStyle}>
          Requires EGDesk <code style={codeStyle}>workspaceByo.allowInlineClientJson: true</code> (MCP settings) and this
          demo running via Hosted Coding so <code style={codeStyle}>EGDESK_MCP_INTERNAL_URL</code> reaches :8080.
        </p>
        <p style={helperTextStyle}>
          Register this redirect URI on your Web client before downloading JSON:{' '}
          <code style={codeStyle}>{redirectHint || 'http://localhost:8080/visitor-auth/callback'}</code>
        </p>
        <div style={fieldGridStyle}>
          <label style={labelStyle}>
            Connection label
            <input
              value={operatorLabel}
              onChange={(e) => setOperatorLabel(e.target.value)}
              placeholder="my-gcp-project"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Connection
            <select
              value={selectedProfileId}
              onChange={(e) => {
                setSelectedProfileId(e.target.value);
                const row = connections.find((c) => c.profileId === e.target.value);
                if (row) setOperatorLabel(row.label);
              }}
              style={inputStyle}
            >
              <option value="">—</option>
              {connections.map((c) => (
                <option key={c.profileId} value={c.profileId}>
                  {c.label} {c.clients.web ? '(Web ✓)' : ''} {c.clients.desktop ? '(Desktop ✓)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Web redirect mode
            <select
              value={redirectMode}
              onChange={(e) => setRedirectMode(e.target.value === 'site-origin' ? 'site-origin' : 'gateway')}
              style={inputStyle}
            >
              <option value="gateway">gateway (:8080 / tunnel)</option>
              <option value="site-origin">site-origin (custom domain)</option>
            </select>
          </label>
        </div>
        <input
          ref={desktopFileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleDesktopJsonUpload(file);
          }}
        />
        <input
          ref={webFileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleWebJsonUpload(file);
          }}
        />
        <div style={buttonRowStyle}>
          <button
            type="button"
            style={secondaryBtnStyle}
            disabled={busy}
            onClick={() => desktopFileRef.current?.click()}
          >
            1. Upload Desktop JSON
          </button>
          <button
            type="button"
            style={secondaryBtnStyle}
            disabled={busy || !selectedProfileId}
            onClick={() => webFileRef.current?.click()}
          >
            2. Upload Web JSON
          </button>
          <button type="button" style={secondaryBtnStyle} disabled={busy} onClick={() => void handleEnableOperatorVisitor()}>
            3. Enable visitor login for this site
          </button>
          <button type="button" style={secondaryBtnStyle} disabled={busy} onClick={() => void refreshConnections()}>
            Refresh connections
          </button>
        </div>
        {byoMessage && <p style={helperTextStyle}>{byoMessage}</p>}
      </section>

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
              onClick={() => void handleSignIn(VISITOR_BASIC_SCOPES, 'platform')}
              disabled={busy}
              style={secondaryBtnStyle}
            >
              Platform · email only
            </button>
            <button
              type="button"
              onClick={() => void handleSignIn(VISITOR_WORKSPACE_SCOPES, 'platform')}
              disabled={busy}
              style={secondaryBtnStyle}
            >
              Platform · Drive/Sheets
            </button>
            <button
              type="button"
              onClick={() => void handleSignIn(VISITOR_WORKSPACE_SCOPES, 'operator')}
              disabled={busy || !operatorLabel.trim()}
              style={primaryBtnStyle}
            >
              {busy ? 'Working…' : 'Sign in with YOUR Web client'}
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
          <dt style={kvTermStyle}>EGDesk OAuth bounce</dt>
          <dd style={kvDescStyle}>
            <code style={codeStyle}>{egdeskPublicUrl || '—'}</code>
          </dd>
          <dt style={kvTermStyle}>Opaque session id</dt>
          <dd style={kvDescStyle}>
            <code style={codeStyle}>{maskSessionId(sessionId)}</code>
          </dd>
          <dt style={kvTermStyle}>Login mode</dt>
          <dd style={kvDescStyle}>{loginMode === 'operator' ? `operator:${operatorLabel || '—'}` : 'platform'}</dd>
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
            Operator BYO upload: set <code style={codeStyle}>workspaceByo.allowInlineClientJson: true</code> in EGDesk MCP
            configuration (Settings → MCP). Restart EGDesk after changing it.
          </li>
          <li>
            <strong>Loopback</strong> (localhost / 127.0.0.1 on :4000 or :3000): Google bounces via{' '}
            <code style={codeStyle}>http://localhost:54321/auth/callback</code> (exact allowlist entry).
            <strong> LAN IP</strong> (192.168.x.x from phone/other device): requires tunnel env in{' '}
            <code style={codeStyle}>.env.local</code>; Google bounces via{' '}
            <code style={codeStyle}>
              https://tunneling-service.onrender.com/t/{'{id}'}/visitor-auth/callback/{'{pendingId}'}
            </code>
            . Allowlist that URL pattern and{' '}
            <code style={codeStyle}>https://tunneling-service.onrender.com/**</code>. Prod :3000 uses basePath{' '}
            <code style={codeStyle}>/t/{'{id}'}/p/{'{project}'}/auth/callback</code> as returnTo.
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
