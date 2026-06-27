'use client';

import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'local_agent_status',
    title: 'Check status',
    description: 'Ollama install state, default Gemma 4 QAT model availability, and installed models.',
    category: 'setup',
    helperName: 'getLocalAgentStatus',
    fields: [],
  },
  {
    name: 'local_agent_pull',
    title: 'Pull model',
    description: 'Download the default local agent model. Starts Ollama if needed — can take several minutes.',
    category: 'setup',
    helperName: 'pullLocalAgentModel',
    fields: [
      {
        name: 'model',
        label: 'Model tag (optional)',
        type: 'string',
        placeholder: 'Default Gemma 4 QAT if empty',
      },
    ],
  },
  {
    name: 'local_agent_call',
    title: 'Chat',
    description: 'Run a chat completion with the local offline model.',
    category: 'inference',
    helperName: 'callLocalAgent',
    fields: [
      {
        name: 'prompt',
        label: 'Prompt',
        type: 'textarea',
        required: true,
        placeholder: 'Summarize what PageIndex does in one sentence.',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'inference', label: 'Inference' },
];

const RUNNING_HINTS: Record<string, string> = {
  local_agent_pull: 'Downloading model weights — this can take several minutes on first run.',
  local_agent_call: 'Running inference on local Ollama…',
};

export default function LocalAgentPlayground() {
  const renderDisplay = (data: any, tool: string) => {
    const { kvGridStyle, kvTermStyle, kvDescStyle, miniLabelStyle } = playgroundStyles;

    if (tool === 'local_agent_call' && (data?.response || data?.content || data?.message)) {
      const text = data.response || data.content || data.message;
      return (
        <div>
          <div style={miniLabelStyle}>Assistant</div>
          <pre style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            margin: 0,
          }}>
            {String(text)}
          </pre>
        </div>
      );
    }

    if (data?.ready != null || data?.ollamaRunning != null || data?.models) {
      return (
        <dl style={kvGridStyle}>
          {data.ready != null && <><dt style={kvTermStyle}>Ready</dt><dd style={kvDescStyle}>{String(data.ready)}</dd></>}
          {data.ollamaRunning != null && <><dt style={kvTermStyle}>Ollama running</dt><dd style={kvDescStyle}>{String(data.ollamaRunning)}</dd></>}
          {data.defaultModelInstalled != null && (
            <><dt style={kvTermStyle}>Default model</dt><dd style={kvDescStyle}>{String(data.defaultModelInstalled)}</dd></>
          )}
          {Array.isArray(data.models) && (
            <>
              <dt style={kvTermStyle}>Models</dt>
              <dd style={kvDescStyle}>{data.models.join(', ') || '—'}</dd>
            </>
          )}
        </dl>
      );
    }

    if (data?.message) {
      return <p style={{ fontSize: 14, color: '#065f46', margin: 0 }}>{data.message}</p>;
    }

    return null;
  };

  return (
    <McpPlayground
      currentHref="/local-agent-mcp"
      eyebrow="EGDesk Local Agent MCP"
      title="Local Agent Playground"
      subtitle="Offline AI via Ollama and Gemma 4 QAT. Enable the Local Agent MCP server in EGDesk and pull the model once before chatting."
      apiPath="/api/local-agent"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#059669"
      renderDisplay={renderDisplay}
    />
  );
}
