/**
 * POST /api/database
 *
 * Runs EGDesk database helpers from the playground UI.
 * Body: { helper: string, arguments: Record<string, any> }
 */

import { NextResponse } from 'next/server';

// @ts-ignore — file is generated at setup time
import {
  queryTable,
  searchTable,
  listTables,
  getTableSchema,
  insertRows,
  updateRows,
  deleteRows,
  aggregateTable,
  executeSQL,
  callUserDataTool,
} from '../../../egdesk-helpers';

type HelperArgs = Record<string, any>;

async function runHelper(helper: string, args: HelperArgs) {
  switch (helper) {
    case 'queryTable':
      return queryTable(args.tableName, {
        filters: args.filters,
        limit: args.limit,
        offset: args.offset,
        orderBy: args.orderBy,
        orderDirection: args.orderDirection,
      });

    case 'searchTable':
      return searchTable(args.tableName, args.searchQuery, args.limit ?? 50);

    case 'listTables':
      return listTables();

    case 'getTableSchema':
      return getTableSchema(args.tableName);

    case 'insertRows':
      return insertRows(args.tableName, args.rows);

    case 'updateRows':
      return updateRows(args.tableName, args.updates, {
        ids: args.ids,
        filters: args.filters,
        expectedVersion: args.expectedVersion,
      });

    case 'deleteRows':
      return deleteRows(args.tableName, {
        ids: args.ids,
        filters: args.filters,
      });

    case 'aggregateTable':
      return aggregateTable(args.tableName, args.column, args.function, {
        filters: args.filters,
        groupBy: args.groupBy,
      });

    case 'executeSQL':
      return executeSQL(args.query);

    case 'uploadImage': {
      // 1. Insert a metadata row into the images table
      const inserted = await insertRows('images', [{
        filename: args.filename,
        mime_type: args.mimeType || 'application/octet-stream',
        size_bytes: Math.round((args.data?.length ?? 0) * 3 / 4),
        uploaded_at: new Date().toISOString(),
      }]);
      // 2. Get the new row ID from the insert result
      const rowId = inserted?.insertedIds?.[0] ?? inserted?.lastInsertRowid ?? 1;
      // 3. Upload the file blob attached to that row
      const upload = await callUserDataTool('user_data_upload_file', {
        tableName: 'images', rowId, columnName: 'file',
        filename: args.filename, data: args.data,
        mimeType: args.mimeType,
      });
      return { rowId, upload };
    }

    case 'listImages':
      return queryTable('images', { limit: 100, orderBy: 'id', orderDirection: 'desc' });

    case 'deleteImage': {
      // Delete the file blob first, then remove the row
      await callUserDataTool('user_data_delete_file', { tableName: 'images', rowId: args.rowId, columnName: 'file' });
      return deleteRows('images', { ids: [args.rowId] });
    }

    case 'fetchImage':
    case 'fetchFile': {
      const file = await callUserDataTool('user_data_download_file', {
        tableName: 'images',
        rowId: args.rowId,
        columnName: 'file',
      });
      return file;
    }

    case 'getFileStats':
      return callUserDataTool('user_data_get_file_stats', { tableName: 'images' });

    default:
      throw new Error(`Unknown helper: ${helper}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { helper, arguments: args = {} } = body;

    if (!helper) {
      return NextResponse.json({ error: 'helper is required' }, { status: 400 });
    }

    const result = await runHelper(helper, args);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[/api/database] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
