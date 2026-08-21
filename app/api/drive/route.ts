import { createMcpRoute } from '@/lib/create-mcp-route';

export const POST = createMcpRoute('/drive/tools/call', {
  drive_sync: { path: '/drive/sync', method: 'POST' },
  drive_sync_status: { path: '/drive/sync', method: 'GET' },
});
