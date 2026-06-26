/**
 * GET /api/database/meta
 *
 * Returns table definitions from egdesk.config.ts for UI dropdowns.
 */

import { NextResponse } from 'next/server';

// @ts-ignore — file is generated at setup time
import { TABLES } from '../../../../egdesk.config';

export async function GET() {
  try {
    const tables = Object.values(TABLES).map((t: {
      name: string;
      displayName: string;
      columns: string[];
      rowCount?: number;
    }) => ({
      name: t.name,
      displayName: t.displayName,
      columns: t.columns,
      rowCount: t.rowCount ?? null,
    }));

    return NextResponse.json({ tables });
  } catch (error: any) {
    console.error('[/api/database/meta] Error:', error);
    return NextResponse.json({ error: error.message ?? 'Internal error' }, { status: 500 });
  }
}
