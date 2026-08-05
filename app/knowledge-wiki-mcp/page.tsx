'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'knowledge_wiki_status',
    title: 'Status',
    description: 'Obsidian vault config + cached wikiHow guide counts.',
    category: 'pipeline',
    helperName: 'getKnowledgeWikiStatus',
    fields: [],
  },
  {
    name: 'knowledge_wiki_search',
    title: 'Unified search',
    description: 'Search indexed Obsidian notes and locally cached wikiHow guides.',
    category: 'pipeline',
    helperName: 'searchKnowledgeWiki',
    fields: [
      {
        name: 'query',
        label: 'Query',
        type: 'string',
        required: true,
        placeholder: 'invoice process',
      },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 20 },
    ],
  },
  {
    name: 'obsidian_set_vault',
    title: 'Set vault',
    description: 'Point EGDesk at a local Obsidian vault directory.',
    category: 'obsidian',
    helperName: 'setObsidianVault',
    fields: [
      {
        name: 'vaultPath',
        label: 'Vault path',
        type: 'string',
        required: true,
        placeholder: '/Users/you/Documents/MyVault',
      },
    ],
  },
  {
    name: 'obsidian_index',
    title: 'Index vault',
    description: 'Scan .md notes and index tags, frontmatter, wikilinks.',
    category: 'obsidian',
    helperName: 'indexObsidianVault',
    fields: [
      {
        name: 'vaultPath',
        label: 'Vault path (optional)',
        type: 'string',
        placeholder: 'Leave empty to use configured vault',
      },
    ],
  },
  {
    name: 'obsidian_search',
    title: 'Search notes',
    description: 'Search indexed Obsidian notes.',
    category: 'obsidian',
    helperName: 'searchObsidianNotes',
    fields: [
      {
        name: 'query',
        label: 'Query',
        type: 'string',
        required: true,
        placeholder: 'onboarding',
      },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 20 },
    ],
  },
  {
    name: 'obsidian_get_note',
    title: 'Get note',
    description: 'Fetch full note by path, title, or id.',
    category: 'obsidian',
    helperName: 'getObsidianNote',
    fields: [
      { name: 'path', label: 'Relative path', type: 'string', placeholder: 'Projects/Plan.md' },
      { name: 'title', label: 'Title', type: 'string' },
      { name: 'id', label: 'Note id', type: 'string' },
    ],
  },
  {
    name: 'obsidian_list_notes',
    title: 'List notes',
    description: 'List indexed notes.',
    category: 'obsidian',
    helperName: 'listObsidianNotes',
    fields: [
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { name: 'tag', label: 'Tag filter', type: 'string' },
    ],
  },
  {
    name: 'obsidian_backlinks',
    title: 'Backlinks',
    description: 'Notes that [[wikilink]] to a title.',
    category: 'obsidian',
    helperName: 'getObsidianBacklinks',
    fields: [
      {
        name: 'title',
        label: 'Target title',
        type: 'string',
        required: true,
        placeholder: 'Company Handbook',
      },
    ],
  },
  {
    name: 'wikihow_search',
    title: 'Search wikiHow',
    description: 'Remote MediaWiki search (use lang=ko for Korean).',
    category: 'wikihow',
    helperName: 'searchWikiHow',
    fields: [
      {
        name: 'query',
        label: 'Query',
        type: 'string',
        required: true,
        placeholder: 'change a tire',
      },
      {
        name: 'lang',
        label: 'Language',
        type: 'select',
        options: ['en', 'ko', 'ja', 'es', 'pt', 'de', 'fr', 'zh'],
        defaultValue: 'en',
      },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 10 },
    ],
  },
  {
    name: 'wikihow_get_guide',
    title: 'Get guide',
    description: 'Fetch steps for a guide and cache locally.',
    category: 'wikihow',
    helperName: 'getWikiHowGuide',
    fields: [
      {
        name: 'titleOrUrl',
        label: 'Title or URL',
        type: 'string',
        required: true,
        placeholder: 'Change-a-Tire',
      },
      {
        name: 'lang',
        label: 'Language',
        type: 'select',
        options: ['en', 'ko', 'ja', 'es', 'pt', 'de', 'fr', 'zh'],
        defaultValue: 'en',
      },
    ],
  },
  {
    name: 'wikihow_list_cached',
    title: 'List cached',
    description: 'Guides already stored in knowledge-wiki.db.',
    category: 'wikihow',
    helperName: 'listCachedWikiHow',
    fields: [
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      {
        name: 'lang',
        label: 'Language filter',
        type: 'select',
        options: ['', 'en', 'ko', 'ja'],
      },
    ],
  },
  {
    name: 'wikihow_search_cached',
    title: 'Search cached',
    description: 'Offline search over cached wikiHow guides.',
    category: 'wikihow',
    helperName: 'searchCachedWikiHow',
    fields: [
      {
        name: 'query',
        label: 'Query',
        type: 'string',
        required: true,
        placeholder: 'tire',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'obsidian', label: 'Obsidian' },
  { key: 'wikihow', label: 'wikiHow' },
];

export default function KnowledgeWikiPlayground() {
  const [lastTitleOrUrl, setLastTitleOrUrl] = useState<string | null>(null);
  const [lastNotePath, setLastNotePath] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (tool === 'wikihow_search' && Array.isArray(parsed) && parsed[0]?.title) {
      setLastTitleOrUrl(parsed[0].title);
    }
    if (tool === 'obsidian_search' && Array.isArray(parsed) && parsed[0]?.path) {
      setLastNotePath(parsed[0].path);
    }
    if (tool === 'obsidian_list_notes' && Array.isArray(parsed) && parsed[0]?.path) {
      setLastNotePath(parsed[0].path);
    }
  }, []);

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      if (tool.name === 'wikihow_get_guide' && lastTitleOrUrl) {
        return { titleOrUrl: lastTitleOrUrl };
      }
      if (tool.name === 'obsidian_get_note' && lastNotePath) {
        return { path: lastNotePath };
      }
      return {};
    },
    [lastTitleOrUrl, lastNotePath]
  );

  const renderDisplay = useCallback((data: any, tool: string) => {
    const {
      miniLabelStyle,
      tableWrapStyle,
      tableStyle,
      thStyle,
      tdStyle,
      inlineCodeStyle,
      secondaryBtnStyle,
    } = playgroundStyles;

    if (Array.isArray(data) && data.length > 0 && (tool.includes('search') || tool.includes('list'))) {
      return (
        <div>
          <div style={miniLabelStyle}>Results ({data.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Source / Path</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 40).map((row: any, i: number) => {
                  const title = row.title || '—';
                  const meta =
                    row.source ||
                    row.path ||
                    row.url ||
                    row.lang ||
                    row.id ||
                    '—';
                  return (
                    <tr key={row.id || row.path || row.url || i}>
                      <td style={tdStyle}>{title}</td>
                      <td style={tdStyle}>
                        <code style={inlineCodeStyle}>{String(meta).slice(0, 80)}</code>
                      </td>
                      <td style={tdStyle}>
                        {(row.url || row.title) && tool.startsWith('wikihow') && (
                          <button
                            onClick={() => setLastTitleOrUrl(row.url || row.title)}
                            style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                          >
                            Use
                          </button>
                        )}
                        {row.path && tool.startsWith('obsidian') && (
                          <button
                            onClick={() => setLastNotePath(row.path)}
                            style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                          >
                            Use path
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (tool === 'wikihow_get_guide' && Array.isArray(data?.steps)) {
      return (
        <div>
          <div style={miniLabelStyle}>
            {data.title} — {data.steps.length} steps
          </div>
          <ol style={{ paddingLeft: 20, fontSize: 13, lineHeight: 1.55 }}>
            {data.steps.map((s: any) => (
              <li key={s.number} style={{ marginBottom: 8 }}>
                {s.title ? <strong>{s.title}: </strong> : null}
                {s.text}
              </li>
            ))}
          </ol>
        </div>
      );
    }

    if (tool === 'obsidian_get_note' && typeof data?.content === 'string') {
      return (
        <pre
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            maxHeight: 480,
            overflowY: 'auto',
            margin: 0,
          }}
        >
          {data.content.slice(0, 12000)}
          {data.content.length > 12000 ? '\n\n… [truncated in display]' : ''}
        </pre>
      );
    }

    return null;
  }, []);

  return (
    <McpPlayground
      currentHref="/knowledge-wiki-mcp"
      eyebrow="EGDesk Knowledge Wiki MCP"
      title="Obsidian + wikiHow Playground"
      subtitle="Index a local Obsidian vault and fetch/cache wikiHow how-to guides so agents can explore knowledge and solve procedural problems."
      apiPath="/api/knowledge-wiki"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#0f766e"
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
