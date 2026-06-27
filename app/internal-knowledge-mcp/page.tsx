'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'businessidentity_list_snapshots',
    title: 'List snapshots',
    description: 'All business identity snapshots, optionally filtered by brand key.',
    category: 'identity',
    helperName: 'listBusinessIdentitySnapshots',
    fields: [
      { name: 'brandKey', label: 'Brand key (optional)', type: 'string', placeholder: 'my-brand' },
    ],
  },
  {
    name: 'businessidentity_get_snapshot',
    title: 'Get snapshot',
    description: 'Full snapshot including company data, services/products, and analysis.',
    category: 'identity',
    helperName: 'getBusinessIdentitySnapshot',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
    ],
  },
  {
    name: 'businessidentity_get_company_info',
    title: 'Company info',
    description: 'Contact, structure, partners, and target industries from a snapshot.',
    category: 'identity',
    helperName: 'getBusinessIdentityCompanyInfo',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
    ],
  },
  {
    name: 'knowledge_list_documents',
    title: 'List documents',
    description: 'Internal knowledge docs for a snapshot — hierarchy, process, policy, note.',
    category: 'knowledge',
    helperName: 'listKnowledgeDocuments',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
      {
        name: 'category',
        label: 'Category (optional)',
        type: 'string',
        placeholder: 'hierarchy | process | policy | note',
      },
    ],
  },
  {
    name: 'knowledge_search_content',
    title: 'Search content',
    description: 'Full-text search in document titles and markdown content.',
    category: 'knowledge',
    helperName: 'searchKnowledgeContent',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
      { name: 'searchText', label: 'Search text', type: 'string', required: true, placeholder: 'onboarding' },
      {
        name: 'category',
        label: 'Category (optional)',
        type: 'string',
        placeholder: 'hierarchy | process | policy | note',
      },
    ],
  },
  {
    name: 'knowledge_get_document',
    title: 'Get document',
    description: 'Load one knowledge document with full markdown content.',
    category: 'knowledge',
    helperName: 'getKnowledgeDocument',
    fields: [
      { name: 'documentId', label: 'Document ID', type: 'string', required: true },
    ],
  },
  {
    name: 'knowledge_get_by_category',
    title: 'By category',
    description: 'All documents of one category for a snapshot.',
    category: 'knowledge',
    helperName: 'getKnowledgeByCategory',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: ['hierarchy', 'process', 'policy', 'note'],
        required: true,
        defaultValue: 'process',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'identity', label: 'Business identity' },
  { key: 'knowledge', label: 'Knowledge' },
];

type Snapshot = { id?: string; snapshotId?: string; brandKey?: string; createdAt?: string };
type Doc = { id?: string; documentId?: string; title?: string; category?: string };

function snapId(s: Snapshot): string {
  return s.id || s.snapshotId || '';
}

function docId(d: Doc): string {
  return d.id || d.documentId || '';
}

export default function InternalKnowledgePlayground() {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (tool === 'businessidentity_list_snapshots') {
      const snaps = Array.isArray(parsed?.snapshots) ? parsed.snapshots : Array.isArray(parsed) ? parsed : [];
      if (snaps[0]) setSelectedSnapshotId(snapId(snaps[0]));
    }
    const docs = Array.isArray(parsed?.documents) ? parsed.documents : Array.isArray(parsed?.results) ? parsed.results : [];
    if (docs[0] && tool.includes('knowledge')) {
      setSelectedDocumentId(docId(docs[0]));
    }
    if (parsed?.id && tool.includes('knowledge_get_document')) {
      setSelectedDocumentId(String(parsed.id));
    }
  }, []);

  const getDefaultFieldValues = useCallback((tool: PlaygroundToolDef) => {
    const defaults: Record<string, string> = {};
    if (selectedSnapshotId && tool.fields.some(f => f.name === 'snapshotId')) {
      defaults.snapshotId = selectedSnapshotId;
    }
    if (selectedDocumentId && tool.fields.some(f => f.name === 'documentId')) {
      defaults.documentId = selectedDocumentId;
    }
    return defaults;
  }, [selectedSnapshotId, selectedDocumentId]);

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

    const snapshots: Snapshot[] = Array.isArray(data?.snapshots)
      ? data.snapshots
      : Array.isArray(data) && tool.includes('list_snapshots')
        ? data
        : [];

    if (snapshots.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Snapshots ({snapshots.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Brand</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap, i) => {
                  const id = snapId(snap);
                  return (
                    <tr key={id || i}>
                      <td style={tdStyle}>{snap.brandKey || '—'}</td>
                      <td style={tdStyle}><code style={inlineCodeStyle}>{id || '—'}</code></td>
                      <td style={tdStyle}>{snap.createdAt || '—'}</td>
                      <td style={tdStyle}>
                        {id && (
                          <button
                            onClick={() => setSelectedSnapshotId(id)}
                            style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                          >
                            Select
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

    const docs: Doc[] = Array.isArray(data?.documents)
      ? data.documents
      : Array.isArray(data?.results)
        ? data.results
        : [];

    if (docs.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Documents ({docs.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, i) => {
                  const id = docId(doc);
                  return (
                    <tr key={id || i}>
                      <td style={tdStyle}>{doc.title || '—'}</td>
                      <td style={tdStyle}>{doc.category || '—'}</td>
                      <td style={tdStyle}><code style={inlineCodeStyle}>{id || '—'}</code></td>
                      <td style={tdStyle}>
                        {id && (
                          <button
                            onClick={() => setSelectedDocumentId(id)}
                            style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                          >
                            Select
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

    if (typeof data?.content === 'string' && data.content.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>{data.title || 'Document'}</div>
          <pre style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            maxHeight: 480,
            overflowY: 'auto',
            margin: 0,
          }}>
            {data.content.slice(0, 10000)}
            {data.content.length > 10000 ? '\n\n… [truncated]' : ''}
          </pre>
        </div>
      );
    }

    if (data?.companyInfo || data?.company) {
      const info = data.companyInfo || data.company;
      return (
        <pre style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          padding: 12,
          fontSize: 12,
          lineHeight: 1.5,
          maxHeight: 400,
          overflowY: 'auto',
          margin: 0,
        }}>
          {JSON.stringify(info, null, 2)}
        </pre>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={playgroundStyles.miniLabelStyle}>Snapshot ID</div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {selectedSnapshotId ? (
            <code style={playgroundStyles.inlineCodeStyle}>{selectedSnapshotId}</code>
          ) : 'List snapshots first'}
        </p>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={playgroundStyles.miniLabelStyle}>Document ID</div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {selectedDocumentId ? (
            <code style={playgroundStyles.inlineCodeStyle}>{selectedDocumentId}</code>
          ) : 'List or search documents'}
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/internal-knowledge-mcp"
      eyebrow="EGDesk Internal Knowledge MCP"
      title="Internal Knowledge Playground"
      subtitle="Browse business identity snapshots and internal knowledge documents. Create snapshots in EGDesk Business Identity first."
      apiPath="/api/internal-knowledge"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#0891b2"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
