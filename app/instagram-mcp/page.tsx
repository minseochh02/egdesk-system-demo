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
    name: 'instagram_list_schedules',
    title: 'List schedules',
    description: 'EGDesk Instagram scheduled posts.',
    category: 'schedules',
    fields: [
      { name: 'connectionId', label: 'Connection ID (optional)', type: 'string' },
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
  { key: 'history', label: 'History' },
  { key: 'stats', label: 'Stats' },
  { key: 'publish', label: 'Publish' },
  { key: 'schedules', label: 'Schedules' },
];

const RUNNING_HINTS: Record<string, string> = {
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

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      const defaults: Record<string, string> = {};
      if (connectionId && tool.fields.some((f) => f.name === 'connectionId')) {
        defaults.connectionId = connectionId;
      }
      return defaults;
    },
    [connectionId],
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
  }, []);

  const postProcessArgs = useCallback((args: Record<string, any>) => {
    const next = { ...args };
    if (next.status === '') delete next.status;
    return next;
  }, []);

  const renderDisplay = useCallback((toolName: string, raw: unknown) => {
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
          {data.history.slice(0, 20).map((h: any) => (
            <div
              key={h.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
              }}
            >
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
          ))}
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
        <div style={{ display: 'grid', gap: 8 }}>
          {data.schedules.map((s: any) => (
            <div key={s.id} style={{ fontSize: 13 }}>
              <strong>{s.title}</strong>{' '}
              <code style={inlineCodeStyle}>{s.id}</code>
              {' · '}
              {s.enabled ? 'enabled' : 'disabled'}
            </div>
          ))}
        </div>
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
        <div style={playgroundStyles.miniLabelStyle}>Session</div>
        <p
          style={{
            fontSize: 13,
            color: '#111827',
            margin: '4px 0 0',
            lineHeight: 1.55,
          }}
        >
          Connection:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {connectionId || '—'}
          </code>
          {' · '}Handle:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {handle ? `@${handle}` : '—'}
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
      subtitle="Manage connections, publish posts, sync likes/comments, and browse publish history via EGDesk Instagram MCP."
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
