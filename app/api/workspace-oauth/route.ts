import { NextRequest, NextResponse } from 'next/server';

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

/** Demo-only proxy for workspace_oauth_clients* (operator BYO config on EGDesk). */
export async function POST(request: NextRequest) {
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
