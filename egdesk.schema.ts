/**
 * egdesk.schema.ts — committed seed schema
 *
 * This file is intentionally committed to git. EGDesk reads it once when the
 * project is first opened and creates these tables in the dev database automatically.
 *
 * Unlike egdesk.config.ts (which is auto-generated and gitignored), this file
 * is the source of truth for the initial schema. Edit it to add/remove seed tables.
 */

export const TABLES = {
  products: {
    name: 'products',
    displayName: 'Products',
    columns: ['name', 'description', 'price', 'category', 'stock'],
    columnCount: 5,
    rowCount: 0,
  },
  customers: {
    name: 'customers',
    displayName: 'Customers',
    columns: ['first_name', 'last_name', 'email', 'phone', 'created_at'],
    columnCount: 5,
    rowCount: 0,
  },
  orders: {
    name: 'orders',
    displayName: 'Orders',
    columns: ['customer_id', 'product_id', 'quantity', 'total_price', 'status', 'ordered_at'],
    columnCount: 6,
    rowCount: 0,
  },
} as const;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];
