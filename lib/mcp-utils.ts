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
