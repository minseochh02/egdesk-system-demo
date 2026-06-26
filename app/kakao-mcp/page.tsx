'use client';

import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';

// ── Tool definitions ────────────────────────────────────────────────────────

type FieldDef = {
  name: string;
  label: string;
  type: 'string' | 'boolean' | 'select' | 'number';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | boolean | number;
};

type ToolDef = {
  name: string;
  title: string;
  description: string;
  fields: FieldDef[];
  category: 'login' | 'channels' | 'bots' | 'diagnostics';
};

const TOOLS: ToolDef[] = [
  {
    name: 'kakao_begin_login',
    title: 'Begin Login',
    description: 'Start Kakao QR login. Returns a QR code to scan with KakaoTalk.',
    category: 'login',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'service', label: 'Service', type: 'select', options: ['chatbot', 'business'], defaultValue: 'chatbot' },
      { name: 'headless', label: 'Headless', type: 'boolean', defaultValue: true },
      { name: 'waitMs', label: 'Wait (ms)', type: 'number', placeholder: '0', defaultValue: 0 },
    ],
  },
  {
    name: 'kakao_login_status',
    title: 'Login Status',
    description: 'Poll login session status by loginId.',
    category: 'login',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'loginId', label: 'Login ID', type: 'string', required: true, placeholder: 'From begin_login result' },
    ],
  },
  {
    name: 'kakao_close_login',
    title: 'Close Login',
    description: 'Close a pending login session and free browser resources.',
    category: 'login',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'loginId', label: 'Login ID', type: 'string', required: true, placeholder: 'From begin_login result' },
    ],
  },
  {
    name: 'kakao_list_channels',
    title: 'List Channels',
    description: 'List Kakao Business channels for a profile.',
    category: 'channels',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'enrichDetails', label: 'Enrich Details', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_select_channel',
    title: 'Select Channel',
    description: 'Persist a selected channel into EGDesk profile metadata.',
    category: 'channels',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'channel.searchId', label: 'Search ID', type: 'string', required: true, placeholder: '@my-channel' },
      { name: 'channel.name', label: 'Channel Name', type: 'string', placeholder: 'My Channel' },
    ],
  },
  {
    name: 'kakao_create_channel',
    title: 'Create Channel',
    description: 'Create or reuse a Kakao Business channel.',
    category: 'channels',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'channelName', label: 'Channel Name', type: 'string', required: true, placeholder: 'Demo Support' },
      { name: 'searchId', label: 'Search ID', type: 'string', required: true, placeholder: 'demo-support' },
      { name: 'reuseExisting', label: 'Reuse Existing', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_list_bots',
    title: 'List Bots',
    description: 'List Kakao chatbot admin bots for a profile.',
    category: 'bots',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
    ],
  },
  {
    name: 'kakao_create_bot',
    title: 'Create Bot',
    description: 'Create or reuse a Kakao chatbot, bind channel, configure skill, and deploy.',
    category: 'bots',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'botName', label: 'Bot Name', type: 'string', required: true, placeholder: 'Demo Support Bot' },
      { name: 'channelSearchId', label: 'Channel Search ID', type: 'string', required: true, placeholder: '@demo-support' },
      { name: 'skillUrl', label: 'Skill URL', type: 'string', placeholder: 'https://your-url/kakao/skill' },
      { name: 'reuseExisting', label: 'Reuse Existing', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_list_resources',
    title: 'List Resources',
    description: 'List both channels and bots in one call.',
    category: 'diagnostics',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
      { name: 'enrichDetails', label: 'Enrich Details', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_check_callback_statuses',
    title: 'Check Callbacks',
    description: 'Verify bot skill/callback webhook configuration.',
    category: 'diagnostics',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
    ],
  },
  {
    name: 'kakao_repair_callback_setup',
    title: 'Repair Callbacks',
    description: 'Repair missing or stale callback configuration and deploy.',
    category: 'diagnostics',
    fields: [
      { name: 'profileName', label: 'Profile', type: 'string', required: true, placeholder: 'Default' },
    ],
  },
];

