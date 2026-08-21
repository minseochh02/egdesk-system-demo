import { NextResponse } from 'next/server';

export type EgdeskHttpToolSpec = {
  path: string;
  method: 'GET' | 'POST';
};

function buildEgdeskHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY;
  if (apiKey) headers['X-Api-Key'] = apiKey;
  const projectId = process.env.NEXT_PUBLIC_EGDESK_PROJECT_ID;
  if (projectId) headers['X-EGDesk-Project-Id'] = projectId;
  const egdeskEnv = process.env.NEXT_PUBLIC_EGDESK_ENV;
  if (egdeskEnv) headers['X-EGDesk-Env'] = egdeskEnv;
  return headers;
}

function egdeskApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_EGDESK_API_URL ||
    process.env.EGDESK_API_URL ||
    'http://localhost:19285'
  );
}

/** Factory for POST /api/* routes that proxy MCP tool calls to EGDesk. */
export function createMcpRoute(
  egdeskPath: string | null,
  httpTools: Record<string, EgdeskHttpToolSpec> = {},
) {
  return async function POST(request: Request) {
    try {
      const body = await request.json();
      const { tool, arguments: args } = body;

      if (!tool) {
        return NextResponse.json({ error: 'tool is required' }, { status: 400 });
      }

      const apiUrl = egdeskApiUrl();
      const headers = buildEgdeskHeaders();
      const http = httpTools[tool];

      if (http) {
        const base = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
        const url = new URL(http.path.replace(/^\//, ''), base);
        if (http.method === 'GET') {
          for (const [key, value] of Object.entries(args || {})) {
            if (value != null && value !== '') url.searchParams.set(key, String(value));
          }
        }
        const res = await fetch(url.toString(), {
          method: http.method,
          headers,
          body: http.method === 'POST' ? JSON.stringify(args || {}) : undefined,
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      }

      if (!egdeskPath) {
        return NextResponse.json({ error: `Unknown HTTP sync tool: ${tool}` }, { status: 400 });
      }

      const res = await fetch(`${apiUrl}${egdeskPath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tool, arguments: args }),
      });

      const data = await res.json();
      return NextResponse.json(data);
    } catch (error: any) {
      console.error(`[${egdeskPath || 'workspace-http'}] Error:`, error);
      return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
    }
  };
}
