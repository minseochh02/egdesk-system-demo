'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'browser_recording_list_saved_tests',
    title: 'List tests',
    description: 'Saved browser recorder specs (*.spec.js) with paths and schedule info.',
    category: 'tests',
    helperName: 'listBrowserRecordingTests',
    fields: [],
  },
  {
    name: 'browser_recording_get_replay_options',
    title: 'Replay options',
    description: 'Date picker hints, labeled fields, and default replay values for a spec.',
    category: 'tests',
    helperName: 'getBrowserRecordingReplayOptions',
    fields: [
      {
        name: 'testFile',
        label: 'Test file',
        type: 'string',
        required: true,
        placeholder: 'myflow.spec.js',
        hint: 'Bare filename or absolute path under browser-recorder-tests.',
      },
    ],
  },
  {
    name: 'browser_recording_run',
    title: 'Run replay',
    description: 'Replay a saved recording in Chrome. Pass headless false to watch the browser.',
    category: 'run',
    helperName: 'runBrowserRecording',
    fields: [
      {
        name: 'testFile',
        label: 'Test file',
        type: 'string',
        required: true,
        placeholder: 'myflow.spec.js',
      },
      {
        name: 'headless',
        label: 'Headless',
        type: 'boolean',
        defaultValue: true,
        hint: 'Set to No to show Chrome during replay.',
      },
      {
        name: 'startDate',
        label: 'Start date (optional)',
        type: 'string',
        placeholder: '2025-06-01',
      },
      {
        name: 'endDate',
        label: 'End date (optional)',
        type: 'string',
        placeholder: '2025-06-30',
      },
    ],
  },
  {
    name: 'browser_recording_list_schedules',
    title: 'List schedules',
    description: 'All Playwright scheduler entries for saved recorder tests.',
    category: 'schedule',
    helperName: 'listBrowserRecordingSchedules',
    fields: [],
  },
  {
    name: 'browser_recording_get_schedule',
    title: 'Get schedule',
    description: 'Scheduler entry for one test file, if configured.',
    category: 'schedule',
    helperName: 'getBrowserRecordingSchedule',
    fields: [
      {
        name: 'testFile',
        label: 'Test file',
        type: 'string',
        required: true,
        placeholder: 'myflow.spec.js',
      },
    ],
  },
  {
    name: 'browser_recording_list_download_folders',
    title: 'Download folders',
    description: 'Browser automation download folders with Excel/CSV exports.',
    category: 'sync',
    helperName: 'listBrowserRecordingDownloadFolders',
    fields: [],
  },
];

const CATEGORIES = [
  { key: 'tests', label: 'Tests' },
  { key: 'run', label: 'Run' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'sync', label: 'Sync' },
];

const RUNNING_HINTS: Record<string, string> = {
  browser_recording_run: 'Replaying actions in Chrome — may take a minute depending on the script.',
  browser_recording_list_saved_tests: 'Scanning browser-recorder-tests folder…',
};

type SavedTest = {
  testFile?: string;
  fileName?: string;
  name?: string;
  path?: string;
  headless?: boolean;
};

function testFileName(test: SavedTest): string {
  return test.testFile || test.fileName || test.name || test.path || '';
}

