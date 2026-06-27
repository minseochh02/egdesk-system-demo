'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'ssl_analyze_site',
    title: 'Analyze site',
    description: 'Full SSL/security audit: TLS, headers, accessibility, letter grade (A+ to F).',
    category: 'audit',
    helperName: 'analyzeSslSite',
    fields: [
      { name: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://example.com' },
      { name: 'save', label: 'Save to history', type: 'boolean', defaultValue: true },
    ],
  },
  {
    name: 'ssl_check_certificate',
    title: 'Check certificate',
    description: 'Inspect TLS certificate: expiry, issuer, SANs, self-signed status.',
    category: 'audit',
    helperName: 'checkSslCertificate',
    fields: [
      { name: 'url', label: 'HTTPS URL', type: 'string', required: true, placeholder: 'https://example.com' },
    ],
  },
  {
    name: 'ssl_check_security_headers',
    title: 'Security headers',
    description: 'Check HSTS, CSP, X-Frame-Options, and related headers.',
    category: 'audit',
    helperName: 'checkSecurityHeaders',
    fields: [
      { name: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://example.com' },
    ],
  },
  {
    name: 'ssl_list_analyses',
    title: 'List analyses',
    description: 'Saved SSL analysis history entries.',
    category: 'history',
    helperName: 'listSslAnalyses',
    fields: [
      { name: 'websiteUrl', label: 'URL filter', type: 'string', placeholder: 'example.com' },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 20 },
    ],
  },
  {
    name: 'ssl_get_analysis',
    title: 'Get analysis',
    description: 'Load a saved analysis record by ID.',
    category: 'history',
    helperName: 'getSslAnalysis',
    fields: [
      { name: 'id', label: 'Analysis ID', type: 'string', required: true },
    ],
  },
  {
    name: 'ssl_list_certificates',
    title: 'List certificates',
    description: 'Stored EGDesk-managed certificates (metadata only — no private keys).',
    category: 'certs',
    helperName: 'listSslCertificates',
    fields: [],
  },
  {
    name: 'ssl_get_certificate',
    title: 'Get certificate',
    description: 'Certificate metadata by ID.',
    category: 'certs',
    helperName: 'getSslCertificate',
    fields: [
      { name: 'id', label: 'Certificate ID', type: 'string', required: true },
    ],
  },
];

const CATEGORIES = [
  { key: 'audit', label: 'Audit' },
  { key: 'history', label: 'History' },
  { key: 'certs', label: 'Certificates' },
];

const RUNNING_HINTS: Record<string, string> = {
  ssl_analyze_site: 'Running TLS and security header checks…',
  ssl_check_certificate: 'Fetching certificate chain…',
  ssl_check_security_headers: 'Inspecting response headers…',
};

export default function SslPlayground() {
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
            {data.hstsEnabled != null && (
              <><dt style={kvTermStyle}>HSTS</dt><dd style={kvDescStyle}>{String(data.hstsEnabled)}</dd></>
            )}
          </dl>
        </div>
      );
    }

    const analyses = Array.isArray(data?.analyses) ? data.analyses : Array.isArray(data) ? data : [];
    if (analyses.length > 0 && analyses[0]?.id) {
      return (
        <div>
          <div style={miniLabelStyle}>Analyses ({analyses.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>URL</th>
                  <th style={thStyle}>Grade</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {analyses.map((row: any, i: number) => (
                  <tr key={row.id || i}>
                    <td style={tdStyle}>{row.url || row.websiteUrl || '—'}</td>
                    <td style={tdStyle}>{row.grade || row.overallGrade || '—'}</td>
                    <td style={tdStyle}><code style={inlineCodeStyle}>{row.id || '—'}</code></td>
                    <td style={tdStyle}>
                      {row.id && (
                        <button
                          onClick={() => setLastAnalysisId(row.id)}
                          style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                        >
                          Use ID
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const certs = Array.isArray(data?.certificates) ? data.certificates : [];
    if (certs.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Certificates ({certs.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Domain</th>
                  <th style={thStyle}>Issuer</th>
                  <th style={thStyle}>Expires</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((cert: any, i: number) => (
                  <tr key={cert.id || i}>
                    <td style={tdStyle}>{cert.domain || '—'}</td>
                    <td style={tdStyle}>{cert.issuer || '—'}</td>
                    <td style={tdStyle}>{cert.validTo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (data?.issuer || data?.validTo) {
      return (
        <dl style={kvGridStyle}>
          {data.domain && <><dt style={kvTermStyle}>Domain</dt><dd style={kvDescStyle}>{data.domain}</dd></>}
          {data.issuer && <><dt style={kvTermStyle}>Issuer</dt><dd style={kvDescStyle}>{data.issuer}</dd></>}
          {data.validTo && <><dt style={kvTermStyle}>Valid to</dt><dd style={kvDescStyle}>{data.validTo}</dd></>}
          {data.isSelfSigned != null && (
            <><dt style={kvTermStyle}>Self-signed</dt><dd style={kvDescStyle}>{String(data.isSelfSigned)}</dd></>
          )}
        </dl>
      );
    }

    if (data?.headers && typeof data.headers === 'object') {
      return (
        <dl style={kvGridStyle}>
          {Object.entries(data.headers).map(([key, value]) => (
            <span key={key} style={{ display: 'contents' }}>
              <dt style={kvTermStyle}>{key}</dt>
              <dd style={kvDescStyle}>{String(value ?? '—')}</dd>
            </span>
          ))}
        </dl>
      );
    }

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
      currentHref="/ssl-mcp"
      eyebrow="EGDesk SSL MCP"
      title="SSL Playground"
      subtitle="Audit TLS certificates and security headers, browse analysis history, and inspect stored certificates."
      apiPath="/api/ssl"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#0d9488"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
