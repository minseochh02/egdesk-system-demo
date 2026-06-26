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
  /** Map UI field to a different API argument name */
  apiName?: string;
  /** Invert boolean when sending to API (e.g. showBrowser → headless) */
  invertBoolean?: boolean;
};

type ToolDef = {
  name: string;
  title: string;
  description: string;
  fields: FieldDef[];
  category: 'login' | 'channels' | 'bots' | 'advanced';
  internal?: boolean;
};

const SERVICE_HINTS: Record<string, string> = {
  chatbot: 'Opens chatbot.kakao.com for the QR flow. Same Kakao account — one scan logs you in everywhere.',
  business: 'Opens business.kakao.com for the QR flow. Same Kakao account — one scan logs you in everywhere.',
};

const SESSION_STORAGE_KEY = 'egdesk-kakao-playground';

type PersistedSession = {
  profileName: string;
  loginId: string | null;
  loginStatus: string | null;
  loginService: 'chatbot' | 'business' | null;
  kakaoLoggedIn: boolean;
  selectedChannel: { searchId: string; name: string } | null;
  cachedChannels: Array<{ id?: string; name?: string; searchId?: string; status?: string; connectedBotName?: string }>;
  cachedBots: Array<{ id?: string; name?: string; status?: string; isInactive?: boolean }>;
};

function defaultSession(): PersistedSession {
  return {
    profileName: 'Default',
    loginId: null,
    loginStatus: null,
    loginService: null,
    kakaoLoggedIn: false,
    selectedChannel: null,
    cachedChannels: [],
    cachedBots: [],
  };
}

function loadSession(): PersistedSession {
  if (typeof window === 'undefined') return defaultSession();
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // migrate older sessions that tracked chatbot/business separately
      const kakaoLoggedIn = parsed.kakaoLoggedIn
        ?? parsed.chatbotLoggedIn
        ?? parsed.businessLoggedIn
        ?? false;
      return { ...defaultSession(), ...parsed, kakaoLoggedIn };
    }
  } catch { /* ignore */ }
  return defaultSession();
}

function saveSession(session: PersistedSession) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

