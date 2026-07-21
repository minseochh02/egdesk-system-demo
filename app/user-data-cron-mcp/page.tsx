'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'user_data_cron_list',
    title: 'List jobs',
    description: 'List UserData cron jobs for this project+env.',
    category: 'jobs',
    helperName: 'listUserDataCronJobs',
    fields: [],
  },
  {
    name: 'user_data_cron_get',
    title: 'Get job',
    description: 'Fetch a single cron job by id.',
    category: 'jobs',
    helperName: 'getUserDataCronJob',
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
    name: 'user_data_cron_create',
    title: 'Create job',
    description:
      'Schedule sync_config, browser_recording, or backup. Use frequencyType daily/weekly/monthly/custom or cron.',
    category: 'jobs',
    helperName: 'createUserDataCronJob',
    fields: [
      {
        name: 'name',
        label: 'Name',
        type: 'string',
        required: true,
        placeholder: 'Morning bank sync',
      },
      {
        name: 'actionType',
        label: 'Action',
        type: 'select',
        required: true,
        options: ['sync_config', 'browser_recording', 'backup'],
        defaultValue: 'backup',
      },
      {
        name: 'actionPayload',
        label: 'Action payload (JSON)',
        type: 'json',
        placeholder: '{}',
        hint: 'sync_config: {"syncConfigId":"…"}. browser_recording: {"testPath":"/abs/path.spec.js"}. backup: {}',
        defaultValue: '{}',
      },
      {
        name: 'frequencyType',
        label: 'Frequency',
        type: 'select',
        required: true,
        options: ['daily', 'weekly', 'monthly', 'custom', 'cron'],
        defaultValue: 'daily',
      },
      {
        name: 'scheduledTime',
        label: 'Time (HH:MM)',
        type: 'string',
        defaultValue: '09:00',
        hint: 'Ignored when frequencyType is cron.',
      },
      {
        name: 'dayOfWeek',
        label: 'Day of week (0=Sun)',
        type: 'number',
        defaultValue: 1,
        hint: 'Weekly only',
      },
      {
        name: 'dayOfMonth',
        label: 'Day of month',
        type: 'number',
        defaultValue: 1,
        hint: 'Monthly only',
      },
      {
        name: 'customIntervalDays',
        label: 'Custom interval (days)',
        type: 'number',
        defaultValue: 7,
      },
      {
        name: 'cronExpression',
        label: 'Cron expression',
        type: 'string',
        placeholder: '0 9 * * 1-5',
        hint: 'Required when frequencyType is cron',
      },
      {
        name: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'user_data_cron_update',
    title: 'Update job',
    description: 'Patch fields on an existing cron job.',
    category: 'jobs',
    helperName: 'updateUserDataCronJob',
    fields: [
      { name: 'jobId', label: 'Job id', type: 'string', required: true },
      { name: 'name', label: 'Name', type: 'string' },
      {
        name: 'enabled',
        label: 'Enabled',
        type: 'boolean',
      },
      {
        name: 'scheduledTime',
        label: 'Time (HH:MM)',
        type: 'string',
        placeholder: '09:00',
      },
      {
        name: 'frequencyType',
        label: 'Frequency',
        type: 'select',
        options: ['daily', 'weekly', 'monthly', 'custom', 'cron'],
      },
      {
        name: 'cronExpression',
        label: 'Cron expression',
        type: 'string',
        placeholder: '0 9 * * *',
      },
      {
        name: 'actionPayload',
        label: 'Action payload (JSON)',
        type: 'json',
      },
    ],
  },
  {
    name: 'user_data_cron_toggle',
    title: 'Toggle job',
    description: 'Enable or pause a cron job.',
    category: 'jobs',
    helperName: 'toggleUserDataCronJob',
    fields: [
      { name: 'jobId', label: 'Job id', type: 'string', required: true },
      {
        name: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
    ],
  },
  {
    name: 'user_data_cron_delete',
    title: 'Delete job',
    description: 'Remove a cron job permanently.',
    category: 'jobs',
    helperName: 'deleteUserDataCronJob',
    fields: [
      { name: 'jobId', label: 'Job id', type: 'string', required: true },
    ],
  },
  {
    name: 'user_data_cron_run_now',
    title: 'Run now',
    description: 'Execute a job immediately without waiting for the schedule.',
    category: 'run',
    helperName: 'runUserDataCronJobNow',
    fields: [
      { name: 'jobId', label: 'Job id', type: 'string', required: true },
    ],
  },
  {
    name: 'user_data_cron_executions',
    title: 'Execution history',
    description: 'Recent run history for a job.',
    category: 'run',
    helperName: 'listUserDataCronExecutions',
    fields: [
      { name: 'jobId', label: 'Job id', type: 'string', required: true },
      {
        name: 'limit',
        label: 'Limit',
        type: 'number',
        defaultValue: 20,
      },
    ],
  },
  {
    name: 'user_data_cron_status',
    title: 'Scheduler status',
    description: 'Whether the UserData cron engine is running and how many jobs are armed.',
    category: 'run',
    helperName: 'getUserDataCronStatus',
    fields: [],
  },
];

const CATEGORIES = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'run', label: 'Run & history' },
];

