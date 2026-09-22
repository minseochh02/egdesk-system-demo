'use client';

import {
  McpPlayground,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'bi_list_snapshots',
    title: 'List snapshots',
    description: 'List all business identity snapshots.',
    category: 'snapshots',
    fields: [
      {
        name: 'brandKey',
        label: 'Brand key (optional)',
        type: 'string',
        placeholder: 'egdesk',
      },
    ],
  },
  {
    name: 'bi_get_snapshot',
    title: 'Get snapshot',
    description: 'Get full identity data for a snapshot.',
    category: 'snapshots',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
        placeholder: 'from bi_list_snapshots',
      },
    ],
  },
  {
    name: 'bi_get_company_info',
    title: 'Company info',
    description: 'Extract company info slice from a snapshot.',
    category: 'snapshots',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'bi_catalog_list_products',
    title: 'List products',
    description: 'List managed products for a snapshot.',
    category: 'catalog',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'bi_catalog_register_product',
    title: 'Register product',
    description: 'Register or update a product in the catalog.',
    category: 'catalog',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'name',
        label: 'Product name',
        type: 'string',
        required: true,
        defaultValue: 'Sample Product',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        defaultValue: 'Product description here',
      },
      {
        name: 'toneVoice',
        label: 'Tone / voice',
        type: 'string',
        defaultValue: 'Professional',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'string',
        defaultValue: 'Software',
      },
    ],
  },
  {
    name: 'bi_face_list',
    title: 'List brand faces',
    description: 'List AI brand faces for a snapshot.',
    category: 'brand-face',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
    ],
  },
  {
    name: 'bi_face_generate',
    title: 'Generate brand face',
    description: 'Generate a new AI brand face.',
    category: 'brand-face',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'styleNotes',
        label: 'Style notes',
        type: 'textarea',
        defaultValue: 'Professional female founder, minimalist background',
      },
      {
        name: 'roleHint',
        label: 'Role hint',
        type: 'string',
        defaultValue: 'CEO',
      },
    ],
  },
];

export default function BusinessIdentityMCPPage() {
  return (
    <McpPlayground
      currentHref="/business-identity-mcp"
      eyebrow="EGDesk MCP"
      title="Business Identity MCP"
      subtitle="Manage brand identity snapshots, product catalogs, and AI brand faces / spokespersons."
      apiPath="/api/business-identity"
      tools={TOOLS}
      categories={[
        { key: 'snapshots', label: 'Snapshots' },
        { key: 'catalog', label: 'Product catalog' },
        { key: 'brand-face', label: 'Brand face' },
      ]}
    />
  );
}
