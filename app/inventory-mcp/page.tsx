'use client';

import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';

type FieldDef = {
  name: string;
  label: string;
  type: 'string' | 'select' | 'textarea';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
};

type ToolDef = {
  name: string;
  title: string;
  description: string;
  fields: FieldDef[];
};

const TOOL: ToolDef = {
  name: 'inventory_setup_scanner',
  title: 'Install inventory scanner',
  description:
    'Inject a camera-based barcode / YOLO product recognition scanner into a Next.js or Vite project. After install, the scanner runs standalone — no EGDesk required at runtime.',
  fields: [
    {
      name: 'projectPath',
      label: 'Project absolute path',
      type: 'string',
      required: true,
      placeholder: '/Users/you/projects/my-store-app',
      hint: 'Defaults to this demo app\'s folder — change it to inject into another Next.js or Vite project.',
    },
    {
      name: 'framework',
      label: 'Framework',
      type: 'select',
      options: ['auto', 'nextjs', 'vite'],
      defaultValue: 'auto',
      hint: 'Leave on auto to detect from next.config.* or vite.config.*.',
    },
    {
      name: 'routePath',
      label: 'Scanner route',
      type: 'string',
      defaultValue: '/inventory-scanner',
      placeholder: '/inventory-scanner',
      hint: 'URL path where the scanner page will be mounted.',
    },
  ],
};

type HistoryEntry = {
  id: number;
  tool: string;
  args: Record<string, any>;
  result: any;
  error?: string;
  timestamp: number;
  durationMs: number;
};

type InstallStatus = {
  installed: boolean;
  routePath: string;
  projectPath?: string;
};

function parseMcpResult(raw: any): any {
  if (raw?.success === false) {
    throw new Error(raw.error || 'Request failed');
  }

  const mcpPayload = raw?.result ?? raw;

  if (mcpPayload?.content?.[0]?.text) {
    try {
      return JSON.parse(mcpPayload.content[0].text);
    } catch {
      return mcpPayload;
    }
  }

  return mcpPayload;
}

