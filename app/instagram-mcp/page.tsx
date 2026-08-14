'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';
import { parseMcpResult } from '@/lib/mcp-utils';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'instagram_list_connections',
    title: 'List connections',
    description:
      'Instagram accounts saved in EGDesk (id, name, login, @handle). Passwords never returned.',
    category: 'setup',
    fields: [],
  },
  {
    name: 'instagram_save_connection',
    title: 'Save connection',
    description:
      'Add or update login credentials. Set public @handle separately from login email.',
    category: 'setup',
    fields: [
      {
        name: 'name',
        label: 'Display name',
        type: 'string',
        required: true,
        placeholder: 'My Instagram',
      },
      {
        name: 'username',
        label: 'Login (email / phone / username)',
        type: 'string',
        required: true,
        placeholder: 'you@email.com',
      },
      {
        name: 'password',
        label: 'Password',
        type: 'string',
        required: true,
      },
      {
        name: 'handle',
        label: 'Public @handle',
        type: 'string',
        placeholder: 'your_username',
        hint: 'Not the login email — used for profile URLs.',
      },
    ],
  },
  {
    name: 'instagram_update_connection',
    title: 'Update connection',
    description: 'Patch name, login, password, or @handle.',
    category: 'setup',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      { name: 'name', label: 'Display name', type: 'string' },
      { name: 'username', label: 'Login', type: 'string' },
      { name: 'password', label: 'Password', type: 'string' },
      { name: 'handle', label: 'Public @handle', type: 'string' },
    ],
  },
  {
    name: 'instagram_delete_connection',
    title: 'Delete connection',
    description: 'Remove an Instagram connection by id.',
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
    name: 'instagram_generate_content',
    title: 'Generate content (no publish)',
    description:
      'Caption + image without login. For product posts: register photos in BI Products MCP first (imageCount>0), then pass biSnapshotId + productName — or attach productImages here for a one-off.',
    category: 'generate',
    fields: [
      {
        name: 'topic',
        label: 'Topic',
        type: 'string',
        placeholder: 'Optional free-text topic',
      },
      {
        name: 'productName',
        label: 'Product name',
        type: 'string',
        placeholder: 'Must match BI catalog name for photo grounding',
        hint: 'Resolved against BI catalog when biSnapshotId is set.',
      },
      {
        name: 'biSnapshotId',
        label: 'BI snapshot ID',
        type: 'string',
        placeholder: 'From BI Products MCP → List snapshots',
        hint: 'Product photos come from the BI catalog — register them with bi_register_product(filePaths/images) first.',
      },
      {
        name: 'productImage',
        label: 'One-off product photo (optional)',
        type: 'file',
        fileDelivery: 'inline',
        accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif',
        hint: 'Overrides BI-resolved images for this call only. Schedules cannot use this — register in BI instead.',
      },
      {
        name: 'contentGoal',
        label: 'Content goal',
        type: 'string',
      },
      {
        name: 'visualBrief',
        label: 'Visual brief',
        type: 'textarea',
      },
      {
        name: 'cta',
        label: 'CTA',
        type: 'string',
      },
      {
        name: 'language',
        label: 'Language',
        type: 'string',
        placeholder: 'ko',
      },
      {
        name: 'textModel',
        label: 'Text model',
        type: 'string',
      },
      {
        name: 'imageModel',
        label: 'Image model',
        type: 'string',
      },
      {
        name: 'generateImage',
        label: 'Generate image',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'instagram_schedule_create',
    title: 'Create schedule',
    description:
      'Recurring cron at scheduledTime (HH:MM). For bi_products: BI catalog must already have product photos (imageCount>0) — this tool does NOT accept productImages. runNow defaults true (also posts immediately).',
    category: 'schedule',
    fields: [
      {
        name: 'title',
        label: 'Schedule title',
        type: 'string',
        required: true,
        placeholder: 'Daily product posts',
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
        hint: 'bi_products uses BI product photos as image references. Register photos in BI Products MCP first.',
      },
      {
        name: 'biSnapshotId',
        label: 'BI snapshot ID',
        type: 'string',
        placeholder: 'Required for bi_products',
        hint: 'From BI Products MCP. Create fails if products have imageCount=0.',
      },
      {
        name: 'topics',
        label: 'Topics / product names',
        type: 'textarea',
        placeholder:
          'Exact BI product names (imageCount>0). Optional for bi_products — uses catalog if empty.',
      },
      {
        name: 'scheduledTime',
        label: 'Time (HH:MM)',
        type: 'string',
        defaultValue: '09:00',
        hint: 'Recurring cron time-of-day — not a one-off timer.',
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
        name: 'weeklyDay',
        label: 'Weekly day (0=Sun … 6=Sat)',
        type: 'number',
        placeholder: '1',
      },
      {
        name: 'textModel',
        label: 'Caption model',
        type: 'string',
      },
      {
        name: 'imageModel',
        label: 'Image model',
        type: 'string',
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
        defaultValue: true,
        hint: 'Default true — also generate + post immediately. Pass false for cron-only.',
      },
    ],
  },
  {
    name: 'instagram_list_schedules',
    title: 'List schedules',
    description: 'EGDesk Instagram scheduled posts.',
    category: 'schedule',
    fields: [
      { name: 'connectionId', label: 'Connection ID (optional)', type: 'string' },
    ],
  },
  {
    name: 'instagram_schedule_toggle',
    title: 'Toggle schedule',
    description: 'Enable or disable an Instagram schedule.',
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
    name: 'instagram_schedule_delete',
    title: 'Delete schedule',
    description: 'Permanently delete an Instagram schedule.',
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
    name: 'instagram_schedule_run_now',
    title: 'Run schedule now',
    description:
      'Generate caption + image and post for an existing schedule. bi_products schedules need BI catalog photos already registered.',
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
    name: 'instagram_list_history',
    title: 'List publish history',
    description:
      'Scheduled + debug/manual posts, with likes/comments when stats were synced.',
    category: 'history',
    fields: [
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
  {
    name: 'instagram_sync_post_stats',
    title: 'Sync post stats',
    description:
      'Login (headed, background) and scrape recent posts for likes/comments. Slow (~1–2 min).',
    category: 'stats',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      {
        name: 'limit',
        label: 'Max posts',
        type: 'number',
        defaultValue: 12,
      },
      {
        name: 'concurrency',
        label: 'Parallel tabs',
        type: 'number',
        defaultValue: 8,
      },
    ],
  },
  {
    name: 'instagram_fetch_posts',
    title: 'Fetch posts',
    description: 'Alias of sync post stats — scrape recent posts with engagement.',
    category: 'stats',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      { name: 'limit', label: 'Max posts', type: 'number', defaultValue: 12 },
    ],
  },
  {
    name: 'instagram_create_post',
    title: 'Create post',
    description:
      'Publish via Playwright (login + create). Requires absolute imagePath on the EGDesk machine.',
    category: 'publish',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      {
        name: 'caption',
        label: 'Caption',
        type: 'textarea',
        required: true,
        placeholder: 'Hello from EGDesk…',
      },
      {
        name: 'imagePath',
        label: 'Image path (absolute)',
        type: 'string',
        required: true,
        placeholder: '/Users/you/Downloads/photo.png',
      },
      {
        name: 'waitAfterShare',
        label: 'Wait after share (ms)',
        type: 'number',
        defaultValue: 8000,
      },
    ],
  },
  {
    name: 'instagram_debug_post',
    title: 'Debug post',
    description:
      'Post fixed caption with ~/Downloads/cat.png (or custom imagePath). No Gemini.',
    category: 'publish',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      { name: 'caption', label: 'Caption (optional)', type: 'textarea' },
      {
        name: 'imagePath',
        label: 'Image path (optional)',
        type: 'string',
        placeholder: '~/Downloads/cat.png by default',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'generate', label: 'Generate' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'history', label: 'History' },
  { key: 'stats', label: 'Stats' },
  { key: 'publish', label: 'Publish' },
];

const RUNNING_HINTS: Record<string, string> = {
  instagram_generate_content: 'Generating caption + image…',
  instagram_schedule_create:
    'Creating schedule (and posting if runNow)…',
  instagram_schedule_run_now:
    'Generating + posting — can take a minute; may pause for CAPTCHA…',
  instagram_sync_post_stats:
    'Logging in and scraping posts (background Chrome, parallel tabs)…',
  instagram_fetch_posts: 'Scraping Instagram posts…',
  instagram_create_post: 'Logging in and publishing — can take a minute…',
  instagram_debug_post: 'Debug post — login + share…',
  instagram_list_history: 'Loading publish history…',
};

const inlineCodeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 12,
  background: '#f1f5f9',
  padding: '1px 6px',
  borderRadius: 4,
};

const kvGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '6px 16px',
  margin: 0,
  fontSize: 13,
};

const kvTermStyle: CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontWeight: 600,
};

const kvDescStyle: CSSProperties = {
  margin: 0,
  color: '#0f172a',
};

export default function InstagramMcpPlayground() {
  const [connectionId, setConnectionId] = useState('');
  const [handle, setHandle] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [imagePath, setImagePath] = useState('');

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      const defaults: Record<string, string> = {};
      if (connectionId && tool.fields.some((f) => f.name === 'connectionId')) {
        defaults.connectionId = connectionId;
      }
      if (scheduleId && tool.fields.some((f) => f.name === 'scheduleId')) {
        defaults.scheduleId = scheduleId;
      }
      if (snapshotId && tool.fields.some((f) => f.name === 'biSnapshotId')) {
        defaults.biSnapshotId = snapshotId;
      }
      if (imagePath && tool.fields.some((f) => f.name === 'imagePath')) {
        defaults.imagePath = imagePath;
      }
      return defaults;
    },
    [connectionId, scheduleId, snapshotId, imagePath],
  );

  const onResult = useCallback((toolName: string, raw: unknown) => {
    const data = parseMcpResult(raw) as any;
    if (!data || typeof data !== 'object') return;

    if (toolName === 'instagram_list_connections' && Array.isArray(data.connections)) {
      const first = data.connections[0];
      if (first?.id) setConnectionId(String(first.id));
      if (first?.handle) setHandle(String(first.handle));
    }

    if (
      (toolName === 'instagram_save_connection' ||
        toolName === 'instagram_update_connection') &&
      data.connection?.id
    ) {
      setConnectionId(String(data.connection.id));
      if (data.connection.handle) setHandle(String(data.connection.handle));
    }

    if (data.handle) setHandle(String(data.handle));
    if (data.schedule?.id) setScheduleId(String(data.schedule.id));
    if (data.scheduleId) setScheduleId(String(data.scheduleId));
    if (data.schedule?.biSnapshotId) setSnapshotId(String(data.schedule.biSnapshotId));
    if (typeof data.image?.filePath === 'string') setImagePath(data.image.filePath);
    if (typeof data.imagePath === 'string') setImagePath(data.imagePath);
  }, []);

  const postProcessArgs = useCallback((args: Record<string, any>, context: any) => {
    const next = { ...args };
    if (next.status === '') delete next.status;

    if (typeof next.topics === 'string' && next.topics.trim()) {
      next.topics = next.topics
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (typeof next.topics === 'string') {
      delete next.topics;
    }

    delete next.productImage;
    const payload = context.filePayloads?.productImage;
    if (payload?.base64) {
      next.productImages = [
        {
          dataBase64: payload.base64,
          mimeType: payload.mimeType || 'image/png',
        },
      ];
    }

    return next;
  }, []);

  const renderDisplay = useCallback((raw: unknown, toolName: string) => {
    const data = parseMcpResult(raw) as any;
    if (!data || typeof data !== 'object') return null;

    if (Array.isArray(data.connections)) {
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
              <div style={{ fontWeight: 600 }}>{c.name || c.username}</div>
              <dl style={{ ...kvGridStyle, marginTop: 8 }}>
                <dt style={kvTermStyle}>ID</dt>
                <dd style={kvDescStyle}>
                  <code style={inlineCodeStyle}>{c.id}</code>
                </dd>
                <dt style={kvTermStyle}>Login</dt>
                <dd style={kvDescStyle}>{c.username}</dd>
                <dt style={kvTermStyle}>Handle</dt>
                <dd style={kvDescStyle}>{c.handle ? `@${c.handle}` : '—'}</dd>
              </dl>
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(data.history)) {
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {data.total ?? data.history.length} entries
          </p>
          {data.history.slice(0, 20).map((h: any) => {
            const thumb = h.imageUrl || h.imagePath;
            return (
              <div
                key={h.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 12,
                  display: 'grid',
                  gridTemplateColumns: thumb ? '72px 1fr' : '1fr',
                  gap: 12,
                  alignItems: 'start',
                }}
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      String(thumb).startsWith('http')
                        ? thumb
                        : `file://${thumb}`
                    }
                    alt=""
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: 'cover',
                      borderRadius: 6,
                      background: '#f1f5f9',
                    }}
                  />
                ) : null}
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {h.title || h.scheduleTitle || h.caption?.slice?.(0, 60) || h.id}
                  </div>
                  <dl style={{ ...kvGridStyle, marginTop: 8 }}>
                    <dt style={kvTermStyle}>Status</dt>
                    <dd style={kvDescStyle}>{h.status}</dd>
                    <dt style={kvTermStyle}>Source</dt>
                    <dd style={kvDescStyle}>{h.source}</dd>
                    <dt style={kvTermStyle}>Likes</dt>
                    <dd style={kvDescStyle}>{h.likes ?? '—'}</dd>
                    <dt style={kvTermStyle}>Comments</dt>
                    <dd style={kvDescStyle}>{h.comments ?? '—'}</dd>
                  </dl>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (Array.isArray(data.posts) && toolName.includes('sync')) {
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Scraped {data.posts.length} · matched {data.matched ?? 0}
            {data.handle ? ` · @${data.handle}` : ''}
          </p>
          {data.posts.slice(0, 12).map((p: any) => (
            <div key={p.shortcode || p.url} style={{ fontSize: 13 }}>
              <code style={inlineCodeStyle}>{p.shortcode}</code>{' '}
              {p.likes ?? 0} likes · {p.comments ?? 0} comments
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(data.schedules)) {
      return (
        <div style={playgroundStyles.tableWrapStyle}>
          <table style={playgroundStyles.tableStyle}>
            <thead>
              <tr>
                <th style={playgroundStyles.thStyle}>Title</th>
                <th style={playgroundStyles.thStyle}>ID</th>
                <th style={playgroundStyles.thStyle}>Source</th>
                <th style={playgroundStyles.thStyle}>BI snapshot</th>
                <th style={playgroundStyles.thStyle}>Time</th>
                <th style={playgroundStyles.thStyle}>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {data.schedules.map((s: any) => (
                <tr key={s.id}>
                  <td style={playgroundStyles.tdStyle}>{s.title}</td>
                  <td style={playgroundStyles.tdStyle}>
                    <code style={inlineCodeStyle}>{s.id}</code>
                  </td>
                  <td style={playgroundStyles.tdStyle}>{s.topicSource || '—'}</td>
                  <td style={playgroundStyles.tdStyle}>
                    {s.biSnapshotId ? (
                      <code style={inlineCodeStyle}>{s.biSnapshotId}</code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={playgroundStyles.tdStyle}>{s.scheduledTime || '—'}</td>
                  <td style={playgroundStyles.tdStyle}>
                    {s.enabled ? 'yes' : 'no'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (data.content || data.image || data.schedule || data.hint || data.biPhotoWarning) {
      return (
        <dl style={kvGridStyle}>
          {data.schedule?.id && (
            <>
              <dt style={kvTermStyle}>Schedule</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>{data.schedule.id}</code>
                {data.schedule.topicSource
                  ? ` · ${data.schedule.topicSource}`
                  : ''}
              </dd>
            </>
          )}
          {data.actualNextRun && (
            <>
              <dt style={kvTermStyle}>Next run</dt>
              <dd style={kvDescStyle}>{data.actualNextRun}</dd>
            </>
          )}
          {data.hint && (
            <>
              <dt style={kvTermStyle}>Hint</dt>
              <dd style={kvDescStyle}>{data.hint}</dd>
            </>
          )}
          {data.biPhotoWarning && (
            <>
              <dt style={kvTermStyle}>Photo warning</dt>
              <dd style={{ ...kvDescStyle, color: '#b45309' }}>
                {data.biPhotoWarning}
              </dd>
            </>
          )}
          {data.content?.caption && (
            <>
              <dt style={kvTermStyle}>Caption</dt>
              <dd style={kvDescStyle}>{data.content.caption}</dd>
            </>
          )}
          {(data.image?.filePath || data.imagePath) && (
            <>
              <dt style={kvTermStyle}>Image</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>
                  {data.image?.filePath || data.imagePath}
                </code>
              </dd>
            </>
          )}
          {data.error && (
            <>
              <dt style={kvTermStyle}>Error</dt>
              <dd style={{ ...kvDescStyle, color: '#b91c1c' }}>{data.error}</dd>
            </>
          )}
        </dl>
      );
    }

    if (data.message || data.success != null) {
      return (
        <dl style={kvGridStyle}>
          {data.message && (
            <>
              <dt style={kvTermStyle}>Message</dt>
              <dd style={kvDescStyle}>{data.message}</dd>
            </>
          )}
          {data.error && (
            <>
              <dt style={kvTermStyle}>Error</dt>
              <dd style={{ ...kvDescStyle, color: '#b91c1c' }}>{data.error}</dd>
            </>
          )}
        </dl>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={playgroundStyles.miniLabelStyle}>Suggested flow</div>
        <p
          style={{
            fontSize: 13,
            color: '#111827',
            margin: '4px 0 0',
            lineHeight: 1.55,
          }}
        >
          <strong>Product posts (required):</strong> BI Products MCP → register
          product with photo → confirm <code style={inlineCodeStyle}>imageCount &gt; 0</code>{' '}
          → here create schedule with{' '}
          <code style={inlineCodeStyle}>topicSource=bi_products</code>. The
          scheduler does <em>not</em> accept productImages directly.
          <br />
          <strong>One-off:</strong> Generate content (optional product photo) →
          Create post with returned image path ·{' '}
          <strong>Debug:</strong> Debug post with a local file.
          <br />
          Connection:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {connectionId || '—'}
          </code>
          {' · '}Handle:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {handle ? `@${handle}` : '—'}
          </code>
          {' · '}Schedule:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {scheduleId || '—'}
          </code>
          {' · '}Snapshot:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {snapshotId || '—'}
          </code>
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/instagram-mcp"
      eyebrow="EGDesk Instagram MCP"
      title="Instagram Playground"
      subtitle="Manage connections, generate product-grounded posts (BI photos first), schedule auto-publish, sync likes/comments, and browse history."
      apiPath="/api/instagram"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#E4405F"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
      postProcessArgs={postProcessArgs}
    />
  );
}
