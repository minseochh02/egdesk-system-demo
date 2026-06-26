/**
 * GET /api/inventory/status
 *
 * Returns whether the inventory scanner component has been injected into this project.
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const scannerComponent = path.join(
    process.cwd(),
    'components/inventory-scanner/InventoryScanner.tsx',
  );

  return NextResponse.json({
    installed: fs.existsSync(scannerComponent),
    routePath: '/inventory-scanner',
  });
}
