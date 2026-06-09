/**
 * POST /api/create-row
 *
 * Inserts a demo row into the first EGDesk table.
 *
 * EGDesk key concepts shown here:
 *  - `insertRows` from egdesk-helpers.ts — inserts rows into a table
 *
 * The row data must match the column names in your table.
 * Column names are available in TABLES[key].columns (from egdesk.config.ts).
 */

import { NextResponse } from 'next/server';

// @ts-ignore — file is generated at setup time
import { TABLES } from '../../../egdesk.config';
// @ts-ignore — file is generated at setup time
import { insertRows } from '../../../egdesk-helpers';

export async function POST() {
  try {
    const tableKeys = Object.keys(TABLES) as (keyof typeof TABLES)[];

    if (tableKeys.length === 0) {
      return NextResponse.json(
        { error: 'No tables found. Import data in EGDesk first.' },
        { status: 404 }
      );
    }

    const firstTable = TABLES[tableKeys[0]];

    // Build a demo row — one string value per column
    // In a real app you'd populate this from request body / form data
    const demoRow: Record<string, string> = {};
    for (const col of firstTable.columns) {
      demoRow[col] = `demo_${col}_${Date.now()}`;
    }

    // insertRows(tableName, rows) — inserts rows and returns the result
    const result = await insertRows(firstTable.name, [demoRow]);

    return NextResponse.json({ success: true, row: result });
  } catch (error: any) {
    console.error('[/api/create-row] Error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
  }
}
