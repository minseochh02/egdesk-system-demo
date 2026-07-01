export type DemoPageLink = {
  title: string;
  description: string;
  href: string;
  eyebrow: string;
  items: string[];
};

export const DEMO_PAGES: DemoPageLink[] = [
  {
    title: 'Database Demo',
    description: 'Try every database helper — queryTable, insertRows, updateRows, search, and SQL — with live results.',
    href: '/database',
    eyebrow: 'Data helpers',
    items: ['queryTable', 'insertRows', 'updateRows', 'searchTable'],
  },
  {
    title: 'PageIndex MCP',
    description: 'Index PDFs into a hierarchical tree with checkpointed progress, resume interrupted jobs, and fetch page text.',
    href: '/pageindex-mcp',
    eyebrow: 'Document indexing',
    items: ['indexPageIndexPdf', 'resumePageIndexDocument', 'getPageIndexStructure'],
  },
  {
    title: 'EGDesk Config MCP',
    description: 'Fetch or save AI provider API keys (Google, OpenAI, Anthropic, Azure) in AI Keys Manager.',
    href: '/egdesk-config-mcp',
    eyebrow: 'Runtime config',
    items: ['getApiKey', 'setApiKey', 'listApiKeys'],
  },
  {
    title: 'Korean Law MCP',
    description: 'Search 법제처 for laws, precedents, administrative rules, and fetch full legal text.',
    href: '/korean-law-mcp',
    eyebrow: 'Legal research',
    items: ['searchKoreanLaw', 'getKoreanLawText', 'getKoreanLawDecision'],
  },
  {
    title: 'SEO MCP',
    description: 'Run Lighthouse audits, list saved reports, and inspect issues by category.',
    href: '/seo-mcp',
    eyebrow: 'Site quality',
    items: ['runLighthouse', 'listSeoReports', 'getSeoIssuesSummary'],
  },
  {
    title: 'Local Agent MCP',
    description: 'Check Ollama readiness, pull Gemma 4 QAT, and run offline chat completions.',
    href: '/local-agent-mcp',
    eyebrow: 'Offline AI',
    items: ['getLocalAgentStatus', 'callLocalAgent', 'pullLocalAgentModel'],
  },
  {
    title: 'AI Caller MCP',
    description: 'Call Gemini with automatic token usage tracking. View aggregated stats and raw call logs.',
    href: '/ai-caller-mcp',
    eyebrow: 'Gemini + tracking',
    items: ['callAiCaller', 'getAiCallerUsage', 'getAiCallerLogs'],
  },
  {
    title: 'FinanceHub MCP',
    description: 'Query synced bank accounts, transactions, monthly summaries, and Hometax tax invoices.',
    href: '/financehub-mcp',
    eyebrow: 'Finance data',
    items: ['listBanks', 'queryBankTransactions', 'queryTaxInvoices'],
  },
  {
    title: 'Internal Knowledge MCP',
    description: 'Browse business identity snapshots and search internal knowledge documents.',
    href: '/internal-knowledge-mcp',
    eyebrow: 'Company knowledge',
    items: ['listBusinessIdentitySnapshots', 'searchKnowledgeContent'],
  },
  {
    title: 'Browser Recording MCP',
    description: 'List saved recorder tests, inspect replay options, and run Chrome replays.',
    href: '/browser-recording-mcp',
    eyebrow: 'Browser automation',
    items: ['listBrowserRecordingTests', 'runBrowserRecording'],
  },
  {
    title: 'SSL MCP',
    description: 'Audit TLS certificates, security headers, and browse stored certificate metadata.',
    href: '/ssl-mcp',
    eyebrow: 'Security',
    items: ['analyzeSslSite', 'checkSslCertificate', 'listSslCertificates'],
  },
  {
    title: 'Inventory MCP',
    description: 'Install the camera-based inventory scanner into Next.js or Vite projects via inventory_setup_scanner.',
    href: '/inventory-mcp',
    eyebrow: 'Inventory scanner',
    items: ['inventory_setup_scanner', 'YOLO', 'DINO'],
  },
  {
    title: 'Kakao MCP Guide',
    description: 'Review every Kakao Channel MCP tool with helper examples, raw calls, inputs, and setup notes.',
    href: '/kakao-mcp',
    eyebrow: 'Kakao automation',
    items: ['channels', 'bots', 'callbacks'],
  },
];

/** Nav links for playground headers (excludes current page). */
export function getDemoNavLinks(basePath: string, currentHref?: string) {
  const prefix = basePath.replace(/\/$/, '');
  const pageLinks = DEMO_PAGES.filter(p => p.href !== currentHref).map(p => ({
    href: `${prefix}${p.href}`,
    label: p.title.replace(/ Demo$| MCP$| Guide$| Setup$/, '').replace(/^Kakao MCP Guide$/, 'Kakao MCP'),
  }));
  return [{ href: `${prefix}/`, label: 'All demos' }, ...pageLinks];
}
