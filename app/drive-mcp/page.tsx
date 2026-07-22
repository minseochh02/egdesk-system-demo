'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';
import { apiFetch } from '@/lib/api';
import { parseMcpResult } from '@/lib/mcp-utils';

const FOLDER_TOOLS = new Set(['drive_init', 'drive_set_target_folders']);

/**
 * Extract a Drive folder ID from a URL or bare id.
 * Supports:
 * - https://drive.google.com/drive/folders/ID
 * - https://drive.google.com/drive/u/0/folders/ID?...
 * - https://drive.google.com/open?id=ID
 * - bare folder id
 */
export function extractDriveFolderId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const foldersMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch?.[1]) return foldersMatch[1];

  try {
    const url = new URL(raw);
    const idParam = url.searchParams.get('id');
    if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam;
  } catch {
    // not a URL
  }

  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw)) return raw;

  return null;
}

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'drive_init',
    title: 'Init sync',
    description:
      'Save folders to watch (local drive.db) and set the change cursor. After this, use the Live feed → Start listening.',
    category: 'setup',
    helperName: 'initDriveSync',
    fields: [
      {
        name: 'snapshot',
        label: 'Snapshot existing files',
        type: 'boolean',
        defaultValue: false,
        hint: 'Usually leave off for a live demo so only new uploads show up as events.',
      },
      {
        name: 'downloadPath',
        label: 'Download path (optional)',
        type: 'string',
        placeholder: '/path/to/drive-downloads',
      },
      {
        name: 'reset',
        label: 'Reset existing state',
        type: 'boolean',
        defaultValue: false,
        hint: 'Reinitialize even if sync state already exists.',
      },
    ],
  },
  {
    name: 'drive_set_target_folders',
    title: 'Set folders',
    description: 'Replace monitored folder IDs without resetting the page token.',
    category: 'setup',
    helperName: 'setDriveTargetFolders',
    fields: [],
  },
  {
    name: 'drive_start_poll_loop',
    title: 'Keep watching',
    description:
      'Start continuous Drive polling (saved + auto-resumes). Prefer the Live feed Start listening button above for the demo.',
    category: 'live',
    helperName: 'startDrivePollLoop',
    fields: [
      {
        name: 'intervalSeconds',
        label: 'Interval (seconds)',
        type: 'number',
        defaultValue: 15,
        hint: 'Minimum 15. Use 15 for demos so uploads show up quickly.',
      },
      {
        name: 'download',
        label: 'Download matching files',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'drive_stop_poll_loop',
    title: 'Stop watching',
    description: 'Stop the continuous poll loop. Folder IDs and page token remain saved.',
    category: 'live',
    helperName: 'stopDrivePollLoop',
    fields: [],
  },
  {
    name: 'drive_poll',
    title: 'Poll once',
    description: 'One-shot changes.list. The Live feed also polls while listening.',
    category: 'live',
    helperName: 'pollDriveChanges',
    fields: [
      {
        name: 'download',
        label: 'Download matching files',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'drive_status',
    title: 'Status',
    description: 'Sync state, watched folders (with names), poll loop, and event counts.',
    category: 'browse',
    helperName: 'getDriveStatus',
    fields: [],
  },
  {
    name: 'drive_list_watched_folders',
    title: 'List watched folders',
    description: 'Show every folder currently configured for watching, with Drive names and URLs.',
    category: 'browse',
    helperName: 'listDriveWatchedFolders',
    fields: [],
  },
  {
    name: 'drive_list_events',
    title: 'List events',
    description: 'Recent drive_file_events from the local Drive DB.',
    category: 'browse',
    helperName: 'listDriveEvents',
    fields: [
      {
        name: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 50,
      },
      {
        name: 'downloadedOnly',
        label: 'Downloaded only',
        type: 'boolean',
        defaultValue: false,
      },
      {
        name: 'since',
        label: 'Since (ISO)',
        type: 'string',
        placeholder: '2026-07-01T00:00:00.000Z',
      },
    ],
  },
  {
    name: 'drive_watch',
    title: 'Start webhook',
    description:
      'Advanced: drive.changes.watch via public tunnel. For local demos, use Live → Start listening instead.',
    category: 'advanced',
    helperName: 'watchDriveChanges',
    fields: [
      {
        name: 'webhookBaseUrl',
        label: 'Webhook base URL',
        type: 'string',
        required: true,
        placeholder: 'https://your-tunnel.example',
        hint: 'EGDesk tunnel / ngrok / Cloudflare public base (no /drive path).',
      },
      {
        name: 'ttlSeconds',
        label: 'TTL seconds (optional)',
        type: 'number',
        placeholder: '86400',
        hint: 'Google max ~7 days. Omit for Google default.',
      },
    ],
  },
  {
    name: 'drive_stop',
    title: 'Stop webhook',
    description: 'Stop the active Drive watch channel and clear channel fields.',
    category: 'advanced',
    helperName: 'stopDriveWatch',
    fields: [],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'live', label: 'Live' },
  { key: 'browse', label: 'Browse' },
  { key: 'advanced', label: 'Advanced' },
];

const RUNNING_HINTS: Record<string, string> = {
  drive_init: 'Saving folders and change cursor…',
  drive_watch: 'Registering Google Drive watch channel…',
  drive_poll: 'Listing and processing Drive changes…',
  drive_start_poll_loop: 'Starting continuous poll loop…',
  drive_list_events: 'Loading file events…',
  drive_list_watched_folders: 'Resolving folder names…',
};

type WatchedFolder = {
  id: string;
  name?: string | null;
  url?: string;
  error?: string | null;
};

type DriveEvent = {
  id?: number;
  file_id?: string;
  file_name?: string;
  event_type?: string;
  mime_type?: string;
  downloaded?: number;
  detected_at?: string;
  download_path?: string | null;
};

const pickerLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

const pickerInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  color: '#111827',
  background: '#fff',
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 999,
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  color: '#065f46',
  fontSize: 12,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};

function DriveFolderPicker({
  folderIds,
  onChange,
}: {
  folderIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addFolder = useCallback(() => {
    const id = extractDriveFolderId(draft);
    if (!id) {
      setError('Paste a Drive folder URL or folder ID (…/folders/ID).');
      return;
    }
    if (folderIds.includes(id)) {
      setError('That folder is already added.');
      return;
    }
    onChange([...folderIds, id]);
    setDraft('');
    setError(null);
  }, [draft, folderIds, onChange]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    addFolder();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addFolder();
    }
  };

  return (
    <div style={{ marginBottom: 4 }}>
      <label style={pickerLabelStyle}>
        Drive folders <span style={{ color: '#dc2626' }}>*</span>
      </label>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          placeholder="Paste folder URL — https://drive.google.com/drive/folders/…"
          style={pickerInputStyle}
          autoComplete="off"
        />
        <button
          type="submit"
          style={{
            ...playgroundStyles.secondaryBtnStyle,
            flexShrink: 0,
            background: '#0f766e',
            color: '#fff',
            borderColor: '#0f766e',
          }}
        >
          Add
        </button>
      </form>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px', lineHeight: 1.45 }}>
        Paste a Google Drive folder link or bare folder ID, then Add. You can monitor multiple folders.
      </p>
      {error && (
        <p style={{ fontSize: 12, color: '#dc2626', margin: '0 0 8px' }}>{error}</p>
      )}
      {folderIds.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {folderIds.map((id) => (
            <span key={id} style={chipStyle}>
              {id}
              <button
                type="button"
                onClick={() => onChange(folderIds.filter((x) => x !== id))}
                aria-label={`Remove folder ${id}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#047857',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No folders added yet.</p>
      )}
    </div>
  );
}

export default function DrivePlayground() {
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [watchedFolders, setWatchedFolders] = useState<WatchedFolder[]>([]);
  const [channelStatus, setChannelStatus] = useState<string | null>(null);
  const [pollLoopLabel, setPollLoopLabel] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [liveEvents, setLiveEvents] = useState<DriveEvent[]>([]);
  const [newEventKeys, setNewEventKeys] = useState<Set<string>>(new Set());
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [lastTickAt, setLastTickAt] = useState<string | null>(null);
  const knownEventKeys = useRef<Set<string>>(new Set());
  const listeningRef = useRef(false);

  const callDriveTool = useCallback(async (tool: string, args: Record<string, any> = {}) => {
    const res = await apiFetch('/api/drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args }),
    });
    const raw = await res.json();
    return parseMcpResult(raw);
  }, []);

  const applyWatchedFolders = useCallback((folders: WatchedFolder[]) => {
    setWatchedFolders(folders);
    setFolderIds(folders.map((f) => f.id).filter(Boolean));
  }, []);

  const eventKey = (event: DriveEvent) =>
    `${event.id ?? ''}:${event.file_id ?? ''}:${event.detected_at ?? ''}:${event.event_type ?? ''}`;

  const ingestEvents = useCallback((events: DriveEvent[], markNew: boolean) => {
    const nextKeys = new Set<string>();
    const freshlySeen: string[] = [];
    for (const event of events) {
      const key = eventKey(event);
      nextKeys.add(key);
      if (markNew && !knownEventKeys.current.has(key)) {
        freshlySeen.push(key);
      }
    }
    knownEventKeys.current = nextKeys;
    setLiveEvents(events);
    if (freshlySeen.length > 0) {
      setNewEventKeys(new Set(freshlySeen));
      window.setTimeout(() => {
        setNewEventKeys((prev) => {
          const copy = new Set(prev);
          for (const key of freshlySeen) copy.delete(key);
          return copy;
        });
      }, 4000);
    }
  }, []);

  const refreshLiveFeed = useCallback(async (opts?: { pollFirst?: boolean }) => {
    try {
      if (opts?.pollFirst) {
        await callDriveTool('drive_poll', { download: true });
      }
      const events = await callDriveTool('drive_list_events', { limit: 30 });
      const list = Array.isArray(events) ? events : [];
      ingestEvents(list, true);
      setLastTickAt(new Date().toLocaleTimeString());
      setLiveError(null);
    } catch (err: any) {
      setLiveError(err?.message || String(err));
    }
  }, [callDriveTool, ingestEvents]);

  const startListening = useCallback(async () => {
    setLiveBusy(true);
    setLiveError(null);
    try {
      const started = await callDriveTool('drive_start_poll_loop', {
        intervalSeconds: 15,
        download: true,
      });
      setListening(true);
      listeningRef.current = true;
      setPollLoopLabel(`every ${started?.intervalSeconds ?? 15}s`);
      if (Array.isArray(started?.targetFolderIds)) {
        setFolderIds(started.targetFolderIds.map(String));
      }
      // Seed feed without marking everything as "new"
      const events = await callDriveTool('drive_list_events', { limit: 30 });
      const list = Array.isArray(events) ? events : [];
      knownEventKeys.current = new Set(list.map(eventKey));
      setLiveEvents(list);
      setNewEventKeys(new Set());
      setLastTickAt(new Date().toLocaleTimeString());
      // Also resolve folder names
      try {
        const foldersResult = await callDriveTool('drive_list_watched_folders', {});
        if (Array.isArray(foldersResult?.folders)) {
          applyWatchedFolders(foldersResult.folders);
        }
      } catch {
        // optional
      }
    } catch (err: any) {
      setLiveError(err?.message || String(err));
      setListening(false);
      listeningRef.current = false;
    } finally {
      setLiveBusy(false);
    }
  }, [applyWatchedFolders, callDriveTool]);

  const stopListening = useCallback(async () => {
    setLiveBusy(true);
    setLiveError(null);
    try {
      await callDriveTool('drive_stop_poll_loop', {});
      setListening(false);
      listeningRef.current = false;
      setPollLoopLabel('off');
    } catch (err: any) {
      setLiveError(err?.message || String(err));
    } finally {
      setLiveBusy(false);
    }
  }, [callDriveTool]);

  // While listening: refresh UI from drive.db every 4s (backend poll loop does Drive API)
  useEffect(() => {
    if (!listening) return;
    const id = window.setInterval(() => {
      if (!listeningRef.current) return;
      void refreshLiveFeed({ pollFirst: false });
    }, 4000);
    return () => window.clearInterval(id);
  }, [listening, refreshLiveFeed]);

  // On mount: restore status + folders + events
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await callDriveTool('drive_status', {});
        if (cancelled) return;
        if (Array.isArray(status?.sync?.watchedFolders)) {
          applyWatchedFolders(status.sync.watchedFolders);
        } else if (Array.isArray(status?.sync?.targetFolderIds)) {
          setFolderIds(status.sync.targetFolderIds.map(String));
        }
        if (status?.channel?.status) setChannelStatus(String(status.channel.status));
        if (status?.pollLoop?.running) {
          setListening(true);
          listeningRef.current = true;
          setPollLoopLabel(`every ${status.pollLoop.intervalSec ?? '?'}s`);
        } else if (status?.pollLoop) {
          setPollLoopLabel('off');
        }
        const events = await callDriveTool('drive_list_events', { limit: 30 });
        if (cancelled) return;
        const list = Array.isArray(events) ? events : [];
        knownEventKeys.current = new Set(list.map(eventKey));
        setLiveEvents(list);
      } catch {
        // EGDesk may not be running yet
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyWatchedFolders, callDriveTool]);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (Array.isArray(parsed?.folders) && parsed.folders[0]?.id) {
      applyWatchedFolders(parsed.folders);
    }
    if (Array.isArray(parsed?.sync?.watchedFolders) && parsed.sync.watchedFolders.length) {
      applyWatchedFolders(parsed.sync.watchedFolders);
    }
    if (Array.isArray(parsed?.targetFolderIds) && parsed.targetFolderIds.length) {
      setFolderIds(parsed.targetFolderIds.map(String));
      setWatchedFolders((prev) => {
        const byId = new Map(prev.map((f) => [f.id, f]));
        return parsed.targetFolderIds.map((id: string) =>
          byId.get(id) || {
            id: String(id),
            name: null,
            url: `https://drive.google.com/drive/folders/${id}`,
          }
        );
      });
    }
    if (Array.isArray(parsed?.sync?.targetFolderIds) && parsed.sync.targetFolderIds.length) {
      setFolderIds(parsed.sync.targetFolderIds.map(String));
    }
    if (parsed?.channel?.status) {
      setChannelStatus(String(parsed.channel.status));
    }
    if (parsed?.status === 'watching' || parsed?.status === 'stopped') {
      setChannelStatus(parsed.status === 'watching' ? 'active' : 'none');
    }
    if (parsed?.pollLoop) {
      const running = Boolean(parsed.pollLoop.running);
      setListening(running);
      listeningRef.current = running;
      setPollLoopLabel(
        running ? `every ${parsed.pollLoop.intervalSec ?? '?'}s` : 'off'
      );
    }
    if (parsed?.status === 'polling') {
      setListening(true);
      listeningRef.current = true;
      setPollLoopLabel(`every ${parsed.intervalSeconds ?? '?'}s`);
    }
    if (tool === 'drive_stop_poll_loop' && parsed?.status === 'stopped') {
      setListening(false);
      listeningRef.current = false;
      setPollLoopLabel('off');
    }
    if (tool === 'drive_init' && parsed?.status === 'initialized') {
      // After init, nudge user toward live listening (don't auto-start — OAuth may need attention)
      setPollLoopLabel((prev) => prev || 'ready — click Start listening');
    }
    if (Array.isArray(parsed) && parsed[0]?.file_id) {
      ingestEvents(parsed, true);
    }
  }, [applyWatchedFolders, ingestEvents]);

  const validateBeforeRun = useCallback(
    (tool: PlaygroundToolDef) => {
      if (FOLDER_TOOLS.has(tool.name) && folderIds.length === 0) {
        return 'Add at least one Drive folder (paste a folder URL and click Add).';
      }
      return null;
    },
    [folderIds]
  );

  const postProcessArgs = useCallback(
    (args: Record<string, any>, context: { tool: PlaygroundToolDef }) => {
      if (!FOLDER_TOOLS.has(context.tool.name)) return args;
      return { ...args, folderIds };
    },
    [folderIds]
  );

  const renderFormExtras = useCallback(
    (context: { tool: PlaygroundToolDef }) => {
      if (!FOLDER_TOOLS.has(context.tool.name)) return null;
      return <DriveFolderPicker folderIds={folderIds} onChange={setFolderIds} />;
    },
    [folderIds]
  );

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

    if (data?.sync || data?.channel || data?.events || Array.isArray(data?.folders)) {
      const folders: WatchedFolder[] = Array.isArray(data?.folders)
        ? data.folders
        : Array.isArray(data?.sync?.watchedFolders)
          ? data.sync.watchedFolders
          : [];

      return (
        <div style={{ display: 'grid', gap: 16 }}>
          {folders.length > 0 && (
            <div>
              <div style={miniLabelStyle}>Watched folders ({folders.length})</div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Folder ID</th>
                      <th style={thStyle}>Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folders.map((folder) => (
                      <tr key={folder.id}>
                        <td style={tdStyle}>
                          {folder.name || (
                            <span style={{ color: '#9ca3af' }}>{folder.error || 'Unknown'}</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <code style={inlineCodeStyle}>{folder.id}</code>
                        </td>
                        <td style={tdStyle}>
                          {folder.url && (
                            <a
                              href={folder.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#0f766e', fontSize: 13 }}
                            >
                              Drive ↗
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <dl style={kvGridStyle}>
          {data.status && (
            <>
              <dt style={kvTermStyle}>Status</dt>
              <dd style={kvDescStyle}>{data.status}</dd>
            </>
          )}
          {data.message && !data.sync && (
            <>
              <dt style={kvTermStyle}>Message</dt>
              <dd style={kvDescStyle}>{data.message}</dd>
            </>
          )}
          {data.sync?.mode && (
            <>
              <dt style={kvTermStyle}>Mode</dt>
              <dd style={kvDescStyle}>{data.sync.mode}</dd>
            </>
          )}
          {data.sync?.dbPath && (
            <>
              <dt style={kvTermStyle}>Saved DB</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>{data.sync.dbPath}</code>
              </dd>
            </>
          )}
          {data.pollLoop && (
            <>
              <dt style={kvTermStyle}>Poll loop</dt>
              <dd style={kvDescStyle}>
                {data.pollLoop.running
                  ? `running · every ${data.pollLoop.intervalSec ?? '?'}s`
                  : 'off'}
                {data.pollLoop.lastPollAt ? ` · last ${data.pollLoop.lastPollAt}` : ''}
                {data.pollLoop.lastError ? ` · error: ${data.pollLoop.lastError}` : ''}
              </dd>
            </>
          )}
          {data.channel?.status && (
            <>
              <dt style={kvTermStyle}>Channel</dt>
              <dd style={kvDescStyle}>
                {data.channel.status}
                {data.channel.expiresIn ? ` · ${data.channel.expiresIn}` : ''}
              </dd>
            </>
          )}
          {data.events && (
            <>
              <dt style={kvTermStyle}>Events</dt>
              <dd style={kvDescStyle}>
                total {data.events.total ?? 0} · 24h {data.events.last24Hours ?? 0} ·
                downloaded {data.events.downloaded ?? 0}
              </dd>
            </>
          )}
          {data.sync?.webhookUrl && (
            <>
              <dt style={kvTermStyle}>Webhook</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>{data.sync.webhookUrl}</code>
              </dd>
            </>
          )}
          {Array.isArray(data.recommendations) && data.recommendations.length > 0 && (
            <>
              <dt style={kvTermStyle}>Tips</dt>
              <dd style={kvDescStyle}>{data.recommendations.join(' ')}</dd>
            </>
          )}
        </dl>
        </div>
      );
    }

    const events: DriveEvent[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.events)
        ? data.events
        : [];

    if (events.length > 0 && events[0]?.file_id) {
      return (
        <div>
          <div style={miniLabelStyle}>Events ({events.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Downloaded</th>
                  <th style={thStyle}>Detected</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, i) => (
                  <tr key={event.id ?? event.file_id ?? i}>
                    <td style={tdStyle}>
                      {event.file_name || '—'}
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        <code style={inlineCodeStyle}>{event.file_id}</code>
                      </div>
                    </td>
                    <td style={tdStyle}>{event.event_type || '—'}</td>
                    <td style={tdStyle}>{event.downloaded ? 'yes' : 'no'}</td>
                    <td style={tdStyle}>{event.detected_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (data?.webhookUrl || data?.channelId || data?.status === 'initialized' || data?.status === 'polling') {
      return (
        <dl style={kvGridStyle}>
          {data.status && (
            <>
              <dt style={kvTermStyle}>Status</dt>
              <dd style={kvDescStyle}>{data.status}</dd>
            </>
          )}
          {data.savedTo && (
            <>
              <dt style={kvTermStyle}>Saved to</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>{data.savedTo}</code>
              </dd>
            </>
          )}
          {typeof data.intervalSeconds === 'number' && (
            <>
              <dt style={kvTermStyle}>Interval</dt>
              <dd style={kvDescStyle}>{data.intervalSeconds}s</dd>
            </>
          )}
          {data.channelId && (
            <>
              <dt style={kvTermStyle}>Channel</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>{data.channelId}</code>
              </dd>
            </>
          )}
          {data.webhookUrl && (
            <>
              <dt style={kvTermStyle}>Webhook</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>{data.webhookUrl}</code>
              </dd>
            </>
          )}
          {data.expiration && (
            <>
              <dt style={kvTermStyle}>Expires</dt>
              <dd style={kvDescStyle}>
                {data.expiration}
                {data.expiresIn ? ` (${data.expiresIn})` : ''}
              </dd>
            </>
          )}
          {typeof data.changesProcessed === 'number' && (
            <>
              <dt style={kvTermStyle}>Processed</dt>
              <dd style={kvDescStyle}>
                {data.changesProcessed} changes · {data.filesLogged ?? 0} logged ·{' '}
                {data.filesDownloaded ?? 0} downloaded
              </dd>
            </>
          )}
          {data.message && (
            <>
              <dt style={kvTermStyle}>Message</dt>
              <dd style={kvDescStyle}>{data.message}</dd>
            </>
          )}
        </dl>
      );
    }

    return null;
  }, []);

  const canListen = folderIds.length > 0 || watchedFolders.length > 0;

  const sessionBar = (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          ...playgroundStyles.sessionBarStyle,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 14,
          borderColor: listening ? '#99f6e4' : '#e5e7eb',
          background: listening ? '#f0fdfa' : '#f9fafb',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={playgroundStyles.miniLabelStyle}>Live feed</div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: listening ? '#10b981' : '#9ca3af',
                  boxShadow: listening ? '0 0 0 4px rgba(16,185,129,0.2)' : 'none',
                  display: 'inline-block',
                }}
              />
              {listening ? `Listening ${pollLoopLabel || ''}` : 'Not listening'}
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0', lineHeight: 1.45 }}>
              {listening
                ? 'Upload a file into a watched Drive folder — new events appear below within ~15s.'
                : '1) Init sync with a folder  2) Start listening  3) Upload a file in Drive'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!listening ? (
              <button
                type="button"
                onClick={() => void startListening()}
                disabled={liveBusy || !canListen}
                style={{
                  ...playgroundStyles.secondaryBtnStyle,
                  background: canListen ? '#0f766e' : '#9ca3af',
                  color: '#fff',
                  borderColor: canListen ? '#0f766e' : '#9ca3af',
                  opacity: liveBusy ? 0.7 : 1,
                }}
                title={canListen ? 'Start poll loop + live event feed' : 'Init a folder first'}
              >
                {liveBusy ? 'Starting…' : 'Start listening'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopListening()}
                disabled={liveBusy}
                style={{ ...playgroundStyles.secondaryBtnStyle, opacity: liveBusy ? 0.7 : 1 }}
              >
                {liveBusy ? 'Stopping…' : 'Stop listening'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void refreshLiveFeed({ pollFirst: true })}
              disabled={liveBusy}
              style={playgroundStyles.secondaryBtnStyle}
            >
              Check now
            </button>
          </div>
        </div>

        {liveError && (
          <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{liveError}</p>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
          <span>Last refresh: {lastTickAt || '—'}</span>
          <span>Webhook channel: {channelStatus || '—'}</span>
          <span>Events: {liveEvents.length}</span>
        </div>

        <div>
          <div style={playgroundStyles.miniLabelStyle}>
            Watched folders ({watchedFolders.length || folderIds.length})
          </div>
          {(watchedFolders.length > 0 || folderIds.length > 0) ? (
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {(watchedFolders.length > 0
                ? watchedFolders
                : folderIds.map((id) => ({
                    id,
                    name: null as string | null,
                    url: `https://drive.google.com/drive/folders/${id}`,
                  }))
              ).map((folder) => (
                <div
                  key={folder.id}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}
                >
                  <strong style={{ color: '#111827' }}>{folder.name || 'Folder'}</strong>
                  <code style={{ ...playgroundStyles.inlineCodeStyle, fontSize: 11 }}>{folder.id}</code>
                  {folder.url && (
                    <a href={folder.url} target="_blank" rel="noreferrer" style={{ color: '#0f766e' }}>
                      Open in Drive ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: '#6b7280', margin: '6px 0 0' }}>
              Add a folder under Setup → Init sync first.
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Incoming file events</h3>
          {listening && (
            <span style={{ fontSize: 12, color: '#0f766e', fontWeight: 600 }}>live</span>
          )}
        </div>
        {liveEvents.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
            No events yet. After Start listening, upload any file into the watched Drive folder and watch it show up here.
          </p>
        ) : (
          <div style={playgroundStyles.tableWrapStyle}>
            <table style={playgroundStyles.tableStyle}>
              <thead>
                <tr>
                  <th style={playgroundStyles.thStyle}>When</th>
                  <th style={playgroundStyles.thStyle}>File</th>
                  <th style={playgroundStyles.thStyle}>Type</th>
                  <th style={playgroundStyles.thStyle}>Downloaded</th>
                </tr>
              </thead>
              <tbody>
                {liveEvents.map((event) => {
                  const key = `${event.id ?? ''}:${event.file_id ?? ''}:${event.detected_at ?? ''}:${event.event_type ?? ''}`;
                  const isNew = newEventKeys.has(key);
                  return (
                    <tr
                      key={key}
                      style={isNew ? { background: '#ecfdf5' } : undefined}
                    >
                      <td style={playgroundStyles.tdStyle}>
                        {isNew && (
                          <span style={{ color: '#059669', fontWeight: 700, marginRight: 6 }}>NEW</span>
                        )}
                        {event.detected_at || '—'}
                      </td>
                      <td style={playgroundStyles.tdStyle}>
                        <div>{event.file_name || '—'}</div>
                        <code style={{ ...playgroundStyles.inlineCodeStyle, fontSize: 11 }}>
                          {event.file_id}
                        </code>
                      </td>
                      <td style={playgroundStyles.tdStyle}>{event.event_type || '—'}</td>
                      <td style={playgroundStyles.tdStyle}>{event.downloaded ? 'yes' : 'no'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/drive-mcp"
      eyebrow="EGDesk Drive MCP"
      title="Drive Playground"
      subtitle="Init a folder, Start listening, then upload a file in Google Drive — the live feed below updates as events arrive."
      apiPath="/api/drive"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#0f766e"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      renderFormExtras={renderFormExtras}
      renderFormExtrasPosition="before"
      postProcessArgs={postProcessArgs}
      validateBeforeRun={validateBeforeRun}
    />
  );
}
