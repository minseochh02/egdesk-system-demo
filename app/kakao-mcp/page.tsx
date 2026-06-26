import type React from 'react';

type ToolDoc = {
  name: string;
  title: string;
  purpose: string;
  helper: string;
  raw: string;
  args: Array<{ name: string; detail: string }>;
  notes: string[];
};

const tools: ToolDoc[] = [
  {
    name: 'kakao_list_channels',
    title: 'List Kakao Channels',
    purpose: 'Find managed Kakao Channels for a Google profile. Use this before selecting a channel or creating a bot.',
    helper: `const channels = await listKakaoChannels('Default', {
  enrichDetails: true,
});`,
    raw: `await callKakaoTool('kakao_list_channels', {
  profileName: 'Default',
  enrichDetails: true,
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
      { name: 'enrichDetails', detail: 'Optional. When true, EGDesk opens channel detail pages to collect richer data.' },
    ],
    notes: [
      'Returns channels with names, search IDs, profile URLs, and any extra details EGDesk can read.',
      'Use searchId from this result when creating a Kakao bot for a specific channel.',
    ],
  },
  {
    name: 'kakao_select_channel',
    title: 'Select Kakao Channel',
    purpose: 'Open or activate a known Kakao Channel in the managed browser profile.',
    helper: `await selectKakaoChannel('Default', {
  searchId: '@sample-channel',
  name: 'Sample Channel',
});`,
    raw: `await callKakaoTool('kakao_select_channel', {
  profileName: 'Default',
  channel: {
    searchId: '@sample-channel',
    name: 'Sample Channel',
  },
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
      { name: 'channel', detail: 'A channel object. Prefer passing searchId; name is useful as a fallback label.' },
    ],
    notes: [
      'Call listKakaoChannels first if you do not know the channel searchId.',
      'This is useful before doing manual review or confirming the correct Kakao workspace.',
    ],
  },
  {
    name: 'kakao_create_channel',
    title: 'Create Kakao Channel',
    purpose: 'Create a new Kakao Channel, or reuse an existing channel when requested.',
    helper: `const channel = await createKakaoChannel({
  profileName: 'Default',
  channelName: 'Demo Support',
  searchId: '@demo-support',
  reuseExisting: true,
});`,
    raw: `await callKakaoTool('kakao_create_channel', {
  profileName: 'Default',
  channelName: 'Demo Support',
  searchId: '@demo-support',
  reuseExisting: true,
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
      { name: 'channelName', detail: 'Visible Kakao Channel name to create.' },
      { name: 'searchId', detail: 'Kakao Channel search ID, usually beginning with @.' },
      { name: 'reuseExisting', detail: 'Optional. When true, EGDesk returns a matching existing channel instead of failing.' },
    ],
    notes: [
      'Kakao may require account verification, business settings, or manual confirmation depending on the account state.',
      'Keep search IDs stable because bots and callback checks use them later.',
    ],
  },
  {
    name: 'kakao_list_bots',
    title: 'List Kakao Bots',
    purpose: 'Read Kakao bot entries available in the selected Kakao account.',
    helper: `const bots = await listKakaoBots('Default');`,
    raw: `await callKakaoTool('kakao_list_bots', {
  profileName: 'Default',
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
    ],
    notes: [
      'Returns bot names, IDs, linked channel data, and callback metadata when available.',
      'Use this before callback status checks if you want to target specific bots.',
    ],
  },
  {
    name: 'kakao_create_bot',
    title: 'Create Kakao Bot',
    purpose: 'Create a Kakao bot and link it to a Kakao Channel.',
    helper: `const bot = await createKakaoBot({
  profileName: 'Default',
  botName: 'Demo Support Bot',
  channelSearchId: '@demo-support',
  skillUrl: 'https://your-egdesk-url.example/kakao/skill',
  reuseExisting: true,
});`,
    raw: `await callKakaoTool('kakao_create_bot', {
  profileName: 'Default',
  botName: 'Demo Support Bot',
  channelSearchId: '@demo-support',
  skillUrl: 'https://your-egdesk-url.example/kakao/skill',
  reuseExisting: true,
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
      { name: 'botName', detail: 'Visible Kakao bot name to create.' },
      { name: 'channelSearchId', detail: 'Search ID of the Kakao Channel to link.' },
      { name: 'skillUrl', detail: 'Optional. EGDesk Kakao skill webhook URL to configure during setup.' },
      { name: 'reuseExisting', detail: 'Optional. When true, EGDesk returns a matching existing bot instead of failing.' },
    ],
    notes: [
      'Create or list channels first so channelSearchId is accurate.',
      'Use the EGDesk /kakao/skill endpoint as the callback URL for webhook delivery.',
    ],
  },
  {
    name: 'kakao_list_resources',
    title: 'List Kakao Resources',
    purpose: 'Fetch channels and bots in one call for setup dashboards or audits.',
    helper: `const resources = await listKakaoResources('Default', {
  enrichDetails: true,
});`,
    raw: `await callKakaoTool('kakao_list_resources', {
  profileName: 'Default',
  enrichDetails: true,
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
      { name: 'enrichDetails', detail: 'Optional. Applies richer channel detail collection where supported.' },
    ],
    notes: [
      'Returns both channels and bots in a single response.',
      'Use this for a first screen that needs to show current Kakao setup state.',
    ],
  },
  {
    name: 'kakao_check_callback_statuses',
    title: 'Check Callback Statuses',
    purpose: 'Verify whether Kakao bots have their callback or skill webhook configured correctly.',
    helper: `const statuses = await checkKakaoCallbackStatuses('Default', {
  bots: [{ name: 'Demo Support Bot' }],
  channels: [{ searchId: '@demo-support' }],
});`,
    raw: `await callKakaoTool('kakao_check_callback_statuses', {
  profileName: 'Default',
  bots: [{ name: 'Demo Support Bot' }],
  channels: [{ searchId: '@demo-support' }],
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
      { name: 'bots', detail: 'Optional. Bot objects to check. Omit to let EGDesk discover bots.' },
      { name: 'channels', detail: 'Optional. Channel objects to help match bots to channels.' },
    ],
    notes: [
      'Use after bot creation or after changing the EGDesk webhook URL.',
      'The result is intended for setup health checks and repair prompts.',
    ],
  },
  {
    name: 'kakao_repair_callback_setup',
    title: 'Repair Callback Setup',
    purpose: 'Attempt to repair missing or stale Kakao callback configuration for managed bots.',
    helper: `const repair = await repairKakaoCallbackSetup('Default', {
  bots: [{ name: 'Demo Support Bot' }],
  channels: [{ searchId: '@demo-support' }],
});`,
    raw: `await callKakaoTool('kakao_repair_callback_setup', {
  profileName: 'Default',
  bots: [{ name: 'Demo Support Bot' }],
  channels: [{ searchId: '@demo-support' }],
});`,
    args: [
      { name: 'profileName', detail: 'Google profile name used by EGDesk automation.' },
      { name: 'bots', detail: 'Optional. Bot objects to repair. Omit to let EGDesk discover bots.' },
      { name: 'channels', detail: 'Optional. Channel objects used for bot-channel matching.' },
    ],
    notes: [
      'Run checkKakaoCallbackStatuses first when you want to show users exactly what will be repaired.',
      'Some Kakao account states can still require manual browser confirmation.',
    ],
  },
];

const setupSnippet = `import {
  callKakaoTool,
  listKakaoChannels,
  listKakaoBots,
  listKakaoResources,
  selectKakaoChannel,
  createKakaoChannel,
  createKakaoBot,
  checkKakaoCallbackStatuses,
  repairKakaoCallbackSetup,
} from '../egdesk-helpers';`;

const flowSnippet = `const profileName = 'Default';

const channel = await createKakaoChannel({
  profileName,
  channelName: 'Demo Support',
  searchId: '@demo-support',
  reuseExisting: true,
});

const bot = await createKakaoBot({
  profileName,
  botName: 'Demo Support Bot',
  channelSearchId: channel.searchId,
  skillUrl: 'https://your-egdesk-url.example/kakao/skill',
  reuseExisting: true,
});

const status = await checkKakaoCallbackStatuses(profileName, {
  bots: [bot],
  channels: [channel],
});`;

export default function KakaoMcpPage() {
  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <a href="../" style={backLinkStyle}>Back to database demo</a>
        <div style={eyebrowStyle}>EGDesk Kakao MCP</div>
        <h1 style={titleStyle}>Kakao Channel setup and management</h1>
        <p style={introStyle}>
          Use these helpers after EGDesk regenerates <code>egdesk-helpers.ts</code>. They call the local
          Kakao MCP endpoint through <code>/__kakao_proxy</code> in the browser or <code>/kakao/tools/call</code>
          on the server.
        </p>
      </header>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Before using the tools</h2>
        <div style={checkGridStyle}>
          <div style={checkItemStyle}>
            <strong>Kakao MCP server</strong>
            <span>Enable the Kakao MCP server in EGDesk. It is opt-in because it drives browser automation.</span>
          </div>
          <div style={checkItemStyle}>
            <strong>Google profile</strong>
            <span>Use the same profile name that is logged into the target Kakao account.</span>
          </div>
          <div style={checkItemStyle}>
            <strong>Generated helpers</strong>
            <span>Regenerate helpers so this app has the Kakao functions and proxy route.</span>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Import helpers</h2>
        <CodeBlock code={setupSnippet} />
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Common setup flow</h2>
        <p style={bodyTextStyle}>
          This creates or reuses a channel, creates or reuses a bot, then verifies callback setup.
        </p>
        <CodeBlock code={flowSnippet} />
      </section>

      <section style={toolListStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Every Kakao MCP tool</h2>
          <p style={bodyTextStyle}>
            Each generated helper is a thin wrapper around <code>callKakaoTool()</code>. Use the helper for app
            code and the raw call when you are building generic MCP tooling.
          </p>
        </div>

        {tools.map((tool) => (
          <article key={tool.name} style={toolCardStyle}>
            <div style={toolHeaderStyle}>
              <div>
                <h3 style={toolTitleStyle}>{tool.title}</h3>
                <code style={toolNameStyle}>{tool.name}</code>
              </div>
            </div>
            <p style={purposeStyle}>{tool.purpose}</p>

            <div style={twoColumnStyle}>
              <div>
                <h4 style={miniTitleStyle}>Generated helper</h4>
                <CodeBlock code={tool.helper} />
              </div>
              <div>
                <h4 style={miniTitleStyle}>Raw MCP call</h4>
                <CodeBlock code={tool.raw} />
              </div>
            </div>

            <div style={argsGridStyle}>
              <div>
                <h4 style={miniTitleStyle}>Inputs</h4>
                <dl style={definitionListStyle}>
                  {tool.args.map((arg) => (
                    <div key={arg.name} style={definitionRowStyle}>
                      <dt style={definitionTermStyle}>{arg.name}</dt>
                      <dd style={definitionDescStyle}>{arg.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h4 style={miniTitleStyle}>Notes</h4>
                <ul style={noteListStyle}>
                  {tool.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre style={codeBlockStyle}>
      <code>{code}</code>
    </pre>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '40px 24px 64px',
};

const headerStyle: React.CSSProperties = {
  marginBottom: 28,
};

const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginBottom: 20,
  color: '#2563eb',
  fontSize: 14,
  fontWeight: 600,
};

const eyebrowStyle: React.CSSProperties = {
  color: '#047857',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0,
  marginBottom: 8,
  textTransform: 'uppercase',
};

const titleStyle: React.CSSProperties = {
  fontSize: 34,
  lineHeight: 1.15,
  fontWeight: 800,
  marginBottom: 12,
  color: '#111827',
};

const introStyle: React.CSSProperties = {
  maxWidth: 820,
  color: '#4b5563',
  fontSize: 16,
  lineHeight: 1.7,
};

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 22,
  marginBottom: 18,
};

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
  fontWeight: 750,
  marginBottom: 10,
  color: '#111827',
};

const bodyTextStyle: React.CSSProperties = {
  color: '#4b5563',
  fontSize: 14,
  lineHeight: 1.7,
  marginBottom: 12,
};

const checkGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
};

const checkItemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  color: '#374151',
  fontSize: 14,
  lineHeight: 1.55,
};

const toolListStyle: React.CSSProperties = {
  marginTop: 28,
};

const toolCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 22,
  marginBottom: 18,
};

const toolHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 10,
};

const toolTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 750,
  color: '#111827',
  marginBottom: 4,
};

const toolNameStyle: React.CSSProperties = {
  display: 'inline-flex',
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  color: '#065f46',
  background: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: 6,
  padding: '3px 7px',
  fontSize: 12,
};

const purposeStyle: React.CSSProperties = {
  color: '#4b5563',
  fontSize: 14,
  lineHeight: 1.7,
  marginBottom: 16,
};

const twoColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
  marginBottom: 18,
};

const argsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 18,
};

const miniTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 750,
  color: '#374151',
  marginBottom: 8,
};

const codeBlockStyle: React.CSSProperties = {
  background: '#111827',
  color: '#f9fafb',
  borderRadius: 8,
  padding: 14,
  overflowX: 'auto',
  fontSize: 13,
  lineHeight: 1.55,
};

const definitionListStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
};

const definitionRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 3,
};

const definitionTermStyle: React.CSSProperties = {
  color: '#111827',
  fontSize: 13,
  fontWeight: 700,
};

const definitionDescStyle: React.CSSProperties = {
  color: '#4b5563',
  fontSize: 13,
  lineHeight: 1.55,
  margin: 0,
};

const noteListStyle: React.CSSProperties = {
  color: '#4b5563',
  fontSize: 13,
  lineHeight: 1.6,
  paddingLeft: 18,
};
