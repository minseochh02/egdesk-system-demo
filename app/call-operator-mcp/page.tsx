'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

type ReadyFlag = {
  ready?: boolean;
  model?: string;
  pipeline?: string;
  path?: string | null;
};

type QueueActive = {
  source?: string;
  stage?: string;
  message?: string;
  turn?: number;
  turnCount?: number;
};

type TranscriptSegment = {
  speaker?: string;
  startSec?: number;
  endSec?: number;
  text?: string;
};

const AUDIO_ACCEPT =
  'audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac,audio/wav,audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/flac';

const SPEAKER_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'call_operator_status',
    title: 'Check status',
    description:
      'Whisper, pyannote, and ffmpeg readiness plus the shared transcription queue. MCP and the Call Operator window share one Whisper CLI — a running UI job will make transcribe wait.',
    category: 'setup',
    helperName: 'getCallOperatorStatus',
    fields: [],
  },
  {
    name: 'call_operator_ensure',
    title: 'Ensure models',
    description:
      'Locate or install whisper.cpp Large v3 Turbo, the pyannote venv, and ffmpeg. Safe to call before the first transcribe. First run can take several minutes.',
    category: 'setup',
    helperName: 'ensureCallOperator',
    fields: [],
  },
  {
    name: 'call_operator_transcribe',
    title: 'Transcribe',
    description:
      'Diarize with pyannote, then transcribe each turn with whisper.cpp. Audio never leaves this machine. Enable Call Operator MCP and File System MCP in EGDesk.',
    category: 'transcribe',
    helperName: 'transcribeCallOperator',
    fields: [
      {
        name: 'file_path',
        label: 'Audio file',
        type: 'file',
        accept: AUDIO_ACCEPT,
        required: true,
        placeholder: '/Users/you/Downloads/call.wav',
        hint: 'Choose audio — it uploads to EGDesk Downloads via File System MCP, then transcribes. Or paste an absolute path under Downloads or the Call Operator uploads folder. File System MCP must be enabled. Max 80 MB.',
      },
      {
        name: 'language',
        label: 'Language',
        type: 'string',
        defaultValue: 'ko',
        placeholder: 'ko',
        hint: 'Whisper language code. Default matches the Call Operator UI.',
      },
      {
        name: 'num_speakers',
        label: 'Speakers',
        type: 'number',
        defaultValue: 2,
        hint: 'pyannote clustering target. Use 2 for a typical two-party call.',
      },
    ],
  },
  {
    name: 'call_operator_debug_preprocess',
    title: 'Debug preprocess',
    description:
      'Export WAV + PCM/mel sha256 + reference log-mel + whisper.cpp transcript for Mac vs Windows diff. Bundle lands in EGDesk userData/call-operator/debug/.',
    category: 'debug',
    helperName: 'debugCallOperatorPreprocess',
    fields: [
      {
        name: 'file_path',
        label: 'Audio file',
        type: 'file',
        accept: AUDIO_ACCEPT,
        required: true,
        placeholder: '/Users/you/Downloads/call.wav',
        hint: 'Same file on Mac and Windows — compare manifest wavSha256, pcmSha256, mel.sha256.',
      },
      {
        name: 'language',
        label: 'Language',
        type: 'string',
        defaultValue: 'ko',
      },
      {
        name: 'run_whisper',
        label: 'Run whisper.cpp',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'setup', label: 'Setup' },
  { key: 'transcribe', label: 'Transcribe' },
  { key: 'debug', label: 'Debug' },
];

const RUNNING_HINTS: Record<string, string> = {
  call_operator_ensure: 'Installing or locating local models — first run can take several minutes.',
  call_operator_transcribe:
    'Diarizing then transcribing each turn sequentially. A few-minute call can take several minutes. Leave this tab open.',
  call_operator_debug_preprocess:
    'Decoding audio, dumping log-mel, optional whisper.cpp pass — opens debug folder when done.',
};

function formatSec(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function speakerColor(label: string | undefined, index: number): string {
  const match = label?.match(/(\d+)/);
  const n = match ? Number(match[1]) - 1 : index;
  return SPEAKER_COLORS[((n % SPEAKER_COLORS.length) + SPEAKER_COLORS.length) % SPEAKER_COLORS.length];
}

function readyTone(ready: boolean | undefined): CSSProperties {
  if (ready) return { background: '#ecfdf5', color: '#065f46' };
  if (ready === false) return { background: '#fef2f2', color: '#991b1b' };
  return { background: '#f3f4f6', color: '#6b7280' };
}

export default function CallOperatorPlayground() {
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [lastSegmentCount, setLastSegmentCount] = useState(0);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (tool !== 'call_operator_transcribe') return;
    if (typeof parsed?.file === 'string') setLastFile(parsed.file);
    if (Array.isArray(parsed?.segments)) setLastSegmentCount(parsed.segments.length);
  }, []);

  const renderDisplay = useCallback((data: any, tool: string) => {
    const {
      kvGridStyle,
      kvTermStyle,
      kvDescStyle,
      miniLabelStyle,
      tableWrapStyle,
      tableStyle,
      thStyle,
      tdStyle,
      inlineCodeStyle,
      statusBadgeStyle,
    } = playgroundStyles;

    if (tool === 'call_operator_status') {
      const whisper = (data?.whisper ?? {}) as ReadyFlag;
      const pyannote = (data?.pyannote ?? {}) as ReadyFlag;
      const ffmpeg = (data?.ffmpeg ?? {}) as ReadyFlag;
      const queue = data?.queue;
      const active = (queue?.active ?? null) as QueueActive | null;
      const roots: string[] = Array.isArray(data?.allowlist?.roots) ? data.allowlist.roots : [];

      return (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ ...statusBadgeStyle, ...readyTone(whisper.ready) }}>
              Whisper {whisper.ready ? 'ready' : 'not ready'}
            </span>
            <span style={{ ...statusBadgeStyle, ...readyTone(pyannote.ready) }}>
              pyannote {pyannote.ready ? 'ready' : 'not ready'}
            </span>
            <span style={{ ...statusBadgeStyle, ...readyTone(ffmpeg.ready) }}>
              ffmpeg {ffmpeg.ready ? 'ready' : 'not ready'}
            </span>
            <span
              style={{
                ...statusBadgeStyle,
                ...(queue?.idle ? readyTone(true) : { background: '#fef3c7', color: '#92400e' }),
              }}
            >
              {queue?.idle ? 'Queue idle' : `Queue ${active?.source ?? 'busy'}`}
            </span>
          </div>
          <dl style={kvGridStyle}>
            {whisper.model && (
              <>
                <dt style={kvTermStyle}>Whisper model</dt>
                <dd style={kvDescStyle}>{whisper.model}</dd>
              </>
            )}
            {pyannote.pipeline && (
              <>
                <dt style={kvTermStyle}>pyannote</dt>
                <dd style={kvDescStyle}>{pyannote.pipeline}</dd>
              </>
            )}
            {ffmpeg.path && (
              <>
                <dt style={kvTermStyle}>ffmpeg</dt>
                <dd style={kvDescStyle}>{ffmpeg.path}</dd>
              </>
            )}
            {data?.transcriptionMode && (
              <>
                <dt style={kvTermStyle}>Mode</dt>
                <dd style={kvDescStyle}>{data.transcriptionMode}</dd>
              </>
            )}
            {active?.message && (
              <>
                <dt style={kvTermStyle}>Active job</dt>
                <dd style={kvDescStyle}>
                  {active.source} · {active.stage}
                  {active.turn != null && active.turnCount != null
                    ? ` (${active.turn}/${active.turnCount})`
                    : ''}
                  {' — '}
                  {active.message}
                </dd>
              </>
            )}
            {queue?.pendingCount != null && (
              <>
                <dt style={kvTermStyle}>Pending</dt>
                <dd style={kvDescStyle}>{String(queue.pendingCount)}</dd>
              </>
            )}
          </dl>
          {roots.length > 0 && (
            <div>
              <div style={miniLabelStyle}>Allowlist</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                {roots.map((root) => (
                  <li key={root}>
                    <code style={inlineCodeStyle}>{root}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (tool === 'call_operator_ensure' && (data?.ready != null || data?.whisper)) {
      return (
        <dl style={kvGridStyle}>
          <dt style={kvTermStyle}>Ready</dt>
          <dd style={kvDescStyle}>{String(data.ready ?? true)}</dd>
          {data?.whisper?.model && (
            <>
              <dt style={kvTermStyle}>Whisper</dt>
              <dd style={kvDescStyle}>{data.whisper.model}</dd>
            </>
          )}
          {data?.ffmpeg?.path && (
            <>
              <dt style={kvTermStyle}>ffmpeg</dt>
              <dd style={kvDescStyle}>{data.ffmpeg.path}</dd>
            </>
          )}
        </dl>
      );
    }

    if (tool === 'call_operator_debug_preprocess' || data?.howToDiff) {
      return (
        <div style={{ display: 'grid', gap: 16 }}>
          <dl style={kvGridStyle}>
            <dt style={kvTermStyle}>Output</dt>
            <dd style={kvDescStyle}><code style={inlineCodeStyle}>{data.outputDir || '—'}</code></dd>
            <dt style={kvTermStyle}>Platform</dt>
            <dd style={kvDescStyle}>{data.platform} ({data.arch})</dd>
            <dt style={kvTermStyle}>Decode</dt>
            <dd style={kvDescStyle}>{data.decodeSource}</dd>
            <dt style={kvTermStyle}>wav sha256</dt>
            <dd style={kvDescStyle}><code style={inlineCodeStyle}>{data.audio?.wavSha256 || '—'}</code></dd>
            <dt style={kvTermStyle}>pcm sha256</dt>
            <dd style={kvDescStyle}><code style={inlineCodeStyle}>{data.audio?.pcmSha256 || '—'}</code></dd>
            <dt style={kvTermStyle}>mel sha256</dt>
            <dd style={kvDescStyle}><code style={inlineCodeStyle}>{data.mel?.sha256 || '—'}</code></dd>
            {data.whisper?.transcript && (
              <>
                <dt style={kvTermStyle}>Whisper</dt>
                <dd style={kvDescStyle}>{data.whisper.transcript.slice(0, 200)}{data.whisper.transcript.length > 200 ? '…' : ''}</dd>
              </>
            )}
          </dl>
          {Array.isArray(data.howToDiff) && (
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
              {data.howToDiff.map((line: string) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          )}
        </div>
      );
    }

    if (tool === 'call_operator_transcribe' && (data?.transcript || Array.isArray(data?.segments))) {
      const segments: TranscriptSegment[] = Array.isArray(data.segments) ? data.segments : [];
      return (
        <div style={{ display: 'grid', gap: 16 }}>
          <dl style={kvGridStyle}>
            {data.file && (
              <>
                <dt style={kvTermStyle}>File</dt>
                <dd style={kvDescStyle}>{data.file}</dd>
              </>
            )}
            {data.language && (
              <>
                <dt style={kvTermStyle}>Language</dt>
                <dd style={kvDescStyle}>{data.language}</dd>
              </>
            )}
            {data.durationSec != null && (
              <>
                <dt style={kvTermStyle}>Duration</dt>
                <dd style={kvDescStyle}>{formatSec(data.durationSec)}</dd>
              </>
            )}
            {data.backend && (
              <>
                <dt style={kvTermStyle}>Backend</dt>
                <dd style={kvDescStyle}>{data.backend}</dd>
              </>
            )}
            <dt style={kvTermStyle}>Turns</dt>
            <dd style={kvDescStyle}>{segments.length}</dd>
          </dl>
          {segments.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {segments.map((segment, i) => {
                const color = speakerColor(segment.speaker, i);
                return (
                  <div
                    key={`${segment.startSec}-${i}`}
                    style={{
                      borderLeft: `3px solid ${color}`,
                      padding: '8px 12px',
                      background: '#f9fafb',
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4 }}>
                      {segment.speaker || '화자'}
                      <span style={{ color: '#9ca3af', fontWeight: 500, marginLeft: 8 }}>
                        {formatSec(segment.startSec)}–{formatSec(segment.endSec)}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: '#111827' }}>
                      {segment.text || '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <pre
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: 14,
                fontSize: 14,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {String(data.transcript)}
            </pre>
          )}
          {segments.length > 0 && (
            <div>
              <div style={miniLabelStyle}>Segments</div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Speaker</th>
                      <th style={thStyle}>Start</th>
                      <th style={thStyle}>End</th>
                      <th style={thStyle}>Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((segment, i) => (
                      <tr key={`row-${i}`}>
                        <td style={tdStyle}>{segment.speaker || '—'}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatSec(segment.startSec)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatSec(segment.endSec)}</td>
                        <td style={tdStyle}>{segment.text || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={playgroundStyles.sessionPillsStyle}>
        <span
          style={{
            ...playgroundStyles.statusBadgeStyle,
            background: lastFile ? '#ecfdf5' : '#f3f4f6',
            color: lastFile ? '#065f46' : '#6b7280',
          }}
        >
          {lastFile ? lastFile : 'No transcript yet'}
        </span>
        {lastFile && (
          <span
            style={{
              ...playgroundStyles.statusBadgeStyle,
              background: '#ede9fe',
              color: '#5b21b6',
            }}
          >
            {lastSegmentCount} turns
          </span>
        )}
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/call-operator-mcp"
      eyebrow="EGDesk Call Operator MCP"
      title="Call Operator Playground"
      subtitle="Transcribe a call recording locally with speaker labels. Enable Call Operator MCP and File System MCP in EGDesk. First run downloads whisper.cpp + pyannote; later runs stay on disk. Audio never leaves this machine."
      apiPath="/api/call-operator"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#2563eb"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
    />
  );
}
