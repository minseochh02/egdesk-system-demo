'use client';

import {
  McpPlayground,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'sheets_list_connections',
    title: 'List connections',
    description: 'GET /sheets/sync — overwrite configs and incremental links for a My DB project.',
    category: 'catalog',
    helperName: 'listSheetSyncConnections',
    fields: [
      {
        name: 'projectId',
        label: 'Project ID (optional)',
        type: 'string',
        placeholder: 'Uses X-EGDesk-Project-Id when empty',
      },
      {
        name: 'environment',
        label: 'Environment',
        type: 'select',
        options: ['development', 'production'],
        defaultValue: 'development',
      },
    ],
  },
  {
    name: 'sheets_sync',
    title: 'Sync',
    description:
      'POST /sheets/sync. toWorkspace = My DB → Sheet. toLocal = Sheet → My DB (needs a linked tab). both = pull then push.',
    category: 'sync',
    helperName: 'syncSheets',
    fields: [
      {
        name: 'direction',
        label: 'Direction',
        type: 'select',
        options: ['toWorkspace', 'toLocal', 'both'],
        defaultValue: 'toWorkspace',
      },
      {
        name: 'projectId',
        label: 'Project ID (optional)',
        type: 'string',
      },
      {
        name: 'environment',
        label: 'Environment',
        type: 'select',
        options: ['development', 'production'],
        defaultValue: 'development',
      },
      {
        name: 'configId',
        label: 'Overwrite config ID (optional)',
        type: 'string',
      },
      {
        name: 'linkId',
        label: 'Link ID (optional)',
        type: 'string',
        hint: 'sheet_table_links.id — used for toLocal / incremental push',
      },
      {
        name: 'spreadsheetId',
        label: 'Spreadsheet ID (optional)',
        type: 'string',
      },
      {
        name: 'tabName',
        label: 'Tab name (optional)',
        type: 'string',
        placeholder: 'DATA',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'catalog', label: 'Catalog' },
  { key: 'sync', label: 'Sync' },
];

const RUNNING_HINTS: Record<string, string> = {
  sheets_list_connections: 'Listing sheet connections…',
  sheets_sync: 'Syncing My DB ↔ Google Sheets…',
};

export default function SheetsMcpPage() {
  return (
    <McpPlayground
      currentHref="/sheets-mcp"
      eyebrow="EGDesk Sheets sync"
      title="Sheets Playground"
      subtitle="Bidirectional My DB ↔ Google Sheets. List overwrite configs and incremental links, then sync toWorkspace, toLocal, or both. Enable Sheets MCP in EGDesk and pick a My DB project."
      apiPath="/api/sheets"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#188038"
    />
  );
}
