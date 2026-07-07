import { formatFileSize, type FileFieldPayload } from '@/lib/mcp-utils';
import type { PlaygroundFieldDef } from '@/components/mcp-playground';
import {
  buildGeminiToolArgsFromPanel,
  type GeminiToolsPanelState,
} from '@/lib/ai-caller-tools';

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff', 'avif', 'heic', 'heif',
]);

const SNIPPET_DEFAULTS = {
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  caller: 'mcp',
};

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

function resolveFieldRaw(
  field: PlaygroundFieldDef,
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (trimmed) return trimmed;
  if (field.usePlaceholderWhenEmpty && field.placeholder?.trim()) {
    return field.placeholder.trim();
  }
  return undefined;
}

export function buildAiCallerArgsFromPlayground(
  fields: PlaygroundFieldDef[],
  fieldValues: Record<string, string>,
  filePayloads: Record<string, FileFieldPayload>,
  geminiTools: GeminiToolsPanelState,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = resolveFieldRaw(field, fieldValues[field.name]);
    if (raw === undefined) continue;

    const apiKey = field.apiName || field.name;
    if (field.type === 'boolean') {
      args[apiKey] = raw === 'true';
    } else if (field.type === 'number') {
      args[apiKey] = Number(raw);
    } else if (field.type === 'json') {
      try {
        args[apiKey] = JSON.parse(raw);
      } catch {
        args[apiKey] = raw;
      }
    } else {
      args[apiKey] = raw;
    }
  }

  const payload = filePayloads.filePaths;
  if (payload?.base64) {
    const ext = payload.name.split('.').pop()?.toLowerCase() ?? '';
    if (IMAGE_EXTENSIONS.has(ext)) {
      args.images = [`data:${mimeTypeForFilename(payload.name)};base64,${payload.base64}`];
      args.__attachedImageMeta = { name: payload.name, size: payload.size };
    } else {
      args.files = [{
        name: payload.name,
        content: payload.base64,
        encoding: 'base64',
        mimeType: mimeTypeForFilename(payload.name),
      }];
      args.__attachedFileMeta = { name: payload.name, size: payload.size };
    }
    delete args.filePaths;
  } else if (typeof args.filePaths === 'string' && String(args.filePaths).trim()) {
    args.filePaths = String(args.filePaths)
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof args.images === 'string' && String(args.images).trim()) {
    args.images = [String(args.images).trim()];
  }

  const toolArgs = buildGeminiToolArgsFromPanel(geminiTools);
  if (toolArgs.tools) args.tools = toolArgs.tools;
  if (toolArgs.toolConfig) args.toolConfig = toolArgs.toolConfig;
  if (toolArgs.responseSchema) args.responseSchema = toolArgs.responseSchema;

  return args;
}

function formatTsString(value: string): string {
  if (
    value.length <= 100
    && !value.includes('\n')
    && !value.includes('`')
    && !value.includes('${')
  ) {
    return JSON.stringify(value);
  }
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return `\`${escaped}\``;
}

