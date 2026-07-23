'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'user_data_queue_list',
    title: 'List jobs',
    description: 'List UserData queue jobs for this project+env.',
    category: 'jobs',
    helperName: 'listUserDataQueueJobs',
    fields: [
      {
        name: 'status',
        label: 'Status filter',
        type: 'select',
        options: ['', 'pending', 'running', 'completed', 'failed', 'cancelled', 'dead'],
        defaultValue: '',
      },
      {
        name: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 50,
      },
    ],
  },
  {
    name: 'user_data_queue_get',
    title: 'Get job',
    description: 'Fetch a single queue job by id.',
    category: 'jobs',
    helperName: 'getUserDataQueueJob',
    fields: [
      {
        name: 'jobId',
        label: 'Job id',
        type: 'string',
        required: true,
        placeholder: 'uuid from list',
      },
    ],
  },
  {
    name: 'user_data_queue_enqueue',
    title: 'Enqueue job',
    description:
      'Enqueue sync_config, browser_recording, backup, or script for the background worker.',
    category: 'jobs',
    helperName: 'enqueueUserDataQueueJob',
    fields: [
      {
        name: 'name',
        label: 'Name (optional)',
        type: 'string',
        placeholder: 'Overnight ETL',
      },
      {
        name: 'actionType',
        label: 'Action',
        type: 'select',
        required: true,
        options: ['sync_config', 'browser_recording', 'backup', 'script'],
        defaultValue: 'backup',
      },
      {
        name: 'syncConfigId',
        label: 'Sync config id (flat)',
        type: 'string',
        placeholder: 'uuid',
        hint: 'Preferred for sync_config',
      },
      {
        name: 'testPath',
        label: 'Test path (flat)',
        type: 'string',
        placeholder: '/abs/path/to/script.spec.js',
        hint: 'Preferred for browser_recording',
      },
      {
        name: 'scriptPath',
        label: 'User script path (flat)',
        type: 'string',
        placeholder: '/abs/path/to/job.mjs',
        hint: 'For actionType=script',
      },
      {
        name: 'functionName',
        label: 'Export name',
        type: 'string',
        placeholder: 'run',
        defaultValue: 'run',
      },
      {
        name: 'args',
        label: 'Script args (JSON)',
        type: 'json',
        placeholder: '{}',
        defaultValue: '{}',
      },
      {
        name: 'timeoutMs',
        label: 'Timeout (ms)',
        type: 'number',
        defaultValue: 300000,
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'number',
        defaultValue: 0,
        hint: 'Higher runs first',
      },
      {
        name: 'maxAttempts',
        label: 'Max attempts',
        type: 'number',
        defaultValue: 3,
      },
      {
        name: 'idempotencyKey',
        label: 'Idempotency key',
        type: 'string',
        placeholder: 'optional-unique-key',
      },
      {
        name: 'actionPayload',
        label: 'Action payload (JSON, optional)',
        type: 'json',
        placeholder: '{}',
        defaultValue: '{}',
      },
    ],
  },
  {
    name: 'user_data_queue_cancel',
    title: 'Cancel job',
    description: 'Cancel a pending queue job.',
    category: 'jobs',
    helperName: 'cancelUserDataQueueJob',
    fields: [
      {
        name: 'jobId',
        label: 'Job id',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'user_data_queue_retry',
    title: 'Retry job',
    description: 'Re-queue a failed, dead, or cancelled job.',
    category: 'jobs',
    helperName: 'retryUserDataQueueJob',
    fields: [
      {
        name: 'jobId',
        label: 'Job id',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'user_data_queue_delete',
    title: 'Delete job',
    description: 'Delete a queue job and its runs.',
    category: 'jobs',
    helperName: 'deleteUserDataQueueJob',
    fields: [
      {
        name: 'jobId',
        label: 'Job id',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'user_data_queue_run_now',
    title: 'Run now',
    description: 'Claim and execute a queue job immediately.',
    category: 'run',
    helperName: 'runUserDataQueueJobNow',
    fields: [
      {
        name: 'jobId',
        label: 'Job id',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'user_data_queue_runs',
    title: 'List runs',
    description: 'Attempt history for a queue job.',
    category: 'run',
    helperName: 'listUserDataQueueRuns',
    fields: [
      {
        name: 'jobId',
        label: 'Job id',
        type: 'string',
        required: true,
      },
      {
        name: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 30,
      },
    ],
  },
  {
    name: 'user_data_queue_stats',
    title: 'Queue stats',
    description: 'Counts by status for this project+env.',
    category: 'run',
    helperName: 'getUserDataQueueStats',
    fields: [],
  },
  {
    name: 'user_data_queue_status',
    title: 'Worker status',
    description: 'Whether the UserData queue worker is running.',
    category: 'run',
    helperName: 'getUserDataQueueStatus',
    fields: [],
  },
];

const CATEGORIES = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'run', label: 'Run & history' },
];

const RUNNING_HINTS: Record<string, string> = {
  user_data_queue_run_now: 'Running job… this may take a while for browser recording or sync.',
  user_data_queue_enqueue: 'Enqueueing for the background worker…',
};

export default function UserDataQueueMcpPage() {
  const [selectedJobId, setSelectedJobId] = useState('');

  const onResult = useCallback((toolName: string, parsed: any) => {
    const job = parsed?.job || parsed?.jobs?.[0];
    const id = job?.id || parsed?.jobId;
    if (typeof id === 'string' && id) {
      setSelectedJobId(id);
    }
    if (toolName === 'user_data_queue_list' && Array.isArray(parsed?.jobs) && parsed.jobs[0]?.id) {
      setSelectedJobId(parsed.jobs[0].id);
    }
  }, []);

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      if (!selectedJobId) return {};
      if (
        tool.name === 'user_data_queue_get' ||
        tool.name === 'user_data_queue_cancel' ||
        tool.name === 'user_data_queue_retry' ||
        tool.name === 'user_data_queue_delete' ||
        tool.name === 'user_data_queue_run_now' ||
        tool.name === 'user_data_queue_runs'
      ) {
        return { jobId: selectedJobId };
      }
      return {};
    },
    [selectedJobId],
  );

  const renderDisplay = useCallback((toolName: string, parsed: any) => {
    if (toolName === 'user_data_queue_list' && Array.isArray(parsed?.jobs)) {
      if (parsed.jobs.length === 0) {
        return <p style={{ color: '#6b7280', margin: 0 }}>No queue jobs yet.</p>;
      }
      return (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {parsed.jobs.map((job: any) => (
            <li key={job.id} style={{ marginBottom: 8 }}>
              <strong>{job.name || job.id.slice(0, 8)}</strong>{' '}
              <code style={playgroundStyles.inlineCodeStyle}>{job.id}</code>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                {job.actionType} · {job.status} · attempts {job.attempts}/{job.maxAttempts} ·
                priority {job.priority}
              </div>
            </li>
          ))}
        </ul>
      );
    }

    if (toolName === 'user_data_queue_status') {
      return (
        <p style={{ margin: 0 }}>
          Worker {parsed?.running ? 'running' : 'stopped'} · busy projects{' '}
          {parsed?.busyProjectCount ?? 0}
        </p>
      );
    }

    if (toolName === 'user_data_queue_stats' && parsed?.stats) {
      const s = parsed.stats;
      return (
        <p style={{ margin: 0 }}>
          pending {s.pending} · running {s.running} · completed {s.completed} · dead {s.dead} ·
          cancelled {s.cancelled}
        </p>
      );
    }

    if (toolName === 'user_data_queue_runs' && Array.isArray(parsed?.runs)) {
      if (parsed.runs.length === 0) {
        return <p style={{ color: '#6b7280', margin: 0 }}>No runs yet.</p>;
      }
      return (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {parsed.runs.map((run: any) => (
            <li key={run.id} style={{ marginBottom: 6 }}>
              <strong>
                {run.status} #{run.attempt}
              </strong>{' '}
              · {run.startedAt}
              {run.resultMessage ? ` — ${run.resultMessage}` : ''}
              {run.errorMessage ? ` — ${run.errorMessage}` : ''}
            </li>
          ))}
        </ul>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Selected job id</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {selectedJobId ? (
            <code style={playgroundStyles.inlineCodeStyle}>{selectedJobId}</code>
          ) : (
            'List or enqueue a job first — also available in EGDesk → User Data → Queue'
          )}
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      title="UserData Queue MCP"
      description="Durable enqueue + worker with retries for sync configs, browser recordings, backups, and user scripts."
      currentHref="/user-data-queue-mcp"
      tools={TOOLS}
      categories={CATEGORIES}
      apiPath="/api/user-data-queue"
      runningHints={RUNNING_HINTS}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
      renderDisplay={renderDisplay}
      sessionBar={sessionBar}
    />
  );
}
