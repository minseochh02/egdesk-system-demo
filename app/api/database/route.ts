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
