'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'brand_face_list_snapshots',
    title: 'List BI snapshots',
    description:
      'Business Identity snapshots. Copy a snapshotId for brand face generation.',
    category: 'setup',
    fields: [
      {
        name: 'brandKey',
        label: 'Brand key (optional)',
        type: 'string',
        placeholder: 'my-brand',
      },
    ],
  },
  {
    name: 'brand_face_list',
    title: 'List brand faces',
    description:
      'List AI spokespersons saved on a snapshot (preferred id + summaries).',
    category: 'faces',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
        placeholder: 'From List BI snapshots',
      },
      {
        name: 'includePortraitBase64',
        label: 'Include portrait base64',
        type: 'boolean',
        defaultValue: false,
        hint: 'Large payload — leave off unless you need the image data.',
      },
    ],
  },
  {
    name: 'brand_face_generate',
    title: 'Generate brand face',
    description:
      'AI text brief + portrait (default). Saves on the BI snapshot for YouTube Shorts.',
    category: 'faces',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'styleNotes',
        label: 'Style notes',
        type: 'textarea',
        placeholder:
          'Warm Korean educator vibe, late 30s, trustworthy, soft professional wardrobe…',
      },
      {
        name: 'roleHint',
        label: 'Role hint',
        type: 'string',
        placeholder: 'teacher, founder, coach…',
      },
      {
        name: 'generatePortrait',
        label: 'Generate portrait',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'setPreferred',
        label: 'Set as preferred for Shorts',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'save',
        label: 'Save on snapshot',
        type: 'boolean',
        defaultValue: true,
      },
      {
        name: 'companyName',
        label: 'Company name override',
        type: 'string',
        placeholder: 'Only if snapshot title is missing',
      },
    ],
  },
  {
    name: 'brand_face_generate_portrait',
    title: 'Regenerate portrait',
    description: 'New portrait for an existing persona; saves on the snapshot.',
    category: 'faces',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'personaId',
        label: 'Persona ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'brand_face_set_preferred',
    title: 'Set preferred face',
    description:
      'Mark which brand face YouTube Shorts should use for this snapshot.',
    category: 'faces',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'personaId',
        label: 'Persona ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'brand_face_delete',
    title: 'Delete brand face',
    description: 'Remove a persona from the snapshot.',
    category: 'faces',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'personaId',
        label: 'Persona ID',
        type: 'string',
        required: true,
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'faces', label: 'Brand faces' },
];