function formatTsObject(
  value: unknown,
  indentLevel = 0,
  keyPath: string[] = [],
): string {
  const indent = '  '.repeat(indentLevel);
  const childIndent = '  '.repeat(indentLevel + 1);

  if (value == null) return 'undefined';

  if (typeof value === 'string') {
    const parentKey = keyPath[keyPath.length - 1] ?? '';
    if (
      (parentKey === 'images' || parentKey === 'content')
      && value.length > 200
    ) {
      if (value.startsWith('data:')) {
        const mime = value.match(/^data:([^;]+);base64,/)?.[1] ?? 'application/octet-stream';
        return `'data:${mime};base64,<PASTE_BASE64_HERE>'`;
      }
      return `'<PASTE_BASE64_HERE>'`;
    }
    return formatTsString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const lines = value.map((entry) => `${childIndent}${formatTsObject(entry, indentLevel + 1, keyPath)}`);
    return `[\n${lines.join(',\n')},\n${indent}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, entryValue]) => {
      const formatted = formatTsObject(entryValue, indentLevel + 1, [...keyPath, key]);
      return `${childIndent}${JSON.stringify(key)}: ${formatted}`;
    });
    return `{\n${lines.join(',\n')},\n${indent}}`;
  }

  return JSON.stringify(value);
}

function buildSnippetOptions(
  args: Record<string, unknown>,
  defaultModel = SNIPPET_DEFAULTS.model,
): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  const prompt = String(args.prompt ?? '').trim();

  const systemPrompt = typeof args.systemPrompt === 'string' ? args.systemPrompt.trim() : '';
  if (systemPrompt) options.systemPrompt = systemPrompt;

  const model = typeof args.model === 'string' ? args.model.trim() : '';
  if (model && model !== defaultModel) options.model = model;

  const keyName = typeof args.keyName === 'string' ? args.keyName.trim() : '';
  if (keyName) options.keyName = keyName;

  if (typeof args.temperature === 'number' && args.temperature !== SNIPPET_DEFAULTS.temperature) {
    options.temperature = args.temperature;
  } else if (typeof args.temperature === 'string' && args.temperature.trim()) {
    const parsed = Number(args.temperature);
    if (!Number.isNaN(parsed) && parsed !== SNIPPET_DEFAULTS.temperature) {
      options.temperature = parsed;
    }
  }

  if (typeof args.maxOutputTokens === 'number' && args.maxOutputTokens > 0) {
    options.maxOutputTokens = args.maxOutputTokens;
  } else if (typeof args.maxOutputTokens === 'string' && args.maxOutputTokens.trim()) {
    const parsed = Number(args.maxOutputTokens);
    if (!Number.isNaN(parsed) && parsed > 0) {
      options.maxOutputTokens = parsed;
    }
  }

  const caller = typeof args.caller === 'string' ? args.caller.trim() : '';
  if (caller && caller !== SNIPPET_DEFAULTS.caller) options.caller = caller;

  if (args.responseSchema) options.responseSchema = args.responseSchema;
  if (args.tools) options.tools = args.tools;
  if (args.toolConfig) options.toolConfig = args.toolConfig;

  if (Array.isArray(args.images) && args.images.length > 0) {
    options.images = args.images;
    if (args.__attachedImageMeta && typeof args.__attachedImageMeta === 'object') {
      options.__attachmentComment = `Attached image: ${(args.__attachedImageMeta as FileFieldPayload).name} (${formatFileSize((args.__attachedImageMeta as FileFieldPayload).size)})`;
    }
  }

  if (Array.isArray(args.filePaths) && args.filePaths.length > 0) {
    options.filePaths = args.filePaths;
  }

  if (Array.isArray(args.files) && args.files.length > 0) {
    options.files = args.files;
    if (args.__attachedFileMeta && typeof args.__attachedFileMeta === 'object') {
      options.__attachmentComment = `Attached file: ${(args.__attachedFileMeta as FileFieldPayload).name} (${formatFileSize((args.__attachedFileMeta as FileFieldPayload).size)})`;
    }
  }

  if (typeof args.images === 'string' && args.images.trim()) {
    options.images = [args.images.trim()];
  }

  return { prompt, options };
}

export function buildCallAiCallerSnippet(
  args: Record<string, unknown>,
  defaultModel = SNIPPET_DEFAULTS.model,
): string {
  const { prompt, options } = buildSnippetOptions(args, defaultModel);
  const attachmentComment =
    typeof options.__attachmentComment === 'string' ? options.__attachmentComment : null;
  delete options.__attachmentComment;

  const optionKeys = Object.keys(options);
  const lines: string[] = [
    "import { callAiCaller } from './egdesk-helpers';",
    '',
    'const result = await callAiCaller(',
    `  ${formatTsString(prompt || 'Your prompt here')},`,
  ];

  if (optionKeys.length === 0) {
    lines.push(');');
  } else {
    lines.push('  {');
    if (attachmentComment) {
      lines.push(`    // ${attachmentComment} — replace placeholder base64 before running`);
    }
    for (const key of optionKeys) {
      lines.push(`    ${JSON.stringify(key)}: ${formatTsObject(options[key], 2, [key])},`);
    }
    lines.push('  },');
    lines.push(');');
  }

  lines.push('');
  lines.push('// result.content — text response');
  lines.push('// result.json — parsed JSON when responseSchema is set');
  lines.push('// result.functionCalls — Gemini function calls (not auto-executed)');
  lines.push('// result.usage — token usage summary');

  return lines.join('\n');
}
