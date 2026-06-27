'use client';

import { useCallback } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const PROVIDER_OPTIONS = ['google', 'openai', 'anthropic', 'azure', 'custom'];

const providerField = {
  name: 'provider',
  label: 'Provider',
  type: 'select' as const,
  options: PROVIDER_OPTIONS,
  defaultValue: 'google',
  hint: 'google = Gemini, openai = GPT, anthropic = Claude, azure = Azure OpenAI, custom = custom endpoint',
};

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'egdesk_set_api_key',
    title: 'Save API key',
    description:
      'Save an API key into EGDesk AI Keys Manager for google, openai, anthropic, azure, or custom. Updates an existing entry matched by provider + keyId or provider + name.',
    category: 'keys',
    helperName: 'setApiKey',
    fields: [
      providerField,
      {
        name: 'apiKey',
        label: 'API key',
        type: 'string',
        required: true,
        placeholder: 'AIza... or sk-...',
        hint: 'Stored in EGDesk AI Keys Manager on the machine running EGDesk.',
      },
      {
        name: 'name',
        label: 'Key name',
        type: 'string',
        placeholder: 'egdesk',
        defaultValue: 'egdesk',
        hint: 'Existing key with this provider + name is updated; otherwise a new entry is created.',
      },
      {
        name: 'keyId',
        label: 'Key ID (optional)',
        type: 'string',
        placeholder: 'Update a specific AI Keys entry by id',
      },
      {
        name: 'setActive',
        label: 'Set active',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'egdesk_get_api_key',
    title: 'Get preferred key',
    description:
      'Return the API key EGDesk would use for a provider (egdesk-named → active → any key → env var). Pass apiKey to return a value directly without reading the store.',
    category: 'keys',
    helperName: 'getApiKey',
    fields: [
      providerField,
      {
        name: 'apiKey',
        label: 'API key override (optional)',
        type: 'string',
        placeholder: 'Return this key without reading AI Keys Manager',
        hint: 'Not persisted — useful for one-off checks.',
      },
      {
        name: 'keyId',
        label: 'Key ID (optional)',
        type: 'string',
        placeholder: 'Fetch a specific AI Keys entry',
      },
      {
        name: 'name',
        label: 'Key name (optional)',
        type: 'string',
        placeholder: 'egdesk',
        hint: 'Exact name match — bypasses preferred-key selection.',
      },
    ],
  },
  {
    name: 'egdesk_list_api_keys',
    title: 'List keys',
    description:
      'List API keys in AI Keys Manager. Leave provider empty to list keys for every provider.',
    category: 'keys',
    helperName: 'listApiKeys',
    fields: [
      {
        name: 'provider',
        label: 'Provider filter (optional)',
        type: 'select',
        options: ['', ...PROVIDER_OPTIONS],
        defaultValue: '',
        hint: 'Leave blank to list all providers.',
      },
    ],
  },
];

const CATEGORIES = [{ key: 'keys', label: 'AI provider keys' }];

function renderKeyTable(
  rows: any[],
  styles: typeof playgroundStyles,
  label: string,
  preferredKeyId?: string | null,
  envFallback?: { variable?: string; apiKey?: string } | null,
) {
  const { miniLabelStyle, tableWrapStyle, tableStyle, thStyle, tdStyle, inlineCodeStyle } = styles;

  return (
    <div>
      <div style={miniLabelStyle}>
        {label} ({rows.length})
        {preferredKeyId && (
          <> · preferred: <code style={inlineCodeStyle}>{preferredKeyId}</code></>
        )}
      </div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Provider</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Active</th>
              <th style={thStyle}>API key</th>
              <th style={thStyle}>Preferred</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id || `${row.providerId}-${row.name}`}>
                <td style={tdStyle}>{row.providerId || row.provider || '—'}</td>
                <td style={tdStyle}>{row.name || '—'}</td>
                <td style={tdStyle}>{String(row.isActive ?? false)}</td>
                <td style={tdStyle}><code style={inlineCodeStyle}>{row.apiKey || '—'}</code></td>
                <td style={tdStyle}>{row.isPreferred ? 'yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {envFallback?.apiKey && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 0' }}>
          Env fallback ({envFallback.variable}):{' '}
          <code style={inlineCodeStyle}>{envFallback.apiKey}</code>
        </p>
      )}
    </div>
  );
}

