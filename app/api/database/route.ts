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
  createTable,
} from '../../../egdesk-helpers';

type HelperArgs = Record<string, any>;

function pickRows(result: unknown): Record<string, unknown>[] {
  if (!result || typeof result !== 'object') return [];
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.rows)) return r.rows as Record<string, unknown>[];
  if (Array.isArray(r.data)) return r.data as Record<string, unknown>[];
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return [];
}

function pickInsertId(result: unknown): number | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as { insertedIds?: number[]; lastInsertRowid?: number };
  const id = r.insertedIds?.[0] ?? r.lastInsertRowid;
  return id != null ? Number(id) : undefined;
}

function parseCustomerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Customer', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function resolveCustomerId(customerName: string): Promise<number> {
  const { firstName, lastName } = parseCustomerName(customerName);
  const matches = pickRows(
    await queryTable('customers', {
      filters: { first_name: firstName, last_name: lastName },
      limit: 1,
    }),
  );
  const existingId = matches[0]?.id;
  if (existingId != null) return Number(existingId);

  const inserted = await insertRows('customers', [{
    first_name: firstName,
    last_name: lastName,
    email: '',
    phone: '',
    created_at: new Date().toISOString(),
  }]);
  const newId = pickInsertId(inserted);
  if (newId == null) {
    throw new Error('Could not create customer row');
  }
  return newId;
}

async function resolveDefaultProductId(): Promise<number> {
  const products = pickRows(
    await queryTable('products', { limit: 1, orderBy: 'id', orderDirection: 'ASC' }),
  );
  const existingId = products[0]?.id;
  if (existingId != null) return Number(existingId);

  const inserted = await insertRows('products', [{
    name: 'Demo product',
    description: 'Auto-created for demo orders',
    price: '10000',
    category: 'general',
    stock: '100',
  }]);
  const newId = pickInsertId(inserted);
  if (newId == null) {
    throw new Error('Could not create default product row');
  }
  return newId;
}

/** Real-time demo form → orders table (customer_id, product_id, total_price, …). */
async function insertDemoOrder(args: HelperArgs) {
  const customerName = String(args.customerName ?? '').trim();
  if (!customerName) {
    throw new Error('customerName is required');
  }
  const status = String(args.status ?? 'pending');
  const amountRaw = args.amount;
  const totalPrice =
    amountRaw === undefined || amountRaw === '' || amountRaw === null
      ? 0
      : Number(amountRaw);
  if (Number.isNaN(totalPrice)) {
    throw new Error('amount must be a number');
  }

  const customerId = await resolveCustomerId(customerName);
  const productId = await resolveDefaultProductId();
  const orderedAt = new Date().toISOString();

  const insertResult = await insertRows('orders', [{
    customer_id: customerId,
    product_id: productId,
    quantity: 1,
    total_price: totalPrice,
    status,
    ordered_at: orderedAt,
  }]);

  const orderId = pickInsertId(insertResult);
  return {
    orderId,
    customerId,
    productId,
    total_price: totalPrice,
    status,
    ordered_at: orderedAt,
    customerName,
  };
}

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

    case 'insertDemoOrder':
      return insertDemoOrder(args);

    case 'updateRows':
      return callUserDataTool('user_data_update_rows', {
        tableName: args.tableName,
        updates: args.updates,
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

    case 'ensureImagesTable': {
      const listed = await listTables();
      const tables: Array<{ name?: string; tableName?: string }> = Array.isArray(listed?.tables)
        ? listed.tables
        : Array.isArray(listed)
          ? listed
          : [];
      const hasImages = tables.some((t) => {
        const n = String(t?.name || t?.tableName || t || '').toLowerCase();
        return n === 'images';
      });
      if (hasImages) return { created: false, tableName: 'images' };
      await createTable(
        'Images',
        [
          { name: 'filename', type: 'TEXT' },
          { name: 'mime_type', type: 'TEXT' },
          { name: 'size_bytes', type: 'INTEGER' },
          { name: 'uploaded_at', type: 'TEXT' },
        ],
        { tableName: 'images' },
      );
      return { created: true, tableName: 'images' };
    }

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
        tableName: 'images',
        rowId,
        columnName: 'file',
        filename: args.filename,
        data: args.data,
        mimeType: args.mimeType,
        ...(args.yoloCrop ? { yoloCrop: true } : {}),
        ...(args.contentType === 'object' || args.contentType === 'paper'
          ? { contentType: args.contentType }
          : {}),
        ...(args.yoloModel ? { yoloModel: args.yoloModel } : {}),
        ...(args.yoloConfThreshold !== undefined ? { yoloConfThreshold: Number(args.yoloConfThreshold) } : {}),
        ...(args.yoloCropPad !== undefined ? { yoloCropPad: Number(args.yoloCropPad) } : {}),
      });
      return { rowId, upload };
    }

    case 'listImages':
      return queryTable('images', { limit: 100, orderBy: 'id', orderDirection: 'DESC' });

    case 'deleteImage': {
      // Delete main file + any YOLO crop siblings, then remove the row
      const listed = await callUserDataTool('user_data_list_files', {
        tableName: 'images',
        rowId: args.rowId,
      }).catch(() => null);
      const files: Array<{ columnName?: string; column_name?: string }> = Array.isArray(listed?.files)
        ? listed.files
        : Array.isArray(listed)
          ? listed
          : [];
      const columns = new Set<string>(['file']);
      for (const f of files) {
        const col = f.columnName || f.column_name;
        if (col && /^file__crop_\d+$/.test(col)) columns.add(col);
      }
      for (const columnName of columns) {
        await callUserDataTool('user_data_delete_file', {
          tableName: 'images',
          rowId: args.rowId,
          columnName,
        }).catch(() => undefined);
      }
      return deleteRows('images', { ids: [args.rowId] });
    }

    case 'fetchImage':
    case 'fetchFile': {
      const file = await callUserDataTool('user_data_download_file', {
        ...(args.fileId
          ? { fileId: args.fileId }
          : {
              tableName: 'images',
              rowId: args.rowId,
              columnName: args.columnName || 'file',
            }),
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
