'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'youtube_list_connections',
    title: 'List connections',
    description:
      'YouTube accounts saved in EGDesk (Chrome profile or login). Passwords never returned.',
    category: 'setup',
    fields: [],
  },
  {
    name: 'youtube_save_connection',
    title: 'Save connection',
    description:
      'Prefer Chrome user-data dir + executable to avoid CAPTCHA. Username/password also accepted.',
    category: 'setup',
    fields: [
      {
        name: 'name',
        label: 'Display name',
        type: 'string',
        required: true,
        placeholder: 'My YouTube',
      },
      {
        name: 'chromeUserDataDir',
        label: 'Chrome user data dir',
        type: 'string',
        placeholder: '/Users/you/Library/Application Support/Google/Chrome',
        hint: 'Recommended — reuse a logged-in Chrome profile.',
      },
      {
        name: 'chromeExecutablePath',
        label: 'Chrome executable',
        type: 'string',
        placeholder: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      },
      {
        name: 'username',
        label: 'Username (optional if using Chrome profile)',
        type: 'string',
      },
      {
        name: 'password',
        label: 'Password (optional if using Chrome profile)',
        type: 'string',
      },
      {
        name: 'channelId',
        label: 'Channel ID (optional)',
        type: 'string',
      },
    ],
  },
  {
    name: 'youtube_update_connection',
    title: 'Update connection',
    description: 'Patch name, Chrome paths, or credentials.',
    category: 'setup',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      { name: 'name', label: 'Display name', type: 'string' },
      { name: 'chromeUserDataDir', label: 'Chrome user data dir', type: 'string' },
      {
        name: 'chromeExecutablePath',
        label: 'Chrome executable',
        type: 'string',
      },
      { name: 'username', label: 'Username', type: 'string' },
      { name: 'password', label: 'Password', type: 'string' },
      { name: 'channelId', label: 'Channel ID', type: 'string' },
    ],
  },
  {
    name: 'youtube_delete_connection',
    title: 'Delete connection',
    description: 'Remove a YouTube connection by id.',
    category: 'setup',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'youtube_schedule_create',
    title: 'Create Shorts schedule',
    description:
      'Recurring Shorts auto-gen. Use bi_products + biSnapshotId for product grounding and brand face. Set Publish now to run immediately.',
    category: 'schedule',
    fields: [
      {
        name: 'title',
        label: 'Schedule title',
        type: 'string',
        required: true,
        placeholder: 'Daily product Shorts',
      },
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
        placeholder: 'From List connections',
      },
      {
        name: 'topicSource',
        label: 'Topic source',
        type: 'select',
        options: ['bi_products', 'manual'],
        defaultValue: 'bi_products',
      },
      {
        name: 'biSnapshotId',
        label: 'BI snapshot ID',
        type: 'string',
        placeholder: 'Required for bi_products + brand face',
        hint: 'From Brand Face MCP or BI Products MCP',
      },
      {
        name: 'topics',
        label: 'Topics / product names',
        type: 'textarea',
        placeholder:
          'One product name per line (optional for bi_products — uses catalog if empty)',
      },
      {
        name: 'scheduledTime',
        label: 'Time (HH:MM)',
        type: 'string',
        defaultValue: '09:00',
      },
      {
        name: 'frequencyType',
        label: 'Frequency',
        type: 'select',
        options: ['daily', 'weekly', 'monthly', 'custom'],
        defaultValue: 'daily',
      },
      {
        name: 'frequencyValue',
        label: 'Frequency value',
        type: 'number',
        defaultValue: 1,
      },
      {
        name: 'textModel',
        label: 'Script model',
        type: 'string',
        placeholder: 'gemini-3.5-flash',
      },
      {
        name: 'videoModel',
        label: 'Video model',
        type: 'string',
        placeholder: 'veo-3.1-generate-preview',
      },
      {
        name: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'runNow',
        label: 'Publish now (run after create)',
        type: 'boolean',
        defaultValue: false,
        hint: 'Generate script + Veo Shorts + upload in the same call (several minutes).',
      },
    ],
  },
  {
    name: 'youtube_list_schedules',
    title: 'List schedules',
    description: 'YouTube Shorts schedules in EGDesk.',
    category: 'schedule',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID filter (optional)',
        type: 'string',
      },
    ],
  },
  {
    name: 'youtube_schedule_toggle',
    title: 'Toggle schedule',
    description: 'Enable or disable a Shorts schedule.',
    category: 'schedule',
    fields: [
      {
        name: 'scheduleId',
        label: 'Schedule ID',
        type: 'string',
        required: true,
      },
      {
        name: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'youtube_schedule_run_now',
    title: 'Run schedule now',
    description:
      'Full auto path: content + Veo pipeline + YouTube upload. Uses preferred brand face when biSnapshotId is set.',
    category: 'schedule',
    fields: [
      {
        name: 'scheduleId',
        label: 'Schedule ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'youtube_generate_shorts',
    title: 'Generate Shorts (no upload)',
    description:
      'Script + veoScenes only, or set Generate video to render a local mp4 via the Shorts pipeline.',
    category: 'generate',
    fields: [
      {
        name: 'topic',
        label: 'Topic / product name',
        type: 'string',
        required: true,
        placeholder: '실시간 출결 관리',
      },
      {
        name: 'biSnapshotId',
        label: 'BI snapshot ID',
        type: 'string',
        hint: 'Grounds product tone + preferred brand face',
      },
      {
        name: 'language',
        label: 'Language',
        type: 'string',
        defaultValue: 'ko',
      },
      {
        name: 'textModel',
        label: 'Script model',
        type: 'string',
        placeholder: 'gemini-3.5-flash',
      },
      {
        name: 'videoModel',
        label: 'Video model',
        type: 'string',
        placeholder: 'veo-3.1-generate-preview',
      },
      {
        name: 'extraInstructions',
        label: 'Extra instructions',
        type: 'textarea',
      },
      {
        name: 'generateVideo',
        label: 'Generate local video',
        type: 'boolean',
        defaultValue: false,
        hint: 'Runs Veo clip → overlay → outro. Returns finalPath.',
      },
      {
        name: 'skipOutro',
        label: 'Skip brand outro',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    name: 'youtube_debug_post',
    title: 'Debug upload',
    description:
      'Login + upload a local Shorts mp4 (no Gemini). Defaults to ~/Downloads/shorts-test.mp4.',
    category: 'publish',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      {
        name: 'videoPath',
        label: 'Video path (absolute)',
        type: 'string',
        placeholder: '/Users/you/Downloads/shorts-test.mp4',
      },
      { name: 'title', label: 'Title (optional)', type: 'string' },
      {
        name: 'description',
        label: 'Description (optional)',
        type: 'textarea',
      },
    ],
  },
  {
    name: 'youtube_list_history',
    title: 'List history',
    description: 'Scheduled Shorts execution history with post URLs when available.',
    category: 'history',
    fields: [
      { name: 'scheduleId', label: 'Schedule ID', type: 'string' },
      { name: 'connectionId', label: 'Connection ID', type: 'string' },
      {
        name: 'status',
        label: 'Status filter',
        type: 'select',
        options: ['', 'success', 'failure'],
        defaultValue: '',
      },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
    ],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'generate', label: 'Generate' },
  { key: 'publish', label: 'Publish' },
  { key: 'history', label: 'History' },
];

export default function YouTubeMcpPlayground() {
  const [connectionId, setConnectionId] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [videoPath, setVideoPath] = useState('');

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      const defaults: Record<string, string> = {};
      if (connectionId && tool.fields.some((f) => f.name === 'connectionId')) {
        defaults.connectionId = connectionId;
      }
      if (snapshotId && tool.fields.some((f) => f.name === 'biSnapshotId')) {
        defaults.biSnapshotId = snapshotId;
      }
      if (scheduleId && tool.fields.some((f) => f.name === 'scheduleId')) {
        defaults.scheduleId = scheduleId;
      }
      if (videoPath && tool.fields.some((f) => f.name === 'videoPath')) {
        defaults.videoPath = videoPath;
      }
      return defaults;
    },
    [connectionId, snapshotId, scheduleId, videoPath],
  );

  const onResult = useCallback((toolName: string, parsed: any) => {
    if (!parsed || typeof parsed !== 'object') return;

    if (Array.isArray(parsed.connections) && parsed.connections[0]?.id) {
      setConnectionId(String(parsed.connections[0].id));
    }
    if (parsed.connection?.id) setConnectionId(String(parsed.connection.id));
    if (parsed.biSnapshotId) setSnapshotId(String(parsed.biSnapshotId));
    if (parsed.schedule?.id) setScheduleId(String(parsed.schedule.id));
    if (parsed.scheduleId) setScheduleId(String(parsed.scheduleId));
    if (parsed.video?.finalPath) setVideoPath(String(parsed.video.finalPath));
  }, []);

  const postProcessArgs = useCallback((args: Record<string, any>) => {
    const next = { ...args };
    if (next.status === '') delete next.status;
    if (typeof next.topics === 'string' && next.topics.trim()) {
      next.topics = next.topics
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return next;
  }, []);

  const renderDisplay = useCallback((data: any, toolName: string) => {
    const styles = playgroundStyles;

    if (Array.isArray(data?.connections)) {
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          {data.connections.map((c: any) => (
            <div
              key={c.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <dl style={{ ...styles.kvGridStyle, marginTop: 8 }}>
                <dt style={styles.kvTermStyle}>ID</dt>
                <dd style={styles.kvDescStyle}>
                  <code style={styles.inlineCodeStyle}>{c.id}</code>
                </dd>
                <dt style={styles.kvTermStyle}>Auth</dt>
                <dd style={styles.kvDescStyle}>
                  {c.chromeUserDataDir
                    ? 'Chrome profile'
                    : c.username
                      ? `login: ${c.username}`
                      : '—'}
                </dd>
              </dl>
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(data?.schedules)) {
      return (
        <div style={styles.tableWrapStyle}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>Title</th>
                <th style={styles.thStyle}>ID</th>
                <th style={styles.thStyle}>Enabled</th>
                <th style={styles.thStyle}>BI snapshot</th>
                <th style={styles.thStyle}>Video model</th>
              </tr>
            </thead>
            <tbody>
              {data.schedules.map((s: any) => (
                <tr key={s.id}>
                  <td style={styles.tdStyle}>{s.title}</td>
                  <td style={styles.tdStyle}>
                    <code style={styles.inlineCodeStyle}>{s.id}</code>
                  </td>
                  <td style={styles.tdStyle}>
                    {s.enabled ? 'enabled' : 'disabled'}
                  </td>
                  <td style={styles.tdStyle}>
                    <code style={styles.inlineCodeStyle}>
                      {s.biSnapshotId || '—'}
                    </code>
                  </td>
                  <td style={styles.tdStyle}>{s.videoModel || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (Array.isArray(data?.history)) {
      return (
        <div style={styles.tableWrapStyle}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>When</th>
                <th style={styles.thStyle}>Status</th>
                <th style={styles.thStyle}>Title</th>
                <th style={styles.thStyle}>URL</th>
              </tr>
            </thead>
            <tbody>
              {data.history.slice(0, 30).map((h: any) => (
                <tr key={h.id}>
                  <td style={styles.tdStyle}>
                    {h.startedAt
                      ? new Date(h.startedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td style={styles.tdStyle}>{h.status}</td>
                  <td style={styles.tdStyle}>
                    {h.title || h.scheduleTitle || '—'}
                  </td>
                  <td style={styles.tdStyle}>
                    {h.postUrl ? (
                      <a href={h.postUrl} target="_blank" rel="noreferrer">
                        {h.postUrl}
                      </a>
                    ) : (
                      h.errorMessage || '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (data?.content || data?.video || data?.schedule || data?.hint) {
      return (
        <div>
          <dl style={styles.kvGridStyle}>
            {data.schedule?.id && (
              <>
                <dt style={styles.kvTermStyle}>Schedule ID</dt>
                <dd style={styles.kvDescStyle}>
                  <code style={styles.inlineCodeStyle}>{data.schedule.id}</code>
                </dd>
              </>
            )}
            {data.postUrl && (
              <>
                <dt style={styles.kvTermStyle}>Post URL</dt>
                <dd style={styles.kvDescStyle}>
                  <a href={data.postUrl} target="_blank" rel="noreferrer">
                    {data.postUrl}
                  </a>
                </dd>
              </>
            )}
            {data.content?.title && (
              <>
                <dt style={styles.kvTermStyle}>Title</dt>
                <dd style={styles.kvDescStyle}>{data.content.title}</dd>
              </>
            )}
            {data.spokesperson?.name && (
              <>
                <dt style={styles.kvTermStyle}>Spokesperson</dt>
                <dd style={styles.kvDescStyle}>
                  {data.spokesperson.name}
                  {data.spokesperson.role ? ` · ${data.spokesperson.role}` : ''}
                </dd>
              </>
            )}
            {Array.isArray(data.content?.veoScenes) && (
              <>
                <dt style={styles.kvTermStyle}>Veo scenes</dt>
                <dd style={styles.kvDescStyle}>
                  {data.content.veoScenes.length} scenes
                </dd>
              </>
            )}
            {data.video?.finalPath && (
              <>
                <dt style={styles.kvTermStyle}>Video path</dt>
                <dd style={styles.kvDescStyle}>
                  <code style={styles.inlineCodeStyle}>
                    {data.video.finalPath}
                  </code>
                </dd>
              </>
            )}
            {data.video?.durationSec != null && (
              <>
                <dt style={styles.kvTermStyle}>Duration</dt>
                <dd style={styles.kvDescStyle}>{data.video.durationSec}s</dd>
              </>
            )}
            {data.message && (
              <>
                <dt style={styles.kvTermStyle}>Message</dt>
                <dd style={styles.kvDescStyle}>{data.message}</dd>
              </>
            )}
            {data.hint && (
              <>
                <dt style={styles.kvTermStyle}>Next</dt>
                <dd style={styles.kvDescStyle}>{data.hint}</dd>
              </>
            )}
            {data.error && (
              <>
                <dt style={styles.kvTermStyle}>Error</dt>
                <dd style={{ ...styles.kvDescStyle, color: '#b91c1c' }}>
                  {data.error}
                </dd>
              </>
            )}
          </dl>

          {Array.isArray(data.content?.veoScenes) &&
            data.content.veoScenes.length > 0 &&
            toolName === 'youtube_generate_shorts' && (
              <div style={{ marginTop: 16 }}>
                <div style={styles.miniLabelStyle}>Scenes</div>
                <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13 }}>
                  {data.content.veoScenes.map((s: any, i: number) => (
                    <li key={s.id || i} style={{ marginBottom: 6 }}>
                      <strong>{s.id || `scene-${i + 1}`}</strong>
                      {s.durationSec != null ? ` (${s.durationSec}s)` : ''}:{' '}
                      {s.prompt || s.visual || '—'}
                    </li>
                  ))}
                </ol>
              </div>
            )}
        </div>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Suggested flow</div>
        <p
          style={{
            fontSize: 13,
            color: '#374151',
            margin: '4px 0 0',
            lineHeight: 1.55,
          }}
        >
          <strong>A — Brand face first:</strong> Brand Face MCP → generate preferred
          face on a snapshot.
          <br />
          <strong>B — Preview:</strong> Generate Shorts (no upload) with that{' '}
          <code style={playgroundStyles.inlineCodeStyle}>biSnapshotId</code>
          ; optionally Generate local video.
          <br />
          <strong>C — Publish:</strong> Create schedule with{' '}
          <code style={playgroundStyles.inlineCodeStyle}>runNow</code>, or Debug
          upload with a local mp4.
          <br />
          Session connection:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {connectionId || '—'}
          </code>
          {' · '}snapshot:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {snapshotId || '—'}
          </code>
          {' · '}schedule:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {scheduleId || '—'}
          </code>
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/youtube-mcp"
      eyebrow="YouTube Shorts MCP"
      title="YouTube Shorts playground"
      subtitle="Manage YouTube connections, generate multi-scene Shorts (with brand face), schedule auto uploads, and inspect history."
      apiPath="/api/youtube"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#FF0000"
      sessionBar={sessionBar}
      getDefaultFieldValues={getDefaultFieldValues}
      onResult={onResult}
      postProcessArgs={postProcessArgs}
      renderDisplay={renderDisplay}
      runningHints={{
        youtube_schedule_create:
          'Creating schedule (and generating/uploading if runNow)…',
        youtube_schedule_run_now:
          'Generating Shorts + uploading — can take several minutes…',
        youtube_generate_shorts:
          'Generating Shorts content (and video if enabled)…',
        youtube_debug_post: 'Logging in and uploading debug Shorts…',
        youtube_list_history: 'Loading Shorts history…',
      }}
    />
  );
}
