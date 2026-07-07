'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { parseMcpResult } from '@/lib/mcp-utils';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';
import { AiCallerToolsPanel } from '@/components/ai-caller-tools-panel';
import {
  createDefaultGeminiToolsState,
  type GeminiToolsPanelState,
} from '@/lib/ai-caller-tools';
import {
  buildAiCallerArgsFromPlayground,
  buildCallAiCallerSnippet,
} from '@/lib/ai-caller-helper-snippet';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_KEY_PLACEHOLDER = 'Default key (EGDesk preference)';

function postProcessAiCallerArgs(
  _args: Record<string, any>,
  context: {
    tool: PlaygroundToolDef;
    fieldValues: Record<string, string>;
    filePayloads: Record<string, { name: string; size: number; base64: string }>;
    geminiTools?: GeminiToolsPanelState;
  },
): Record<string, any> {
  if (context.tool.name !== 'ai_caller_call') return _args;

  const args = buildAiCallerArgsFromPlayground(
    context.tool.fields,
    context.fieldValues,
    context.filePayloads,
    context.geminiTools ?? createDefaultGeminiToolsState(),
  );
  delete args.__attachedImageMeta;
  delete args.__attachedFileMeta;
  return args;
}

function CopyCallAiCallerButton({
  tool,
  fieldValues,
  filePayloads,
  geminiTools,
  defaultModel,
}: {
  tool: PlaygroundToolDef;
  fieldValues: Record<string, string>;
  filePayloads: Record<string, { name: string; size: number; base64: string }>;
  geminiTools: GeminiToolsPanelState;
  defaultModel: string;
}) {
  const { secondaryBtnStyle } = playgroundStyles;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    setError(null);
    try {
      const args = buildAiCallerArgsFromPlayground(tool.fields, fieldValues, filePayloads, geminiTools);
      const snippet = buildCallAiCallerSnippet(args, defaultModel);
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      setError(err?.message || 'Could not build helper snippet');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={handleCopy}
        style={{
          ...secondaryBtnStyle,
          borderColor: '#c4b5fd',
          color: '#5b21b6',
          background: '#faf5ff',
        }}
      >
        {copied ? 'Copied callAiCaller()' : 'Copy callAiCaller()'}
      </button>
      {error && <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>}
    </div>
  );
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
        name: 'maxOutputTokens',
        label: 'Max output tokens',
        type: 'string',
        placeholder: 'Auto (model max)',
        hint: 'Leave empty to auto-use the model\'s maximum from the Gemini API.',
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
  modelDetails: Array<{ name: string; outputTokenLimit: number | null }>,
  selectedModel: string,
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

  const activeModel = selectedModel || defaultModel;
  const activeModelDetails = modelDetails.find((model) => model.name === activeModel);
  const modelMaxOutput = activeModelDetails?.outputTokenLimit;
  const maxOutputHint = modelMaxOutput
    ? `Leave empty to auto-use ${modelMaxOutput.toLocaleString()} tokens (this model's Gemini API max).`
    : 'Leave empty to auto-use the model\'s maximum output tokens from the Gemini API.';

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

      if (field.name === 'maxOutputTokens' && tool.name === 'ai_caller_call') {
        return {
          ...field,
          hint: maxOutputHint,
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
  const [modelDetails, setModelDetails] = useState<Array<{
    name: string;
    outputTokenLimit: number | null;
    inputTokenLimit: number | null;
  }>>([]);
  const [defaultModel, setDefaultModel] = useState(DEFAULT_GEMINI_MODEL);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [apiKeyNames, setApiKeyNames] = useState<string[]>([]);
  const [preferredKeyName, setPreferredKeyName] = useState<string | null>(null);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [geminiTools, setGeminiTools] = useState<GeminiToolsPanelState>(() => createDefaultGeminiToolsState());

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
        setModelDetails(
          Array.isArray(parsed?.modelDetails)
            ? parsed.modelDetails.map((model: any) => ({
              name: String(model?.name ?? ''),
              outputTokenLimit: Number.isFinite(model?.outputTokenLimit) ? Number(model.outputTokenLimit) : null,
              inputTokenLimit: Number.isFinite(model?.inputTokenLimit) ? Number(model.inputTokenLimit) : null,
            })).filter((model: { name: string }) => model.name)
            : [],
        );
        setDefaultModel(
          models.includes(resolvedDefault) ? resolvedDefault : models[0] ?? resolvedDefault,
        );
        setModelsError(null);
      } else {
        setGeminiModels([]);
        setModelDetails([]);
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
        modelDetails,
        selectedModel,
      ),
    [geminiModels, defaultModel, modelsError, apiKeyNames, apiKeysError, preferredKeyName, modelDetails, selectedModel],
  );

  const renderDisplay = (data: any, tool: string) => {
    const { kvGridStyle, kvTermStyle, kvDescStyle, miniLabelStyle } = playgroundStyles;

    if (tool === 'ai_caller_call' && (data?.content || data?.functionCalls?.length || data?.json)) {
      return (
        <div>
          {data.content ? (
            <>
              <div style={miniLabelStyle}>Response</div>
              <pre style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                lineHeight: 1.65,
                fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
                whiteSpace: 'pre-wrap',
                margin: 0,
                marginBottom: 12,
              }}>
                {String(data.content)}
              </pre>
            </>
          ) : null}
          {data.json && (
            <>
              <div style={miniLabelStyle}>Parsed JSON</div>
              <pre style={{
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: 8,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.55,
                fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
                whiteSpace: 'pre-wrap',
                margin: 0,
                marginBottom: 12,
              }}>
                {JSON.stringify(data.json, null, 2)}
              </pre>
            </>
          )}
          {Array.isArray(data.functionCalls) && data.functionCalls.length > 0 && (
            <>
              <div style={miniLabelStyle}>Function Calls</div>
              <pre style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.55,
                fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
                whiteSpace: 'pre-wrap',
                margin: 0,
                marginBottom: 12,
              }}>
                {JSON.stringify(data.functionCalls, null, 2)}
              </pre>
            </>
          )}
          {data.groundingMetadata && (
            <>
              <div style={miniLabelStyle}>Grounding</div>
              <pre style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 8,
                padding: 14,
                fontSize: 12,
                lineHeight: 1.5,
                fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
                whiteSpace: 'pre-wrap',
                margin: 0,
                marginBottom: 12,
                maxHeight: 240,
                overflow: 'auto',
              }}>
                {JSON.stringify(data.groundingMetadata, null, 2)}
              </pre>
            </>
          )}
          {data.codeExecutionResult && (
            <>
              <div style={miniLabelStyle}>Code execution result</div>
              <pre style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: 14,
                fontSize: 12,
                lineHeight: 1.5,
                fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
                whiteSpace: 'pre-wrap',
                margin: 0,
                marginBottom: 12,
              }}>
                {String(data.codeExecutionResult)}
              </pre>
            </>
          )}
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
          {(data.finishReason || data.outputTokens) && (
            <>
              <div style={miniLabelStyle}>Output limits</div>
              <dl style={kvGridStyle}>
                {data.finishReason ? (
                  <>
                    <dt style={kvTermStyle}>Finish reason</dt>
                    <dd style={{
                      ...kvDescStyle,
                      color: data.finishReason === 'MAX_TOKENS' ? '#b45309' : kvDescStyle.color,
                      fontWeight: data.finishReason === 'MAX_TOKENS' ? 600 : kvDescStyle.fontWeight,
                    }}>
                      {data.finishReason}
                      {data.finishReason === 'MAX_TOKENS' ? ' — response may be truncated' : ''}
                    </dd>
                  </>
                ) : null}
                {data.outputTokens?.configured != null ? (
                  <>
                    <dt style={kvTermStyle}>Max output (configured)</dt>
                    <dd style={kvDescStyle}>
                      {Number(data.outputTokens.configured).toLocaleString()}
                      {data.outputTokens.autoMaxed ? ' (auto — model max)' : ''}
                    </dd>
                  </>
                ) : null}
                {data.outputTokens?.modelMax != null ? (
                  <>
                    <dt style={kvTermStyle}>Model max output</dt>
                    <dd style={kvDescStyle}>{Number(data.outputTokens.modelMax).toLocaleString()}</dd>
                  </>
                ) : null}
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
      postProcessArgs={(args, context) => postProcessAiCallerArgs(args, { ...context, geminiTools })}
      renderRunActions={({ tool, fieldValues, filePayloads }) => (
        tool.name === 'ai_caller_call' ? (
          <CopyCallAiCallerButton
            tool={tool}
            fieldValues={fieldValues}
            filePayloads={filePayloads}
            geminiTools={geminiTools}
            defaultModel={defaultModel}
          />
        ) : null
      )}
      renderFormExtrasAfterField="maxOutputTokens"
      onFieldValuesChange={(fieldValues) => {
        const model = fieldValues.model?.trim() || '';
        setSelectedModel((prev) => (prev === model ? prev : model));
      }}
      renderFormExtras={({ tool, fieldValues, setField }) => {
        if (tool.name !== 'ai_caller_call') return null;

        const activeModel = fieldValues.model?.trim() || selectedModel || defaultModel;
        const modelMax = modelDetails.find((model) => model.name === activeModel)?.outputTokenLimit;
        const currentMax = fieldValues.maxOutputTokens?.trim() ?? '';
        const { secondaryBtnStyle } = playgroundStyles;

        return (
          <div style={{ marginBottom: 16 }}>
            {modelMax ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setField('maxOutputTokens', String(modelMax))}
                  style={{
                    ...secondaryBtnStyle,
                    borderColor: '#c4b5fd',
                    color: '#5b21b6',
                    background: '#faf5ff',
                  }}
                >
                  Use model max ({modelMax.toLocaleString()})
                </button>
                {currentMax ? (
                  <button
                    type="button"
                    onClick={() => setField('maxOutputTokens', '')}
                    style={secondaryBtnStyle}
                  >
                    Clear (auto)
                  </button>
                ) : null}
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  Empty field auto-uses {modelMax.toLocaleString()} for {activeModel}.
                </span>
              </div>
            ) : null}
            <AiCallerToolsPanel value={geminiTools} onChange={setGeminiTools} accentColor="#7c3aed" />
          </div>
        );
      }}
      validateBeforeRun={(tool, values, filePayloads) => {
        if (tool.name !== 'ai_caller_call') return null;
        const prompt = values.prompt?.trim() ?? '';
        const images = values.images?.trim() ?? '';
        const filePath = values.filePaths?.trim() ?? '';
        const hasAttachedFile = Boolean(filePayloads?.filePaths?.base64);
        if (!prompt && !images && !filePath && !hasAttachedFile) {
          return 'Enter a prompt, paste base64 image data, or attach a file.';
        }
        try {
          buildAiCallerArgsFromPlayground(tool.fields, values, filePayloads ?? {}, geminiTools);
        } catch (err: any) {
          return err?.message || 'Invalid Gemini tools configuration.';
        }
        return null;
      }}
    />
  );
}