const CATEGORIES = [
  { key: 'login', label: 'Login' },
  { key: 'channels', label: 'Channels' },
  { key: 'bots', label: 'Bots' },
  { key: 'diagnostics', label: 'Diagnostics' },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildArgs(tool: ToolDef, values: Record<string, string>): Record<string, any> {
  const args: Record<string, any> = {};
  for (const field of tool.fields) {
    const raw = values[field.name];
    if (raw === undefined || raw === '') continue;

    // Handle nested fields like channel.searchId
    if (field.name.includes('.')) {
      const [parent, child] = field.name.split('.');
      if (!args[parent]) args[parent] = {};
      args[parent][child] = raw;
      continue;
    }

    if (field.type === 'boolean') {
      args[field.name] = raw === 'true';
    } else if (field.type === 'number') {
      args[field.name] = Number(raw);
    } else {
      args[field.name] = raw;
    }
  }
  return args;
}

type HistoryEntry = {
  id: number;
  tool: string;
  args: Record<string, any>;
  result: any;
  error?: string;
  timestamp: number;
  durationMs: number;
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function KakaoPlayground() {
  const [selectedTool, setSelectedTool] = useState<ToolDef>(TOOLS[0]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [landingHref, setLandingHref] = useState('/');
  const [dbHref, setDbHref] = useState('/database');
  const nextId = useRef(1);

  // Login polling state
  const [loginPolling, setLoginPolling] = useState(false);
  const [loginId, setLoginId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loginStatus, setLoginStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setLandingHref(bp || '/');
    setDbHref(`${bp}/database`);
  }, []);

  // Initialize default field values when tool changes
  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of selectedTool.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = String(field.defaultValue);
      }
    }
    setFieldValues(defaults);
  }, [selectedTool]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setLoginPolling(false);
  }, []);

  const callTool = async (toolName: string, args: Record<string, any>): Promise<any> => {
    const res = await apiFetch('/api/kakao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName, arguments: args }),
    });
    return res.json();
  };

  const startPolling = useCallback((id: string, profileName: string) => {
    setLoginPolling(true);
    setLoginId(id);

    pollRef.current = setInterval(async () => {
      try {
        const result = await callTool('kakao_login_status', { profileName, loginId: id });
        const parsed = parseMcpResult(result);
        if (parsed.qrImageDataUrl) setQrImage(parsed.qrImageDataUrl);
        setLoginStatus(parsed.status || null);

        if (parsed.status === 'logged_in' || parsed.status === 'expired' || parsed.status === 'failed' || parsed.status === 'closed') {
          stopPolling();
          // Add a status poll entry to history
          setHistory(prev => [{
            id: nextId.current++,
            tool: 'kakao_login_status',
            args: { profileName, loginId: id },
            result: parsed,
            timestamp: Date.now(),
            durationMs: 0,
          }, ...prev]);
        }
      } catch {
        stopPolling();
      }
    }, 2500);
  }, [stopPolling]);

  const handleRun = async () => {
    const args = buildArgs(selectedTool, fieldValues);
    setRunning(true);

    const start = Date.now();
    try {
      const raw = await callTool(selectedTool.name, args);
      const parsed = parseMcpResult(raw);
      const entry: HistoryEntry = {
        id: nextId.current++,
        tool: selectedTool.name,
        args,
        result: parsed,
        timestamp: Date.now(),
        durationMs: Date.now() - start,
      };
      setHistory(prev => [entry, ...prev]);
      setExpandedEntry(entry.id);

      // Auto-handle login flow
      if (selectedTool.name === 'kakao_begin_login' && parsed.loginId) {
        setLoginId(parsed.loginId);
        if (parsed.qrImageDataUrl) setQrImage(parsed.qrImageDataUrl);
        setLoginStatus(parsed.status || null);

        if (parsed.status === 'waiting_for_qr') {
          startPolling(parsed.loginId, args.profileName || 'Default');
        }

        // Auto-fill loginId on login_status and close_login tools
        // (user can switch to those tools and the loginId will be pre-filled)
      }
    } catch (err: any) {
      const entry: HistoryEntry = {
        id: nextId.current++,
        tool: selectedTool.name,
        args,
        result: null,
        error: err.message || String(err),
        timestamp: Date.now(),
        durationMs: Date.now() - start,
      };
      setHistory(prev => [entry, ...prev]);
      setExpandedEntry(entry.id);
    } finally {
      setRunning(false);
    }
  };

  const handleCloseLogin = async () => {
    if (!loginId) return;
    stopPolling();
    try {
      await callTool('kakao_close_login', {
        profileName: fieldValues.profileName || 'Default',
        loginId,
      });
    } catch { /* best effort */ }
    setQrImage(null);
    setLoginId(null);
    setLoginStatus(null);
  };

  const setField = (name: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
  };

  const selectToolByName = (name: string) => {
    const tool = TOOLS.find(t => t.name === name);
    if (tool) setSelectedTool(tool);
  };

  return (
    <main style={pageStyle}>
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <a href={landingHref} style={navLinkStyle}>Back to landing</a>
          <a href={dbHref} style={navLinkStyle}>Database demo</a>
        </div>
        <div style={eyebrowStyle}>EGDesk Kakao MCP</div>
        <h1 style={titleStyle}>Kakao Playground</h1>
        <p style={subtitleStyle}>
          Call Kakao MCP tools, see QR codes, inspect results. EGDesk must be running with the Kakao MCP server enabled.
        </p>
      </header>

      <div style={layoutStyle}>
        {/* Left: Tool picker + form */}
        <div style={leftColStyle}>
          {/* Tool tabs by category */}
          <div style={panelStyle}>
            {CATEGORIES.map(cat => (
              <div key={cat.key} style={{ marginBottom: 16 }}>
                <div style={categoryLabelStyle}>{cat.label}</div>
                <div style={toolTabGridStyle}>
                  {TOOLS.filter(t => t.category === cat.key).map(tool => (
                    <button
                      key={tool.name}
                      onClick={() => setSelectedTool(tool)}
                      style={{
                        ...toolTabStyle,
                        ...(selectedTool.name === tool.name ? toolTabActiveStyle : {}),
                      }}
                    >
                      {tool.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Selected tool form */}
          <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                {selectedTool.title}
              </h2>
              <code style={toolBadgeStyle}>{selectedTool.name}</code>
            </div>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{selectedTool.description}</p>

            <div style={{ display: 'grid', gap: 12 }}>
              {selectedTool.fields.map(field => (
                <div key={field.name}>
                  <label style={labelStyle}>
                    {field.label}
                    {field.required && <span style={{ color: '#dc2626' }}> *</span>}
                  </label>
                  {field.type === 'boolean' ? (
                    <select
                      value={fieldValues[field.name] ?? String(field.defaultValue ?? 'true')}
                      onChange={e => setField(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : field.type === 'select' ? (
                    <select
                      value={fieldValues[field.name] ?? (field.defaultValue as string) ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={fieldValues[field.name] ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={handleRun}
                disabled={running}
                style={runBtnStyle}
              >
                {running ? 'Running...' : 'Run'}
              </button>
              {loginId && selectedTool.name.startsWith('kakao_') && (
                <button onClick={() => {
                  // Auto-fill loginId for status/close tools
                  if (selectedTool.name === 'kakao_login_status' || selectedTool.name === 'kakao_close_login') {
                    setField('loginId', loginId);
                  } else {
                    selectToolByName('kakao_login_status');
                    setTimeout(() => setField('loginId', loginId!), 0);
                  }
                }} style={secondaryBtnStyle}>
                  Fill loginId
                </button>
              )}
            </div>
          </div>

          {/* QR code panel (login flow) */}
          {(qrImage || loginPolling) && (
            <div style={qrPanelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                  Kakao QR Login
                </h3>
                <button onClick={handleCloseLogin} style={closeBtnStyle}>
                  Close session
                </button>
              </div>

              {qrImage ? (
                <div style={{ textAlign: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImage}
                    alt="Kakao QR code"
                    style={{ width: 200, height: 200, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <p style={{ color: '#6b7280', fontSize: 13, marginTop: 10 }}>
                    Scan with KakaoTalk to log in
                  </p>
                </div>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                  Waiting for QR code...
                </p>
              )}

              <div style={statusBadgeContainerStyle}>
                <span style={{
                  ...statusBadgeStyle,
                  background: loginStatus === 'logged_in' ? '#dcfce7' : loginStatus === 'failed' || loginStatus === 'expired' ? '#fef2f2' : '#fef3c7',
                  color: loginStatus === 'logged_in' ? '#166534' : loginStatus === 'failed' || loginStatus === 'expired' ? '#991b1b' : '#92400e',
                }}>
                  {loginStatus || 'starting'}
                </span>
                {loginPolling && <span style={{ color: '#9ca3af', fontSize: 12 }}>polling every 2.5s</span>}
                {loginId && <code style={{ fontSize: 11, color: '#6b7280' }}>{loginId}</code>}
              </div>
            </div>
          )}
        </div>

        {/* Right: Results history */}
        <div style={rightColStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Results</h2>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                style={{ ...secondaryBtnStyle, fontSize: 12, padding: '4px 10px' }}
              >
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div style={emptyResultStyle}>
              Run a tool to see results here
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
                        background: entry.error ? '#ef4444' : '#22c55e',
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
                      {/* Args */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={miniLabelStyle}>Arguments</div>
                        <pre style={resultCodeStyle}>
                          {JSON.stringify(entry.args, null, 2)}
                        </pre>
                      </div>

                      {/* Result or error */}
                      <div>
                        <div style={miniLabelStyle}>{entry.error ? 'Error' : 'Response'}</div>
                        <pre style={{
                          ...resultCodeStyle,
                          ...(entry.error ? { background: '#fef2f2', color: '#991b1b', borderColor: '#fecaca' } : {}),
                        }}>
                          {entry.error
                            ? entry.error
                            : JSON.stringify(entry.result, stripQrImages, 2)}
                        </pre>
                      </div>

                      {/* Inline QR if present */}
                      {entry.result?.qrImageDataUrl && (
                        <div style={{ marginTop: 8, textAlign: 'center' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={entry.result.qrImageDataUrl}
                            alt="QR"
                            style={{ width: 140, height: 140, borderRadius: 6, border: '1px solid #e5e7eb' }}
                          />
                        </div>
                      )}

                      {/* Quick actions from result */}
                      {entry.result?.loginId && entry.tool === 'kakao_begin_login' && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => {
                              selectToolByName('kakao_login_status');
                              setTimeout(() => {
                                setField('loginId', entry.result.loginId);
                                setField('profileName', entry.args.profileName || 'Default');
                              }, 0);
                            }}
                            style={secondaryBtnStyle}
                          >
                            Poll status
                          </button>
                          <button
                            onClick={() => {
                              selectToolByName('kakao_close_login');
                              setTimeout(() => {
                                setField('loginId', entry.result.loginId);
                                setField('profileName', entry.args.profileName || 'Default');
                              }, 0);
                            }}
                            style={secondaryBtnStyle}
                          >
                            Close login
                          </button>
                        </div>
                      )}
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

// ── Utility ─────────────────────────────────────────────────────────────────

/** Parse MCP-shaped response { content: [{ text }] } into plain object */
function parseMcpResult(raw: any): any {
  if (raw?.content?.[0]?.text) {
    try {
      return JSON.parse(raw.content[0].text);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** JSON.stringify replacer: truncate qrImageDataUrl in displayed output */
function stripQrImages(key: string, value: any): any {
  if (key === 'qrImageDataUrl' && typeof value === 'string' && value.length > 80) {
    return value.slice(0, 40) + '...[QR image truncated]';
  }
  return value;
}

// ── Styles ──────────────────────────────────────────────────────────────────

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

const leftColStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
};

const rightColStyle: React.CSSProperties = {
  minWidth: 0,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const categoryLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

const toolTabGridStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
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
  borderColor: '#047857',
};

const toolBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 5,
  padding: '2px 6px',
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

const closeBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 600,
  background: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  borderRadius: 5,
  cursor: 'pointer',
};

const qrPanelStyle: React.CSSProperties = {
  background: '#fff',
  border: '2px solid #fde68a',
  borderRadius: 10,
  padding: 18,
};

const statusBadgeContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 12,
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const statusBadgeStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 20,
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
