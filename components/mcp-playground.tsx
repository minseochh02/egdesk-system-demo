'use client';

import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';
import {
  extractUploadedFilePath,
  formatFileSize,
  parseMcpResult,
  readFileAsBase64,
  type FileFieldPayload,
} from '@/lib/mcp-utils';
import { getDemoNavLinks } from '@/lib/demo-pages';

export type PlaygroundFieldDef = {
  name: string;
  label: string;
  type: 'string' | 'boolean' | 'select' | 'number' | 'textarea' | 'json' | 'file';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  /** When true, an empty value on submit uses {@link placeholder} as the argument. */
  usePlaceholderWhenEmpty?: boolean;
  defaultValue?: string | boolean | number;
  hint?: string;
  apiName?: string;
  accept?: string;
  allowManualPath?: boolean;
};

export type PlaygroundToolDef = {
  name: string;
  title: string;
  description: string;
  fields: PlaygroundFieldDef[];
  category: string;
  helperName?: string;
};

export type PlaygroundHistoryEntry = {
  id: number;
  tool: string;
  args: Record<string, any>;
  result: any;
  error?: string;
  timestamp: number;
  durationMs: number;
};

export type McpPlaygroundProps = {
  currentHref: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  apiPath: string;
  tools: PlaygroundToolDef[];
  categories: { key: string; label: string }[];
  runningHints?: Record<string, string>;
  accentColor?: string;
  sessionBar?: React.ReactNode;
  renderDisplay?: (data: any, tool: string) => React.ReactNode;
  onResult?: (tool: string, parsed: any) => void;
  buildExtraArgs?: () => Record<string, any>;
  getDefaultFieldValues?: (tool: PlaygroundToolDef) => Record<string, string>;
  fileUploadApiPath?: string;
  validateBeforeRun?: (tool: PlaygroundToolDef, values: Record<string, string>) => string | null;
  runButtonLabel?: (tool: PlaygroundToolDef) => string;
};

function buildArgs(
  tool: PlaygroundToolDef,
  values: Record<string, string>,
  extra: Record<string, any>,
): Record<string, any> {
  const args: Record<string, any> = { ...extra };

  for (const field of tool.fields) {
    let raw = values[field.name];
    if (raw === undefined || raw === '') {
      if (field.usePlaceholderWhenEmpty && field.placeholder?.trim()) {
        raw = field.placeholder.trim();
      } else {
        continue;
      }
    }

    const apiKey = field.apiName || field.name;

    if (field.type === 'boolean') {
      args[apiKey] = raw === 'true';
    } else if (field.type === 'number') {
      args[apiKey] = Number(raw);
    } else if (field.type === 'json') {
      try {
        args[apiKey] = JSON.parse(raw);
      } catch {
        args[apiKey] = raw;
      }
    } else {
      args[apiKey] = raw;
    }
  }

  return args;
}

async function resolveFieldValues(
  tool: PlaygroundToolDef,
  values: Record<string, string>,
  filePayloads: Record<string, FileFieldPayload>,
  uploadApiPath: string,
): Promise<Record<string, string>> {
  const resolved = { ...values };

  for (const field of tool.fields) {
    if (field.type !== 'file') continue;

    const manualPath = values[field.name]?.trim();
    if (manualPath && !filePayloads[field.name]) {
      resolved[field.name] = manualPath;
      continue;
    }

    const payload = filePayloads[field.name];
    if (!payload) continue;

    const res = await apiFetch(uploadApiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'fs_upload_file',
        arguments: {
          filename: payload.name,
          content: payload.base64,
          encoding: 'base64',
        },
      }),
    });
    const raw = await res.json();
    if (!res.ok || raw?.success === false) {
      throw new Error(
        raw?.error ||
          'Failed to upload file via File System MCP. Enable the File System MCP server in EGDesk.',
      );
    }
    const parsed = parseMcpResult(raw);
    const uploadedPath = extractUploadedFilePath(parsed);
    if (!uploadedPath) {
      throw new Error('Upload succeeded but no file path was returned from EGDesk');
    }
    resolved[field.name] = uploadedPath;
  }

  return resolved;
}

