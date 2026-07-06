'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { parseMcpResult } from '@/lib/mcp-utils';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_KEY_PLACEHOLDER = 'Default key (EGDesk preference)';

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff', 'avif', 'heic', 'heif',
]);

function mimeTypeForFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
    pdf: 'application/pdf',
  };
  return map[ext] ?? 'application/octet-stream';
}

function postProcessAiCallerArgs(
  args: Record<string, any>,
  context: {
    tool: PlaygroundToolDef;
    filePayloads: Record<string, { name: string; size: number; base64: string }>;
  },
): Record<string, any> {
  if (context.tool.name !== 'ai_caller_call') return args;

  const next = { ...args };
  const payload = context.filePayloads.filePaths;
  if (payload?.base64) {
    const ext = payload.name.split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_EXTENSIONS.has(ext)) {
      next.images = [`data:${mimeTypeForFilename(payload.name)};base64,${payload.base64}`];
    } else {
      next.files = [{
        name: payload.name,
        content: payload.base64,
        encoding: 'base64',
        mimeType: mimeTypeForFilename(payload.name),
      }];
    }
    delete next.filePaths;
  } else if (typeof next.filePaths === 'string' && next.filePaths.trim()) {
    next.filePaths = next.filePaths
      .split(/\r?\n/)
      .map((entry: string) => entry.trim())
      .filter(Boolean);
  }

  if (typeof next.images === 'string' && next.images.trim()) {
    next.images = [next.images.trim()];
  }

  return next;
}

const BASE_TOOLS: PlaygroundToolDef[] = [
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
        placeholder: 'Describe this image or ask a question about the attached file.',
        usePlaceholderWhenEmpty: false,
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
        options: [],
        placeholder: DEFAULT_GEMINI_MODEL,
        usePlaceholderWhenEmpty: true,
        defaultValue: '',
        hint: 'Loading available Gemini models from EGDesk…',
      },
      {
        name: 'keyName',
        label: 'API key',
        type: 'select',
        options: [],
        placeholder: DEFAULT_KEY_PLACEHOLDER,
        usePlaceholderWhenEmpty: false,
        defaultValue: '',
        hint: 'Loading Google API keys from EGDesk AI Keys Manager…',
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
      {
        name: 'filePaths',
        label: 'Attach file (optional)',
        type: 'file',
        fileDelivery: 'inline',
        accept: 'image/*,.png,.jpg,.jpeg,.gif,.webp,.bmp,.pdf,.docx,.txt,application/pdf',
        hint: 'PNG and other images are sent inline to Gemini vision. PDF/DOCX/text use inline files — no File System MCP upload required.',
      },
      {
        name: 'images',
        label: 'Images (optional, base64)',
        type: 'textarea',
        placeholder: 'data:image/png;base64,...',
        hint: 'Base64 or data URLs. Max 4 images per call.',
      },
    ],
  },
  {
    name: 'ai_caller_get_capabilities',
    title: 'Get attachment capabilities',
    description: 'Supported file types, limits, and composable MCP workflows for ai_caller_call.',
    category: 'inference',
    helperName: 'callAiCallerTool',
    fields: [],
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
        type: 'select',
        options: [''],
        placeholder: 'Any model',
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
        type: 'select',
        options: [''],
        placeholder: 'Any model',
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
  ai_caller_get_capabilities: 'Loading attachment capabilities...',
  ai_caller_get_usage: 'Querying aggregated usage stats...',
  ai_caller_get_logs: 'Fetching call logs...',
};

function withPlaygroundOptions(
  tools: PlaygroundToolDef[],
  models: string[],
  defaultModel: string,
  modelsError: string | null,
  apiKeyNames: string[],
  apiKeysError: string | null,
  preferredKeyName: string | null,
): PlaygroundToolDef[] {
  const modelHint = modelsError
    ? `${modelsError} Leave on default to use ${defaultModel}.`
    : models.length
      ? `Loaded ${models.length} Gemini models from EGDesk. Leave on default to use ${defaultModel}.`
      : `No models returned from EGDesk. Leave on default to use ${defaultModel}.`;

  const keyHint = apiKeysError
    ? `${apiKeysError} Leave on default to use EGDesk's preferred Google key.`
    : apiKeyNames.length
      ? preferredKeyName
        ? `Loaded ${apiKeyNames.length} Google key(s). Default uses "${preferredKeyName}" (EGDesk preference).`
        : `Loaded ${apiKeyNames.length} Google key(s) from AI Keys Manager. Leave on default for EGDesk preference.`
      : 'No named Google keys in AI Keys Manager. Leave on default to use env var or preferred key.';

  return tools.map(tool => ({
    ...tool,
    fields: tool.fields.map(field => {
      if (field.name === 'model' && field.type === 'select') {
        if (tool.name === 'ai_caller_call') {
          return {
            ...field,
            options: models,
            placeholder: defaultModel,
            hint: modelHint,
          };
        }

        return {
          ...field,
          options: ['', ...models],
          hint: models.length ? `${models.length} models loaded from EGDesk.` : undefined,
        };
      }

      if (field.name === 'keyName' && field.type === 'select' && tool.name === 'ai_caller_call') {
        return {
          ...field,
          options: ['', ...apiKeyNames],
          placeholder: DEFAULT_KEY_PLACEHOLDER,
          hint: keyHint,
        };
      }

      return field;
    }),
  }));
}

