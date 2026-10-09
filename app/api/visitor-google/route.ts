import { NextRequest, NextResponse } from 'next/server';

function resolveEgdeskMcpApiUrl(): string {
  const internal = process.env.EGDESK_MCP_INTERNAL_URL;
  if (internal && internal.trim()) return internal.replace(/\/$/, '');
  return (process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080').replace(/\/$/, '');
}

function buildVisitorHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY;
  const origin = request.headers.get('origin') || request.nextUrl.origin;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  headers.Origin = origin;
  headers['X-Visitor-Origin'] = origin;
  const authorization = request.headers.get('authorization');
  if (authorization) headers.Authorization = authorization;
  return headers;
}

/** Visitor Google tools use the same desktop MCP as visitor-auth (operator sessions are local). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const apiUrl = resolveEgdeskMcpApiUrl();
    const response = await fetch(`${apiUrl}/visitor-google/tools/call`, {
      method: 'POST',
      headers: buildVisitorHeaders(request),
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