function KeyValueFallback({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data).filter(
    ([, v]) => v != null && typeof v !== 'object',
  );

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

export function McpPlayground({
  currentHref,
  eyebrow,
  title,
  subtitle,
  apiPath,
  tools,
  categories,
  runningHints = {},
  accentColor = '#047857',
  sessionBar,
  renderDisplay,
  onResult,
  buildExtraArgs,
  getDefaultFieldValues,
  fileUploadApiPath = '/api/filesystem',
  validateBeforeRun,
  runButtonLabel,
}: McpPlaygroundProps) {
  const [selectedTool, setSelectedTool] = useState<PlaygroundToolDef>(tools[0]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [filePayloads, setFilePayloads] = useState<Record<string, FileFieldPayload>>({});
  const [fileReading, setFileReading] = useState<Record<string, boolean>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<PlaygroundHistoryEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [navLinks, setNavLinks] = useState<{ href: string; label: string }[]>([]);
  const [landingHref, setLandingHref] = useState('/');
  const [runningHint, setRunningHint] = useState<string | null>(null);
  const [runningElapsedSec, setRunningElapsedSec] = useState(0);
  const nextId = useRef(1);
  const runningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const bp = getEgdeskBasePath();
    setLandingHref(bp || '/');
    setNavLinks(getDemoNavLinks(bp, currentHref));
  }, [currentHref]);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const field of selectedTool.fields) {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = String(field.defaultValue);
      }
    }
    const custom = getDefaultFieldValues?.(selectedTool) ?? {};
    setFieldValues({ ...defaults, ...custom });
    setFilePayloads({});
    setFileReading({});
    setFileErrors({});
  }, [selectedTool, getDefaultFieldValues]);

  useEffect(() => {
    return () => {
      if (runningTimerRef.current) clearInterval(runningTimerRef.current);
    };
  }, []);

  const startRunningTimer = useCallback((toolName: string) => {
    setRunningHint(runningHints[toolName] || 'Waiting for EGDesk…');
    setRunningElapsedSec(0);
    if (runningTimerRef.current) clearInterval(runningTimerRef.current);
    runningTimerRef.current = setInterval(() => {
      setRunningElapsedSec(s => s + 1);
    }, 1000);
  }, [runningHints]);

  const stopRunningTimer = useCallback(() => {
    if (runningTimerRef.current) {
      clearInterval(runningTimerRef.current);
      runningTimerRef.current = null;
    }
    setRunningHint(null);
    setRunningElapsedSec(0);
  }, []);

  const recordResult = useCallback((
    tool: string,
    args: Record<string, any>,
    parsed: any,
    durationMs: number,
    error?: string,
  ) => {
    const entry: PlaygroundHistoryEntry = {
      id: nextId.current++,
      tool,
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

  const handleRun = async () => {
    const validationError = validateBeforeRun?.(selectedTool, fieldValues);
    if (validationError) {
      recordResult(selectedTool.name, {}, null, 0, validationError);
      return;
    }

    for (const field of selectedTool.fields) {
      if (field.type !== 'file' || !field.required) continue;
      const manualPath = fieldValues[field.name]?.trim();
      const payload = filePayloads[field.name];
      if (fileReading[field.name]) {
        recordResult(selectedTool.name, {}, null, 0, `Still reading ${field.label.toLowerCase()}…`);
        return;
      }
      if (fileErrors[field.name]) {
        recordResult(selectedTool.name, {}, null, 0, fileErrors[field.name]);
        return;
      }
      if (!payload && !manualPath) {
        recordResult(selectedTool.name, {}, null, 0, `${field.label} is required`);
        return;
      }
    }

    setRunning(true);
    startRunningTimer(selectedTool.name);

    const start = Date.now();
    let args: Record<string, any> = {};
    try {
      const hasFileUpload = selectedTool.fields.some(
        f => f.type === 'file' && filePayloads[f.name],
      );
      if (hasFileUpload) {
        setRunningHint('Uploading file to EGDesk Downloads via File System MCP…');
      }

      const resolvedValues = await resolveFieldValues(
        selectedTool,
        fieldValues,
        filePayloads,
        fileUploadApiPath,
      );
      args = buildArgs(selectedTool, resolvedValues, buildExtraArgs?.() ?? {});

      if (hasFileUpload) {
        startRunningTimer(selectedTool.name);
      }

      const res = await apiFetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: selectedTool.name, arguments: args }),
      });
      const raw = await res.json();
      const parsed = parseMcpResult(raw);
      recordResult(selectedTool.name, args, parsed, Date.now() - start);
      onResult?.(selectedTool.name, parsed);
    } catch (err: any) {
      recordResult(selectedTool.name, args, null, Date.now() - start, err.message || String(err));
    } finally {
      setRunning(false);
      stopRunningTimer();
    }
  };

  const setField = (name: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
  };

  const loadFile = async (name: string, file: File | null) => {
    setFileErrors(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });

    if (!file) {
      setFilePayloads(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      return;
    }

    setFileReading(prev => ({ ...prev, [name]: true }));
    setFieldValues(prev => ({ ...prev, [name]: '' }));

    try {
      const base64 = await readFileAsBase64(file);
      setFilePayloads(prev => ({
        ...prev,
        [name]: { name: file.name, size: file.size, base64 },
      }));
    } catch (err: any) {
      setFilePayloads(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      setFileErrors(prev => ({
        ...prev,
        [name]: err?.message || 'Could not read the selected file. Try choosing it again.',
      }));
    } finally {
      setFileReading(prev => ({ ...prev, [name]: false }));
    }
  };

  const displayEntry = history.find(e => e.id === expandedEntry) ?? history[0];
  const activeTabStyle: React.CSSProperties = {
    background: accentColor,
    color: '#fff',
    border: `1px solid ${accentColor}`,
  };
  const runBtnStyle: React.CSSProperties = {
    ...baseRunBtnStyle,
    background: accentColor,
  };

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <a href={landingHref} style={navLinkStyle}>Back to landing</a>
          {navLinks.map(link => (
            <a key={link.href} href={link.href} style={navLinkStyle}>{link.label}</a>
          ))}
        </div>
        <div style={{ ...eyebrowStyle, color: accentColor }}>{eyebrow}</div>
        <h1 style={titleStyle}>{title}</h1>
        <p style={subtitleStyle}>{subtitle}</p>
      </header>

      {sessionBar}

      <div style={layoutStyle}>
        <div style={leftColStyle}>
          <div style={panelStyle}>
            {categories.map(cat => {
              const catTools = tools.filter(t => t.category === cat.key);
              if (catTools.length === 0) return null;
              return (
                <div key={cat.key} style={{ marginBottom: 16 }}>
                  <div style={categoryLabelStyle}>{cat.label}</div>
                  <div style={toolTabGridStyle}>
                    {catTools.map(tool => (
                      <button
                        key={tool.name}
                        onClick={() => setSelectedTool(tool)}
                        style={{
                          ...toolTabStyle,
                          ...(selectedTool.name === tool.name ? activeTabStyle : {}),
                        }}
                      >
                        {tool.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                {selectedTool.title}
              </h2>
              {selectedTool.helperName && (
                <code style={helperBadgeStyle}>{selectedTool.helperName}()</code>
              )}
            </div>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{selectedTool.description}</p>

            <div style={{ display: 'grid', gap: 12 }}>
              {selectedTool.fields.map(field => (
                <div key={field.name}>
                  <label style={labelStyle}>
                    {field.label}
                    {field.required && <span style={{ color: '#dc2626' }}> *</span>}
                  </label>
                  {field.type === 'boolean' ? (
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
                      {field.usePlaceholderWhenEmpty && field.placeholder && (
                        <option value="">
                          {field.placeholder.includes('(')
                            ? field.placeholder
                            : `Default (${field.placeholder})`}
                        </option>
                      )}
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt || '(none)'}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={fieldValues[field.name] ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  ) : field.type === 'json' ? (
                    <textarea
                      value={fieldValues[field.name] ?? ''}
                      onChange={e => setField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
                    />
                  ) : field.type === 'file' ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{
                          ...filePickerBtnStyle,
                          opacity: fileReading[field.name] ? 0.6 : 1,
                          pointerEvents: fileReading[field.name] ? 'none' : 'auto',
                        }}>
                          {fileReading[field.name] ? 'Reading file…' : 'Choose file'}
                          <input
                            type="file"
                            accept={field.accept ?? '.pdf,application/pdf'}
                            style={{ display: 'none' }}
                            onChange={e => {
                              void loadFile(field.name, e.target.files?.[0] ?? null);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                        {filePayloads[field.name] ? (
                          <span style={fileMetaStyle}>
                            {filePayloads[field.name].name} ({formatFileSize(filePayloads[field.name].size)})
                          </span>
                        ) : fileReading[field.name] ? (
                          <span style={{ fontSize: 13, color: '#6b7280' }}>Preparing upload…</span>
                        ) : (
                          <span style={{ fontSize: 13, color: '#9ca3af' }}>No file selected</span>
                        )}
                        {filePayloads[field.name] && !fileReading[field.name] && (
                          <button
                            type="button"
                            onClick={() => void loadFile(field.name, null)}
                            style={{ ...secondaryBtnStyle, fontSize: 12, padding: '4px 10px' }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {fileErrors[field.name] && (
                        <p style={{ ...hintStyle, color: '#dc2626', margin: 0 }}>{fileErrors[field.name]}</p>
                      )}
                      {(field.allowManualPath ?? true) && (
                        <input
                          type="text"
                          value={fieldValues[field.name] ?? ''}
                          onChange={e => setField(field.name, e.target.value)}
                          placeholder={field.placeholder ?? 'Or paste an absolute path on the EGDesk machine'}
                          style={inputStyle}
                          disabled={Boolean(filePayloads[field.name]) || Boolean(fileReading[field.name])}
                        />
                      )}
                    </div>
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
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={handleRun} disabled={running} style={runBtnStyle}>
                {running
                  ? `Running… ${runningElapsedSec}s`
                  : (runButtonLabel?.(selectedTool) ?? 'Run')}
              </button>
            </div>

            {running && runningHint && (
              <div style={runningHintStyle}>
                <strong style={{ display: 'block', marginBottom: 4 }}>In progress ({runningElapsedSec}s)</strong>
                {runningHint}
              </div>
            )}
          </div>
        </div>

        <div style={rightColStyle}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Display</h2>
            {!displayEntry ? (
              <div style={emptyResultStyle}>Run a tool to see summaries and tables here</div>
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
                  <code style={{ ...helperBadgeStyle, color: accentColor, borderColor: `${accentColor}44`, background: `${accentColor}11` }}>
                    {displayEntry.tool}
                  </code>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{displayEntry.durationMs}ms</span>
                </div>
                {renderDisplay
                  ? renderDisplay(displayEntry.result, displayEntry.tool)
                  : <KeyValueFallback data={displayEntry.result ?? {}} />}
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
            <div style={{ ...emptyResultStyle, padding: '24px 16px' }}>Raw JSON responses appear here</div>
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
                        {entry.tool}
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
                        <pre style={resultCodeStyle}>{JSON.stringify(entry.args, null, 2)}</pre>
                      </div>
                      <div>
                        <div style={miniLabelStyle}>{entry.error ? 'Error' : 'Response'}</div>
                        <pre style={{
                          ...resultCodeStyle,
                          ...(entry.error ? { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' } : {}),
                        }}>
                          {entry.error ? entry.error : JSON.stringify(entry.result, null, 2)}
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
    </main>
  );
}

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

const runningHintStyle: React.CSSProperties = {
  marginTop: 14,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  padding: 12,
  fontSize: 13,
  color: '#1e40af',
  lineHeight: 1.5,
};

const helperBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 5,
  padding: '2px 6px',
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

const baseRunBtnStyle: React.CSSProperties = {
  padding: '8px 22px',
  fontSize: 14,
  fontWeight: 700,
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

const filePickerBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 14px',
  fontSize: 13,
  fontWeight: 600,
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
};

const fileMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#374151',
  fontWeight: 600,
};

const statusBadgeStyle: React.CSSProperties = {
  padding: '3px 10px',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 20,
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

const inlineCodeStyle: React.CSSProperties = {
  fontSize: 12,
  background: '#f3f4f6',
  padding: '1px 5px',
  borderRadius: 4,
};

export const playgroundStyles = {
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
  hintStyle,
  kvGridStyle,
  kvTermStyle,
  kvDescStyle,
};
