export type GeminiToolsPanelState = {
  structuredOutput: boolean;
  responseSchemaJson: string;
  functionCalling: boolean;
  functionsJson: string;
  functionMode: 'AUTO' | 'ANY' | 'NONE';
  codeExecution: boolean;
  googleSearch: boolean;
  googleMaps: boolean;
  urlContext: boolean;
};

export const DEFAULT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    supplier: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        business_number: { type: 'string' },
      },
    },
    buyer: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit_price: { type: 'number' },
        },
      },
    },
  },
};

export const DEFAULT_FUNCTION_DECLARATIONS = [
  {
    name: 'get_weather',
    description: 'Get current weather for a city',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' },
      },
      required: ['city'],
    },
  },
];

export function createDefaultGeminiToolsState(): GeminiToolsPanelState {
  return {
    structuredOutput: true,
    responseSchemaJson: JSON.stringify(DEFAULT_RESPONSE_SCHEMA, null, 2),
    functionCalling: false,
    functionsJson: JSON.stringify(DEFAULT_FUNCTION_DECLARATIONS, null, 2),
    functionMode: 'AUTO',
    codeExecution: false,
    googleSearch: false,
    googleMaps: false,
    urlContext: false,
  };
}

function parseJsonField<T>(raw: string, label: string): T | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`Invalid JSON in ${label}`);
  }
}

export function buildGeminiToolArgsFromPanel(state: GeminiToolsPanelState): {
  tools?: unknown[];
  toolConfig?: { mode: string; allowedFunctionNames?: string[] };
  responseSchema?: unknown;
} {
  const tools: unknown[] = [];

  if (state.codeExecution) tools.push({ codeExecution: {} });
  if (state.googleSearch) tools.push({ googleSearch: {} });
  if (state.googleMaps) tools.push({ googleMaps: {} });
  if (state.urlContext) tools.push({ urlContext: {} });

  if (state.functionCalling) {
    const declarations = parseJsonField<unknown[]>(state.functionsJson, 'function declarations');
    if (declarations?.length) {
      tools.push({ functionDeclarations: declarations });
    }
  }

  const out: {
    tools?: unknown[];
    toolConfig?: { mode: string; allowedFunctionNames?: string[] };
    responseSchema?: unknown;
  } = {};

  if (tools.length > 0) out.tools = tools;
  if (state.functionCalling) out.toolConfig = { mode: state.functionMode };

  if (state.structuredOutput) {
    out.responseSchema = parseJsonField(state.responseSchemaJson, 'structured output schema');
  }

  return out;
}

export function getActiveGeminiToolLabels(state: GeminiToolsPanelState): string[] {
  const labels: string[] = [];
  if (state.structuredOutput) labels.push('Structured outputs');
  if (state.functionCalling) labels.push('Function calling');
  if (state.codeExecution) labels.push('Code execution');
  if (state.googleSearch) labels.push('Google Search');
  if (state.googleMaps) labels.push('Google Maps');
  if (state.urlContext) labels.push('URL context');
  return labels;
}