const TOOLS: ToolDef[] = [
  {
    name: 'kakao_begin_login',
    title: 'Log in with QR',
    description: 'Scan once with KakaoTalk. EGDesk saves the session in your Chrome profile — channel and bot tools share the same login.',
    category: 'login',
    fields: [
      {
        name: 'service',
        label: 'Start from which site?',
        type: 'select',
        options: ['chatbot', 'business'],
        defaultValue: 'chatbot',
      },
      {
        name: 'showBrowser',
        label: 'Show browser window (debug)',
        type: 'boolean',
        defaultValue: false,
        apiName: 'headless',
        invertBoolean: true,
      },
    ],
  },
  {
    name: 'kakao_list_channels',
    title: 'List my channels',
    description: 'Opens headless Chrome and scrapes business.kakao.com. Log in with QR first — this tool cannot show QR itself.',
    category: 'channels',
    fields: [
      { name: 'enrichDetails', label: 'Include extra details', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_create_channel',
    title: 'Create channel',
    description: 'Create a new Kakao Business channel (or reuse if it already exists).',
    category: 'channels',
    fields: [
      { name: 'channelName', label: 'Channel name', type: 'string', required: true, placeholder: 'Demo Support' },
      { name: 'searchId', label: 'Search ID (without @)', type: 'string', required: true, placeholder: 'demo-support' },
      { name: 'reuseExisting', label: 'Reuse if already exists', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_list_bots',
    title: 'List my bots',
    description: 'Opens headless Chrome and scrapes chatbot.kakao.com. Log in with QR first.',
    category: 'bots',
    fields: [],
  },
  {
    name: 'kakao_create_bot',
    title: 'Create bot',
    description: 'Create a chatbot, bind it to a channel, and deploy the skill.',
    category: 'bots',
    fields: [
      { name: 'botName', label: 'Bot name', type: 'string', required: true, placeholder: 'Demo Support Bot' },
      { name: 'channelSearchId', label: 'Channel search ID', type: 'string', required: true, placeholder: '@demo-support' },
      { name: 'skillUrl', label: 'Skill URL (optional)', type: 'string', placeholder: 'https://your-url/kakao/skill' },
      { name: 'reuseExisting', label: 'Reuse if already exists', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_list_resources',
    title: 'List everything',
    description: 'List both channels and bots in one call.',
    category: 'advanced',
    fields: [
      { name: 'enrichDetails', label: 'Include channel details', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'kakao_check_callback_statuses',
    title: 'Check webhooks',
    description: 'Verify bot skill/callback webhook configuration.',
    category: 'advanced',
    fields: [],
  },
  {
    name: 'kakao_repair_callback_setup',
    title: 'Repair webhooks',
    description: 'Fix missing or stale callback configuration and redeploy.',
    category: 'advanced',
    fields: [],
  },
];

const VISIBLE_TOOLS = TOOLS.filter(t => !t.internal);

/** Tools that launch headless Chrome — require prior kakao_begin_login in this playground */
const HEADLESS_BROWSER_TOOLS = new Set([
  'kakao_list_channels',
  'kakao_list_bots',
  'kakao_list_resources',
  'kakao_create_channel',
  'kakao_create_bot',
  'kakao_check_callback_statuses',
  'kakao_repair_callback_setup',
]);

const RUNNING_HINTS: Record<string, string> = {
  kakao_begin_login: 'Opening Chrome and loading Kakao login page…',
  kakao_list_channels: 'Headless Chrome → business.kakao.com → scraping channel list. With extra details on, this can take a few minutes.',
  kakao_list_bots: 'Headless Chrome → chatbot.kakao.com → scraping bot list…',
  kakao_create_channel: 'Headless Chrome → creating channel on business.kakao.com…',
  kakao_create_bot: 'Headless Chrome → creating bot on chatbot.kakao.com (can take several minutes)…',
  kakao_list_resources: 'Headless Chrome → listing channels and bots…',
  kakao_check_callback_statuses: 'Checking webhook configuration…',
  kakao_repair_callback_setup: 'Repairing webhook setup and redeploying…',
};

const CATEGORIES = [
  { key: 'login', label: 'Login' },
  { key: 'channels', label: 'Channels' },
  { key: 'bots', label: 'Bots' },
  { key: 'advanced', label: 'Advanced' },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildArgs(tool: ToolDef, values: Record<string, string>, profileName: string): Record<string, any> {
  const args: Record<string, any> = { profileName };

  for (const field of tool.fields) {
    const raw = values[field.name];
    if (raw === undefined || raw === '') continue;

    const apiKey = field.apiName || field.name;

    if (field.name.includes('.')) {
      const [parent, child] = field.name.split('.');
      if (!args[parent]) args[parent] = {};
      args[parent][child] = raw;
      continue;
    }

    if (field.type === 'boolean') {
      const boolVal = raw === 'true';
      args[apiKey] = field.invertBoolean ? !boolVal : boolVal;
    } else if (field.type === 'number') {
      args[apiKey] = Number(raw);
    } else {
      args[apiKey] = raw;
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
  const [session, setSession] = useState<PersistedSession>(defaultSession);
  const [selectedTool, setSelectedTool] = useState<ToolDef>(VISIBLE_TOOLS[0]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [landingHref, setLandingHref] = useState('/');
  const [dbHref, setDbHref] = useState('/database');
  const [inventoryHref, setInventoryHref] = useState('/inventory-mcp');
  const nextId = useRef(1);

  const [loginPolling, setLoginPolling] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [runningHint, setRunningHint] = useState<string | null>(null);
  const [runningElapsedSec, setRunningElapsedSec] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateSession = useCallback((patch: Partial<PersistedSession>) => {
    setSession(prev => {
      const next = { ...prev, ...patch };
      saveSession(next);
      return next;
    });
  }, []);

  const markLoggedIn = useCallback(() => {
    updateSession({ kakaoLoggedIn: true, loginStatus: 'logged_in' });
  }, [updateSession]);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setLandingHref(bp || '/');
    setDbHref(`${bp}/database`);
    setInventoryHref(`${bp}/inventory-mcp`);
  }, []);

  // Pre-fill create-bot channel from selected channel
  useEffect(() => {
    if (selectedTool.name === 'kakao_create_bot' && session.selectedChannel?.searchId) {
      setFieldValues(prev => ({
        ...prev,
        channelSearchId: session.selectedChannel!.searchId,
      }));
    }
  }, [selectedTool, session.selectedChannel]);

  // Initialize default field values when tool changes
  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of selectedTool.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = String(field.defaultValue);
      }
    }
    if (selectedTool.name === 'kakao_create_bot' && session.selectedChannel?.searchId) {
      defaults.channelSearchId = session.selectedChannel.searchId;
    }
    setFieldValues(defaults);
  }, [selectedTool, session.selectedChannel]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (runningTimerRef.current) clearInterval(runningTimerRef.current);
    };
  }, []);

  const startRunningTimer = useCallback((toolName: string) => {
    setRunningHint(RUNNING_HINTS[toolName] || 'Waiting for EGDesk…');
    setRunningElapsedSec(0);
    if (runningTimerRef.current) clearInterval(runningTimerRef.current);
    runningTimerRef.current = setInterval(() => {
      setRunningElapsedSec(s => s + 1);
    }, 1000);
  }, []);

  const stopRunningTimer = useCallback(() => {
    if (runningTimerRef.current) {
      clearInterval(runningTimerRef.current);
      runningTimerRef.current = null;
    }
    setRunningHint(null);
    setRunningElapsedSec(0);
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

  const applyResultSideEffects = useCallback((tool: string, parsed: any) => {
    if (Array.isArray(parsed?.channels)) {
      updateSession({ cachedChannels: parsed.channels });
    }
    if (Array.isArray(parsed?.bots)) {
      updateSession({ cachedBots: parsed.bots });
    }
    if (tool === 'kakao_list_resources') {
      updateSession({
        cachedChannels: parsed.channels || [],
        cachedBots: parsed.bots || [],
      });
    }
  }, [updateSession]);

  const startPolling = useCallback((
    id: string,
    profileName: string,
    service: 'chatbot' | 'business',
  ) => {
    setLoginPolling(true);
    updateSession({ loginId: id, loginService: service, loginStatus: 'waiting_for_qr' });

    pollRef.current = setInterval(async () => {
      try {
        const result = await callTool('kakao_login_status', { profileName, loginId: id });
        const parsed = parseMcpResult(result);
        if (parsed.qrImageDataUrl) setQrImage(parsed.qrImageDataUrl);
        updateSession({ loginStatus: parsed.status || null });

        if (parsed.status === 'logged_in') {
          stopPolling();
          markLoggedIn();
          setQrImage(null);
          recordResult('kakao_login_status', { profileName, loginId: id }, parsed, 0);
          await callTool('kakao_close_login', { profileName, loginId: id }).catch(() => {});
          updateSession({ loginId: null, loginService: null, loginStatus: 'logged_in' });
        } else if (parsed.status === 'expired' || parsed.status === 'failed' || parsed.status === 'closed') {
          stopPolling();
          setQrImage(null);
          updateSession({ loginId: null, loginService: null });
          recordResult('kakao_login_status', { profileName, loginId: id }, parsed, 0);
        }
      } catch {
        stopPolling();
      }
    }, 2500);
  }, [markLoggedIn, recordResult, stopPolling, updateSession]);

  // Resume polling if page refreshed during active QR login
  useEffect(() => {
    if (
      session.loginId &&
      session.loginStatus === 'waiting_for_qr' &&
      !loginPolling &&
      session.loginService
    ) {
      startPolling(session.loginId, session.profileName, session.loginService);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.loginId, session.loginStatus, loginPolling, session.loginService]);

  const runTool = async (toolName: string, args: Record<string, any>) => {
    const start = Date.now();
    const raw = await callTool(toolName, args);
    const parsed = parseMcpResult(raw);
    recordResult(toolName, args, parsed, Date.now() - start);
    applyResultSideEffects(toolName, parsed);
    return parsed;
  };

  const handleRun = async () => {
    const args = buildArgs(selectedTool, fieldValues, session.profileName);

    if (HEADLESS_BROWSER_TOOLS.has(selectedTool.name) && !session.kakaoLoggedIn) {
      recordResult(
        selectedTool.name,
        args,
        null,
        0,
        'Log in with QR first (Login tab → Show QR code). Headless list/create tools cannot display QR — EGDesk would wait silently otherwise.',
      );
      return;
    }

    setRunning(true);
    startRunningTimer(selectedTool.name);

    try {
      if (HEADLESS_BROWSER_TOOLS.has(selectedTool.name)) {
        await releaseLoginBrowser();
      }

      const parsed = await runTool(selectedTool.name, args);

      if (selectedTool.name === 'kakao_begin_login') {
        const service = (args.service as 'chatbot' | 'business') || 'chatbot';
        updateSession({
          loginId: parsed.loginId || null,
          loginService: service,
          loginStatus: parsed.status || null,
        });

        if (parsed.qrImageDataUrl) setQrImage(parsed.qrImageDataUrl);

        if (parsed.status === 'logged_in') {
          markLoggedIn();
          await releaseLoginBrowser();
        } else if (parsed.loginId && parsed.status === 'waiting_for_qr') {
          startPolling(parsed.loginId, session.profileName, service);
        }
      } else if (parsed.success !== false) {
        // list/create tools also confirm an active session when they succeed
        markLoggedIn();
      }
    } catch (err: any) {
      recordResult(selectedTool.name, args, null, 0, err.message || String(err));
    } finally {
      setRunning(false);
      stopRunningTimer();
    }
  };

  const handleCloseLogin = async () => {
    if (!session.loginId) return;
    stopPolling();
    try {
      await callTool('kakao_close_login', {
        profileName: session.profileName,
        loginId: session.loginId,
      });
    } catch { /* best effort */ }
    setQrImage(null);
    updateSession({ loginId: null, loginStatus: null, loginService: null });
  };

  /** Close QR login browser so headless tools can reuse the Chrome profile. */
  const releaseLoginBrowser = useCallback(async () => {
    if (!session.loginId) return;
    stopPolling();
    try {
      await callTool('kakao_close_login', {
        profileName: session.profileName,
        loginId: session.loginId,
      });
    } catch { /* best effort */ }
    setQrImage(null);
    updateSession({ loginId: null, loginStatus: null, loginService: null });
  }, [session.loginId, session.profileName, stopPolling, updateSession]);

  const handleSelectChannel = async (channel: { searchId: string; name?: string }) => {
    setRunning(true);
    const args = {
      profileName: session.profileName,
      channel: { searchId: channel.searchId, name: channel.name },
    };
    try {
      const parsed = await runTool('kakao_select_channel', args);
      if (parsed.success !== false) {
        updateSession({
          selectedChannel: { searchId: channel.searchId, name: channel.name || channel.searchId },
        });
      }
    } catch (err: any) {
      recordResult('kakao_select_channel', args, null, 0, err.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  const setField = (name: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
  };

  const selectTool = (tool: ToolDef) => {
    setSelectedTool(tool);
  };

  return (
    <main style={pageStyle}>
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <a href={landingHref} style={navLinkStyle}>Back to landing</a>
          <a href={dbHref} style={navLinkStyle}>Database demo</a>
          <a href={inventoryHref} style={navLinkStyle}>Inventory MCP</a>
        </div>
        <div style={eyebrowStyle}>EGDesk Kakao MCP</div>
        <h1 style={titleStyle}>Kakao Playground</h1>
        <p style={subtitleStyle}>
          Log in with QR, then manage channels and bots. EGDesk must be running locally with the Kakao MCP server enabled.
        </p>
      </header>

      {/* Session status */}
      <div style={sessionBarStyle}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelStyle}>Chrome profile name</label>
          <input
            type="text"
            value={session.profileName}
            onChange={e => updateSession({ profileName: e.target.value })}
            placeholder="Default"
            style={inputStyle}
          />
          <p style={hintStyle}>Persistent browser profile in EGDesk — sessions are remembered per profile.</p>
        </div>
        <div style={sessionPillsStyle}>
          <span style={{
            ...statusBadgeStyle,
            background: session.kakaoLoggedIn ? '#dcfce7' : '#f3f4f6',
            color: session.kakaoLoggedIn ? '#166534' : '#6b7280',
            borderRadius: 8,
            padding: '6px 10px',
          }}>
            {session.kakaoLoggedIn ? 'Kakao logged in ✓' : 'Kakao not logged in — scan QR or run a list tool'}
          </span>
          {session.selectedChannel && (
            <span style={selectedChannelPillStyle}>
              Channel: <code style={inlineCodeStyle}>{session.selectedChannel.searchId}</code>
            </span>
          )}
        </div>
      </div>

      <div style={layoutStyle}>
        {/* Left: Tool picker + form */}
        <div style={leftColStyle}>
          <div style={panelStyle}>
            {CATEGORIES.map(cat => (
              <div key={cat.key} style={{ marginBottom: 16 }}>
                <div style={categoryLabelStyle}>{cat.label}</div>
                <div style={toolTabGridStyle}>
                  {VISIBLE_TOOLS.filter(t => t.category === cat.key).map(tool => (
                    <button
                      key={tool.name}
                      onClick={() => selectTool(tool)}
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
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : field.type === 'select' ? (
                    <select
                      value={fieldValues[field.name] ?? (field.defaultValue as string) ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      {field.name === 'service' ? (
                        <>
                          <option value="chatbot">Chatbot Admin (chatbot.kakao.com)</option>
                          <option value="business">Business Channels (business.kakao.com)</option>
                        </>
                      ) : (
                        field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))
                      )}
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
                  {field.name === 'service' && (
                    <p style={hintStyle}>
                      {SERVICE_HINTS[fieldValues.service || 'chatbot']}
                    </p>
                  )}
                  {field.name === 'channelSearchId' && session.selectedChannel && (
                    <p style={hintStyle}>
                      Pre-filled from selected channel. List channels first, then pick one in Display.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handleRun}
                disabled={running}
                style={runBtnStyle}
              >
                {running ? `Running… ${runningElapsedSec}s` : selectedTool.name === 'kakao_begin_login' ? 'Show QR code' : 'Run'}
              </button>
            </div>

            {running && runningHint && (
              <div style={runningHintStyle}>
                <strong style={{ display: 'block', marginBottom: 4 }}>In progress ({runningElapsedSec}s)</strong>
                {runningHint}
              </div>
            )}
          </div>

          {/* QR code panel (login flow) */}
          {(qrImage || loginPolling) && (
            <div style={qrPanelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827' }}>
                  Scan QR code
                </h3>
                <button onClick={handleCloseLogin} style={closeBtnStyle}>
                  Cancel
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
                    Open KakaoTalk → More → QR code scanner
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
                  background: session.loginStatus === 'logged_in' ? '#dcfce7' : session.loginStatus === 'failed' || session.loginStatus === 'expired' ? '#fef2f2' : '#fef3c7',
                  color: session.loginStatus === 'logged_in' ? '#166534' : session.loginStatus === 'failed' || session.loginStatus === 'expired' ? '#991b1b' : '#92400e',
                }}>
                  {session.loginStatus || 'starting'}
                </span>
                {loginPolling && <span style={{ color: '#9ca3af', fontSize: 12 }}>checking every 2.5s</span>}
                {session.loginService && (
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    {session.loginService === 'business' ? 'business.kakao.com' : 'chatbot.kakao.com'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Display + raw results */}
        <div style={rightColStyle}>
          {/* Rich display for the selected / latest result */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Display</h2>
            {(() => {
              const displayEntry = history.find(e => e.id === expandedEntry) ?? history[0];
              if (!displayEntry) {
                return (
                  <div style={emptyResultStyle}>
                    Run a tool to see QR codes, tables, and summaries here
                  </div>
                );
              }
              if (displayEntry.error) {
                return (
                  <div style={displayPanelStyle}>
                    <div style={{ ...statusBadgeStyle, background: '#fef2f2', color: '#991b1b', display: 'inline-block' }}>
                      Error
                    </div>
                    <p style={{ color: '#991b1b', fontSize: 14, margin: '10px 0 0' }}>{displayEntry.error}</p>
                  </div>
                );
              }
              return (
                <div style={displayPanelStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <code style={toolBadgeStyle}>{displayEntry.tool}</code>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>{displayEntry.durationMs}ms</span>
                  </div>
                  <DisplayResultView
                    data={displayEntry.result}
                    tool={displayEntry.tool}
                    selectedChannelSearchId={session.selectedChannel?.searchId}
                    onSelectChannel={handleSelectChannel}
                  />
                </div>
              );
            })()}
          </div>

          {/* Raw history */}
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
                      <div style={{ marginBottom: 8 }}>
                        <div style={miniLabelStyle}>Arguments</div>
                        <pre style={resultCodeStyle}>
                          {JSON.stringify(entry.args, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <div style={miniLabelStyle}>{entry.error ? 'Error' : 'Response'}</div>
                        <pre style={{
                          ...resultCodeStyle,
                          ...(entry.error ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } : {}),
                        }}>
                          {entry.error
                            ? entry.error
                            : JSON.stringify(entry.result, stripInternalFields, 2)}
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

// ── Utility ─────────────────────────────────────────────────────────────────

/** Parse EGDesk API + MCP-shaped responses into a plain object */
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

/** JSON.stringify replacer: hide bulky / internal fields in raw output */
function stripInternalFields(key: string, value: any): any {
  if (key === 'qrImageDataUrl' && typeof value === 'string' && value.length > 80) {
    return value.slice(0, 40) + '...[QR truncated]';
  }
  if (key === 'loginId') return '[managed automatically]';
  return value;
}

// ── Display components ──────────────────────────────────────────────────────

type DisplayResultViewProps = {
  data: any;
  tool: string;
  selectedChannelSearchId?: string;
  onSelectChannel?: (channel: { searchId: string; name?: string }) => void;
};

function DisplayResultView({ data, tool, selectedChannelSearchId, onSelectChannel }: DisplayResultViewProps) {
  if (!data || typeof data !== 'object') {
    return <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>{String(data)}</p>;
  }

  if (data.success === false) {
    return <p style={{ color: '#991b1b', fontSize: 14, margin: 0 }}>{data.error || 'Request failed'}</p>;
  }

  const hasQr = typeof data.qrImageDataUrl === 'string' && data.qrImageDataUrl.startsWith('data:');
  const hasLoginFields = data.status && tool.includes('login');
  const channels = Array.isArray(data.channels) ? data.channels : null;
  const bots = Array.isArray(data.bots) ? data.bots : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* QR login */}
      {(hasQr || hasLoginFields) && (
        <div>
          {hasQr && (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.qrImageDataUrl}
                alt="Kakao QR code"
                style={{ width: 220, height: 220, borderRadius: 10, border: '1px solid #e5e7eb' }}
              />
              <p style={{ color: '#6b7280', fontSize: 13, marginTop: 10 }}>
                Scan with KakaoTalk — status updates automatically
              </p>
            </div>
          )}

          <dl style={kvGridStyle}>
            {data.status && (
              <>
                <dt style={kvTermStyle}>Status</dt>
                <dd style={kvDescStyle}>
                  <span style={{
                    ...statusBadgeStyle,
                    background: data.status === 'logged_in' ? '#dcfce7'
                      : data.status === 'failed' || data.status === 'expired' ? '#fef2f2'
                      : '#fef3c7',
                    color: data.status === 'logged_in' ? '#166534'
                      : data.status === 'failed' || data.status === 'expired' ? '#991b1b'
                      : '#92400e',
                  }}>
                    {data.status}
                  </span>
                </dd>
              </>
            )}
            {data.message && <><dt style={kvTermStyle}>Message</dt><dd style={kvDescStyle}>{data.message}</dd></>}
            {data.service && (
              <>
                <dt style={kvTermStyle}>Starting site</dt>
                <dd style={kvDescStyle}>
                  {data.service === 'business' ? 'business.kakao.com' : 'chatbot.kakao.com'}
                  {' '}(same Kakao account)
                </dd>
              </>
            )}
            {data.profileName && <><dt style={kvTermStyle}>Profile</dt><dd style={kvDescStyle}>{data.profileName}</dd></>}
            {data.expiresAt && <><dt style={kvTermStyle}>QR expires</dt><dd style={kvDescStyle}>{formatTimestamp(data.expiresAt)}</dd></>}
          </dl>
        </div>
      )}

      {/* Channels table */}
      {channels && channels.length > 0 && (
        <div>
          <div style={miniLabelStyle}>Channels ({channels.length}) — click Select to use for bot setup</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Search ID</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Bot</th>
                  {onSelectChannel && <th style={thStyle} />}
                </tr>
              </thead>
              <tbody>
                {channels.map((ch: any, i: number) => {
                  const isSelected = selectedChannelSearchId === ch.searchId;
                  return (
                    <tr key={ch.id || ch.searchId || i} style={isSelected ? { background: '#ecfdf5' } : undefined}>
                      <td style={tdStyle}>{ch.name || '—'}</td>
                      <td style={tdStyle}><code style={inlineCodeStyle}>{ch.searchId || '—'}</code></td>
                      <td style={tdStyle}>{ch.status || '—'}</td>
                      <td style={tdStyle}>{ch.connectedBotName || '—'}</td>
                      {onSelectChannel && ch.searchId && (
                        <td style={tdStyle}>
                          <button
                            onClick={() => onSelectChannel({ searchId: ch.searchId, name: ch.name })}
                            style={{
                              ...secondaryBtnStyle,
                              fontSize: 12,
                              padding: '3px 8px',
                              ...(isSelected ? { background: '#047857', color: '#fff', border: '1px solid #047857' } : {}),
                            }}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {channels && channels.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>No channels found for this profile.</p>
      )}

      {/* Bots table */}
      {bots && bots.length > 0 && (
        <div>
          <div style={miniLabelStyle}>Bots ({bots.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Callback</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((bot: any, i: number) => (
                  <tr key={bot.id || i}>
                    <td style={tdStyle}>{bot.name || '—'}</td>
                    <td style={tdStyle}><code style={inlineCodeStyle}>{bot.id || '—'}</code></td>
                    <td style={tdStyle}>{bot.status || (bot.isInactive ? 'inactive' : '—')}</td>
                    <td style={tdStyle}>{bot.callbackStatus?.callbackApproved != null
                      ? (bot.callbackStatus.callbackApproved ? 'approved' : 'pending')
                      : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Simple success / message-only results */}
      {!hasQr && !channels?.length && !bots?.length && data.message && (
        <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{data.message}</p>
      )}

      {/* Fallback key-value for other structured fields */}
      {!hasQr && !channels?.length && !bots?.length && !hasLoginFields && (
        <KeyValueFallback data={data} />
      )}
    </div>
  );
}

function KeyValueFallback({ data }: { data: Record<string, any> }) {
  const skip = new Set(['qrImageDataUrl', 'success', 'loginId']);
  const entries = Object.entries(data).filter(([k, v]) => !skip.has(k) && v != null && typeof v !== 'object');

  if (entries.length === 0) {
    return <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No visual display for this result — see raw JSON below.</p>;
  }

  return (
    <dl style={kvGridStyle}>
      {entries.map(([key, value]) => (
        <span key={key} style={{ display: 'contents' }}>
          <dt style={kvTermStyle}>{key}</dt>
          <dd style={kvDescStyle}>{String(value)}</dd>
        </span>
      ))}
    </dl>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
  border: '1px solid #047857',
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

const selectedChannelPillStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 8,
  padding: '6px 10px',
};

const runningHintStyle: React.CSSProperties = {
  marginTop: 14,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  padding: 12,
  fontSize: 13,
  color: '#1e40af',
  lineHeight: 1.5,
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

const displayPanelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const kvGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: '6px 12px',
  margin: 0,
};

const kvTermStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  margin: 0,
};

const kvDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#111827',
  margin: 0,
};

const inlineCodeStyle: React.CSSProperties = {
  fontSize: 12,
  background: '#f3f4f6',
  padding: '1px 5px',
  borderRadius: 4,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 700,
  color: '#374151',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #f3f4f6',
  color: '#111827',
};
