'use client';

import { useCallback } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const SAMPLE_HTML = `<h2>Why this product stands out</h2>
<p>Opening paragraph with the core benefit for your audience.</p>
[IMAGE:Product hero shot on a clean desk:header]
<p>Details about how it works in daily use, with a concrete example.</p>
[IMAGE:Close-up of key feature in use:content]
<p>Closing call to action inviting the reader to try it.</p>`;

const SAMPLE_IMAGES_JSON = `[
  {
    "description": "Product hero shot on a clean desk",
    "placement": "header",
    "filePath": "/absolute/path/to/hero.png"
  },
  {
    "description": "Close-up of key feature in use",
    "placement": "content",
    "filePath": "/absolute/path/to/detail.png"
  }
]`;

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'blog_list_connections',
    title: 'List blog connections',
    description: 'WordPress and Naver Blog connections saved in EGDesk.',
    category: 'setup',
    fields: [],
  },
  {
    name: 'blog_add_connection',
    title: 'Add blog account',
    description:
      'Register a new Naver or WordPress account. Returns connectionId for publish/schedule tools.',
    category: 'setup',
    fields: [
      {
        name: 'type',
        label: 'Platform',
        type: 'select',
        options: ['naver', 'wordpress'],
        defaultValue: 'naver',
        required: true,
      },
      {
        name: 'name',
        label: 'Display name (optional)',
        type: 'string',
        placeholder: 'My Naver Blog',
      },
      {
        name: 'username',
        label: 'Username / Naver ID',
        type: 'string',
        required: true,
      },
      {
        name: 'password',
        label: 'Password / WP app password',
        type: 'string',
        required: true,
      },
      {
        name: 'url',
        label: 'WordPress site URL',
        type: 'string',
        placeholder: 'https://example.com (required for wordpress)',
        hint: 'Only needed when Platform = wordpress',
      },
      {
        name: 'proxyUrl',
        label: 'Proxy URL (Naver, optional)',
        type: 'string',
        placeholder: 'http://user:pass@host:port',
      },
    ],
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
      {
        name: 'runNow',
        label: 'Publish now (run after create)',
        type: 'boolean',
        defaultValue: false,
        hint: 'Create the schedule and immediately generate + publish in the same call.',
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
      'Path A — immediately generate + publish for a schedule. May take several minutes.',
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
    name: 'blog_list_history',
    title: 'List posted blog history',
    description:
      'All scheduled executions + MCP one-off publishes (title, post URL, status, connection).',
    category: 'history',
    fields: [
      {
        name: 'scheduleId',
        label: 'Schedule ID filter (optional)',
        type: 'string',
      },
      {
        name: 'connectionId',
        label: 'Connection ID filter (optional)',
        type: 'string',
      },
      {
        name: 'status',
        label: 'Status filter',
        type: 'select',
        options: ['', 'success', 'failure'],
        defaultValue: '',
      },
      {
        name: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 50,
      },
    ],
  },
  {
    name: 'blog_generate_content',
    title: 'Generate content (draft)',
    description:
      'Path B step 1 — generate a draft + local image filePaths without publishing. Pass productName + biSnapshotId to use product tone/images.',
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
        name: 'includeContent',
        label: 'Include full HTML in response',
        type: 'boolean',
        defaultValue: true,
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
    description: 'Inspect a generated draft. Turn on includeContent for full HTML + images.',
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
    title: 'Publish draftId',
    description: 'Path B step 2 — publish a stored draftId (images already on the draft).',
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
        required: true,
        placeholder: 'From Generate content',
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'string',
        placeholder: '#ai #blog',
      },
    ],
  },
  {
    name: 'blog_publish',
    title: 'Publish HTML + images (one call)',
    description:
      'Path C — send title, HTML with [IMAGE:…] markers, and images[] in a single blog_publish call. Upload files below or paste filePath / dataBase64 JSON.',
    category: 'inline',
    helperName: 'publish_with_images',
    fields: [
      {
        name: 'connectionId',
        label: 'Connection ID',
        type: 'string',
        required: true,
        placeholder: 'From List blog connections',
      },
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        required: true,
        defaultValue: 'Demo: inline draft + images',
      },
      {
        name: 'content',
        label: 'HTML content (with markers)',
        type: 'textarea',
        required: true,
        defaultValue: SAMPLE_HTML,
        hint: 'Keep [IMAGE:description:placement] markers where images should appear between paragraphs.',
      },
      {
        name: 'images',
        label: 'Images JSON (marker order)',
        type: 'json',
        defaultValue: SAMPLE_IMAGES_JSON,
        hint: 'Each item: filePath, dataBase64, or url. Order must match markers in the HTML.',
      },
      {
        name: 'imageFile1',
        label: 'Image 1 file (optional — overrides images[0])',
        type: 'file',
        fileDelivery: 'inline',
        accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif',
      },
      {
        name: 'imageFile2',
        label: 'Image 2 file (optional — overrides images[1])',
        type: 'file',
        fileDelivery: 'inline',
        accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif',
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'string',
        defaultValue: '#demo #blog',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'schedule', label: 'Path A — Schedule' },
  { key: 'draft', label: 'Path B — Draft + publish' },
  { key: 'inline', label: 'Path C — HTML + images' },
  { key: 'history', label: 'History' },
];

