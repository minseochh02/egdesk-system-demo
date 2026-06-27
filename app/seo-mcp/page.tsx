'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'seo_run_lighthouse',
    title: 'Run Lighthouse',
    description: 'Audit one or more URLs with Google Lighthouse. Takes 30–60s per URL (max 5).',
    category: 'audit',
    helperName: 'runLighthouse',
    fields: [
      {
        name: 'urls',
        label: 'URLs (JSON array)',
        type: 'json',
        required: true,
        placeholder: '["https://example.com"]',
        hint: 'Up to 5 URLs per run.',
      },
      {
        name: 'includeAiExplanation',
        label: 'Include AI explanation',
        type: 'boolean',
        defaultValue: false,
        hint: 'Uses Gemini to summarize findings (slower).',
      },
    ],
  },
  {
    name: 'seo_list_reports',
    title: 'List reports',
    description: 'List saved Lighthouse report summaries from previous runs.',
    category: 'history',
    helperName: 'listSeoReports',
    fields: [
      {
        name: 'url',
        label: 'URL filter (optional)',
        type: 'string',
        placeholder: 'example.com',
      },
      {
        name: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 20,
      },
    ],
  },
  {
    name: 'seo_get_report',
    title: 'Get report',
    description: 'Load a saved report by ID.',
    category: 'history',
    helperName: 'getSeoReport',
    fields: [
      {
        name: 'id',
        label: 'Report ID',
        type: 'string',
        required: true,
        placeholder: 'From list or Lighthouse run',
      },
    ],
  },
  {
    name: 'seo_get_issues_summary',
    title: 'Issues summary',
    description: 'Lighthouse issues grouped by category for a saved report.',
    category: 'history',
    helperName: 'getSeoIssuesSummary',
    fields: [
      {
        name: 'reportId',
        label: 'Report ID',
        type: 'string',
        required: true,
        placeholder: 'From list or Lighthouse run',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'audit', label: 'Audit' },
  { key: 'history', label: 'History' },
];

const RUNNING_HINTS: Record<string, string> = {
  seo_run_lighthouse: 'Running Lighthouse in headless Chrome — typically 30–60s per URL.',
};

type SeoReport = {
  id?: string;
  url?: string;
  createdAt?: string;
  scores?: Record<string, number>;
};

function reportId(report: SeoReport): string {
  return report.id || '';
}

export default function SeoPlayground() {
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (parsed?.id) setLastReportId(String(parsed.id));
    if (Array.isArray(parsed?.reports) && parsed.reports[0]?.id) {
      setLastReportId(String(parsed.reports[0].id));
    }
    if (Array.isArray(parsed) && parsed[0]?.id) {
      setLastReportId(String(parsed[0].id));
    }
  }, []);

  const getDefaultFieldValues = useCallback((tool: PlaygroundToolDef) => {
    if (!lastReportId) return {};
    if (tool.fields.some(f => f.name === 'id')) return { id: lastReportId };
    if (tool.fields.some(f => f.name === 'reportId')) return { reportId: lastReportId };
    return {};
  }, [lastReportId]);

  const renderDisplay = useCallback((data: any) => {
    const {
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

    const reports: SeoReport[] = Array.isArray(data?.reports)
      ? data.reports
      : Array.isArray(data)
        ? data
        : [];

    if (reports.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Reports ({reports.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>URL</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Performance</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {reports.map((report, i) => {
                  const id = reportId(report);
                  return (
                    <tr key={id || i}>
                      <td style={tdStyle}>{report.url || '—'}</td>
                      <td style={tdStyle}><code style={inlineCodeStyle}>{id || '—'}</code></td>
                      <td style={tdStyle}>{report.scores?.performance ?? '—'}</td>
                      <td style={tdStyle}>
                        {id && (
                          <button
                            onClick={() => setLastReportId(id)}
                            style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                          >
                            Use ID
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

    if (data?.scores && typeof data.scores === 'object') {
      return (
        <dl style={kvGridStyle}>
          {data.url && <><dt style={kvTermStyle}>URL</dt><dd style={kvDescStyle}>{data.url}</dd></>}
          {Object.entries(data.scores).map(([key, value]) => (
            <span key={key} style={{ display: 'contents' }}>
              <dt style={kvTermStyle}>{key}</dt>
              <dd style={kvDescStyle}>{String(value)}</dd>
            </span>
          ))}
        </dl>
      );
    }

    if (data?.issuesByCategory) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          {Object.entries(data.issuesByCategory as Record<string, unknown[]>).map(([category, issues]) => (
            <div key={category}>
              <div style={miniLabelStyle}>{category} ({issues.length})</div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {issues.slice(0, 8).map((issue: any, i) => (
                  <li key={i}>{issue.title || issue.description || JSON.stringify(issue)}</li>
                ))}
                {issues.length > 8 && <li style={{ color: '#9ca3af' }}>… and {issues.length - 8} more</li>}
              </ul>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Last report ID</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {lastReportId ? (
            <code style={playgroundStyles.inlineCodeStyle}>{lastReportId}</code>
          ) : 'Run Lighthouse or list reports first'}
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/seo-mcp"
      eyebrow="EGDesk SEO MCP"
      title="SEO Playground"
      subtitle="Run Lighthouse audits and browse saved SEO reports. Enable the SEO MCP server in EGDesk."
      apiPath="/api/seo"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#2563eb"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
