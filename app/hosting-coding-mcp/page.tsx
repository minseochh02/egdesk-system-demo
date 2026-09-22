'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'hosting_analyze_site',
    title: 'Analyze site',
    description: 'Full SSL/security audit: TLS, headers, accessibility, letter grade (A+ to F).',
    category: 'hosting',
    helperName: 'analyzeHostingSite',
    fields: [
      { name: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://example.com' },
      { name: 'save', label: 'Save to history', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'hosting_check_certificate',
    title: 'Check certificate',
    description: 'Inspect TLS certificate: expiry, issuer, SANs, self-signed status.',
    category: 'hosting',
    helperName: 'checkHostingCertificate',
    fields: [
      { name: 'url', label: 'HTTPS URL', type: 'string', required: true, placeholder: 'https://example.com' },
    ],
  },
  {
    name: 'coding_list_projects',
    title: 'List projects',
    description: 'List all registered projects and their current hosting/server status.',
    category: 'coding',
    helperName: 'listHostingProjects',
    fields: [],
  },
  {
    name: 'coding_start_server',
    title: 'Start server',
    description: 'Start a development or production server for a project folder.',
    category: 'coding',
    helperName: 'startHostingServer',
    fields: [
      { name: 'folderPath', label: 'Folder Path', type: 'string', required: true, placeholder: '/abs/path/to/project' },
      { name: 'mode', label: 'Mode', type: 'string', defaultValue: 'dev' },
      { name: 'forceBuild', label: 'Force build', type: 'boolean', defaultValue: false },
      { name: 'watch', label: 'Watch', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'coding_stop_server',
    title: 'Stop server',
    description: 'Stop a running development or production server.',
    category: 'coding',
    helperName: 'stopHostingServer',
    fields: [
      { name: 'folderPath', label: 'Folder Path', type: 'string', required: true },
      { name: 'mode', label: 'Mode', type: 'string', defaultValue: 'dev' },
    ],
  },
  {
    name: 'coding_get_server_status',
    title: 'Server status',
    description: 'Get details and status for a specific project mode.',
    category: 'coding',
    helperName: 'getHostingServerStatus',
    fields: [
      { name: 'folderPath', label: 'Folder Path', type: 'string', required: true },
      { name: 'mode', label: 'Mode', type: 'string', defaultValue: 'dev' },
    ],
  },
  {
    name: 'hosting_list_analyses',
    title: 'List analyses',
    description: 'Saved SSL analysis history entries.',
    category: 'history',
    helperName: 'listHostingAnalyses',
    fields: [
      { name: 'websiteUrl', label: 'URL filter', type: 'string', placeholder: 'example.com' },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 20 },
    ],
  },
  {
    name: 'hosting_list_certificates',
    title: 'List certificates',
    description: 'Stored EGDesk-managed certificates (metadata only — no private keys).',
    category: 'certs',
    helperName: 'listHostingCertificates',
    fields: [],
  },
];

const CATEGORIES = [
  { key: 'hosting', label: 'Hosting & SSL' },
  { key: 'coding', label: 'Coding & Servers' },
  { key: 'history', label: 'History' },
  { key: 'certs', label: 'Certificates' },
];

const RUNNING_HINTS: Record<string, string> = {
  hosting_analyze_site: 'Running TLS and security header checks…',
  coding_start_server: 'Starting server instance…',
  coding_stop_server: 'Stopping server instance…',
};

export default function HostingCodingPlayground() {
  const [lastUrl, setLastUrl] = useState('https://example.com');
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (parsed?.url) setLastUrl(String(parsed.url));
    if (parsed?.websiteUrl) setLastUrl(String(parsed.websiteUrl));
    if (parsed?.id) setLastAnalysisId(String(parsed.id));
    if (parsed?.saved?.id) setLastAnalysisId(String(parsed.saved.id));
    const list = Array.isArray(parsed?.analyses) ? parsed.analyses : Array.isArray(parsed) ? parsed : [];
    if (list[0]?.id) setLastAnalysisId(String(list[0].id));
  }, []);

  const getDefaultFieldValues = useCallback((tool: PlaygroundToolDef) => {
    const defaults: Record<string, string> = {};
    if (lastUrl && tool.fields.some(f => f.name === 'url')) {
      defaults.url = lastUrl;
    }
    if (lastAnalysisId && tool.fields.some(f => f.name === 'id')) {
      defaults.id = lastAnalysisId;
    }
    return defaults;
  }, [lastUrl, lastAnalysisId]);

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
      statusBadgeStyle,
    } = playgroundStyles;

    // Handle projects list
    if (Array.isArray(data) && data.length > 0 && (data[0].folderPath || data[0].name)) {
      return (
        <div>
          <div style={miniLabelStyle}>Projects ({data.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name / Path</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Access</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any, i: number) => (
                  <tr key={row.name || row.folderPath || i}>
                    <td style={tdStyle}>
                      <div>{row.name || '—'}</div>
                      <code style={{ ...inlineCodeStyle, fontSize: 11 }}>{row.folderPath}</code>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        ...statusBadgeStyle,
                        background: row.devServerStatus === 'running' ? '#dcfce7' : '#f3f4f6',
                        color: row.devServerStatus === 'running' ? '#166534' : '#374151',
                      }}>
                        {row.devServerStatus || 'stopped'}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.accessMode || 'private'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const grade = data?.grade || data?.overallGrade || data?.securityGrade;
    if (grade) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <span style={{
              ...statusBadgeStyle,
              fontSize: 28,
              padding: '8px 18px',
              background: grade.startsWith('A') ? '#dcfce7' : grade.startsWith('B') ? '#fef9c3' : '#fef2f2',
              color: grade.startsWith('A') ? '#166534' : grade.startsWith('B') ? '#854d0e' : '#991b1b',
            }}>
              {grade}
            </span>
          </div>
          <dl style={kvGridStyle}>
            {data.url && <><dt style={kvTermStyle}>URL</dt><dd style={kvDescStyle}>{data.url}</dd></>}
            {data.certificateValid != null && (
              <><dt style={kvTermStyle}>Cert valid</dt><dd style={kvDescStyle}>{String(data.certificateValid)}</dd></>
            )}
          </dl>
        </div>
      );
    }

    // Generic JSON display for other things
    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={playgroundStyles.miniLabelStyle}>Last URL / analysis ID</div>
        <p style={{ fontSize: 14, color: '#111827', margin: '4px 0 0', lineHeight: 1.5 }}>
          URL: <code style={playgroundStyles.inlineCodeStyle}>{lastUrl}</code>
          {lastAnalysisId && (
            <> · Analysis: <code style={playgroundStyles.inlineCodeStyle}>{lastAnalysisId}</code></>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/hosting-coding-mcp"
      eyebrow="EGDesk Hosting & Coding MCP"
      title="Hosting & Coding Playground"
      subtitle="Manage local development servers, projects, and SSL/security audits."
      apiPath="/api/hosting-coding"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#0f172a"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
