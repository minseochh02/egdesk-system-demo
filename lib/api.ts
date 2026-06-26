/**
 * API Fetch Wrapper for EGDesk Tunneling
 *
 * Use apiFetch for client-side /api/* calls — Next.js basePath does not apply to fetch().
 * After `npx egdesk-next-setup`, this file is regenerated to re-export from egdesk-helpers.ts.
 */

export function getEgdeskBasePath(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.NEXT_PUBLIC_EGDESK_BASE_PATH ||
      process.env.EGDESK_BASE_PATH ||
      ''
    );
  }

  const fromEnv = process.env.NEXT_PUBLIC_EGDESK_BASE_PATH || '';
  if (fromEnv) return fromEnv;

  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 't' && parts.length >= 4 && parts[2] === 'p') {
    return `/${parts.slice(0, 4).join('/')}`;
  }
  return '';
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const basePath = getEgdeskBasePath();
  const url =
    path.startsWith('/') && !path.startsWith('//') ? `${basePath}${path}` : path;
  return fetch(url, options);
}