export default function BrowserRecordingPlayground() {
  const [selectedTestFile, setSelectedTestFile] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (tool === 'browser_recording_list_saved_tests') {
      const tests = Array.isArray(parsed?.tests) ? parsed.tests : Array.isArray(parsed) ? parsed : [];
      if (tests[0]) setSelectedTestFile(testFileName(tests[0]));
    }
    if (parsed?.testFile) setSelectedTestFile(String(parsed.testFile));
  }, []);

  const getDefaultFieldValues = useCallback((tool: PlaygroundToolDef) => {
    if (!selectedTestFile) return {};
    if (tool.fields.some(f => f.name === 'testFile')) {
      return { testFile: selectedTestFile };
    }
    return {};
  }, [selectedTestFile]);

  const renderDisplay = useCallback((data: any, tool: string) => {
    const {
      miniLabelStyle,
      tableWrapStyle,
      tableStyle,
      thStyle,
      tdStyle,
      inlineCodeStyle,
      secondaryBtnStyle,
      kvGridStyle,
      kvTermStyle,
      kvDescStyle,
    } = playgroundStyles;

    const tests: SavedTest[] = Array.isArray(data?.tests)
      ? data.tests
      : Array.isArray(data) && tool.includes('list_saved')
        ? data
        : [];

    if (tests.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Saved tests ({tests.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>File</th>
                  <th style={thStyle}>Headless</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {tests.map((test, i) => {
                  const file = testFileName(test);
                  return (
                    <tr key={file || i}>
                      <td style={tdStyle}><code style={inlineCodeStyle}>{file || '—'}</code></td>
                      <td style={tdStyle}>{String(test.headless ?? '—')}</td>
                      <td style={tdStyle}>
                        {file && (
                          <button
                            onClick={() => setSelectedTestFile(file)}
                            style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                          >
                            Select
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (Array.isArray(data?.schedules) && data.schedules.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Schedules ({data.schedules.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Test</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Frequency</th>
                  <th style={thStyle}>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {data.schedules.map((row: any, i: number) => (
                  <tr key={row.id || i}>
                    <td style={tdStyle}>{row.testName || row.testPath || '—'}</td>
                    <td style={tdStyle}>{row.scheduledTime || '—'}</td>
                    <td style={tdStyle}>{row.frequencyType || '—'}</td>
                    <td style={tdStyle}>{String(row.enabled ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (data?.success != null || data?.status != null) {
      return (
        <dl style={kvGridStyle}>
          {data.success != null && <><dt style={kvTermStyle}>Success</dt><dd style={kvDescStyle}>{String(data.success)}</dd></>}
          {data.status && <><dt style={kvTermStyle}>Status</dt><dd style={kvDescStyle}>{data.status}</dd></>}
          {data.message && <><dt style={kvTermStyle}>Message</dt><dd style={kvDescStyle}>{data.message}</dd></>}
          {data.error && <><dt style={kvTermStyle}>Error</dt><dd style={kvDescStyle}>{data.error}</dd></>}
        </dl>
      );
    }

    if (data?.uiHint || data?.labeledFieldReplayBlocks) {
      return (
        <dl style={kvGridStyle}>
          {data.uiHint && <><dt style={kvTermStyle}>UI hint</dt><dd style={kvDescStyle}>{data.uiHint}</dd></>}
          {data.datePickerGroupCount != null && (
            <><dt style={kvTermStyle}>Date pickers</dt><dd style={kvDescStyle}>{data.datePickerGroupCount}</dd></>
          )}
          {Array.isArray(data.labeledFieldReplayBlocks) && (
            <>
              <dt style={kvTermStyle}>Labeled fields</dt>
              <dd style={kvDescStyle}>{data.labeledFieldReplayBlocks.length} capture step(s)</dd>
            </>
          )}
        </dl>
      );
    }

    if (Array.isArray(data?.folders)) {
      return (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          {data.folders.map((folder: any, i: number) => (
            <li key={i}>{folder.path || folder.name || JSON.stringify(folder)}</li>
          ))}
        </ul>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Selected test file</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {selectedTestFile ? (
            <code style={playgroundStyles.inlineCodeStyle}>{selectedTestFile}</code>
          ) : 'List saved tests first — record flows in EGDesk Browser Recorder'}
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/browser-recording-mcp"
      eyebrow="EGDesk Browser Recording MCP"
      title="Browser Recording Playground"
      subtitle="List, inspect, and replay saved browser recorder tests. Enable Browser Recording MCP and save at least one *.spec.js in EGDesk."
      apiPath="/api/browser-recording"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#db2777"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
      runButtonLabel={(tool) =>
        tool.name === 'browser_recording_run' ? 'Run replay' : 'Run'
      }
    />
  );
}
