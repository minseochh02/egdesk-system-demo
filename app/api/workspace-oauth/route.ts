import { NextRequest, NextResponse } from 'next/server';

/**
 * Forwards browser POSTs from the visitor-auth BYO panel to EGDesk `/workspace-oauth/tools/call`.
 * Uses loopback MCP when EGDESK_MCP_INTERNAL_URL is set (hosted coding on the same PC).
 * Set EGDESK_DISABLE_WORKSPACE_OAUTH_PROXY=true only if you must block this on a public site.
 */
function isWorkspaceOauthProxyDisabled(): boolean {
  return process.env.EGDESK_DISABLE_WORKSPACE_OAUTH_PROXY === 'true';
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
  if (isWorkspaceOauthProxyDisabled()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Operator workspace-oauth proxy is disabled (EGDESK_DISABLE_WORKSPACE_OAUTH_PROXY). Use EGDesk → Google Workspace for BYO upload.',
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
