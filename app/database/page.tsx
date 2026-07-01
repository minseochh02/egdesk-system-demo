'use client';

import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';
import { getDemoNavLinks } from '@/lib/demo-pages';

// ── Tool definitions ────────────────────────────────────────────────────────

type FieldDef = {
  name: string;
  label: string;
  type: 'string' | 'boolean' | 'select' | 'number' | 'json' | 'table-select' | 'textarea';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | boolean | number;
  hint?: string;
};

type ToolDef = {
  name: string;
  title: string;
  description: string;
  fields: FieldDef[];
  category: 'read' | 'write' | 'advanced' | 'files';
};

type TableMeta = {
  name: string;
  displayName: string;
  columns: string[];
  rowCount: number | null;
};

const TOOLS: ToolDef[] = [
  {
    name: 'queryTable',
    title: 'Query table',
    description: 'Fetch rows with optional filters, sort, and pagination — no SQL required.',
    category: 'read',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { name: 'offset', label: 'Offset', type: 'number', defaultValue: 0 },
      { name: 'orderBy', label: 'Order by column', type: 'string', placeholder: 'created_at' },
      {
        name: 'orderDirection',
        label: 'Sort direction',
        type: 'select',
        options: ['ASC', 'DESC'],
        defaultValue: 'ASC',
      },
      {
        name: 'filters',
        label: 'Filters (JSON)',
        type: 'json',
        placeholder: '{"status": "active"}',
        hint: 'Key-value pairs matched as exact column filters.',
      },
    ],
  },
  {
    name: 'searchTable',
    title: 'Search table',
    description: 'Full-text search across all columns in a table.',
    category: 'read',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      { name: 'searchQuery', label: 'Search query', type: 'string', required: true, placeholder: 'demo' },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
    ],
  },
  {
    name: 'listTables',
    title: 'List tables',
    description: 'List every table in this EGDesk project.',
    category: 'read',
    fields: [],
  },
  {
    name: 'getTableSchema',
    title: 'Get schema',
    description: 'Inspect column names and types for a table.',
    category: 'read',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
    ],
  },
  {
    name: 'insertRows',
    title: 'Insert rows',
    description: 'Insert one or more rows. Values must match column names.',
    category: 'write',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      {
        name: 'rows',
        label: 'Rows (JSON array)',
        type: 'json',
        required: true,
        placeholder: '[{"name": "Widget", "price": "9.99"}]',
        hint: 'Use "Fill demo row" to generate a sample from the table columns.',
      },
    ],
  },
  {
    name: 'updateRows',
    title: 'Update rows',
    description: 'Update columns on rows matched by id or filters.',
    category: 'write',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      {
        name: 'updates',
        label: 'Updates (JSON object)',
        type: 'json',
        required: true,
        placeholder: '{"status": "shipped"}',
      },
      {
        name: 'ids',
        label: 'Row IDs (JSON array, optional)',
        type: 'json',
        placeholder: '[1, 2, 3]',
      },
      {
        name: 'filters',
        label: 'Filters (JSON, optional)',
        type: 'json',
        placeholder: '{"status": "pending"}',
      },
    ],
  },
  {
    name: 'deleteRows',
    title: 'Delete rows',
    description: 'Delete rows matched by id or filters.',
    category: 'write',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      {
        name: 'ids',
        label: 'Row IDs (JSON array, optional)',
        type: 'json',
        placeholder: '[1, 2, 3]',
      },
      {
        name: 'filters',
        label: 'Filters (JSON, optional)',
        type: 'json',
        placeholder: '{"status": "archived"}',
      },
    ],
  },
  {
    name: 'aggregateTable',
    title: 'Aggregate',
    description: 'Run SUM, AVG, MIN, MAX, or COUNT on a column.',
    category: 'advanced',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      { name: 'column', label: 'Column', type: 'string', required: true, placeholder: 'price' },
      {
        name: 'function',
        label: 'Function',
        type: 'select',
        options: ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'],
        defaultValue: 'COUNT',
        required: true,
      },
      { name: 'groupBy', label: 'Group by column (optional)', type: 'string', placeholder: 'category' },
      {
        name: 'filters',
        label: 'Filters (JSON, optional)',
        type: 'json',
        placeholder: '{"status": "active"}',
      },
    ],
  },
  {
    name: 'executeSQL',
    title: 'SQL query',
    description: 'Run a read-only SELECT query against your EGDesk database.',
    category: 'advanced',
    fields: [
      {
        name: 'query',
        label: 'SQL (SELECT only)',
        type: 'textarea',
        required: true,
        placeholder: 'SELECT * FROM products LIMIT 10',
      },
    ],
  },
  {
    name: 'uploadFile',
    title: 'Upload file',
    description: 'Upload a file to a table row. Data is base64-encoded. <10KB = blob, 10-100KB = gzip blob, >100KB = filesystem.',
    category: 'files',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      { name: 'rowId', label: 'Row ID', type: 'number', required: true, placeholder: '1' },
      { name: 'columnName', label: 'Column name', type: 'string', required: true, placeholder: 'attachment' },
      { name: 'filename', label: 'Filename', type: 'string', required: true, placeholder: 'report.pdf' },
      { name: 'data', label: 'File data (base64)', type: 'textarea', required: true, placeholder: 'SGVsbG8gV29ybGQ=', hint: 'Use the file picker below to select a file, or paste base64 directly.' },
      { name: 'mimeType', label: 'MIME type (optional)', type: 'string', placeholder: 'application/pdf' },
      {
        name: 'forceStorageType',
        label: 'Force storage type (optional)',
        type: 'select',
        options: ['', 'blob', 'file'],
      },
    ],
  },
  {
    name: 'downloadFile',
    title: 'Download file',
    description: 'Download a file by ID or by (table, row, column) lookup.',
    category: 'files',
    fields: [
      { name: 'fileId', label: 'File ID (optional)', type: 'string', placeholder: 'uuid' },
      { name: 'tableName', label: 'Table (if no file ID)', type: 'table-select' },
      { name: 'rowId', label: 'Row ID (if no file ID)', type: 'number', placeholder: '1' },
      { name: 'columnName', label: 'Column name (if no file ID)', type: 'string', placeholder: 'attachment' },
    ],
  },
  {
    name: 'deleteFile',
    title: 'Delete file',
    description: 'Delete a file by ID or by (table, row, column) lookup.',
    category: 'files',
    fields: [
      { name: 'fileId', label: 'File ID (optional)', type: 'string', placeholder: 'uuid' },
      { name: 'tableName', label: 'Table (if no file ID)', type: 'table-select' },
      { name: 'rowId', label: 'Row ID (if no file ID)', type: 'number', placeholder: '1' },
      { name: 'columnName', label: 'Column name (if no file ID)', type: 'string', placeholder: 'attachment' },
    ],
  },
  {
    name: 'listFiles',
    title: 'List files',
    description: 'List all files attached to a specific table row.',
    category: 'files',
    fields: [
      { name: 'tableName', label: 'Table', type: 'table-select', required: true },
      { name: 'rowId', label: 'Row ID', type: 'number', required: true, placeholder: '1' },
    ],
  },
  {
    name: 'getFileStats',
    title: 'File stats',
    description: 'Get file storage statistics for all tables or a specific table.',
    category: 'files',
    fields: [
      { name: 'tableName', label: 'Table (optional)', type: 'table-select' },
    ],
  },
];

