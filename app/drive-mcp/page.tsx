'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

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
        name: 'folderIds',
        label: 'Folder IDs (JSON array)',
        type: 'json',
        required: true,
        placeholder: '["1AbC…folderId"]',
        hint: 'From the Drive folder URL: …/folders/{FOLDER_ID}. Share folders with the service account if using SA credentials.',
      },
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
    fields: [
      {
        name: 'folderIds',
        label: 'Folder IDs (JSON array)',
        type: 'json',
        required: true,
        placeholder: '["1AbC…folderId"]',
      },
    ],
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

export default function DrivePlayground() {
  const [folderIdsHint, setFolderIdsHint] = useState<string | null>(null);
  const [channelStatus, setChannelStatus] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (Array.isArray(parsed?.targetFolderIds) && parsed.targetFolderIds.length) {
      setFolderIdsHint(JSON.stringify(parsed.targetFolderIds));
    }
    if (parsed?.sync?.targetFolderIds?.length) {
      setFolderIdsHint(JSON.stringify(parsed.sync.targetFolderIds));
    }
    if (parsed?.channel?.status) {
      setChannelStatus(String(parsed.channel.status));
    }
    if (parsed?.status === 'watching' || parsed?.status === 'stopped') {
      setChannelStatus(parsed.status === 'watching' ? 'active' : 'none');
    }
  }, []);

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      if (!folderIdsHint) return {};
      if (tool.fields.some((f) => f.name === 'folderIds')) {
        return { folderIds: folderIdsHint };
      }
      return {};
    },
    [folderIdsHint]
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

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Target folders</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {folderIdsHint ? (
            <code style={playgroundStyles.inlineCodeStyle}>{folderIdsHint}</code>
          ) : (
            'Run Init or Status first'
          )}
        </p>
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
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
