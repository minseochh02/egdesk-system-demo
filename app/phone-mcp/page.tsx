'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'phone_list_devices',
    title: 'List devices',
    description: 'Google Messages profiles registered in EGDesk.',
    category: 'devices',
    helperName: 'listPhoneDevices',
    fields: [],
  },
  {
    name: 'phone_create_device',
    title: 'Create device',
    description: 'Create a persistent Chrome profile for Messages Web pairing.',
    category: 'devices',
    helperName: 'createPhoneDevice',
    fields: [
      {
        name: 'label',
        label: 'Label',
        type: 'string',
        required: true,
        placeholder: 'Office phone',
      },
      {
        name: 'id',
        label: 'Device ID (optional)',
        type: 'string',
        placeholder: 'officephone',
      },
    ],
  },
  {
    name: 'phone_delete_device',
    title: 'Delete device',
    description: 'Remove device + local Messages browser profile.',
    category: 'devices',
    helperName: 'deletePhoneDevice',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_connect',
    title: 'Connect (QR pair)',
    description:
      'Open Google Messages Web for QR pairing. Blocks until paired or fails.',
    category: 'devices',
    helperName: 'connectPhoneDevice',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_check',
    title: 'Check pairing',
    description: 'Check whether the device is still paired.',
    category: 'devices',
    helperName: 'checkPhoneDevice',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_list_conversations',
    title: 'List conversations (cache)',
    description: 'Cached inbox rows from the last sync.',
    category: 'inbox',
    helperName: 'listPhoneConversations',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_sync_conversations',
    title: 'Sync conversations',
    description: 'Scrape Google Messages inbox and save conversations.',
    category: 'inbox',
    helperName: 'syncPhoneConversations',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_list_conversation_messages',
    title: 'List thread messages (cache)',
    description: 'Cached bubbles for one conversation (UI chrome stripped).',
    category: 'inbox',
    helperName: 'listPhoneConversationMessages',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
      { name: 'convKey', label: 'Conversation key', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_sync_conversation_thread',
    title: 'Sync conversation thread',
    description:
      'Open a thread in Messages Web by title, scrape bubbles, and save.',
    category: 'inbox',
    helperName: 'syncPhoneConversationThread',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
      { name: 'convKey', label: 'Conversation key', type: 'string', required: true },
      {
        name: 'title',
        label: 'Inbox title',
        type: 'string',
        required: true,
        placeholder: '010-1234-5678',
        hint: 'Exact conversation title as shown in the inbox list.',
      },
    ],
  },
  {
    name: 'phone_list_contacts',
    title: 'List contacts (cache)',
    description: 'Cached SMS contacts for a device.',
    category: 'contacts',
    helperName: 'listPhoneContacts',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_sync_contacts',
    title: 'Sync contacts',
    description: 'Scrape Messages contacts and save them.',
    category: 'contacts',
    helperName: 'syncPhoneContacts',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_send',
    title: 'Send / enqueue SMS',
    description:
      'Enqueue an SMS (immediate or scheduled). Marketing mode wraps (광고) + 무료수신거부 when snapshotId is set.',
    category: 'send',
    helperName: 'sendPhoneSms',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
      {
        name: 'phoneNumber',
        label: 'To (phone)',
        type: 'string',
        required: true,
        placeholder: '01012345678',
      },
      {
        name: 'message',
        label: 'Message',
        type: 'textarea',
        required: true,
        placeholder: 'Hello from EGDesk…',
      },
      {
        name: 'snapshotId',
        label: 'Snapshot ID (marketing)',
        type: 'string',
        placeholder: 'Business identity snapshot id',
      },
      {
        name: 'isMarketing',
        label: 'Marketing SMS',
        type: 'boolean',
        defaultValue: true,
      },
      { name: 'brandName', label: 'Brand name', type: 'string' },
      {
        name: 'scheduledAt',
        label: 'Schedule (unix ms)',
        type: 'number',
        placeholder: 'Leave empty for now',
      },
    ],
  },
  {
    name: 'phone_list_queue',
    title: 'List send queue',
    description: 'Pending / sent / failed jobs.',
    category: 'send',
    helperName: 'listPhoneQueue',
    fields: [
      { name: 'deviceId', label: 'Device ID', type: 'string' },
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string' },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
    ],
  },
  {
    name: 'phone_cancel_send',
    title: 'Cancel send',
    description: 'Cancel a pending job.',
    category: 'send',
    helperName: 'cancelPhoneSend',
    fields: [
      { name: 'jobId', label: 'Job ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_retry_send',
    title: 'Retry send',
    description: 'Retry a failed or cancelled job.',
    category: 'send',
    helperName: 'retryPhoneSend',
    fields: [
      { name: 'jobId', label: 'Job ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_list_for_snapshot',
    title: 'Devices for snapshot',
    description: 'Phone devices linked to a business identity snapshot.',
    category: 'consent',
    helperName: 'listPhoneDevicesForSnapshot',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_link_snapshot',
    title: 'Link device ↔ snapshot',
    description: 'Attach a device to a business identity for marketing consent.',
    category: 'consent',
    helperName: 'linkPhoneSnapshot',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_unlink_snapshot',
    title: 'Unlink device ↔ snapshot',
    description: 'Remove a device link from a business identity snapshot.',
    category: 'consent',
    helperName: 'unlinkPhoneSnapshot',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
      { name: 'deviceId', label: 'Device ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_consent_link_get',
    title: 'Get consent link',
    description: 'Cached 수신 동의/거절 URL for a snapshot.',
    category: 'consent',
    helperName: 'getPhoneConsentLink',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
    ],
  },
  {
    name: 'phone_consent_link_create',
    title: 'Create consent link',
    description: 'Create or refresh the public consent page link.',
    category: 'consent',
    helperName: 'createPhoneConsentLink',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
      { name: 'brandName', label: 'Brand name', type: 'string' },
      {
        name: 'optOutPhone',
        label: '무료수신거부 phone',
        type: 'string',
        placeholder: '01012345678',
      },
    ],
  },
  {
    name: 'phone_consent_events_sync',
    title: 'Sync consent events',
    description: 'Pull opt-out events from Supabase into local cache.',
    category: 'consent',
    helperName: 'syncPhoneConsentEvents',
    fields: [
      { name: 'snapshotId', label: 'Snapshot ID', type: 'string', required: true },
    ],
  },
];

const CATEGORIES = [
  { key: 'devices', label: 'Devices' },
  { key: 'inbox', label: 'Inbox & threads' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'send', label: 'Send queue' },
  { key: 'consent', label: 'Consent / marketing' },
];

const RUNNING_HINTS: Record<string, string> = {
  phone_connect: 'Opening Messages Web for QR pairing…',
  phone_check: 'Checking pairing status…',
  phone_sync_conversations: 'Scraping inbox…',
  phone_sync_conversation_thread: 'Opening thread and scraping bubbles…',
  phone_sync_contacts: 'Scraping contacts…',
  phone_send: 'Enqueueing SMS…',
  phone_consent_events_sync: 'Syncing consent events…',
};

function pickDeviceId(parsed: any): string | null {
  if (parsed?.device?.id) return String(parsed.device.id);
  if (parsed?.id && parsed?.label) return String(parsed.id);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.devices)
      ? parsed.devices
      : [];
  if (list[0]?.id) return String(list[0].id);
  return null;
}

export default function PhoneMcpPlayground() {
  const [deviceId, setDeviceId] = useState('');
  const [convKey, setConvKey] = useState('');
  const [convTitle, setConvTitle] = useState('');
  const [snapshotId, setSnapshotId] = useState('');
  const [jobId, setJobId] = useState('');

  const onResult = useCallback((tool: string, parsed: any) => {
    const nextDevice = pickDeviceId(parsed);
    if (nextDevice) setDeviceId(nextDevice);

    const convs = Array.isArray(parsed?.conversations) ? parsed.conversations : [];
    if (convs[0]?.convKey) {
      setConvKey(String(convs[0].convKey));
      if (convs[0].title) setConvTitle(String(convs[0].title));
    }

    if (parsed?.job?.id) setJobId(String(parsed.job.id));
    const jobs = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.jobs) ? parsed.jobs : [];
    if (jobs[0]?.id) setJobId(String(jobs[0].id));

    if (parsed?.link?.snapshot_id) setSnapshotId(String(parsed.link.snapshot_id));
    if (parsed?.snapshotId) setSnapshotId(String(parsed.snapshotId));

    if (tool === 'phone_sync_conversation_thread' || tool === 'phone_list_conversation_messages') {
      // keep session keys already filled by the form
    }
  }, []);

  const getDefaultFieldValues = useCallback(
    (tool: PlaygroundToolDef) => {
      const defaults: Record<string, string> = {};
      if (deviceId && tool.fields.some((f) => f.name === 'deviceId')) {
        defaults.deviceId = deviceId;
      }
      if (convKey && tool.fields.some((f) => f.name === 'convKey')) {
        defaults.convKey = convKey;
      }
      if (convTitle && tool.fields.some((f) => f.name === 'title')) {
        defaults.title = convTitle;
      }
      if (snapshotId && tool.fields.some((f) => f.name === 'snapshotId')) {
        defaults.snapshotId = snapshotId;
      }
      if (jobId && tool.fields.some((f) => f.name === 'jobId')) {
        defaults.jobId = jobId;
      }
      return defaults;
    },
    [deviceId, convKey, convTitle, snapshotId, jobId],
  );

  const renderDisplay = useCallback((data: any) => {
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
      statusBadgeStyle,
    } = playgroundStyles;

    const devices = Array.isArray(data)
      ? data.filter((d) => d?.id && (d.label != null || d.status != null))
      : Array.isArray(data?.devices)
        ? data.devices
        : data?.device
          ? [data.device]
          : [];

    if (devices.length > 0 && devices[0]?.id) {
      return (
        <div>
          <div style={miniLabelStyle}>Devices ({devices.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Label</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {devices.map((row: any) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>{row.label || '—'}</td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle}>{row.status || '—'}</span>
                    </td>
                    <td style={tdStyle}>
                      <code style={inlineCodeStyle}>{row.id}</code>
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => setDeviceId(row.id)}
                        style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                      >
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const conversations = Array.isArray(data?.conversations) ? data.conversations : [];
    if (conversations.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Conversations ({conversations.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Preview</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {conversations.map((row: any, i: number) => (
                  <tr key={row.convKey || i}>
                    <td style={tdStyle}>{row.title || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'block', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.preview || '—'}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.timeLabel || '—'}</td>
                    <td style={tdStyle}>
                      {row.convKey && (
                        <button
                          type="button"
                          onClick={() => {
                            setConvKey(row.convKey);
                            if (row.title) setConvTitle(row.title);
                          }}
                          style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                        >
                          Use
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const messages = Array.isArray(data?.messages) ? data.messages : [];
    if (messages.length > 0 && messages[0]?.body != null) {
      return (
        <div>
          <div style={miniLabelStyle}>Messages ({messages.length})</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {messages.map((m: any, i: number) => (
              <div
                key={i}
                style={{
                  alignSelf: m.direction === 'outgoing' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: 14,
                  background: m.direction === 'outgoing' ? '#ccfbf1' : '#fff',
                  border: '1px solid #e5e7eb',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {m.timeLabel ? (
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    {m.timeLabel}
                  </div>
                ) : null}
                {m.body}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
    if (contacts.length > 0) {
      return (
        <div>
          <div style={miniLabelStyle}>Contacts ({contacts.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Phone</th>
                </tr>
              </thead>
              <tbody>
                {contacts.slice(0, 100).map((c: any, i: number) => (
                  <tr key={`${c.phone}-${i}`}>
                    <td style={tdStyle}>{c.name || '—'}</td>
                    <td style={tdStyle}>
                      <code style={inlineCodeStyle}>{c.phone || '—'}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    const jobs = Array.isArray(data)
      ? data.filter((j) => j?.phone_number != null || j?.status != null)
      : Array.isArray(data?.jobs)
        ? data.jobs
        : data?.job
          ? [data.job]
          : [];
    if (jobs.length > 0 && (jobs[0]?.id || jobs[0]?.phone_number)) {
      return (
        <div>
          <div style={miniLabelStyle}>Send jobs ({jobs.length})</div>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>To</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {jobs.map((row: any) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>{row.phone_number || '—'}</td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle}>{row.status || '—'}</span>
                    </td>
                    <td style={tdStyle}>
                      <code style={inlineCodeStyle}>{row.id || '—'}</code>
                    </td>
                    <td style={tdStyle}>
                      {row.id && (
                        <button
                          type="button"
                          onClick={() => setJobId(row.id)}
                          style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px' }}
                        >
                          Use
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (data?.link?.consent_url || data?.consent_url) {
      const link = data.link || data;
      return (
        <dl style={kvGridStyle}>
          {link.consent_url && (
            <>
              <dt style={kvTermStyle}>Consent URL</dt>
              <dd style={kvDescStyle}>
                <a href={link.consent_url} target="_blank" rel="noreferrer">
                  {link.consent_url}
                </a>
              </dd>
            </>
          )}
          {link.opt_out_phone && (
            <>
              <dt style={kvTermStyle}>Opt-out phone</dt>
              <dd style={kvDescStyle}>{link.opt_out_phone}</dd>
            </>
          )}
          {link.brand_name && (
            <>
              <dt style={kvTermStyle}>Brand</dt>
              <dd style={kvDescStyle}>{link.brand_name}</dd>
            </>
          )}
        </dl>
      );
    }

    if (data?.paired != null) {
      return (
        <dl style={kvGridStyle}>
          <dt style={kvTermStyle}>Paired</dt>
          <dd style={kvDescStyle}>{String(data.paired)}</dd>
          {data.device?.id && (
            <>
              <dt style={kvTermStyle}>Device</dt>
              <dd style={kvDescStyle}>
                <code style={inlineCodeStyle}>{data.device.id}</code>
              </dd>
            </>
          )}
        </dl>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={playgroundStyles.miniLabelStyle}>Session</div>
        <p style={{ fontSize: 13, color: '#111827', margin: '4px 0 0', lineHeight: 1.55 }}>
          Device:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>{deviceId || '—'}</code>
          {' · '}Conv:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>{convKey || '—'}</code>
          {convTitle ? (
            <>
              {' '}
              (<span style={{ color: '#64748b' }}>{convTitle}</span>)
            </>
          ) : null}
          <br />
          Snapshot:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>{snapshotId || '—'}</code>
          {' · '}Job:{' '}
          <code style={playgroundStyles.inlineCodeStyle}>{jobId || '—'}</code>
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/phone-mcp"
      eyebrow="EGDesk Phone MCP"
      title="Phone / Google Messages Playground"
      subtitle="Pair Messages Web, sync inbox & threads, enqueue SMS, and manage marketing consent / 무료수신거부."
      apiPath="/api/phone"
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
