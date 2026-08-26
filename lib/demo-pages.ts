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
    title: 'UserData Cron MCP',
    description: 'Schedule background jobs for sync configs, browser recordings, and DB backups — list, create, run now, and inspect history.',
    href: '/user-data-cron-mcp',
    eyebrow: 'Background automation',
    items: ['listUserDataCronJobs', 'createUserDataCronJob', 'runUserDataCronJobNow'],
  },
  {
    title: 'UserData Queue MCP',
    description: 'Durable enqueue + worker with retries for the same actions as cron — enqueue, cancel, retry, run now, and inspect runs.',
    href: '/user-data-queue-mcp',
    eyebrow: 'Background automation',
    items: ['enqueueUserDataQueueJob', 'listUserDataQueueJobs', 'runUserDataQueueJobNow'],
  },
  {
    title: 'Concurrency Demo',
    description: 'Interactive demo of _version tracking, optimistic locking with expectedVersion, and conflict detection.',
    href: '/concurrency',
    eyebrow: 'Data integrity',
    items: ['_version', 'expectedVersion', 'conflictDetection', 'WriteMutex'],
  },
  {
    title: 'PageIndex MCP',
    description: 'Index PDFs into a hierarchical tree with checkpointed progress, resume interrupted jobs, and fetch page text.',
    href: '/pageindex-mcp',
    eyebrow: 'Document indexing',
    items: ['indexPageIndexPdf', 'resumePageIndexDocument', 'getPageIndexStructure'],
  },
  {
    title: 'Voice Transcript MCP',
    description: 'Transcribe a local audio file with speaker labels using whisper.cpp + pyannote. Audio stays on this machine.',
    href: '/voice-transcript-mcp',
    eyebrow: 'Local transcription',
    items: ['getVoiceTranscriptStatus', 'ensureVoiceTranscript', 'transcribeVoiceTranscript'],
  },
  {
    title: 'Drive MCP',
    description: 'Watch or poll Google Drive folder changes, download to local, and upload files back to Drive.',
    href: '/drive-mcp',
    eyebrow: 'Drive sync',
    items: ['startDrivePollLoop', 'uploadDriveFile', 'syncDrive'],
  },
  {
    title: 'Sheets sync',
    description: 'List My DB ↔ Sheet connections and sync either direction (toWorkspace, toLocal, or both).',
    href: '/sheets-mcp',
    eyebrow: 'Sheets sync',
    items: ['listSheetSyncConnections', 'syncSheets'],
  },
  {
    title: 'Gmail MCP',
    description: 'Fetch domain Gmail messages and send from the signed-in Google Workspace account.',
    href: '/gmail-mcp',
    eyebrow: 'Gmail',
    items: ['getGmailUserMessages', 'sendGmailMessage'],
  },
  {
    title: 'Apps Script MCP',
    description: 'Push local Apps Script files to Google or pull the cloud project into local storage.',
    href: '/apps-script-mcp',
    eyebrow: 'Apps Script',
    items: ['pushAppsScriptToGoogle', 'pullAppsScriptFromGoogle', 'syncAppsScript'],
  },
  {
    title: 'Knowledge Wiki MCP',
    description: 'Index Obsidian vault notes and fetch/cache wikiHow how-to guides for agent knowledge exploration.',
    href: '/knowledge-wiki-mcp',
    eyebrow: 'Agent knowledge',
    items: ['indexObsidianVault', 'searchKnowledgeWiki', 'searchWikiHow', 'getWikiHowGuide'],
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
    items: ['callAiCaller', 'getAiCallerUsage', 'getAiCallerLogs', 'listAiCallerModels'],
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
    title: 'BI Products MCP',
    description:
      'Register BI products with photos (required before Instagram/YouTube/blog bi_products schedules) — confirm imageCount > 0.',
    href: '/bi-products-mcp',
    eyebrow: 'Product catalog',
    items: ['bi_list_snapshots', 'bi_register_product', 'bi_list_products'],
  },
  {
    title: 'Blog MCP',
    description: 'Schedule auto-gen BI posts, publish HTML + images in one call, and sync Naver article stats with live views.',
    href: '/blog-mcp',
    eyebrow: 'Blog automation',
    items: ['blog_add_connection', 'blog_publish', 'blog_article_stats', 'blog_list_history'],
  },
  {
    title: 'Kakao MCP Guide',
    description: 'Review every Kakao Channel MCP tool with helper examples, raw calls, inputs, and setup notes.',
    href: '/kakao-mcp',
    eyebrow: 'Kakao automation',
    items: ['channels', 'bots', 'callbacks'],
  },
  {
    title: 'Phone MCP',
    description:
      'Pair Google Messages Web, sync inbox/threads/contacts, enqueue SMS, and manage marketing consent / 무료수신거부.',
    href: '/phone-mcp',
    eyebrow: 'SMS / Google Messages',
    items: ['phone_connect', 'phone_sync_conversations', 'phone_send', 'phone_consent_link_create'],
  },
  {
    title: 'Instagram MCP',
    description:
      'Generate/schedule product-grounded posts (register BI photos first), publish, sync likes/comments, and browse history.',
    href: '/instagram-mcp',
    eyebrow: 'Instagram automation',
    items: [
      'instagram_generate_content',
      'instagram_schedule_create',
      'instagram_schedule_run_now',
      'instagram_list_history',
    ],
  },
  {
    title: 'Brand Face MCP',
    description:
      'Generate AI brand face / spokesperson personas on BI snapshots for consistent YouTube Shorts on-camera talent.',
    href: '/brand-face-mcp',
    eyebrow: 'Brand spokesperson',
    items: [
      'brand_face_generate',
      'brand_face_list',
      'brand_face_set_preferred',
    ],
  },
  {
    title: 'YouTube Shorts MCP',
    description:
      'Manage YouTube connections, generate multi-scene Shorts with brand face, schedule auto uploads, and inspect history.',
    href: '/youtube-mcp',
    eyebrow: 'YouTube Shorts',
    items: [
      'youtube_generate_shorts',
      'youtube_schedule_create',
      'youtube_schedule_run_now',
      'youtube_list_history',
    ],
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
