/**
 * Dev-only helpers for the system demo to configure operator BYO Web clients on EGDesk.
 * Requires workspaceByo.allowInlineClientJson in EGDesk MCP settings.
 */

import { apiFetch } from '@/egdesk-helpers';
import { resolveEgdeskPublicUrl } from '@/egdesk-visitor-google';

type McpCallBody = {
  tool: string;
  arguments: Record<string, unknown>;
};

type McpToolResult = {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

type McpEnvelope = {
  success?: boolean;
  result?: McpToolResult;
  content?: Array<{ type: string; text?: string }>;
  error?: string;
};

function parseMcpTextPayload(envelope: McpToolResult | McpEnvelope): Record<string, unknown> {
  const block = 'result' in envelope && envelope.result ? envelope.result : envelope;
  const text = block?.content?.find((c) => c.type === 'text')?.text;
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function callWorkspaceOauth(tool: string, args: Record<string, unknown>) {
  const body: McpCallBody = { tool, arguments: args };
  const response = await apiFetch('/__workspace_oauth_proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const envelope = (await response.json().catch(() => ({}))) as McpEnvelope;
  if (!response.ok) {
    throw new Error(envelope.error || `Workspace OAuth request failed (${response.status})`);
  }
  const payload = parseMcpTextPayload(envelope);
  if (envelope.result?.isError) {
    const err = payload.error as { message?: string; code?: string; redirectUriToRegister?: string } | undefined;
    const hint = err?.redirectUriToRegister ? ` Register: ${err.redirectUriToRegister}` : '';
    throw new Error((err?.message || err?.code || 'Workspace OAuth tool error') + hint);
  }
  if (payload.ok === false && payload.error && typeof payload.error === 'object') {
    const err = payload.error as { message?: string; code?: string; redirectUriToRegister?: string };
    const hint = err.redirectUriToRegister ? ` Register: ${err.redirectUriToRegister}` : '';
    throw new Error((err.message || err.code || 'Workspace OAuth error') + hint);
  }
  return payload;
}

export type DemoOAuthConnection = {
  profileId: string;
  label: string;
  projectId: string | null;
  clientIdMasked: string | null;
  clients: { desktop: boolean; web: boolean };
  isDefault: boolean;
};

export async function listDemoOAuthConnections(): Promise<DemoOAuthConnection[]> {
  const data = await callWorkspaceOauth('workspace_oauth_clients', { action: 'list' });
  const profiles = data.profiles;
  return Array.isArray(profiles) ? (profiles as DemoOAuthConnection[]) : [];
}

export async function saveDemoDesktopOAuthClient(options: {
  oauthClientJson: unknown;
  label?: string;
  profileId?: string;
}): Promise<Record<string, unknown>> {
  return callWorkspaceOauth('workspace_oauth_clients_manage', {
    action: 'upsert',
    oauthClientJson: options.oauthClientJson,
    label: options.label,
    profileId: options.profileId,
    skipConfirm: true,
  });
}

export async function saveDemoWebOAuthClient(options: {
  oauthClientJson: unknown;
  profileId: string;
  redirectMode: 'gateway' | 'site-origin';
  sampleReturnTo?: string;
}): Promise<{ redirectUriToRegister?: string; state?: string }> {
  const egdeskPublicUrl = resolveEgdeskPublicUrl();
  const sampleReturnTo =
    options.sampleReturnTo ||
    (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'http://localhost:4000/auth/callback');
  const data = await callWorkspaceOauth('workspace_oauth_clients_manage', {
    action: 'upsert_web',
    profileId: options.profileId,
    oauthClientJson: options.oauthClientJson,
    redirectMode: options.redirectMode,
    egdeskPublicUrl,
    sampleReturnTo,
  });
  return {
    redirectUriToRegister:
      typeof data.redirectUriToRegister === 'string' ? data.redirectUriToRegister : undefined,
    state: typeof data.state === 'string' ? data.state : undefined,
  };
}

export async function enableDemoVisitorOperatorLogin(options: {
  label: string;
  siteOrigin?: string;
}): Promise<Record<string, unknown>> {
  return callWorkspaceOauth('workspace_oauth_clients_manage', {
    action: 'enable_visitor_operator',
    label: options.label,
    siteOrigin: options.siteOrigin || (typeof window !== 'undefined' ? window.location.origin : ''),
  });
}

export function expectedGatewayRedirectUri(egdeskPublicUrl: string): string {
  const base = egdeskPublicUrl.replace(/\/$/, '');
  try {
    const parsed = new URL(base);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      const port = parsed.port || '8080';
      return `http://localhost:${port}/visitor-auth/callback`;
    }
  } catch {
    // ignore
  }
  return `${base}/visitor-auth/callback`;
}
