'use client';

import { useState } from 'react';
import PlaygroundPage from '@/components/PlaygroundPage';
import ToolCard from '@/components/ToolCard';

export default function BusinessIdentityMCPPage() {
  const [snapshotId, setSnapshotId] = useState('');
  const [brandKey, setBrandKey] = useState('');
  const [personaId, setPersonaId] = useState('');
  const [productId, setProductId] = useState('');

  return (
    <PlaygroundPage
      title="Business Identity MCP"
      description="Manage brand identity snapshots, product catalogs, and AI brand faces / spokespersons."
      currentHref="/business-identity-mcp"
      apiPath="/api/business-identity"
    >
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-4">Common Context</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700">Snapshot ID</label>
              <input
                type="text"
                value={snapshotId}
                onChange={(e) => setSnapshotId(e.target.value)}
                placeholder="e.g. b2f3... (from bi_list_snapshots)"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Brand Key</label>
              <input
                type="text"
                value={brandKey}
                onChange={(e) => setBrandKey(e.target.value)}
                placeholder="e.g. egdesk"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Snapshots</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ToolCard
              title="bi_list_snapshots"
              description="List all business identity snapshots."
              arguments={{ brandKey }}
            />
            <ToolCard
              title="bi_get_snapshot"
              description="Get full identity data for a snapshot."
              arguments={{ snapshotId }}
            />
            <ToolCard
              title="bi_get_company_info"
              description="Extract company info slice."
              arguments={{ snapshotId }}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Product Catalog</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ToolCard
              title="bi_catalog_list_products"
              description="List managed products for a snapshot."
              arguments={{ snapshotId }}
            />
            <ToolCard
              title="bi_catalog_register_product"
              description="Register or update a product."
              arguments={{
                snapshotId,
                name: 'Sample Product',
                description: 'Product description here',
                toneVoice: 'Professional',
                category: 'Software'
              }}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Brand Face</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ToolCard
              title="bi_face_list"
              description="List AI brand faces for a snapshot."
              arguments={{ snapshotId }}
            />
            <ToolCard
              title="bi_face_generate"
              description="Generate a new AI brand face."
              arguments={{
                snapshotId,
                styleNotes: 'Professional female founder, minimalist background',
                roleHint: 'CEO'
              }}
            />
          </div>
        </section>
      </div>
    </PlaygroundPage>
  );
}
