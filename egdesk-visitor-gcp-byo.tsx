'use client';

import { useCallback, useState } from 'react';
import {
  forgetVisitorGcp,
  getStoredVisitorGcpHandle,
  registerVisitorGcp,
  resolveEgdeskPublicUrl,
  setStoredVisitorGcpHandle,
  startVisitorGoogleLogin,
} from '@/egdesk-visitor-google';

/** End-user BYO Web OAuth panel (phase 7b). Requires visitorGcp.allowEndUserGcp on the hosted project. */
export function VisitorGcpByoPanel() {
  const [handle, setHandle] = useState(() => getStoredVisitorGcpHandle() || '');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onUpload = useCallback(
    async (file: File) => {
      setBusy(true);
      setMessage(null);
      try {
        const json = JSON.parse(await file.text());
        const result = await registerVisitorGcp({
          oauthClientJson: json,
          handle: handle.trim() || undefined,
          egdeskPublicUrl: resolveEgdeskPublicUrl(),
        });
        const nextHandle = String(result.handle || '');
        setHandle(nextHandle);
        setStoredVisitorGcpHandle(nextHandle);
        setMessage(
          `Registered ${result.clientIdMasked}. Add redirect URI in GCP if needed: ${result.redirectUriToRegister}`,
        );
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [handle],
  );

  const onSignIn = useCallback(async () => {
    const h = handle.trim() || getStoredVisitorGcpHandle();
    if (!h) {
      setMessage('Upload Web client JSON first.');
      return;
    }
    await startVisitorGoogleLogin({ gcp: 'self', handle: h });
  }, [handle]);

  const onForget = useCallback(async () => {
    const h = handle.trim();
    if (!h) return;
    setBusy(true);
    try {
      await forgetVisitorGcp(h);
      setStoredVisitorGcpHandle(null);
      setHandle('');
      setMessage('Forgot GCP profile for this site.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [handle]);

  return (
    <section style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <h3 style={{ margin: '0 0 8px' }}>Visitor: bring your own GCP</h3>
      <p style={{ fontSize: 14, color: '#555' }}>
        Web application JSON only. Secret stays on EGDesk (register_gcp), not this Next server.
      </p>
      <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
        Handle
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </label>
      <input
        type="file"
        accept=".json"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUpload(f);
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" disabled={busy} onClick={() => void onSignIn()}>
          Sign in with my GCP
        </button>
        <button type="button" disabled={busy || !handle.trim()} onClick={() => void onForget()}>
          Forget
        </button>
      </div>
      {message && <p style={{ fontSize: 13, marginTop: 12 }}>{message}</p>}
    </section>
  );
}
