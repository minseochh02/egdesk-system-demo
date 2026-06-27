'use client';

import { useCallback } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'egdesk_get_gemini_key',
    title: 'Get preferred key',
    description:
      'Return the Google/Gemini API key EGDesk uses (egdesk-named → active → any Google key → GEMINI_API_KEY env).',
    category: 'keys',
    helperName: 'getGeminiApiKey',
    fields: [
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
    name: 'egdesk_list_gemini_keys',
    title: 'List all keys',
    description: 'List every Google/Gemini key in AI Keys Manager with full apiKey values.',
    category: 'keys',
    helperName: 'listGeminiApiKeys',
    fields: [],
  },
];

const CATEGORIES = [{ key: 'keys', label: 'Gemini keys' }];

export default function EgdeskConfigPlayground() {
  const renderDisplay = useCallback((data: any) => {
    const {
      miniLabelStyle,
      tableWrapStyle,
      tableStyle,
      thStyle,
      tdStyle,
      inlineCodeStyle,
      kvGridStyle,
      kvTermStyle,
      kvDescStyle,
    } = playgroundStyles;

    if (Array.isArray(data?.keys)) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={miniLabelStyle}>
            Google/Gemini keys ({data.total ?? data.keys.length})
            {data.preferredKeyId && (
              <> · preferred: <code style={inlineCodeStyle}>{data.preferredKeyId}</code></>
            )}
          </div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Active</th>
                  <th style={thStyle}>API key</th>
                  <th style={thStyle}>Preferred</th>
                </tr>
              </thead>
              <tbody>
                {data.keys.map((row: any) => (
                  <tr key={row.id || row.name}>
                    <td style={tdStyle}>{row.name || '—'}</td>
                    <td style={tdStyle}>{String(row.isActive ?? false)}</td>
                    <td style={tdStyle}><code style={inlineCodeStyle}>{row.apiKey || '—'}</code></td>
                    <td style={tdStyle}>{row.isPreferred ? 'yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.envFallback?.apiKey && (
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Env fallback ({data.envFallback.variable}):{' '}
              <code style={inlineCodeStyle}>{data.envFallback.apiKey}</code>
            </p>
          )}
        </div>
      );
    }

    if (data?.apiKey || data?.success === false) {
      return (
        <dl style={kvGridStyle}>
          <dt style={kvTermStyle}>Configured</dt>
          <dd style={kvDescStyle}>{data.success === false ? 'No' : 'Yes'}</dd>
          {data.source && <><dt style={kvTermStyle}>Source</dt><dd style={kvDescStyle}>{data.source}</dd></>}
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
          These tools return full Gemini API keys. The EGDesk Config MCP route requires <code style={playgroundStyles.inlineCodeStyle}>X-Api-Key</code> when tunnel auth is enabled.
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/egdesk-config-mcp"
      eyebrow="EGDesk Config MCP"
      title="Gemini Keys Playground"
      subtitle="Fetch Google/Gemini API keys from EGDesk AI Keys Manager — same selection logic PageIndex and Gemini generation use."
      apiPath="/api/egdesk-config"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#ea580c"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
    />
  );
}