export default function InventoryMcpPlayground() {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [installStatus, setInstallStatus] = useState<InstallStatus | null>(null);
  const [landingHref, setLandingHref] = useState('/');
  const [dbHref, setDbHref] = useState('/database');
  const [kakaoHref, setKakaoHref] = useState('/kakao-mcp');
  const [scannerHref, setScannerHref] = useState('/inventory-scanner');
  const nextId = useRef(1);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/inventory/status');
      const json = await res.json();
      setInstallStatus(json);
      if (json.projectPath) {
        setFieldValues(prev => ({
          ...prev,
          projectPath: prev.projectPath || json.projectPath,
        }));
      }
    } catch {
      setInstallStatus(null);
    }
  }, []);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of TOOL.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    }
    setFieldValues(defaults);
  }, []);

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setLandingHref(bp || '/');
    setDbHref(`${bp}/database`);
    setKakaoHref(`${bp}/kakao-mcp`);
    setScannerHref(`${bp}/inventory-scanner`);
    loadStatus();
  }, [loadStatus]);

  const recordResult = useCallback((
    tool: string,
    args: Record<string, any>,
    parsed: any,
    durationMs: number,
    error?: string,
  ) => {
    const entry: HistoryEntry = {
      id: nextId.current++,
      tool,
      args,
      result: parsed,
      error,
      timestamp: Date.now(),
      durationMs,
    };
    setHistory(prev => [entry, ...prev]);
    setExpandedEntry(entry.id);
    return entry;
  }, []);

  const buildArgs = (): Record<string, any> => {
    const args: Record<string, any> = {};

    for (const field of TOOL.fields) {
      const raw = fieldValues[field.name];
      if (raw === undefined || raw === '') continue;
      if (field.name === 'framework' && raw === 'auto') continue;
      args[field.name] = raw;
    }

    return args;
  };

  const handleRun = async () => {
    const args = buildArgs();

    if (!args.projectPath) {
      recordResult(TOOL.name, args, null, 0, 'Project absolute path is required');
      return;
    }

    setRunning(true);
    const start = Date.now();

    try {
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: TOOL.name, arguments: args }),
      });
      const raw = await res.json();
      const parsed = parseMcpResult(raw);
      recordResult(TOOL.name, args, parsed, Date.now() - start);

      if (parsed.success) {
        loadStatus();
      }
    } catch (err: any) {
      recordResult(TOOL.name, args, null, Date.now() - start, err.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  const setField = (name: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
  };

  const displayEntry = history.find(e => e.id === expandedEntry) ?? history[0];
  const lastRoutePath = fieldValues.routePath || installStatus?.routePath || '/inventory-scanner';

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <a href={landingHref} style={navLinkStyle}>Back to landing</a>
          <a href={dbHref} style={navLinkStyle}>Database demo</a>
          <a href={kakaoHref} style={navLinkStyle}>Kakao MCP</a>
          <a href={scannerHref} style={navLinkStyle}>Live scanner</a>
        </div>
        <div style={eyebrowStyle}>EGDesk Inventory MCP</div>
        <h1 style={titleStyle}>Inventory Scanner Setup</h1>
        <p style={subtitleStyle}>
          Install the AI-driven inventory scanner into any Next.js or Vite project. EGDesk must be running with the Inventory MCP server enabled.
        </p>
      </header>

      <div style={sessionBarStyle}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={miniLabelStyle}>This demo project</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
            {installStatus?.installed ? 'Scanner installed' : 'Scanner not installed yet'}
          </p>
          <p style={hintStyle}>
            Project path is pre-filled below — run the tool to install the scanner here, then open{' '}
            <a href={scannerHref} style={navLinkStyle}>{lastRoutePath}</a>.
          </p>
        </div>
        <div style={sessionPillsStyle}>
          <span style={{
            ...statusBadgeStyle,
            background: installStatus?.installed ? '#dcfce7' : '#fef3c7',
            color: installStatus?.installed ? '#166534' : '#92400e',
          }}>
            {installStatus?.installed ? 'Ready to scan' : 'Needs setup'}
          </span>
          <button onClick={loadStatus} style={secondaryBtnStyle}>
            Refresh status
          </button>
        </div>
      </div>

      <div style={layoutStyle}>
        <div style={leftColStyle}>
          <div style={panelStyle}>
            <div style={categoryLabelStyle}>Setup</div>
            <button style={{ ...toolTabStyle, ...toolTabActiveStyle, marginBottom: 14 }}>
              {TOOL.title}
            </button>

            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{TOOL.description}</p>

            <div style={infoPanelStyle}>
              <strong style={{ fontSize: 13, color: '#1e40af' }}>What gets injected</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: '#1e40af', lineHeight: 1.65 }}>
                <li>Camera scanner UI (YOLO + DINO product recognition)</li>
                <li><code>/api/inventory/products</code> and log routes</li>
                <li>ONNX / face-model assets under <code>public/</code></li>
                <li><code>@huggingface/transformers</code>, <code>onnxruntime-web</code>, etc.</li>
              </ul>
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              {TOOL.fields.map(field => (
                <div key={field.name}>
                  <label style={labelStyle}>
                    {field.label}
                    {field.required && <span style={{ color: '#dc2626' }}> *</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={fieldValues[field.name] ?? field.defaultValue ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt === 'auto' ? 'Auto-detect' : opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={fieldValues[field.name] ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      style={inputStyle}
                    />
                  )}
                  {field.hint && <p style={hintStyle}>{field.hint}</p>}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={handleRun} disabled={running} style={runBtnStyle}>
                {running ? 'Installing…' : 'Run inventory_setup_scanner'}
              </button>
            </div>
          </div>
        </div>

        <div style={rightColStyle}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Display</h2>
            {!displayEntry ? (
              <div style={emptyResultStyle}>
                Run the setup tool to see installed files and next steps here
              </div>
            ) : displayEntry.error ? (
              <div style={displayPanelStyle}>
                <div style={{ ...statusBadgeStyle, background: '#fef2f2', color: '#991b1b', display: 'inline-block' }}>
                  Error
                </div>
                <p style={{ color: '#991b1b', fontSize: 14, margin: '10px 0 0' }}>{displayEntry.error}</p>
              </div>
            ) : (
              <div style={displayPanelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <code style={toolBadgeStyle}>{displayEntry.tool}</code>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{displayEntry.durationMs}ms</span>
                </div>
                <DisplayResultView
                  data={displayEntry.result}
                  scannerHref={scannerHref}
                  routePath={lastRoutePath}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Results</h2>
            {history.length > 0 && (
              <button
                onClick={() => {
                  setHistory([]);
                  setExpandedEntry(null);
                }}
                style={{ ...secondaryBtnStyle, fontSize: 12, padding: '4px 10px' }}
              >
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ ...emptyResultStyle, padding: '24px 16px' }}>
              Raw JSON responses appear here
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(entry => (
                <div key={entry.id} style={resultCardStyle}>
                  <button
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    style={resultHeaderBtnStyle}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{
                        ...resultDotStyle,
                        background: entry.error ? '#ef4444' : entry.result?.success === false ? '#f59e0b' : '#22c55e',
                      }} />
                      <code style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.tool}
                      </code>
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {entry.durationMs}ms
                    </span>
                  </button>

                  {expandedEntry === entry.id && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={miniLabelStyle}>Arguments</div>
                        <pre style={resultCodeStyle}>{JSON.stringify(entry.args, null, 2)}</pre>
                      </div>
                      <div>
                        <div style={miniLabelStyle}>{entry.error ? 'Error' : 'Response'}</div>
                        <pre style={{
                          ...resultCodeStyle,
                          ...(entry.error ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } : {}),
                        }}>
                          {entry.error ? entry.error : JSON.stringify(entry.result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function DisplayResultView({
  data,
  scannerHref,
  routePath,
}: {
  data: any;
  scannerHref: string;
  routePath: string;
}) {
  if (!data || typeof data !== 'object') {
    return <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>{String(data)}</p>;
  }

  const success = data.success === true;
  const files = Array.isArray(data.installedFiles) ? data.installedFiles : [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <span style={{
          ...statusBadgeStyle,
          background: success ? '#dcfce7' : '#fef2f2',
          color: success ? '#166534' : '#991b1b',
        }}>
          {success ? 'Success' : 'Failed'}
        </span>
        {data.message && (
          <p style={{ color: '#374151', fontSize: 14, margin: '10px 0 0', lineHeight: 1.6 }}>
            {data.message}
          </p>
        )}
      </div>

      {success && (
        <p style={{ margin: 0 }}>
          <a href={scannerHref} style={{ ...runBtnStyle, display: 'inline-block', textDecoration: 'none' }}>
            Open scanner at {routePath}
          </a>
        </p>
      )}

      {data.setupInstructions && (
        <div>
          <div style={miniLabelStyle}>Next steps</div>
          <pre style={resultCodeStyle}>{data.setupInstructions}</pre>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <div style={miniLabelStyle}>Installed files ({files.length})</div>
          <div style={{ ...resultCodeStyle, maxHeight: 220 }}>
            {files.map((file: string) => (
              <div key={file} style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                <code>{file}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '32px 24px 64px',
};

const navLinkStyle: React.CSSProperties = {
  color: '#2563eb',
  fontSize: 14,
  fontWeight: 600,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#047857',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const titleStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  color: '#111827',
  marginBottom: 8,
};

const subtitleStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 15,
  lineHeight: 1.6,
};

const layoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '380px 1fr',
  gap: 20,
  alignItems: 'start',
};

const leftColStyle: React.CSSProperties = { display: 'grid', gap: 16 };
const rightColStyle: React.CSSProperties = { minWidth: 0 };

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const infoPanelStyle: React.CSSProperties = {
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  padding: '12px 14px',
};

const categoryLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

const toolTabStyle: React.CSSProperties = {
  padding: '5px 11px',
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
};

const toolTabActiveStyle: React.CSSProperties = {
  background: '#047857',
  color: '#fff',
  border: '1px solid #047857',
};

const toolBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 5,
  padding: '2px 6px',
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af',
  margin: '4px 0 0',
  lineHeight: 1.5,
};

const sessionBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  alignItems: 'flex-start',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  marginBottom: 20,
};

const sessionPillsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};

const statusBadgeStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 20,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#111827',
  boxSizing: 'border-box',
};

const runBtnStyle: React.CSSProperties = {
  padding: '8px 22px',
  fontSize: 14,
  fontWeight: 700,
  background: '#047857',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
};

const emptyResultStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '48px 24px',
  textAlign: 'center',
  color: '#9ca3af',
  fontSize: 14,
};

const resultCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  overflow: 'hidden',
};

const resultHeaderBtnStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  gap: 8,
};

const resultDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  marginBottom: 4,
};

const resultCodeStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: 10,
  fontSize: 12,
  lineHeight: 1.5,
  overflowX: 'auto',
  margin: 0,
  maxHeight: 400,
  overflowY: 'auto',
};

const displayPanelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};
