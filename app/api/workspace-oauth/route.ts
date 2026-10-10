import { NextRequest, NextResponse } from 'next/server';

/**
 * DEMO ONLY — forwards browser POSTs to EGDesk `/workspace-oauth/tools/call`.
 * If this route is public, anyone can invoke operator BYO config tools (HANDOFF §6.9, invariant 2).
 * Remove this file or keep it disabled before hosting the demo for a public audience.
 */
function isDemoWorkspaceOauthProxyAllowed(): boolean {
  if (process.env.EGDESK_DEMO_ALLOW_WORKSPACE_OAUTH_PROXY === 'true') return true;
  return process.env.NODE_ENV === 'development';
}

function resolveEgdeskMcpApiUrl(): string {
  const internal = process.env.EGDESK_MCP_INTERNAL_URL;
  if (internal && internal.trim()) return internal.replace(/\/$/, '');
  return (process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080').replace(/\/$/, '');
}

function buildEgdeskHeaders(): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_EGDESK_PROJECT_ID;
  const egdeskEnv = process.env.NEXT_PUBLIC_EGDESK_ENV;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  if (projectId) headers['X-EGDesk-Project-Id'] = projectId;
  if (egdeskEnv) headers['X-EGDesk-Env'] = egdeskEnv;
  return headers;
}

export async function POST(request: NextRequest) {
  if (!isDemoWorkspaceOauthProxyAllowed()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Operator workspace-oauth proxy is disabled. Use EGDesk → Google Workspace for BYO upload, or set EGDESK_DEMO_ALLOW_WORKSPACE_OAUTH_PROXY=true only on a trusted local demo.',
      },
      { status: 404 },
    );
  }

  try {
    const body = await request.text();
    const apiUrl = resolveEgdeskMcpApiUrl();
    const response = await fetch(`${apiUrl}/workspace-oauth/tools/call`, {
      method: 'POST',
      headers: buildEgdeskHeaders(),
      body,
      cache: 'no-store',
    });
    const text = await response.text();
    let json: unknown = text;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { success: false, error: text || `HTTP ${response.status}` };
    }
    return NextResponse.json(json, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
