/** Parse EGDesk API + MCP-shaped responses into a plain object */
export function parseMcpResult(raw: any): any {
  if (raw?.success === false) {
    throw new Error(raw.error || 'Request failed');
  }

  const mcpPayload = raw?.result ?? raw;

  if (mcpPayload?.content?.[0]?.text) {
    try {
      return JSON.parse(mcpPayload.content[0].text);
    } catch {
      return mcpPayload;
    }
  }

  return mcpPayload;
}

export function extractUploadedFilePath(result: any): string | null {
  const text =
    typeof result === 'string'
      ? result
      : result?.content?.[0]?.text ?? result?.text ?? null;

  if (typeof text !== 'string') return null;

  const match = text.match(/File uploaded successfully to:\s*(.+?)(?:\n|$)/);
  return match?.[1]?.trim() ?? null;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileFieldPayload = {
  name: string;
  size: number;
  base64: string;
};

const DISPLAY_STRING_MAX = 200;

function estimateBase64Bytes(base64: string): number {
  const normalized = base64.replace(/\s/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.round((normalized.length * 3) / 4) - padding);
}

function redactDisplayString(value: string): string {
  const trimmed = value.trim();
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1];
    const bytes = estimateBase64Bytes(dataUrlMatch[2]);
    return `[${mime}, ${formatFileSize(bytes)} — omitted from display]`;
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    const bytes = estimateBase64Bytes(trimmed);
    return `[base64, ${formatFileSize(bytes)} — omitted from display]`;
  }

  return `${trimmed.slice(0, DISPLAY_STRING_MAX)}… [${trimmed.length.toLocaleString()} chars — truncated]`;
}

/** Strip huge base64 blobs before rendering JSON in the playground UI. */
export function redactBulkyPayloadForDisplay(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, entry) => {
    if (typeof entry !== 'string') return entry;
    if (entry.length <= DISPLAY_STRING_MAX) return entry;
    return redactDisplayString(entry);
  }));
}

export function stringifyPayloadForDisplay(value: unknown, space = 2): string {
  return JSON.stringify(redactBulkyPayloadForDisplay(value), null, space);
}