function parseImagesJson(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function BlogMcpPlayground() {
  const postProcessArgs = useCallback((args: Record<string, any>, context: any) => {
    const next = { ...args };
    if (typeof next.topics === 'string' && next.topics.trim()) {
      next.topics = next.topics
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (typeof next.topics === 'string') {
      delete next.topics;
    }

    // Path C: merge uploaded files into images[] for a single blog_publish call
    if (context.tool?.helperName === 'publish_with_images' || context.tool?.category === 'inline') {
      delete next.imageFile1;
      delete next.imageFile2;

      const images = parseImagesJson(next.images);
      const file1 = context.filePayloads?.imageFile1;
      const file2 = context.filePayloads?.imageFile2;

      if (file1?.base64) {
        images[0] = {
          ...(images[0] || {}),
          description: images[0]?.description || 'Uploaded image 1',
          placement: images[0]?.placement || 'header',
          dataBase64: file1.base64,
          mimeType: file1.mimeType || 'image/png',
        };
        delete images[0].filePath;
      }
      if (file2?.base64) {
        images[1] = {
          ...(images[1] || {}),
          description: images[1]?.description || 'Uploaded image 2',
          placement: images[1]?.placement || 'content',
          dataBase64: file2.base64,
          mimeType: file2.mimeType || 'image/png',
        };
        delete images[1].filePath;
      }

      if (images.length > 0) {
        next.images = images;
      } else {
        delete next.images;
      }
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

    if (Array.isArray(data?.history)) {
      return (
        <div style={styles.tableWrapStyle}>
          <div style={{ ...styles.miniLabelStyle, marginBottom: 8 }}>
            {data.total ?? data.history.length} post(s)
          </div>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>When</th>
                <th style={styles.thStyle}>Source</th>
                <th style={styles.thStyle}>Status</th>
                <th style={styles.thStyle}>Title</th>
                <th style={styles.thStyle}>Connection</th>
                <th style={styles.thStyle}>Post ID</th>
                <th style={styles.thStyle}>Post URL</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h: any) => (
                <tr key={h.id}>
                  <td style={styles.tdStyle}>
                    {h.startedAt ? new Date(h.startedAt).toLocaleString() : '—'}
                  </td>
                  <td style={styles.tdStyle}>{h.source}</td>
                  <td style={styles.tdStyle}>{h.status}</td>
                  <td style={styles.tdStyle}>{h.title || h.scheduleTitle || '—'}</td>
                  <td style={styles.tdStyle}>{h.connectionName || h.connectionId || '—'}</td>
                  <td style={styles.tdStyle}>
                    {h.postId ? <code style={styles.inlineCodeStyle}>{h.postId}</code> : '—'}
                  </td>
                  <td style={styles.tdStyle}>
                    {h.postUrl ? (
                      <a href={h.postUrl} target="_blank" rel="noreferrer">{h.postUrl}</a>
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

    if (
      data?.draftId ||
      data?.schedule?.id ||
      data?.postUrl ||
      data?.connectionId ||
      data?.connection?.id ||
      Array.isArray(data?.images)
    ) {
      return (
        <div>
          <dl style={styles.kvGridStyle}>
            {(data.connectionId || data.connection?.id) && (
              <>
                <dt style={styles.kvTermStyle}>Connection ID</dt>
                <dd style={styles.kvDescStyle}>
                  <code style={styles.inlineCodeStyle}>
                    {data.connectionId || data.connection?.id}
                  </code>
                </dd>
              </>
            )}
            {data.connection?.type && (
              <>
                <dt style={styles.kvTermStyle}>Type</dt>
                <dd style={styles.kvDescStyle}>{data.connection.type}</dd>
              </>
            )}
            {data.connection?.name && (
              <>
                <dt style={styles.kvTermStyle}>Name</dt>
                <dd style={styles.kvDescStyle}>{data.connection.name}</dd>
              </>
            )}
            {typeof data.updated === 'boolean' && (
              <>
                <dt style={styles.kvTermStyle}>Updated existing</dt>
                <dd style={styles.kvDescStyle}>{String(data.updated)}</dd>
              </>
            )}
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
            {typeof data.imageCount === 'number' && (
              <>
                <dt style={styles.kvTermStyle}>Images</dt>
                <dd style={styles.kvDescStyle}>{data.imageCount}</dd>
              </>
            )}
            {data.schedule?.id && (
              <>
                <dt style={styles.kvTermStyle}>Schedule ID</dt>
                <dd style={styles.kvDescStyle}><code style={styles.inlineCodeStyle}>{data.schedule.id}</code></dd>
              </>
            )}
            {data.postId && (
              <>
                <dt style={styles.kvTermStyle}>Post ID</dt>
                <dd style={styles.kvDescStyle}>
                  <code style={styles.inlineCodeStyle}>{data.postId}</code>
                </dd>
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
            {data.connectionType && (
              <>
                <dt style={styles.kvTermStyle}>Connection</dt>
                <dd style={styles.kvDescStyle}>{data.connectionType}</dd>
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

          {Array.isArray(data.images) && data.images.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.miniLabelStyle}>Images (marker order)</div>
              <div style={styles.tableWrapStyle}>
                <table style={styles.tableStyle}>
                  <thead>
                    <tr>
                      <th style={styles.thStyle}>#</th>
                      <th style={styles.thStyle}>Placement</th>
                      <th style={styles.thStyle}>Description</th>
                      <th style={styles.thStyle}>filePath / url</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.images.map((img: any, i: number) => (
                      <tr key={img.uuid || i}>
                        <td style={styles.tdStyle}>{img.index ?? i}</td>
                        <td style={styles.tdStyle}>{img.placement || '—'}</td>
                        <td style={styles.tdStyle}>{img.description || '—'}</td>
                        <td style={styles.tdStyle}>
                          <code style={styles.inlineCodeStyle}>
                            {img.filePath || img.url || '—'}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        <div style={playgroundStyles.miniLabelStyle}>Three flows</div>
        <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0', lineHeight: 1.55 }}>
          <strong>Setup:</strong> add blog account → copy connectionId.<br />
          <strong>A — Schedule:</strong> create schedule (optionally Publish now) or run schedule later.<br />
          <strong>B — Draft:</strong> generate content → publish with draftId.<br />
          <strong>C — One call:</strong> blog_publish with title + HTML markers + images[].<br />
          <strong>History:</strong> blog_list_history for all scheduled + MCP posts.
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/blog-mcp"
      eyebrow="Blog MCP"
      title="Blog schedule & publish playground"
      subtitle="Schedule auto-generated BI posts, generate then publish by draftId, or send HTML + images in a single blog_publish call."
      apiPath="/api/blog"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#0d9488"
      sessionBar={sessionBar}
      postProcessArgs={postProcessArgs}
      renderDisplay={renderDisplay}
      runningHints={{
        blog_schedule_create: 'Creating schedule (and publishing if runNow)…',
        blog_schedule_run_now: 'Generating and publishing — this can take several minutes…',
        blog_generate_content: 'Generating outline and images…',
        blog_publish: 'Publishing to WordPress or Naver…',
        blog_list_history: 'Loading post history…',
      }}
    />
  );
}
