'use client';

import {
  McpPlayground,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'apps_script_list_projects',
    title: 'List projects',
    description: 'List Apps Script projects stored in this EGDesk instance.',
    category: 'browse',
    helperName: 'callAppsScriptTool',
    fields: [],
  },
  {
    name: 'apps_script_push_to_google',
    title: 'Push to Google',
    description: 'Local → Workspace: overwrite the cloud Apps Script project with local files.',
    category: 'sync',
    helperName: 'pushAppsScriptToGoogle',
    fields: [
      {
        name: 'projectId',
        label: 'Script project ID',
        type: 'string',
        required: true,
      },
      {
        name: 'createVersion',
        label: 'Create version after push',
        type: 'boolean',
        defaultValue: false,
      },
      {
        name: 'versionDescription',
        label: 'Version description (optional)',
        type: 'string',
      },
    ],
  },
  {
    name: 'apps_script_pull_from_google',
    title: 'Pull from Google',
    description: 'Workspace → local: overwrite local files with the cloud project.',
    category: 'sync',
    helperName: 'pullAppsScriptFromGoogle',
    fields: [
      {
        name: 'projectId',
        label: 'Script project ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'apps_script_sync',
    title: 'HTTP sync',
    description: 'POST /apps-script/sync. toWorkspace = push; toLocal = pull. Does not accept both.',
    category: 'sync',
    helperName: 'syncAppsScript',
    fields: [
      {
        name: 'direction',
        label: 'Direction',
        type: 'select',
        options: ['toWorkspace', 'toLocal'],
        defaultValue: 'toWorkspace',
      },
      {
        name: 'projectId',
        label: 'Script project ID',
        type: 'string',
        required: true,
      },
      {
        name: 'createVersion',
        label: 'Create version after push',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'browse', label: 'Browse' },
  { key: 'sync', label: 'Sync' },
];

const RUNNING_HINTS: Record<string, string> = {
  apps_script_list_projects: 'Listing Apps Script projects…',
  apps_script_push_to_google: 'Pushing local files to Google…',
  apps_script_pull_from_google: 'Pulling Google files into local storage…',
  apps_script_sync: 'Running Apps Script HTTP sync…',
};

export default function AppsScriptMcpPage() {
  return (
    <McpPlayground
      currentHref="/apps-script-mcp"
      eyebrow="EGDesk Apps Script"
      title="Apps Script Playground"
      subtitle="Push local script files to Google or pull the cloud project back. Enable Apps Script MCP in EGDesk."
      apiPath="/api/apps-script"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#f9ab00"
    />
  );
}