export default function BrandFaceMcpPlayground() {
  const [snapshotId, setSnapshotId] = useState('');
  const [personaId, setPersonaId] = useState('');

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      const defaults: Record<string, string> = {};
      if (snapshotId && tool.fields.some((f) => f.name === 'snapshotId')) {
        defaults.snapshotId = snapshotId;
      }
      if (personaId && tool.fields.some((f) => f.name === 'personaId')) {
        defaults.personaId = personaId;
      }
      return defaults;
    },
    [snapshotId, personaId],
  );

  const onResult = useCallback((toolName: string, parsed: any) => {
    if (!parsed || typeof parsed !== 'object') return;

    if (Array.isArray(parsed.snapshots) && parsed.snapshots[0]?.id) {
      setSnapshotId(String(parsed.snapshots[0].id));
    }
    if (parsed.snapshotId) setSnapshotId(String(parsed.snapshotId));
    if (parsed.persona?.id) setPersonaId(String(parsed.persona.id));
    if (parsed.preferredPersonaId) {
      setPersonaId(String(parsed.preferredPersonaId));
    }
    if (
      toolName === 'brand_face_list' &&
      Array.isArray(parsed.personas) &&
      parsed.personas[0]?.id
    ) {
      const preferred = parsed.preferredPersonaId
        ? parsed.personas.find((p: any) => p.id === parsed.preferredPersonaId)
        : null;
      setPersonaId(String((preferred || parsed.personas[0]).id));
    }
  }, []);

  const renderDisplay = useCallback((data: any) => {
    const styles = playgroundStyles;

    if (Array.isArray(data?.snapshots)) {
      return (
        <div style={styles.tableWrapStyle}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>ID</th>
                <th style={styles.thStyle}>Brand</th>
                <th style={styles.thStyle}>URL</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshots.map((s: any) => (
                <tr key={s.id}>
                  <td style={styles.tdStyle}>
                    <code style={styles.inlineCodeStyle}>{s.id}</code>
                  </td>
                  <td style={styles.tdStyle}>{s.brandKey}</td>
                  <td style={styles.tdStyle}>{s.sourceUrl || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (Array.isArray(data?.personas)) {
      return (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {data.total ?? data.personas.length} faces · preferred{' '}
            <code style={styles.inlineCodeStyle}>
              {data.preferredPersonaId || '—'}
            </code>
          </p>
          {data.personas.map((p: any) => (
            <div
              key={p.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                {p.name}{' '}
                {p.id === data.preferredPersonaId ? (
                  <span style={{ color: '#b45309', fontSize: 12 }}>preferred</span>
                ) : null}
              </div>
              <dl style={{ ...styles.kvGridStyle, marginTop: 8 }}>
                <dt style={styles.kvTermStyle}>ID</dt>
                <dd style={styles.kvDescStyle}>
                  <code style={styles.inlineCodeStyle}>{p.id}</code>
                </dd>
                <dt style={styles.kvTermStyle}>Role</dt>
                <dd style={styles.kvDescStyle}>{p.role || '—'}</dd>
                <dt style={styles.kvTermStyle}>Voice</dt>
                <dd style={styles.kvDescStyle}>{p.voiceStyle || '—'}</dd>
                <dt style={styles.kvTermStyle}>Portrait</dt>
                <dd style={styles.kvDescStyle}>
                  {p.hasPortrait ? 'yes' : 'no'}
                </dd>
                <dt style={styles.kvTermStyle}>Appearance</dt>
                <dd style={styles.kvDescStyle}>{p.appearance || '—'}</dd>
              </dl>
            </div>
          ))}
        </div>
      );
    }

    if (data?.persona) {
      const p = data.persona;
      return (
        <dl style={styles.kvGridStyle}>
          <dt style={styles.kvTermStyle}>Name</dt>
          <dd style={styles.kvDescStyle}>{p.name}</dd>
          <dt style={styles.kvTermStyle}>ID</dt>
          <dd style={styles.kvDescStyle}>
            <code style={styles.inlineCodeStyle}>{p.id}</code>
          </dd>
          <dt style={styles.kvTermStyle}>Role</dt>
          <dd style={styles.kvDescStyle}>{p.role || '—'}</dd>
          <dt style={styles.kvTermStyle}>Voice</dt>
          <dd style={styles.kvDescStyle}>{p.voiceStyle || '—'}</dd>
          <dt style={styles.kvTermStyle}>Appearance</dt>
          <dd style={styles.kvDescStyle}>{p.appearance || '—'}</dd>
          <dt style={styles.kvTermStyle}>Portrait</dt>
          <dd style={styles.kvDescStyle}>{p.hasPortrait ? 'yes' : 'no'}</dd>
          {data.hint && (
            <>
              <dt style={styles.kvTermStyle}>Next</dt>
              <dd style={styles.kvDescStyle}>{data.hint}</dd>
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
            color: '#374151',
            margin: '4px 0 0',
            lineHeight: 1.55,
          }}
        >
          1) List snapshots → 2) Generate brand face (set preferred) → 3) Open{' '}
          <strong>YouTube Shorts MCP</strong> with the same{' '}
          <code style={playgroundStyles.inlineCodeStyle}>biSnapshotId</code>.
          <br />
          Session snapshot:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {snapshotId || '—'}
          </code>
          {' · '}persona:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>
            {personaId || '—'}
          </code>
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/brand-face-mcp"
      eyebrow="Brand Face MCP"
      title="Brand face / spokesperson playground"
      subtitle="Generate and manage AI brand faces on Business Identity snapshots — used as the on-camera spokesperson for YouTube Shorts."
      apiPath="/api/brand-face"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#b45309"
      sessionBar={sessionBar}
      getDefaultFieldValues={getDefaultFieldValues}
      onResult={onResult}
      renderDisplay={renderDisplay}
      runningHints={{
        brand_face_generate:
          'Generating persona brief + portrait — can take a minute…',
        brand_face_generate_portrait: 'Generating portrait image…',
      }}
    />
  );
}
