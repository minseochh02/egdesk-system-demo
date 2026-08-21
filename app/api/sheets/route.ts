import { createMcpRoute } from '@/lib/create-mcp-route';

export const POST = createMcpRoute(null, {
  sheets_list_connections: { path: '/sheets/sync', method: 'GET' },
  sheets_sync: { path: '/sheets/sync', method: 'POST' },
});
