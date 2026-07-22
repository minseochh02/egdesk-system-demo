'use client';

import { useCallback, useMemo, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

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
      'Create local Drive tables, set start page token, and set folders to monitor. Optionally snapshot existing files. Auth: GOOGLE_SERVICE_ACCOUNT_JSON or Google Workspace sign-in in EGDesk.',
    category: 'setup',
    helperName: 'initDriveSync',
    fields: [
      {
        name: 'snapshot',
        label: 'Snapshot existing files',
        type: 'boolean',
        defaultValue: true,
        hint: 'Log/download files already in the folders. Set false for forward-only change cursor.',
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
    name: 'drive_watch',
    title: 'Start watch',
    description:
      'Register drive.changes.watch. Google will POST to {webhookBaseUrl}/drive/webhook. Requires a public tunnel URL and prior Init.',
    category: 'watch',
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
    title: 'Stop watch',
    description: 'Stop the active watch channel and clear channel fields.',
    category: 'watch',
    helperName: 'stopDriveWatch',
    fields: [],
  },
  {
    name: 'drive_poll',
    title: 'Poll once',
    description:
      'One-shot changes.list from the stored page token. Use for local monitoring without a tunnel.',
    category: 'sync',
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
    description: 'Sync state, watch channel expiry, mode, and event counts.',
    category: 'browse',
    helperName: 'getDriveStatus',
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
    name: 'drive_set_target_folders',
    title: 'Set folders',
    description: 'Replace monitored folder IDs without resetting the page token.',
    category: 'setup',
    helperName: 'setDriveTargetFolders',
    fields: [],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'watch', label: 'Watch' },
  { key: 'sync', label: 'Sync' },
  { key: 'browse', label: 'Browse' },
];

const RUNNING_HINTS: Record<string, string> = {
  drive_init: 'Fetching start page token and optionally snapshotting folders…',
  drive_watch: 'Registering Google Drive watch channel…',
  drive_poll: 'Listing and processing Drive changes…',
  drive_list_events: 'Loading file events…',
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
  const [channelStatus, setChannelStatus] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (Array.isArray(parsed?.targetFolderIds) && parsed.targetFolderIds.length) {
      setFolderIds(parsed.targetFolderIds.map(String));
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
  }, []);

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

    if (data?.sync || data?.channel || data?.events) {
      return (
        <dl style={kvGridStyle}>
          {data.status && (
            <>
              <dt style={kvTermStyle}>Status</dt>
              <dd style={kvDescStyle}>{data.status}</dd>
            </>
          )}
          {data.sync?.mode && (
            <>
              <dt style={kvTermStyle}>Mode</dt>
              <dd style={kvDescStyle}>{data.sync.mode}</dd>
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
          {Array.isArray(data.sync?.targetFolderIds) && (
            <>
              <dt style={kvTermStyle}>Folders</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>
                  {JSON.stringify(data.sync.targetFolderIds)}
                </code>
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

    if (data?.webhookUrl || data?.channelId || data?.status === 'initialized') {
      return (
        <dl style={kvGridStyle}>
          {data.status && (
            <>
              <dt style={kvTermStyle}>Status</dt>
              <dd style={kvDescStyle}>{data.status}</dd>
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

  const sessionFolders = useMemo(() => folderIds, [folderIds]);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={playgroundStyles.miniLabelStyle}>Target folders</div>
        {sessionFolders.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {sessionFolders.map((id) => (
              <code key={id} style={{ ...playgroundStyles.inlineCodeStyle, fontSize: 12 }}>
                {id}
              </code>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
            Paste a Drive folder URL on Init / Set folders
          </p>
        )}
      </div>
      <div>
        <div style={playgroundStyles.miniLabelStyle}>Channel</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {channelStatus || '—'}
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/drive-mcp"
      eyebrow="EGDesk Drive MCP"
      title="Drive Playground"
      subtitle="Watch or poll Google Drive folder changes. Prefer Poll for local; Watch needs a public tunnel to /drive/webhook."
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