export default function EgdeskConfigPlayground() {
  const renderDisplay = useCallback((data: any) => {
    const styles = playgroundStyles;
    const {
      kvGridStyle,
      kvTermStyle,
      kvDescStyle,
      inlineCodeStyle,
    } = styles;

    if (Array.isArray(data?.providers)) {
      const allRows = data.providers.flatMap((group: any) =>
        (group.keys || []).map((row: any) => ({
          ...row,
          providerId: row.providerId || group.provider,
          isPreferred: row.isPreferred ?? (group.preferredKeyId && row.id === group.preferredKeyId),
        })),
      );

      return (
        <div style={{ display: 'grid', gap: 16 }}>
          {renderKeyTable(allRows, styles, 'All provider keys', null)}
          {data.providers.map((group: any) => (
            <div key={group.provider}>
              {renderKeyTable(
                group.keys || [],
                styles,
                `${group.provider} keys`,
                group.preferredKeyId,
                group.envFallback,
              )}
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(data?.keys)) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          {renderKeyTable(
            data.keys,
            styles,
            `${data.provider || 'Provider'} keys`,
            data.preferredKeyId,
            data.envFallback,
          )}
        </div>
      );
    }

    if (data?.apiKey || data?.success === false || data?.action) {
      return (
        <dl style={kvGridStyle}>
          <dt style={kvTermStyle}>Configured</dt>
          <dd style={kvDescStyle}>{data.success === false ? 'No' : 'Yes'}</dd>
          {data.provider && <><dt style={kvTermStyle}>Provider</dt><dd style={kvDescStyle}>{data.provider}</dd></>}
          {data.action && <><dt style={kvTermStyle}>Action</dt><dd style={kvDescStyle}>{data.action}</dd></>}
          {data.source && <><dt style={kvTermStyle}>Source</dt><dd style={kvDescStyle}>{data.source}</dd></>}
          {data.persisted === false && (
            <><dt style={kvTermStyle}>Persisted</dt><dd style={kvDescStyle}>No (argument only)</dd></>
          )}
          {data.selectionReason && (
            <><dt style={kvTermStyle}>Selection</dt><dd style={kvDescStyle}>{data.selectionReason}</dd></>
          )}
          {data.name && <><dt style={kvTermStyle}>Name</dt><dd style={kvDescStyle}>{data.name}</dd></>}
          {data.apiKey && (
            <>
              <dt style={kvTermStyle}>API key</dt>
              <dd style={kvDescStyle}><code style={inlineCodeStyle}>{data.apiKey}</code></dd>
            </>
          )}
          {data.message && <><dt style={kvTermStyle}>Message</dt><dd style={kvDescStyle}>{data.message}</dd></>}
        </dl>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Security note</div>
        <p style={{ fontSize: 13, color: '#991b1b', margin: '4px 0 0', lineHeight: 1.55 }}>
          These tools read and write full API keys for Google, OpenAI, and other providers. The EGDesk Config MCP route requires <code style={playgroundStyles.inlineCodeStyle}>X-Api-Key</code> when tunnel auth is enabled.
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/egdesk-config-mcp"
      eyebrow="EGDesk Config MCP"
      title="AI Keys Playground"
      subtitle="Fetch or save API keys by provider (Google/Gemini, OpenAI, Anthropic, Azure, custom) in EGDesk AI Keys Manager."
      apiPath="/api/egdesk-config"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#ea580c"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
    />
  );
}
