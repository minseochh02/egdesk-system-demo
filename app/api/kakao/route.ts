/**
 * POST /api/kakao
 *
 * Proxies Kakao MCP tool calls to the EGDesk local server.
 * Body: { tool: string, arguments: Record<string, any> }
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tool, arguments: args } = body;

    if (!tool) {
      return NextResponse.json({ error: 'tool is required' }, { status: 400 });
    }

    const apiUrl =
      process.env.NEXT_PUBLIC_EGDESK_API_URL ||
      process.env.EGDESK_API_URL ||
      'http://localhost:19285';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY;
    if (apiKey) headers['X-Api-Key'] = apiKey;

    const res = await fetch(`${apiUrl}/kakao/tools/call`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tool, arguments: args }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[/api/kakao] Error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
  }
}
