'use client';

import {
  McpPlayground,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'gmail_list_users',
    title: 'List domain users',
    description: 'Workspace → local: list Google Workspace users in the connected domain.',
    category: 'fetch',
    helperName: 'listGmailUsers',
    fields: [],
  },
  {
    name: 'gmail_get_user_messages',
    title: 'Get messages',
    description: 'Workspace → local: fetch Gmail messages for a user.',
    category: 'fetch',
    helperName: 'getGmailUserMessages',
    fields: [
      {
        name: 'email',
        label: 'User email',
        type: 'string',
        required: true,
        placeholder: 'user@example.com',
      },
      {
        name: 'maxResults',
        label: 'Max results',
        type: 'number',
        defaultValue: 20,
      },
    ],
  },
  {
    name: 'gmail_search_messages',
    title: 'Search messages',
    description: 'Workspace → local: Gmail search query.',
    category: 'fetch',
    helperName: 'searchGmailMessages',
    fields: [
      {
        name: 'query',
        label: 'Query',
        type: 'string',
        required: true,
        placeholder: 'from:example@gmail.com',
      },
      {
        name: 'email',
        label: 'User email (optional)',
        type: 'string',
      },
      {
        name: 'maxResults',
        label: 'Max results',
        type: 'number',
        defaultValue: 20,
      },
    ],
  },
  {
    name: 'gmail_send_message',
    title: 'Send message',
    description: 'Local → Workspace: send from the signed-in Google account (gmail.send).',
    category: 'send',
    helperName: 'sendGmailMessage',
    fields: [
      {
        name: 'to',
        label: 'To',
        type: 'string',
        required: true,
        placeholder: 'recipient@example.com',
      },
      {
        name: 'subject',
        label: 'Subject',
        type: 'string',
        required: true,
      },
      {
        name: 'body',
        label: 'Body',
        type: 'textarea',
        required: true,
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'fetch', label: 'Fetch' },
  { key: 'send', label: 'Send' },
];

const RUNNING_HINTS: Record<string, string> = {
  gmail_list_users: 'Listing domain users…',
  gmail_get_user_messages: 'Fetching messages…',
  gmail_search_messages: 'Searching Gmail…',
  gmail_send_message: 'Sending email…',
};

export default function GmailMcpPage() {
  return (
    <McpPlayground
      currentHref="/gmail-mcp"
      eyebrow="EGDesk Gmail MCP"
      title="Gmail Playground"
      subtitle="Fetch domain mail into EGDesk, then send from the signed-in Workspace account. Enable Gmail MCP and connect Google Workspace credentials."
      apiPath="/api/gmail"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#c5221f"
    />
  );
}
