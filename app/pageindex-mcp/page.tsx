'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

type IndexedDoc = {
  id?: string;
  doc_id?: string;
  name?: string;
  description?: string;
  page_count?: number;
};

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'pageindex_index_document',
    title: 'Index PDF',
    description: 'Build a hierarchical PageIndex tree from a PDF on disk. Takes 30–60s and requires a Gemini API key in EGDesk.',
    category: 'index',
    helperName: 'indexPageIndexPdf',
    fields: [
      {
        name: 'file_path',
        label: 'PDF file',
        type: 'file',
        accept: '.pdf,application/pdf',
        required: true,
        placeholder: '/Users/you/Documents/report.pdf',
        hint: 'Choose a PDF to upload to EGDesk Downloads, or paste an absolute path EGDesk can read directly.',
      },
    ],
  },
  {
    name: 'pageindex_list_documents',
    title: 'List documents',
    description: 'List every PDF indexed in this EGDesk workspace.',
    category: 'browse',
    helperName: 'listPageIndexDocuments',
    fields: [],
  },
  {
    name: 'pageindex_get_document',
    title: 'Get metadata',
    description: 'Name, description, type, and page count for one indexed document.',
    category: 'browse',
    helperName: 'getPageIndexDocument',
    fields: [
      {
        name: 'doc_id',
        label: 'Document ID',
        type: 'string',
        required: true,
        placeholder: 'doc_abc123',
        hint: 'Returned by Index PDF or List documents.',
      },
    ],
  },
  {
    name: 'pageindex_get_structure',
    title: 'Get structure',
    description: 'Hierarchical section tree with titles, page ranges, and summaries — no full page text.',
    category: 'browse',
    helperName: 'getPageIndexStructure',
    fields: [
      {
        name: 'doc_id',
        label: 'Document ID',
        type: 'string',
        required: true,
        placeholder: 'doc_abc123',
      },
    ],
  },
  {
    name: 'pageindex_get_pages',
    title: 'Get pages',
    description: 'Fetch raw text for specific pages. Use Get structure first to find relevant ranges.',
    category: 'read',
    helperName: 'getPageIndexPages',
    fields: [
      {
        name: 'doc_id',
        label: 'Document ID',
        type: 'string',
        required: true,
        placeholder: 'doc_abc123',
      },
      {
        name: 'pages',
        label: 'Pages',
        type: 'string',
        required: true,
        placeholder: '5-7',
        hint: 'Examples: "5", "3,8", "5-7", "1,3,5-7"',
      },
    ],
  },
  {
    name: 'pageindex_delete_document',
    title: 'Delete document',
    description: 'Remove an indexed document and its stored tree from the PageIndex workspace.',
    category: 'manage',
    helperName: 'deletePageIndexDocument',
    fields: [
      {
        name: 'doc_id',
        label: 'Document ID',
        type: 'string',
        required: true,
        placeholder: 'doc_abc123',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'index', label: 'Index' },
  { key: 'browse', label: 'Browse' },
  { key: 'read', label: 'Read' },
  { key: 'manage', label: 'Manage' },
];

const RUNNING_HINTS: Record<string, string> = {
  pageindex_index_document: 'Gemini is building the hierarchical tree — this usually takes 30–60 seconds.',
  pageindex_get_structure: 'Loading section tree…',
  pageindex_get_pages: 'Extracting page text…',
};

function docId(doc: IndexedDoc): string {
  return doc.doc_id || doc.id || '';
}

function StructureTree({ nodes, depth = 0 }: { nodes: any[]; depth?: number }) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: depth === 0 ? 0 : 16, listStyle: 'none' }}>
      {nodes.map((node, i) => (
        <li key={node.id || i} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: '#111827' }}>
            <strong>{node.title || node.name || 'Untitled'}</strong>
            {(node.start_page != null || node.page != null) && (
              <span style={{ color: '#6b7280', marginLeft: 8 }}>
                p.{node.start_page ?? node.page}
                {node.end_page != null && node.end_page !== node.start_page ? `–${node.end_page}` : ''}
              </span>
            )}
          </div>
          {node.summary && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0', lineHeight: 1.5 }}>
              {node.summary}
            </p>
          )}
          {node.children && <StructureTree nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function PageIndexPlayground() {
  const [documents, setDocuments] = useState<IndexedDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (Array.isArray(parsed?.documents)) {
      setDocuments(parsed.documents);
    }
    if (parsed?.doc_id) {
      setSelectedDocId(parsed.doc_id);
    }
  }, []);

  const getDefaultFieldValues = useCallback((tool: PlaygroundToolDef) => {
    if (!selectedDocId) return {};
    if (tool.fields.some(f => f.name === 'doc_id')) {
      return { doc_id: selectedDocId };
    }
    return {};
  }, [selectedDocId]);

  const renderDisplay = useCallback((data: any, tool: string) => {
    const {
      sessionBarStyle,
      sessionPillsStyle,
      statusBadgeStyle,
      miniLabelStyle,
      tableWrapStyle,
      tableStyle,
      thStyle,
      tdStyle,
      inlineCodeStyle,
      secondaryBtnStyle,
      kvGridStyle,
      kvTermStyle,
      kvDescStyle,
    } = playgroundStyles;

    const docs = Array.isArray(data?.documents) ? data.documents : documents;
    const showDocTable = docs.length > 0 && (
      tool === 'pageindex_list_documents' || tool === 'pageindex_index_document'
    );

    const structureNodes =
      data?.structure ??
      data?.sections ??
      data?.tree ??
      (Array.isArray(data?.children) ? data.children : null);

    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {data?.message && (
          <p style={{ fontSize: 14, color: '#065f46', margin: 0 }}>{data.message}</p>
        )}

        {data?.doc_id && (
          <dl style={kvGridStyle}>
            <dt style={kvTermStyle}>doc_id</dt>
            <dd style={kvDescStyle}>
              <code style={inlineCodeStyle}>{data.doc_id}</code>
            </dd>
          </dl>
        )}

        {showDocTable && (
          <div>
            <div style={miniLabelStyle}>Indexed documents ({docs.length})</div>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Pages</th>
                    <th style={thStyle} />
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc, i) => {
                    const id = docId(doc);
                    const isSelected = selectedDocId === id;
                    return (
                      <tr key={id || i} style={isSelected ? { background: '#ecfdf5' } : undefined}>
                        <td style={tdStyle}>{doc.name || '—'}</td>
                        <td style={tdStyle}><code style={inlineCodeStyle}>{id || '—'}</code></td>
                        <td style={tdStyle}>{doc.page_count ?? '—'}</td>
                        <td style={tdStyle}>
                          {id && (
                            <button
                              onClick={() => setSelectedDocId(id)}
                              style={{
                                ...secondaryBtnStyle,
                                fontSize: 12,
                                padding: '3px 8px',
                                ...(isSelected ? { background: '#7c3aed', color: '#fff', border: '1px solid #7c3aed' } : {}),
                              }}
                            >
                              {isSelected ? 'Selected' : 'Select'}
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
        )}

        {structureNodes && (
          <div>
            <div style={miniLabelStyle}>Document structure</div>
            <StructureTree nodes={Array.isArray(structureNodes) ? structureNodes : [structureNodes]} />
          </div>
        )}

        {Array.isArray(data?.pages) && data.pages.length > 0 && (
          <div>
            <div style={miniLabelStyle}>Page content</div>
            {data.pages.map((page: any, i: number) => (
              <div key={page.page ?? i} style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>Page {page.page ?? page.page_number ?? i + 1}</strong>
                <pre style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  padding: 10,
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  marginTop: 6,
                  maxHeight: 240,
                  overflowY: 'auto',
                }}>
                  {page.text ?? page.content ?? JSON.stringify(page, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}

        {data?.name && !showDocTable && (
          <dl style={kvGridStyle}>
            {data.name && <><dt style={kvTermStyle}>Name</dt><dd style={kvDescStyle}>{data.name}</dd></>}
            {data.description && <><dt style={kvTermStyle}>Description</dt><dd style={kvDescStyle}>{data.description}</dd></>}
            {data.page_count != null && <><dt style={kvTermStyle}>Pages</dt><dd style={kvDescStyle}>{data.page_count}</dd></>}
          </dl>
        )}
      </div>
    );
  }, [documents, selectedDocId]);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={playgroundStyles.miniLabelStyle}>Selected document</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {selectedDocId ? (
            <code style={playgroundStyles.inlineCodeStyle}>{selectedDocId}</code>
          ) : 'None — index or list documents first'}
        </p>
        <p style={playgroundStyles.hintStyle}>
          doc_id pre-fills Get structure, Get pages, and Delete tools.
        </p>
      </div>
      <div style={playgroundStyles.sessionPillsStyle}>
        <span style={{
          ...playgroundStyles.statusBadgeStyle,
          background: documents.length > 0 ? '#ede9fe' : '#f3f4f6',
          color: documents.length > 0 ? '#5b21b6' : '#6b7280',
        }}>
          {documents.length} indexed
        </span>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/pageindex-mcp"
      eyebrow="EGDesk PageIndex MCP"
      title="PageIndex Playground"
      subtitle="Index PDFs into a hierarchical tree, inspect structure, and fetch page text. Enable the PageIndex MCP server in EGDesk and set a Gemini API key."
      apiPath="/api/pageindex"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#7c3aed"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