const CATEGORIES = [
  { key: 'read', label: 'Read' },
  { key: 'write', label: 'Write' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'files', label: 'Files' },
] as const;

type HistoryEntry = {
  id: number;
  helper: string;
  args: Record<string, any>;
  result: any;
  error?: string;
  timestamp: number;
  durationMs: number;
};

// ── Pub/Sub types ──────────────────────────────────────────────────────────

interface UserDataChangeEvent {
  kind: 'schema' | 'data';
  action: 'create_table' | 'delete_table' | 'rename_table' | 'insert' | 'update' | 'delete';
  tableName?: string;
  tableId?: string;
  source?: 'mcp' | 'ipc' | 'sync' | 'import';
}

interface PubSubNotification {
  id: number;
  title: string;
  body: string;
  time: string;
  action: string;
}

type TabKey = 'playground' | 'realtime';

// ── Page ────────────────────────────────────────────────────────────────────

export default function DatabasePlayground() {
  const [activeTab, setActiveTab] = useState<TabKey>('playground');
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolDef>(TOOLS[0]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [landingHref, setLandingHref] = useState('/');
  const [navLinks, setNavLinks] = useState<{ href: string; label: string }[]>([]);
  const nextId = useRef(1);

  // Pub/Sub state
  const [sseConnected, setSseConnected] = useState(false);
  const [notifications, setNotifications] = useState<PubSubNotification[]>([]);
  const [orderName, setOrderName] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderStatus, setOrderStatus] = useState('pending');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const notifIdCounter = useRef(0);

  const loadMeta = useCallback(async () => {
    setMetaError(null);
    try {
      const res = await apiFetch('/api/database/meta');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load tables');
      setTables(json.tables ?? []);
    } catch (err: any) {
      setMetaError(err.message || String(err));
      setTables([]);
    }
  }, []);

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setLandingHref(bp || '/');
    setNavLinks(getDemoNavLinks(bp, '/database'));
    loadMeta();
  }, [loadMeta]);

  // ── Pub/Sub SSE logic ──────────────────────────────────────────────────────

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const apiUrl = process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080';
    const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY || '';
    const sseUrl = apiKey ? `${apiUrl}/user-data/sse?key=${encodeURIComponent(apiKey)}` : `${apiUrl}/user-data/sse`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.method !== 'egdesk/user-data-changed') return;
        const evt: UserDataChangeEvent = msg.params;
        const id = ++notifIdCounter.current;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const table = evt.tableName || 'unknown';
        let title = 'Data changed';
        if (evt.action === 'insert') title = 'New order received';
        else if (evt.action === 'update') title = 'Order updated';
        else if (evt.action === 'delete') title = 'Order removed';
        else if (evt.action === 'create_table') title = 'Table created';
        setNotifications((prev) => [{ id, title, body: `${evt.action} on "${table}"`, time, action: evt.action }, ...prev].slice(0, 20));
      } catch { /* ignore */ }
    });

    es.addEventListener('connected', () => setSseConnected(true));
    es.addEventListener('open', () => setSseConnected(true));
    es.addEventListener('error', () => setSseConnected(false));
  }, []);

  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    setSseConnected(false);
  }, []);

  useEffect(() => {
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, []);

  const handleSubmitOrder = async () => {
    if (!orderName.trim()) return;
    setOrderSubmitting(true);
    setOrderMessage(null);
    try {
      const res = await apiFetch('/api/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          helper: 'insertRows',
          arguments: {
            tableName: 'orders',
            rows: [{ customer_name: orderName.trim(), amount: orderAmount || '0', status: orderStatus, created_at: new Date().toISOString() }],
          },
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setOrderMessage('Order saved!');
        setOrderName('');
        setOrderAmount('');
      } else {
        setOrderMessage(`Error: ${data?.error || 'Unknown'}`);
      }
    } catch (err: any) {
      setOrderMessage(`Error: ${err.message}`);
    }
    setOrderSubmitting(false);
  };

  // ── End Pub/Sub logic ──────────────────────────────────────────────────────

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of selectedTool.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = String(field.defaultValue);
      }
    }
    if (selectedTable && selectedTool.fields.some(f => f.name === 'tableName')) {
      defaults.tableName = selectedTable;
    }
    setFieldValues(defaults);
  }, [selectedTool, selectedTable]);

  const recordResult = useCallback((
    helper: string,
    args: Record<string, any>,
    parsed: any,
    durationMs: number,
    error?: string,
  ) => {
    const entry: HistoryEntry = {
      id: nextId.current++,
      helper,
      args,
      result: parsed,
      error,
      timestamp: Date.now(),
      durationMs,
    };
    setHistory(prev => [entry, ...prev]);
    setExpandedEntry(entry.id);
    return entry;
  }, []);

  const buildArgs = (tool: ToolDef, values: Record<string, string>): Record<string, any> => {
    const args: Record<string, any> = {};

    for (const field of tool.fields) {
      const raw = values[field.name];
      if (raw === undefined || raw === '') continue;

      if (field.type === 'json') {
        try {
          args[field.name] = JSON.parse(raw);
        } catch {
          throw new Error(`Invalid JSON in "${field.label}"`);
        }
      } else if (field.type === 'number') {
        args[field.name] = Number(raw);
      } else if (field.type === 'boolean') {
        args[field.name] = raw === 'true';
      } else {
        args[field.name] = raw;
      }
    }

    return args;
  };

  const callHelper = async (helper: string, args: Record<string, any>): Promise<any> => {
    const res = await apiFetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helper, arguments: args }),
    });
    return res.json();
  };

  const parseHelperResult = (raw: any): any => {
    if (raw?.success === false) {
      throw new Error(raw.error || 'Request failed');
    }
    return raw?.result ?? raw;
  };

  const handleRun = async () => {
    let args: Record<string, any> = {};
    try {
      args = buildArgs(selectedTool, fieldValues);
    } catch (err: any) {
      recordResult(selectedTool.name, {}, null, 0, err.message || String(err));
      return;
    }

    for (const field of selectedTool.fields) {
      if (field.required && (args[field.name] === undefined || args[field.name] === '')) {
        recordResult(selectedTool.name, args, null, 0, `"${field.label}" is required`);
        return;
      }
    }

    setRunning(true);
    const start = Date.now();

    try {
      const raw = await callHelper(selectedTool.name, args);
      const parsed = parseHelperResult(raw);
      recordResult(selectedTool.name, args, parsed, Date.now() - start);

      if (args.tableName) {
        setSelectedTable(args.tableName);
      }

      if (selectedTool.name === 'listTables' && Array.isArray(parsed?.tables)) {
        setTables(parsed.tables.map((t: any) => ({
          name: t.name || t.tableName,
          displayName: t.displayName || t.name,
          columns: t.columns || [],
          rowCount: t.rowCount ?? null,
        })));
      }

      if (selectedTool.name === 'insertRows' || selectedTool.name === 'deleteRows' || selectedTool.name === 'updateRows') {
        loadMeta();
      }
    } catch (err: any) {
      recordResult(selectedTool.name, args, null, Date.now() - start, err.message || String(err));
    } finally {
      setRunning(false);
    }
  };

  const setField = (name: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
    if (name === 'tableName') {
      setSelectedTable(value || null);
    }
  };

  const fillDemoRow = () => {
    const tableName = fieldValues.tableName;
    const table = tables.find(t => t.name === tableName);
    if (!table) return;

    const demoRow: Record<string, string> = {};
    const stamp = Date.now();
    for (const col of table.columns) {
      if (col === 'id') continue;
      demoRow[col] = `demo_${col}_${stamp}`;
    }

    setField('rows', JSON.stringify([demoRow], null, 2));
  };

  const displayEntry = history.find(e => e.id === expandedEntry) ?? history[0];

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <a href={landingHref} style={navLinkStyle}>Back to landing</a>
          {navLinks.map(link => (
            <a key={link.href} href={link.href} style={navLinkStyle}>{link.label}</a>
          ))}
        </div>
        <div style={eyebrowStyle}>EGDesk Database</div>
        <h1 style={titleStyle}>Query Playground</h1>
        <p style={subtitleStyle}>
          Try every generated helper — queryTable, insertRows, updateRows, and more. EGDesk must be running with your project open.
        </p>
      </header>

      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <div style={tabBarStyle}>
        <button
          onClick={() => setActiveTab('playground')}
          style={{ ...tabBtnStyle, ...(activeTab === 'playground' ? tabBtnActiveStyle : {}) }}
        >
          Query Playground
        </button>
        <button
          onClick={() => setActiveTab('realtime')}
          style={{ ...tabBtnStyle, ...(activeTab === 'realtime' ? tabBtnActiveStyle : {}) }}
        >
          Real-Time Events
        </button>
      </div>

      {activeTab === 'playground' && (<>
      <div style={sessionBarStyle}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={miniLabelStyle}>Configured tables</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
            {tables.length > 0 ? `${tables.length} table${tables.length !== 1 ? 's' : ''}` : 'None loaded'}
          </p>
          <p style={hintStyle}>
            From <code style={inlineCodeStyle}>egdesk.config.ts</code> — regenerated when your schema changes.
          </p>
          {metaError && (
            <p style={{ ...hintStyle, color: '#b45309', marginTop: 6 }}>
              {metaError} — run <code style={inlineCodeStyle}>npx egdesk-next-setup</code> after importing data.
            </p>
          )}
        </div>
        <div style={sessionPillsStyle}>
          {selectedTable ? (
            <span style={selectedTablePillStyle}>
              Table: <code style={inlineCodeStyle}>{selectedTable}</code>
            </span>
          ) : (
            <span style={statusBadgeStyle}>No table selected</span>
          )}
          <button onClick={loadMeta} style={secondaryBtnStyle}>
            Refresh meta
          </button>
        </div>
      </div>

      <div style={layoutStyle}>
        <div style={leftColStyle}>
          <div style={panelStyle}>
            {CATEGORIES.map(cat => (
              <div key={cat.key} style={{ marginBottom: 16 }}>
                <div style={categoryLabelStyle}>{cat.label}</div>
                <div style={toolTabGridStyle}>
                  {TOOLS.filter(t => t.category === cat.key).map(tool => (
                    <button
                      key={tool.name}
                      onClick={() => setSelectedTool(tool)}
                      style={{
                        ...toolTabStyle,
                        ...(selectedTool.name === tool.name ? toolTabActiveStyle : {}),
                      }}
                    >
                      {tool.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                {selectedTool.title}
              </h2>
              <code style={toolBadgeStyle}>{selectedTool.name}</code>
            </div>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{selectedTool.description}</p>

            <div style={{ display: 'grid', gap: 12 }}>
              {selectedTool.fields.map(field => (
                <div key={field.name}>
                  <label style={labelStyle}>
                    {field.label}
                    {field.required && <span style={{ color: '#dc2626' }}> *</span>}
                  </label>

                  {field.type === 'table-select' ? (
                    <select
                      value={fieldValues[field.name] ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select a table…</option>
                      {tables.map(t => (
                        <option key={t.name} value={t.name}>
                          {t.displayName} ({t.name})
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <select
                      value={fieldValues[field.name] ?? String(field.defaultValue ?? 'true')}
                      onChange={e => setField(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : field.type === 'select' ? (
                    <select
                      value={fieldValues[field.name] ?? (field.defaultValue as string) ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      style={inputStyle}
                    >
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'json' || field.type === 'textarea' ? (
                    <textarea
                      value={fieldValues[field.name] ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.type === 'textarea' ? 5 : 4}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, monospace' }}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={fieldValues[field.name] ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      style={inputStyle}
                    />
                  )}

                  {field.hint && <p style={hintStyle}>{field.hint}</p>}

                  {field.name === 'data' && selectedTool.name === 'uploadFile' && (
                    <input
                      type="file"
                      style={{ marginTop: 6, fontSize: 12 }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setField('filename', file.name);
                        if (file.type) setField('mimeType', file.type);
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = (reader.result as string).split(',')[1] ?? '';
                          setField('data', base64);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  )}

                  {field.name === 'rows' && selectedTool.name === 'insertRows' && (
                    <button
                      type="button"
                      onClick={fillDemoRow}
                      disabled={!fieldValues.tableName}
                      style={{ ...secondaryBtnStyle, marginTop: 8, fontSize: 12, padding: '4px 10px' }}
                    >
                      Fill demo row
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={handleRun} disabled={running} style={runBtnStyle}>
                {running ? 'Running…' : 'Run helper'}
              </button>
            </div>
          </div>

          <div style={infoPanelStyle}>
            <strong style={{ fontSize: 13, color: '#1e40af' }}>How this app calls EGDesk</strong>
            <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: '#1e40af', lineHeight: 1.65 }}>
              <li><code>apiFetch('/api/database')</code> from the browser</li>
              <li>API route calls <code>egdesk-helpers.ts</code> on the server</li>
              <li>Helpers route to your EGDesk project — no credentials in code</li>
            </ol>
          </div>
        </div>

        <div style={rightColStyle}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Display</h2>
            {!displayEntry ? (
              <div style={emptyResultStyle}>
                Run a helper to see tables, row counts, and query results here
              </div>
            ) : displayEntry.error ? (
              <div style={displayPanelStyle}>
                <div style={{ ...statusBadgeStyle, background: '#fef2f2', color: '#991b1b', display: 'inline-block' }}>
                  Error
                </div>
                <p style={{ color: '#991b1b', fontSize: 14, margin: '10px 0 0' }}>{displayEntry.error}</p>
              </div>
            ) : (
              <div style={displayPanelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <code style={toolBadgeStyle}>{displayEntry.helper}</code>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{displayEntry.durationMs}ms</span>
                </div>
                <DisplayResultView data={displayEntry.result} helper={displayEntry.helper} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Results</h2>
            {history.length > 0 && (
              <button
                onClick={() => {
                  setHistory([]);
                  setExpandedEntry(null);
                }}
                style={{ ...secondaryBtnStyle, fontSize: 12, padding: '4px 10px' }}
              >
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div style={{ ...emptyResultStyle, padding: '24px 16px' }}>
              Raw JSON responses appear here
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {history.map(entry => (
                <div key={entry.id} style={resultCardStyle}>
                  <button
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    style={resultHeaderBtnStyle}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{
                        ...resultDotStyle,
                        background: entry.error ? '#ef4444' : '#22c55e',
                      }} />
                      <code style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.helper}
                      </code>
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {entry.durationMs}ms
                    </span>
                  </button>

                  {expandedEntry === entry.id && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={miniLabelStyle}>Arguments</div>
                        <pre style={resultCodeStyle}>
                          {JSON.stringify(entry.args, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div style={miniLabelStyle}>{entry.error ? 'Error' : 'Response'}</div>
                        <pre style={{
                          ...resultCodeStyle,
                          ...(entry.error ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } : {}),
                        }}>
                          {entry.error
                            ? entry.error
                            : JSON.stringify(entry.result, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>)}

      {/* ── Real-Time Events tab ────────────────────────────────────── */}
      {activeTab === 'realtime' && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* SSE connection bar */}
          <div style={sessionBarStyle}>
            <div style={{ flex: 1 }}>
              <div style={miniLabelStyle}>SSE connection</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: sseConnected ? '#047857' : '#6b7280', margin: '4px 0 0' }}>
                {sseConnected ? 'Connected — listening for events' : 'Disconnected'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!sseConnected ? (
                <button onClick={connectSSE} style={runBtnStyle}>Connect</button>
              ) : (
                <button onClick={disconnectSSE} style={secondaryBtnStyle}>Disconnect</button>
              )}
            </div>
          </div>

          {/* Split-screen: Desktop + Mobile */}
          <div style={splitScreenStyle}>
            {/* Desktop frame — order form */}
            <div style={desktopFrameStyle}>
              <div style={desktopTitleBarStyle}>
                <span style={desktopDotStyle('#ef4444')} />
                <span style={desktopDotStyle('#f59e0b')} />
                <span style={desktopDotStyle('#22c55e')} />
                <span style={{ marginLeft: 10, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>EGDesk — Orders</span>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>New Order</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Customer name *</label>
                    <input
                      type="text"
                      value={orderName}
                      onChange={e => setOrderName(e.target.value)}
                      placeholder="Kim Minseo"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Amount</label>
                    <input
                      type="text"
                      value={orderAmount}
                      onChange={e => setOrderAmount(e.target.value)}
                      placeholder="50000"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} style={inputStyle}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="shipped">Shipped</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSubmitOrder}
                    disabled={orderSubmitting || !orderName.trim()}
                    style={{ ...runBtnStyle, marginTop: 4, opacity: (!orderName.trim() || orderSubmitting) ? 0.5 : 1 }}
                  >
                    {orderSubmitting ? 'Saving…' : 'Insert order'}
                  </button>
                  {orderMessage && (
                    <p style={{ fontSize: 13, color: orderMessage.startsWith('Error') ? '#dc2626' : '#047857', margin: 0 }}>
                      {orderMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div style={arrowStyle}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M8 20H32M32 20L24 12M32 20L24 28" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>SSE push</span>
            </div>

            {/* Phone frame — notifications */}
            <div style={phoneFrameStyle}>
              <div style={phoneNotchStyle} />
              <div style={phoneStatusBarStyle}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>9:41</span>
                <button
                  onClick={() => window.open(`${getEgdeskBasePath()}/pubsub`, '_blank', 'width=420,height=700')}
                  style={openTabBtnStyle}
                  title="Open in separate window"
                >
                  &#8599;
                </button>
              </div>
              <div style={phoneContentStyle}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '40px 16px' }}>
                    {sseConnected ? 'Waiting for events…' : 'Connect SSE to see push notifications'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {notifications.map(n => (
                      <div key={n.id} style={notifCardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{n.title}</span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{n.time}</span>
                        </div>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info panel */}
          <div style={infoPanelStyle}>
            <strong style={{ fontSize: 13, color: '#1e40af' }}>How real-time events work</strong>
            <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, color: '#1e40af', lineHeight: 1.65 }}>
              <li>Insert an order using the form above (or the Query Playground tab)</li>
              <li>EGDesk broadcasts <code style={inlineCodeStyle}>egdesk/user-data-changed</code> via SSE</li>
              <li>The phone receives a push-style notification in real time</li>
              <li>In production, use <code style={inlineCodeStyle}>onUserDataChanged()</code> from egdesk-helpers</li>
            </ol>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Display components ──────────────────────────────────────────────────────

function DisplayResultView({ data, helper }: { data: any; helper: string }) {
  if (data == null) {
    return <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>No data returned.</p>;
  }

  if (typeof data !== 'object') {
    return <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{String(data)}</p>;
  }

  const rows = Array.isArray(data.rows) ? data.rows : null;
  const tables = Array.isArray(data.tables) ? data.tables : null;
  const schema = data.schema || data.columns;
  const groupedResults = Array.isArray(data.groupedResults) ? data.groupedResults : null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {(data.tableName || data.total != null || data.limit != null) && (
        <dl style={kvGridStyle}>
          {data.tableName && <><dt style={kvTermStyle}>Table</dt><dd style={kvDescStyle}><code style={inlineCodeStyle}>{data.tableName}</code></dd></>}
          {data.total != null && <><dt style={kvTermStyle}>Total</dt><dd style={kvDescStyle}>{data.total}</dd></>}
          {data.limit != null && <><dt style={kvTermStyle}>Limit</dt><dd style={kvDescStyle}>{data.limit}</dd></>}
          {data.offset != null && <><dt style={kvTermStyle}>Offset</dt><dd style={kvDescStyle}>{data.offset}</dd></>}
          {data.hasMore != null && <><dt style={kvTermStyle}>Has more</dt><dd style={kvDescStyle}>{data.hasMore ? 'yes' : 'no'}</dd></>}
          {data.searchQuery && <><dt style={kvTermStyle}>Search</dt><dd style={kvDescStyle}>{data.searchQuery}</dd></>}
          {data.matchCount != null && <><dt style={kvTermStyle}>Matches</dt><dd style={kvDescStyle}>{data.matchCount}</dd></>}
          {data.value != null && <><dt style={kvTermStyle}>Value</dt><dd style={kvDescStyle}>{String(data.value)}</dd></>}
          {data.function && <><dt style={kvTermStyle}>Function</dt><dd style={kvDescStyle}>{data.function}</dd></>}
          {data.column && <><dt style={kvTermStyle}>Column</dt><dd style={kvDescStyle}>{data.column}</dd></>}
          {data.rowsAffected != null && <><dt style={kvTermStyle}>Rows affected</dt><dd style={kvDescStyle}>{data.rowsAffected}</dd></>}
          {data.insertedCount != null && <><dt style={kvTermStyle}>Inserted</dt><dd style={kvDescStyle}>{data.insertedCount}</dd></>}
        </dl>
      )}

      {tables && tables.length > 0 && (
        <div>
          <div style={miniLabelStyle}>Tables ({tables.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Display name</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Columns</th>
                  <th style={thStyle}>Rows</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t: any, i: number) => (
                  <tr key={t.name || t.tableName || i}>
                    <td style={tdStyle}>{t.displayName || '—'}</td>
                    <td style={tdStyle}><code style={inlineCodeStyle}>{t.name || t.tableName || '—'}</code></td>
                    <td style={tdStyle}>{t.columnCount ?? t.columns?.length ?? '—'}</td>
                    <td style={tdStyle}>{t.rowCount ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {schema && !rows && helper === 'getTableSchema' && (
        <div>
          <div style={miniLabelStyle}>Schema</div>
          {Array.isArray(schema) ? (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Column</th>
                    <th style={thStyle}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {schema.map((col: any, i: number) => (
                    <tr key={col.name || i}>
                      <td style={tdStyle}>{col.name || col}</td>
                      <td style={tdStyle}>{col.type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <KeyValueFallback data={typeof schema === 'object' ? schema : { schema }} />
          )}
        </div>
      )}

      {groupedResults && groupedResults.length > 0 && (
        <div>
          <div style={miniLabelStyle}>Grouped results</div>
          <RowsTable rows={groupedResults} />
        </div>
      )}

      {rows && (
        <div>
          <div style={miniLabelStyle}>
            Rows ({rows.length}{data.total != null ? ` of ${data.total}` : ''})
          </div>
          {rows.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>No rows returned.</p>
          ) : (
            <RowsTable rows={rows} />
          )}
        </div>
      )}

      {!rows?.length && !tables?.length && !groupedResults?.length && helper !== 'getTableSchema' && (
        <KeyValueFallback data={data} />
      )}
    </div>
  );
}

function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach(k => set.add(k));
      return set;
    }, new Set<string>()),
  );

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col} style={thStyle}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col} style={tdStyle}>
                  {row[col] == null
                    ? <span style={{ color: '#9ca3af' }}>—</span>
                    : typeof row[col] === 'object'
                      ? JSON.stringify(row[col])
                      : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyValueFallback({ data }: { data: Record<string, any> }) {
  const skip = new Set(['rows', 'tables', 'groupedResults']);
  const entries = Object.entries(data).filter(([k, v]) => !skip.has(k) && v != null && typeof v !== 'object');

  if (entries.length === 0) {
    return (
      <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
        No visual display for this result — see raw JSON below.
      </p>
    );
  }

  return (
    <dl style={kvGridStyle}>
      {entries.map(([key, value]) => (
        <span key={key} style={{ display: 'contents' }}>
          <dt style={kvTermStyle}>{key}</dt>
          <dd style={kvDescStyle}>{String(value)}</dd>
        </span>
      ))}
    </dl>
  );
}

// ── Styles (aligned with Kakao MCP playground) ─────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '32px 24px 64px',
};

const navLinkStyle: React.CSSProperties = {
  color: '#2563eb',
  fontSize: 14,
  fontWeight: 600,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#047857',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const titleStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 800,
  color: '#111827',
  marginBottom: 8,
};

const subtitleStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: 15,
  lineHeight: 1.6,
};

const layoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '380px 1fr',
  gap: 20,
  alignItems: 'start',
};

const leftColStyle: React.CSSProperties = {
  display: 'grid',
  gap: 16,
};

const rightColStyle: React.CSSProperties = {
  minWidth: 0,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const infoPanelStyle: React.CSSProperties = {
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 10,
  padding: '14px 16px',
};

const categoryLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
};

const toolTabGridStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

const toolTabStyle: React.CSSProperties = {
  padding: '5px 11px',
  fontSize: 13,
  fontWeight: 600,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
};

const toolTabActiveStyle: React.CSSProperties = {
  background: '#047857',
  color: '#fff',
  border: '1px solid #047857',
};

const toolBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 5,
  padding: '2px 6px',
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#9ca3af',
  margin: '4px 0 0',
  lineHeight: 1.5,
};

const sessionBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  alignItems: 'flex-start',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 16,
  marginBottom: 20,
};

const sessionPillsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};

const selectedTablePillStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 8,
  padding: '6px 10px',
};

const statusBadgeStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 20,
  background: '#f3f4f6',
  color: '#6b7280',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#fff',
  color: '#111827',
  boxSizing: 'border-box',
};

const runBtnStyle: React.CSSProperties = {
  padding: '8px 22px',
  fontSize: 14,
  fontWeight: 700,
  background: '#047857',
  color: '#fff',
  border: 'none',
  borderRadius: 7,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
};

const emptyResultStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '48px 24px',
  textAlign: 'center',
  color: '#9ca3af',
  fontSize: 14,
};

const resultCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  overflow: 'hidden',
};

const resultHeaderBtnStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  gap: 8,
};

const resultDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#9ca3af',
  textTransform: 'uppercase',
  marginBottom: 4,
};

const resultCodeStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  padding: 10,
  fontSize: 12,
  lineHeight: 1.5,
  overflowX: 'auto',
  margin: 0,
  maxHeight: 400,
  overflowY: 'auto',
};

const displayPanelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const kvGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: '6px 12px',
  margin: 0,
};

const kvTermStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  margin: 0,
};

const kvDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#111827',
  margin: 0,
};

const inlineCodeStyle: React.CSSProperties = {
  fontSize: 12,
  background: '#f3f4f6',
  padding: '1px 5px',
  borderRadius: 4,
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 700,
  color: '#374151',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid #f3f4f6',
  color: '#111827',
};

// ── Tab bar styles ──────────────────────────────────────────────────────────

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  marginBottom: 20,
  borderBottom: '2px solid #e5e7eb',
};

const tabBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: 600,
  color: '#6b7280',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  marginBottom: -2,
  cursor: 'pointer',
};

const tabBtnActiveStyle: React.CSSProperties = {
  color: '#047857',
  borderBottom: '2px solid #047857',
};

// ── Real-time tab styles ────────────────────────────────────────────────────

const splitScreenStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  flexWrap: 'wrap',
};

const desktopFrameStyle: React.CSSProperties = {
  width: 360,
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};

const desktopTitleBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 14px',
  background: '#f3f4f6',
  borderBottom: '1px solid #e5e7eb',
};

const desktopDotStyle = (color: string): React.CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: color,
});

const arrowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

const phoneFrameStyle: React.CSSProperties = {
  width: 280,
  height: 500,
  background: '#fff',
  border: '3px solid #1f2937',
  borderRadius: 32,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
};

const phoneNotchStyle: React.CSSProperties = {
  width: 100,
  height: 6,
  background: '#1f2937',
  borderRadius: 3,
  margin: '8px auto 0',
};

const phoneStatusBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 20px 6px',
  fontSize: 11,
  fontWeight: 600,
  color: '#374151',
};

const phoneContentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
};

const notifCardStyle: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '10px 12px',
};

const openTabBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 12,
  lineHeight: 1,
  padding: '2px 5px',
  cursor: 'pointer',
  color: '#6b7280',
};