function extractGoogleKeyNames(parsed: any): { names: string[]; preferredName: string | null } {
  const keys = Array.isArray(parsed?.keys) ? parsed.keys : [];
  const names = keys
    .map((key: any) => (typeof key?.name === 'string' ? key.name.trim() : ''))
    .filter((name: string) => name.length > 0);

  const preferredId = typeof parsed?.preferredKeyId === 'string' ? parsed.preferredKeyId : null;
  const preferred = preferredId
    ? keys.find((key: any) => key?.id === preferredId)
    : keys.find((key: any) => key?.isPreferred === true);
  const preferredName =
    typeof preferred?.name === 'string' && preferred.name.trim()
      ? preferred.name.trim()
      : null;

  return { names, preferredName };
}

export default function AiCallerPlayground() {
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState(DEFAULT_GEMINI_MODEL);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [apiKeyNames, setApiKeyNames] = useState<string[]>([]);
  const [preferredKeyName, setPreferredKeyName] = useState<string | null>(null);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      const [modelsResult, keysResult] = await Promise.allSettled([
        apiFetch('/api/ai-caller', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'ai_caller_list_models',
            arguments: {},
          }),
        }).then(async (res) => parseMcpResult(await res.json())),
        apiFetch('/api/egdesk-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'egdesk_list_gemini_keys',
            arguments: {},
          }),
        }).then(async (res) => parseMcpResult(await res.json())),
      ]);

      if (cancelled) return;

      if (modelsResult.status === 'fulfilled') {
        const parsed = modelsResult.value;
        const models = Array.isArray(parsed?.models)
          ? parsed.models.filter((model: unknown) => typeof model === 'string')
          : [];
        const resolvedDefault =
          typeof parsed?.defaultModel === 'string' && parsed.defaultModel.trim()
            ? parsed.defaultModel.trim()
            : DEFAULT_GEMINI_MODEL;

        setGeminiModels(models);
        setDefaultModel(
          models.includes(resolvedDefault) ? resolvedDefault : models[0] ?? resolvedDefault,
        );
        setModelsError(null);
      } else {
        setGeminiModels([]);
        setDefaultModel(DEFAULT_GEMINI_MODEL);
        setModelsError(
          modelsResult.reason?.message || 'Could not load Gemini models from EGDesk.',
        );
      }

      if (keysResult.status === 'fulfilled') {
        const { names, preferredName } = extractGoogleKeyNames(keysResult.value);
        setApiKeyNames(names);
        setPreferredKeyName(preferredName);
        setApiKeysError(null);
      } else {
        setApiKeyNames([]);
        setPreferredKeyName(null);
        setApiKeysError(
          keysResult.reason?.message || 'Could not load Google API keys from EGDesk.',
        );
      }
    };

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const tools = useMemo(
    () =>
      withPlaygroundOptions(
        BASE_TOOLS,
        geminiModels,
        defaultModel,
        modelsError,
        apiKeyNames,
        apiKeysError,
        preferredKeyName,
      ),
    [geminiModels, defaultModel, modelsError, apiKeyNames, apiKeysError, preferredKeyName],
  );

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
          {data.attachments && (
            <>
              <div style={miniLabelStyle}>Attachments</div>
              <dl style={kvGridStyle}>
                <dt style={kvTermStyle}>Images</dt>
                <dd style={kvDescStyle}>{data.attachments.imageCount ?? 0}</dd>
                <dt style={kvTermStyle}>Text files</dt>
                <dd style={kvDescStyle}>{data.attachments.textFileCount ?? 0}</dd>
                <dt style={kvTermStyle}>Documents</dt>
                <dd style={kvDescStyle}>{data.attachments.documentFileCount ?? 0}</dd>
                <dt style={kvTermStyle}>Videos</dt>
                <dd style={kvDescStyle}>{data.attachments.videoFileCount ?? 0}</dd>
              </dl>
            </>
          )}
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
          {data.apiKey?.name && (
            <>
              <div style={miniLabelStyle}>API Key Used</div>
              <dl style={kvGridStyle}>
                <dt style={kvTermStyle}>Key name</dt>
                <dd style={kvDescStyle}>{data.apiKey.name}</dd>
                {data.apiKey.id && (
                  <>
                    <dt style={kvTermStyle}>Key ID</dt>
                    <dd style={kvDescStyle}>{data.apiKey.id}</dd>
                  </>
                )}
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
      tools={tools}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#7c3aed"
      renderDisplay={renderDisplay}
      postProcessArgs={postProcessAiCallerArgs}
      validateBeforeRun={(tool, values, filePayloads) => {
        if (tool.name !== 'ai_caller_call') return null;
        const prompt = values.prompt?.trim() ?? '';
        const images = values.images?.trim() ?? '';
        const filePath = values.filePaths?.trim() ?? '';
        const hasAttachedFile = Boolean(filePayloads?.filePaths?.base64);
        if (!prompt && !images && !filePath && !hasAttachedFile) {
          return 'Enter a prompt, paste base64 image data, or attach a file.';
        }
        return null;
      }}
    />
  );
}
