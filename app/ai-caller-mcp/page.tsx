'use client';

import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const GEMINI_MODEL_OPTIONS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-1.0-pro',
];

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'ai_caller_call',
    title: 'Call Gemini',
    description: 'Send a prompt to Gemini and log token usage for rate tracking.',
    category: 'inference',
    helperName: 'callAiCaller',
    fields: [
      {
        name: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
        placeholder: 'Summarize the benefits of token usage tracking in one paragraph.',
      },
      {
        name: 'systemPrompt',
        label: 'System prompt (optional)',
        type: 'textarea',
        placeholder: 'You are a helpful assistant.',
      },
      {
        name: 'model',
        label: 'Model',
        type: 'select',
        options: GEMINI_MODEL_OPTIONS,
        placeholder: 'gemini-2.5-flash',
        usePlaceholderWhenEmpty: true,
        defaultValue: '',
        hint: 'Leave on the default option to use gemini-2.5-flash.',
      },
      {
        name: 'temperature',
        label: 'Temperature',
        type: 'string',
        placeholder: '0.7',
        usePlaceholderWhenEmpty: true,
      },
      {
        name: 'caller',
        label: 'Caller tag',
        type: 'string',
        placeholder: 'mcp',
        usePlaceholderWhenEmpty: true,
      },
    ],
  },
  {
    name: 'ai_caller_get_usage',
    title: 'Get usage stats',
    description: 'Aggregated token usage. Filter by caller, model, date range. Group by caller/model/day/hour.',
    category: 'tracking',
    helperName: 'getAiCallerUsage',
    fields: [
      {
        name: 'caller',
        label: 'Filter by caller',
        type: 'string',
        placeholder: 'e.g. mcp',
      },
      {
        name: 'model',
        label: 'Filter by model',
        type: 'string',
        placeholder: 'e.g. gemini-2.5-flash',
      },
      {
        name: 'since',
        label: 'Since (ISO-8601)',
        type: 'string',
        placeholder: '2026-01-01T00:00:00Z',
      },
      {
        name: 'until',
        label: 'Until (ISO-8601)',
        type: 'string',
        placeholder: '2026-12-31T23:59:59Z',
      },
      {
        name: 'groupBy',
        label: 'Group by',
        type: 'string',
        placeholder: 'caller | model | day | hour',
      },
    ],
  },
  {
    name: 'ai_caller_get_logs',
    title: 'Get call logs',
    description: 'Raw AI call log entries, newest first. Use for debugging or detailed inspection.',
    category: 'tracking',
    helperName: 'getAiCallerLogs',
    fields: [
      {
        name: 'caller',
        label: 'Filter by caller',
        type: 'string',
        placeholder: 'e.g. mcp',
      },
      {
        name: 'model',
        label: 'Filter by model',
        type: 'string',
        placeholder: 'e.g. gemini-2.5-flash',
      },
      {
        name: 'limit',
        label: 'Limit',
        type: 'string',
        placeholder: '50 (default, max 500)',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'inference', label: 'Inference' },
  { key: 'tracking', label: 'Usage Tracking' },
];

const RUNNING_HINTS: Record<string, string> = {
  ai_caller_call: 'Calling Gemini API and logging token usage...',
  ai_caller_get_usage: 'Querying aggregated usage stats...',
  ai_caller_get_logs: 'Fetching call logs...',
};

export default function AiCallerPlayground() {
  const renderDisplay = (data: any, tool: string) => {
    const { kvGridStyle, kvTermStyle, kvDescStyle, miniLabelStyle } = playgroundStyles;

    if (tool === 'ai_caller_call' && data?.content) {
      return (
        <div>
          <div style={miniLabelStyle}>Response</div>
          <pre style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            margin: 0,
            marginBottom: 12,
          }}>
            {String(data.content)}
          </pre>
          {data.usage && (
            <>
              <div style={miniLabelStyle}>Token Usage</div>
              <dl style={kvGridStyle}>
                <dt style={kvTermStyle}>Prompt tokens</dt>
                <dd style={kvDescStyle}>{data.usage.promptTokens}</dd>
                <dt style={kvTermStyle}>Completion tokens</dt>
                <dd style={kvDescStyle}>{data.usage.completionTokens}</dd>
                <dt style={kvTermStyle}>Total tokens</dt>
                <dd style={kvDescStyle}>{data.usage.totalTokens}</dd>
                <dt style={kvTermStyle}>Duration</dt>
                <dd style={kvDescStyle}>{data.usage.durationMs}ms</dd>
              </dl>
            </>
          )}
        </div>
      );
    }

    if (tool === 'ai_caller_get_usage' && data) {
      if (Array.isArray(data)) {
        return (
          <div>
            <div style={miniLabelStyle}>Grouped Usage</div>
            {data.map((row: any, i: number) => (
              <dl key={i} style={{ ...kvGridStyle, marginBottom: 8 }}>
                <dt style={kvTermStyle}>Group</dt>
                <dd style={kvDescStyle}>{row.group_key}</dd>
                <dt style={kvTermStyle}>Calls</dt>
                <dd style={kvDescStyle}>{row.call_count}</dd>
                <dt style={kvTermStyle}>Total tokens</dt>
                <dd style={kvDescStyle}>{row.total_tokens}</dd>
                <dt style={kvTermStyle}>Errors</dt>
                <dd style={kvDescStyle}>{row.error_count}</dd>
              </dl>
            ))}
          </div>
        );
      }
      return (
        <dl style={kvGridStyle}>
          <dt style={kvTermStyle}>Total calls</dt>
          <dd style={kvDescStyle}>{data.call_count ?? 0}</dd>
          <dt style={kvTermStyle}>Prompt tokens</dt>
          <dd style={kvDescStyle}>{data.total_prompt_tokens ?? 0}</dd>
          <dt style={kvTermStyle}>Completion tokens</dt>
          <dd style={kvDescStyle}>{data.total_completion_tokens ?? 0}</dd>
          <dt style={kvTermStyle}>Total tokens</dt>
          <dd style={kvDescStyle}>{data.total_tokens ?? 0}</dd>
          <dt style={kvTermStyle}>Avg duration</dt>
          <dd style={kvDescStyle}>{Math.round(data.avg_duration_ms ?? 0)}ms</dd>
          <dt style={kvTermStyle}>Errors</dt>
          <dd style={kvDescStyle}>{data.error_count ?? 0}</dd>
        </dl>
      );
    }

    return null;
  };

  return (
    <McpPlayground
      currentHref="/ai-caller-mcp"
      eyebrow="EGDesk AI Caller MCP"
      title="AI Caller Playground"
      subtitle="Gemini API calls with automatic token usage tracking. Every call is logged to SQLite for rate and cost monitoring."
      apiPath="/api/ai-caller"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#7c3aed"
      renderDisplay={renderDisplay}
    />
  );
}
