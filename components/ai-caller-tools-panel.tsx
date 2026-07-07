'use client';

import type React from 'react';
import { useState } from 'react';
import {
  type GeminiToolsPanelState,
  getActiveGeminiToolLabels,
} from '@/lib/ai-caller-tools';

type AiCallerToolsPanelProps = {
  value: GeminiToolsPanelState;
  onChange: (next: GeminiToolsPanelState) => void;
  accentColor?: string;
};

type ToolRowProps = {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  editable?: boolean;
  expanded?: boolean;
  onEdit?: () => void;
  children?: React.ReactNode;
};

function ToggleSwitch({
  enabled,
  onChange,
  accentColor,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  accentColor: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        border: 'none',
        background: enabled ? accentColor : '#d1d5db',
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          transition: 'left 0.15s ease',
        }}
      />
    </button>
  );
}

function ToolRow({
  title,
  description,
  enabled,
  onToggle,
  editable,
  expanded,
  onEdit,
  children,
}: ToolRowProps) {
  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      background: '#fff',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</div>
          {description && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{description}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {editable && (
            <button
              type="button"
              onClick={onEdit}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {expanded ? 'Hide' : 'Edit'}
            </button>
          )}
          <ToggleSwitch enabled={enabled} onChange={onToggle} accentColor="#7c3aed" />
        </div>
      </div>
      {expanded && children && (
        <div style={{
          borderTop: '1px solid #f3f4f6',
          padding: '12px 14px 14px',
          background: '#fafafa',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

const editorStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 140,
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
  lineHeight: 1.5,
  fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, monospace',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  background: '#fff',
};

export function AiCallerToolsPanel({ value, onChange, accentColor = '#7c3aed' }: AiCallerToolsPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    structuredOutput: false,
    functionCalling: false,
  });

  const patch = (partial: Partial<GeminiToolsPanelState>) => onChange({ ...value, ...partial });
  const activeLabels = getActiveGeminiToolLabels(value);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Tools</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Configure Gemini like Google AI Studio — toggles instead of raw JSON.
          </div>
        </div>
      </div>

      <ToolRow
        title="Structured outputs"
        description="Force JSON that matches a schema"
        enabled={value.structuredOutput}
        onToggle={(enabled) => patch({ structuredOutput: enabled })}
        editable
        expanded={expanded.structuredOutput}
        onEdit={() => setExpanded(prev => ({ ...prev, structuredOutput: !prev.structuredOutput }))}
      >
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Response schema (JSON)
        </label>
        <textarea
          value={value.responseSchemaJson}
          onChange={e => patch({ responseSchemaJson: e.target.value })}
          style={editorStyle}
        />
      </ToolRow>

      <ToolRow
        title="Function calling"
        description="Let Gemini request your custom functions"
        enabled={value.functionCalling}
        onToggle={(enabled) => patch({ functionCalling: enabled })}
        editable
        expanded={expanded.functionCalling}
        onEdit={() => setExpanded(prev => ({ ...prev, functionCalling: !prev.functionCalling }))}
      >
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Function declarations (JSON array)
        </label>
        <textarea
          value={value.functionsJson}
          onChange={e => patch({ functionsJson: e.target.value })}
          style={{ ...editorStyle, marginBottom: 10 }}
        />
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Calling mode
        </label>
        <select
          value={value.functionMode}
          onChange={e => patch({ functionMode: e.target.value as GeminiToolsPanelState['functionMode'] })}
          style={selectStyle}
        >
          <option value="AUTO">AUTO — model may call functions or reply with text</option>
          <option value="ANY">ANY — model must call a function</option>
          <option value="NONE">NONE — declarations present but calling disabled</option>
        </select>
      </ToolRow>

      <ToolRow
        title="Code execution"
        description="Let Gemini run generated Python and use the result"
        enabled={value.codeExecution}
        onToggle={(enabled) => patch({ codeExecution: enabled })}
      />

      <ToolRow
        title="Grounding with Google Search"
        description="Use live Google Search results in the answer"
        enabled={value.googleSearch}
        onToggle={(enabled) => patch({ googleSearch: enabled })}
      />

      <ToolRow
        title="Grounding with Google Maps"
        description="Use Google Maps grounding for location-aware answers"
        enabled={value.googleMaps}
        onToggle={(enabled) => patch({ googleMaps: enabled })}
      />

      <ToolRow
        title="URL context"
        description="Let Gemini fetch and use content from URLs in the prompt"
        enabled={value.urlContext}
        onToggle={(enabled) => patch({ urlContext: enabled })}
      />

      {activeLabels.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
          {activeLabels.map(label => (
            <span
              key={label}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: accentColor,
                background: `${accentColor}14`,
                border: `1px solid ${accentColor}33`,
                borderRadius: 999,
                padding: '4px 10px',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
