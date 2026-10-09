export type OAuthClientJsonKind = 'desktop' | 'web' | 'unknown';

export function classifyOAuthClientJson(raw: unknown): OAuthClientJsonKind {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const root = raw as Record<string, unknown>;
  const hasWeb = Boolean(root.web && typeof root.web === 'object');
  const hasInstalled = Boolean(root.installed && typeof root.installed === 'object');
  if (hasWeb && !hasInstalled) return 'web';
  if (hasInstalled && !hasWeb) return 'desktop';
  if (hasWeb && hasInstalled) return 'web';
  return 'unknown';
}

export function extractWebProjectId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const web = root.web && typeof root.web === 'object' ? (root.web as Record<string, unknown>) : null;
  if (web && typeof web.project_id === 'string' && web.project_id.trim()) {
    return web.project_id.trim();
  }
  if (typeof root.project_id === 'string' && root.project_id.trim()) {
    return root.project_id.trim();
  }
  return null;
}

export function describeOAuthClientJsonKind(kind: OAuthClientJsonKind): string {
  if (kind === 'desktop') {
    return 'Desktop client (installed). Use button 1 or the auto-upload — not Web upload.';
  }
  if (kind === 'web') {
    return 'Web application client (web).';
  }
  return 'Unrecognized OAuth client JSON. Download from Google Cloud → APIs & Services → Credentials.';
}
