import { createMcpRoute } from '@/lib/create-mcp-route';

export const POST = createMcpRoute('/apps-script/tools/call', {
  apps_script_sync: { path: '/apps-script/sync', method: 'POST' },
});
