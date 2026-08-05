'use client';

import { useCallback } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'blog_list_connections',
    title: 'List blog connections',
    description: 'WordPress and Naver Blog connections saved in EGDesk.',
    category: 'setup',
    fields: [],
  },
  {
    name: 'blog_schedule_create',
    title: 'Create schedule (auto-gen)',
    description:
      'Path A — register a recurring schedule. EGDesk generates and publishes on the cron, or call Run now.',
    category: 'schedule',
    fields: [
      {
        name: 'title',
        label: 'Schedule title',
        type: 'string',
        required: true,
        placeholder: 'Weekly product blog',
      },
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
        placeholder: 'From List blog connections',
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
        placeholder: 'Required for bi_products',
        hint: 'From BI Products MCP → List snapshots',
      },
      {
        name: 'topics',
        label: 'Topics / product names',
        type: 'textarea',
        placeholder: 'One product name per line (optional for bi_products — uses all catalog products if empty)',
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
        name: 'weeklyDay',
        label: 'Weekly day (0=Sun … 6=Sat)',
        type: 'number',
        placeholder: '1',
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
    name: 'blog_schedule_list',
    title: 'List schedules',
    description: 'List saved blog schedules.',
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
    name: 'blog_schedule_toggle',
    title: 'Toggle schedule',
    description: 'Enable or disable a schedule.',
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
    name: 'blog_schedule_run_now',
    title: 'Run schedule now',
    description:
      'Path A step 3 — immediately generate + publish for a schedule. May take several minutes.',
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
    name: 'blog_generate_content',
    title: 'Generate content (draft)',
    description:
      'Path B step 1 — generate a draft without publishing. Pass productName + biSnapshotId to use product tone/images.',
    category: 'draft',
    fields: [
      {
        name: 'topic',
        label: 'Topic (optional if productName set)',
        type: 'string',
      },
      {
        name: 'productName',
        label: 'Product name',
        type: 'string',
        placeholder: 'Must match BI catalog product name',
      },
      {
        name: 'biSnapshotId',
        label: 'BI snapshot ID',
        type: 'string',
      },
      {
        name: 'platform',
        label: 'Platform hint',
        type: 'select',
        options: ['naver', 'wordpress'],
        defaultValue: 'naver',
      },
      {
        name: 'connectionId',
        label: 'WP connection for image upload (optional)',
        type: 'string',
      },
      {
        name: 'textModel',
        label: 'Text model (optional)',
        type: 'string',
      },
      {
        name: 'imageModel',
        label: 'Image model (optional)',
        type: 'string',
      },
    ],
  },
  {
    name: 'blog_get_draft',
    title: 'Get draft',
    description: 'Inspect a generated draft. Turn on includeContent for full HTML.',
    category: 'draft',
    fields: [
      {
        name: 'draftId',
        label: 'Draft ID',
        type: 'string',
        required: true,
        placeholder: 'From Generate content',
      },
      {
        name: 'includeContent',
        label: 'Include full HTML',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    name: 'blog_publish',
    title: 'Publish draft / content',
    description: 'Path B step 2 — publish a draftId (or inline title+content) to WordPress or Naver.',
    category: 'draft',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
      },
      {
        name: 'draftId',
        label: 'Draft ID',
        type: 'string',
        placeholder: 'Preferred — from Generate content',
      },
      {
        name: 'title',
        label: 'Inline title (if no draft)',
        type: 'string',
      },
      {
        name: 'content',
        label: 'Inline HTML content (if no draft)',
        type: 'textarea',
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'string',
        placeholder: '#ai #blog',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'schedule', label: 'Path A — Schedule' },
  { key: 'draft', label: 'Path B — Draft + publish' },
];

export default function BlogMcpPlayground() {
  const postProcessArgs = useCallback((args: Record<string, any>) => {
    const next = { ...args };
    if (typeof next.topics === 'string' && next.topics.trim()) {
      next.topics = next.topics
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (typeof next.topics === 'string') {
      delete next.topics;
    }
    return next;
  }, []);

  const renderDisplay = useCallback((data: any) => {
    const styles = playgroundStyles;

    if (Array.isArray(data?.connections)) {
      return (
        <div style={styles.tableWrapStyle}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>ID</th>
                <th style={styles.thStyle}>Name</th>
                <th style={styles.thStyle}>Type</th>
              </tr>
            </thead>
            <tbody>
              {data.connections.map((c: any) => (
                <tr key={c.id}>
                  <td style={styles.tdStyle}><code style={styles.inlineCodeStyle}>{c.id}</code></td>
                  <td style={styles.tdStyle}>{c.name}</td>
                  <td style={styles.tdStyle}>{c.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (Array.isArray(data?.schedules)) {
      return (
        <div style={styles.tableWrapStyle}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>ID</th>
                <th style={styles.thStyle}>Title</th>
                <th style={styles.thStyle}>Source</th>
                <th style={styles.thStyle}>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {data.schedules.map((s: any) => (
                <tr key={s.id}>
                  <td style={styles.tdStyle}><code style={styles.inlineCodeStyle}>{s.id}</code></td>
                  <td style={styles.tdStyle}>{s.title}</td>
                  <td style={styles.tdStyle}>{s.topicSource}</td>
                  <td style={styles.tdStyle}>{String(s.enabled)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (data?.draftId || data?.schedule?.id || data?.postUrl) {
      return (
        <dl style={styles.kvGridStyle}>
          {data.draftId && (
            <>
              <dt style={styles.kvTermStyle}>Draft ID</dt>
              <dd style={styles.kvDescStyle}><code style={styles.inlineCodeStyle}>{data.draftId}</code></dd>
            </>
          )}
          {data.title && (
            <>
              <dt style={styles.kvTermStyle}>Title</dt>
              <dd style={styles.kvDescStyle}>{data.title}</dd>
            </>
          )}
          {data.schedule?.id && (
            <>
              <dt style={styles.kvTermStyle}>Schedule ID</dt>
              <dd style={styles.kvDescStyle}><code style={styles.inlineCodeStyle}>{data.schedule.id}</code></dd>
            </>
          )}
          {data.postUrl && (
            <>
              <dt style={styles.kvTermStyle}>Post URL</dt>
              <dd style={styles.kvDescStyle}>
                <a href={data.postUrl} target="_blank" rel="noreferrer">{data.postUrl}</a>
              </dd>
            </>
          )}
          {data.hint && (
            <>
              <dt style={styles.kvTermStyle}>Next</dt>
              <dd style={styles.kvDescStyle}>{data.hint}</dd>
            </>
          )}
          {data.message && (
            <>
              <dt style={styles.kvTermStyle}>Message</dt>
              <dd style={styles.kvDescStyle}>{data.message}</dd>
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
        <div style={playgroundStyles.miniLabelStyle}>Two flows</div>
        <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0', lineHeight: 1.55 }}>
          <strong>A — Schedule:</strong> list connections → create schedule (bi_products) → run now.<br />
          <strong>B — Draft:</strong> generate content → get draft → publish with connectionId.
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/blog-mcp"
      eyebrow="Blog MCP"
      title="Blog schedule & publish playground"
      subtitle="Schedule auto-generated BI product posts, or generate a draft then publish to WordPress / Naver in a separate step."
      apiPath="/api/blog"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#0d9488"
      sessionBar={sessionBar}
      postProcessArgs={postProcessArgs}
      renderDisplay={renderDisplay}
      runningHints={{
        blog_schedule_run_now: 'Generating and publishing — this can take several minutes…',
        blog_generate_content: 'Generating outline and images…',
        blog_publish: 'Publishing to WordPress or Naver…',
      }}
    />
  );
}