const RUNNING_HINTS: Record<string, string> = {
  user_data_cron_run_now: 'Running job… this may take a while for browser recording or sync.',
  user_data_cron_create: 'Creating and arming schedule…',
};

export default function UserDataCronMcpPage() {
  const [selectedJobId, setSelectedJobId] = useState('');

  const onResult = useCallback((toolName: string, parsed: any) => {
    const job =
      parsed?.job ||
      parsed?.jobs?.[0] ||
      (Array.isArray(parsed?.jobs) ? null : null);
    const id = job?.id || parsed?.jobId;
    if (typeof id === 'string' && id) {
      setSelectedJobId(id);
    }
    if (toolName === 'user_data_cron_list' && Array.isArray(parsed?.jobs) && parsed.jobs[0]?.id) {
      setSelectedJobId(parsed.jobs[0].id);
    }
  }, []);

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      if (!selectedJobId) return {};
      if (
        tool.name === 'user_data_cron_get' ||
        tool.name === 'user_data_cron_update' ||
        tool.name === 'user_data_cron_toggle' ||
        tool.name === 'user_data_cron_delete' ||
        tool.name === 'user_data_cron_run_now' ||
        tool.name === 'user_data_cron_executions'
      ) {
        return { jobId: selectedJobId };
      }
      return {};
    },
    [selectedJobId],
  );

  const renderDisplay = useCallback((toolName: string, parsed: any) => {
    if (toolName === 'user_data_cron_list' && Array.isArray(parsed?.jobs)) {
      if (parsed.jobs.length === 0) {
        return <p style={{ color: '#6b7280', margin: 0 }}>No cron jobs yet.</p>;
      }
      return (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {parsed.jobs.map((job: any) => (
            <li key={job.id} style={{ marginBottom: 8 }}>
              <strong>{job.name}</strong>{' '}
              <code style={playgroundStyles.inlineCodeStyle}>{job.id}</code>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                {job.actionType} · {job.frequencyType}
                {job.scheduledTime ? ` @ ${job.scheduledTime}` : ''}
                {job.enabled ? ' · enabled' : ' · paused'}
              </div>
            </li>
          ))}
        </ul>
      );
    }

    if (toolName === 'user_data_cron_status') {
      return (
        <p style={{ margin: 0 }}>
          Scheduler {parsed?.running ? 'running' : 'stopped'} · {parsed?.armedCount ?? 0} armed
        </p>
      );
    }

    if (toolName === 'user_data_cron_executions' && Array.isArray(parsed?.executions)) {
      if (parsed.executions.length === 0) {
        return <p style={{ color: '#6b7280', margin: 0 }}>No executions yet.</p>;
      }
      return (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {parsed.executions.map((ex: any) => (
            <li key={ex.id} style={{ marginBottom: 6 }}>
              <strong>{ex.status}</strong> · {ex.startedAt}
              {ex.resultMessage ? ` — ${ex.resultMessage}` : ''}
              {ex.errorMessage ? ` — ${ex.errorMessage}` : ''}
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
            'List or create a job first — also available in EGDesk → User Data → Cron Jobs'
          )}
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/user-data-cron-mcp"
      eyebrow="EGDesk UserData Cron MCP"
      title="UserData Cron Jobs Playground"
      subtitle="Schedule background automation for this project: sync downloads, run browser recordings, or back up the UserData DB. Same engine as EGDesk → User Data → Cron Jobs."
      apiPath="/api/user-data-cron"
      tools={TOOLS}
      categories={CATEGORIES}
      runningHints={RUNNING_HINTS}
      accentColor="#2563eb"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
