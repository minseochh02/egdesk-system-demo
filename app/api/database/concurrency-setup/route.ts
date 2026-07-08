/**
 * POST /api/database/concurrency-setup
 *
 * Creates or deletes the _concurrency_demo table for the concurrency demo page.
 * Body: { action: 'create' | 'delete' }
 */

import { NextResponse } from 'next/server';

// @ts-ignore — file is generated at setup time
import { deleteTable, createTable } from '../../../../egdesk-helpers';

const TABLE_NAME = '_concurrency_demo';

export async function POST(request: Request) {
  try {
    const { action } = await request.json();

    if (action === 'create') {
      // Delete if exists, then create fresh
      try {
        await deleteTable(TABLE_NAME);
      } catch {
        // Table may not exist — ignore
      }

      await createTable('Concurrency Demo', [
        { name: 'item', type: 'TEXT', notNull: true },
        { name: 'quantity', type: 'INTEGER', notNull: true },
        { name: 'status', type: 'TEXT', notNull: true },
      ], {
        tableName: TABLE_NAME,
        description: 'Demo table for concurrency & optimistic locking scenarios',
      });

      return NextResponse.json({ success: true, action: 'created' });
    }

    if (action === 'delete') {
      await deleteTable(TABLE_NAME);
      return NextResponse.json({ success: true, action: 'deleted' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[/api/database/concurrency-setup] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
