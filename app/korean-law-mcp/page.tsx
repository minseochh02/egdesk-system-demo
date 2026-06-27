'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'korean_law_search',
    title: 'Search',
    description: 'Search laws, precedents (판례), administrative rules, or municipal regulations via 법제처 API.',
    category: 'search',
    helperName: 'searchKoreanLaw',
    fields: [
      {
        name: 'query',
        label: 'Search query',
        type: 'string',
        required: true,
        placeholder: '근로기준법',
        hint: 'For precedents (prec), use legal claim types like "손해배상(기)" — everyday keywords often return 0 results.',
      },
      {
        name: 'target',
        label: 'Target',
        type: 'select',
        options: ['law', 'prec', 'admrul', 'ordin'],
        defaultValue: 'law',
        hint: 'law=법령, prec=판례, admrul=행정규칙, ordin=자치법규',
      },
      {
        name: 'display',
        label: 'Results per page',
        type: 'number',
        defaultValue: 20,
      },
      {
        name: 'page',
        label: 'Page',
        type: 'number',
        defaultValue: 1,
      },
    ],
  },
  {
    name: 'korean_law_get_text',
    title: 'Get law text',
    description: 'Fetch full text for a law, administrative rule, or municipal regulation.',
    category: 'retrieve',
    helperName: 'getKoreanLawText',
    fields: [
      {
        name: 'id',
        label: 'Law ID (MST)',
        type: 'string',
        required: true,
        placeholder: 'From search results',
      },
      {
        name: 'target',
        label: 'Target',
        type: 'select',
        options: ['law', 'admrul', 'ordin'],
        defaultValue: 'law',
      },
    ],
  },
  {
    name: 'korean_law_get_decision',
    title: 'Get precedent',
    description: 'Fetch full text of a court precedent (판례).',
    category: 'retrieve',
    helperName: 'getKoreanLawDecision',
    fields: [
      {
        name: 'id',
        label: 'Precedent ID',
        type: 'string',
        required: true,
        placeholder: 'From prec search results',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'search', label: 'Search' },
  { key: 'retrieve', label: 'Retrieve' },
];

type LawHit = Record<string, string | undefined>;

function pickId(hit: LawHit): string {
  return (
    hit.id ||
    hit.lawId ||
    hit.법령ID ||
    hit.판례일련번호 ||
    hit.판례정보일련번호 ||
    ''
  );
}

function pickTitle(hit: LawHit): string {
  return hit.lawName || hit.법령명 || hit.caseName || hit.사건명 || pickId(hit) || '—';
}

function extractHits(data: any): LawHit[] {
  if (Array.isArray(data?.LawSearch?.law)) return data.LawSearch.law;
  if (Array.isArray(data?.PrecSearch?.prec)) return data.PrecSearch.prec;
  if (Array.isArray(data?.AdmRulSearch?.admrul)) return data.AdmRulSearch.admrul;
  if (Array.isArray(data?.OrdinSearch?.ordin)) return data.OrdinSearch.ordin;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function KoreanLawPlayground() {
  const [lastSearchId, setLastSearchId] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (tool === 'korean_law_search') {
      const hits = extractHits(parsed);
      if (hits[0]) {
        setLastSearchId(pickId(hits[0]));
      }
    }
  }, []);

  const getDefaultFieldValues = useCallback((tool: PlaygroundToolDef) => {
    if (lastSearchId && tool.fields.some(f => f.name === 'id')) {
      return { id: lastSearchId };
    }
    return {};
  }, [lastSearchId]);

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

    const hits = extractHits(data);

    if (tool === 'korean_law_search' && hits.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Search results ({hits.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {hits.slice(0, 30).map((hit, i) => {
                  const id = pickId(hit);
                  return (
                    <tr key={id || i}>
                      <td style={tdStyle}>{pickTitle(hit)}</td>
                      <td style={tdStyle}><code style={inlineCodeStyle}>{id || '—'}</code></td>
                      <td style={tdStyle}>
                        {id && (
                          <button
                            onClick={() => setLastSearchId(id)}
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

    const text =
      data?.Law?.법령?.조문?.조 ||
      data?.PrecService?.판례본문 ||
      data?.body ||
      data?.text;

    if (typeof text === 'string' && text.length > 0) {
      return (
        <pre style={{
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
        }}>
          {text.slice(0, 12000)}
          {text.length > 12000 ? '\n\n… [truncated in display]' : ''}
        </pre>
      );
    }

    return null;
  }, []);

  return (
    <McpPlayground
      currentHref="/korean-law-mcp"
      eyebrow="EGDesk Korean Law MCP"
      title="Korean Law Playground"
      subtitle="Search and retrieve Korean legal data from 법제처. No login required — calls the public legislation API through EGDesk."
      apiPath="/api/korean-law"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#b45309"
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
