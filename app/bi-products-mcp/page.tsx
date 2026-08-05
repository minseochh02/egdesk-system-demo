'use client';

import { useCallback } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'bi_list_snapshots',
    title: 'List BI snapshots',
    description: 'List Business Identity snapshots. Copy a snapshotId for product registration.',
    category: 'catalog',
    fields: [
      {
        name: 'brandKey',
        label: 'Brand key (optional)',
        type: 'string',
        placeholder: 'my-brand',
      },
    ],
  },
  {
    name: 'bi_list_products',
    title: 'List products',
    description: 'List catalog products for a snapshot, including toneVoice and image counts.',
    category: 'catalog',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
        placeholder: 'Paste from List BI snapshots',
      },
    ],
  },
  {
    name: 'bi_get_product',
    title: 'Get product',
    description: 'Fetch one product by id or name.',
    category: 'catalog',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'productIdOrName',
        label: 'Product id or name',
        type: 'string',
        required: true,
      },
      {
        name: 'includeImages',
        label: 'Include image base64',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    name: 'bi_register_product',
    title: 'Register product',
    description:
      'Create or upsert a product/service with description, tone/personality, and optional image. Matching is by name.',
    category: 'write',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
        placeholder: 'Paste from List BI snapshots',
      },
      {
        name: 'name',
        label: 'Product / service name',
        type: 'string',
        required: true,
        placeholder: '실시간 출결 관리',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'What this product offers…',
      },
      {
        name: 'toneVoice',
        label: 'Tone / personality',
        type: 'textarea',
        placeholder: 'Warm and reassuring for parents; practical Korean; lightly playful but trustworthy',
        hint: 'Used when generating blog posts about this product (overrides brand tone).',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'string',
        placeholder: 'SaaS, consulting, …',
      },
      {
        name: 'keyFeatures',
        label: 'Key features',
        type: 'textarea',
        placeholder: 'One feature per line (or comma-separated)',
      },
      {
        name: 'priceHint',
        label: 'Price hint',
        type: 'string',
        placeholder: 'From $99/mo',
      },
      {
        name: 'productImage',
        label: 'Product image (optional)',
        type: 'file',
        fileDelivery: 'inline',
        accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif',
        hint: 'Sent as inline base64 to bi_register_product.',
      },
      {
        name: 'replaceAttachments',
        label: 'Replace existing attachments',
        type: 'boolean',
        defaultValue: false,
      },
    ],
  },
  {
    name: 'bi_update_product',
    title: 'Update product',
    description: 'Patch fields on an existing catalog product.',
    category: 'write',
    fields: [
      {
        name: 'snapshotId',
        label: 'Snapshot ID',
        type: 'string',
        required: true,
      },
      {
        name: 'productIdOrName',
        label: 'Product id or name',
        type: 'string',
        required: true,
      },
      {
        name: 'name',
        label: 'New name (optional)',
        type: 'string',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
      },
      {
        name: 'toneVoice',
        label: 'Tone / personality',
        type: 'textarea',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'string',
      },
      {
        name: 'keyFeatures',
        label: 'Key features',
        type: 'textarea',
      },
      {
        name: 'priceHint',
        label: 'Price hint',
        type: 'string',
      },
      {
        name: 'productImage',
        label: 'Add image (optional)',
        type: 'file',
        fileDelivery: 'inline',
        accept: 'image/*,.png,.jpg,.jpeg,.webp,.gif',
      },
    ],
  },
];

const CATEGORIES = [
  { key: 'catalog', label: 'Browse' },
  { key: 'write', label: 'Register / update' },
];

export default function BiProductsMcpPlayground() {
  const postProcessArgs = useCallback((args: Record<string, any>, context: any) => {
    const next = { ...args };
    delete next.productImage;

    if (typeof next.keyFeatures === 'string' && next.keyFeatures.trim()) {
      next.keyFeatures = next.keyFeatures
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    const payload = context.filePayloads?.productImage;
    if (payload?.base64) {
      next.images = [
        {
          base64: payload.base64,
          mimeType: payload.mimeType || 'image/png',
          name: payload.name || 'product-image',
        },
      ];
    }

    return next;
  }, []);

  const renderDisplay = useCallback((data: any) => {
    const styles = playgroundStyles;
    if (Array.isArray(data?.snapshots)) {
      return (
        <div style={styles.tableWrapStyle}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>ID</th>
                <th style={styles.thStyle}>Brand</th>
                <th style={styles.thStyle}>URL</th>
              </tr>
            </thead>
            <tbody>
              {data.snapshots.map((s: any) => (
                <tr key={s.id}>
                  <td style={styles.tdStyle}><code style={styles.inlineCodeStyle}>{s.id}</code></td>
                  <td style={styles.tdStyle}>{s.brandKey}</td>
                  <td style={styles.tdStyle}>{s.sourceUrl || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (Array.isArray(data?.products)) {
      return (
        <div style={styles.tableWrapStyle}>
          <table style={styles.tableStyle}>
            <thead>
              <tr>
                <th style={styles.thStyle}>Name</th>
                <th style={styles.thStyle}>Tone</th>
                <th style={styles.thStyle}>Images</th>
                <th style={styles.thStyle}>Category</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p: any) => (
                <tr key={p.id || p.name}>
                  <td style={styles.tdStyle}>{p.name}</td>
                  <td style={styles.tdStyle}>{p.toneVoice || '—'}</td>
                  <td style={styles.tdStyle}>{p.imageCount ?? 0}</td>
                  <td style={styles.tdStyle}>{p.category || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (data?.product) {
      const p = data.product;
      return (
        <dl style={styles.kvGridStyle}>
          <dt style={styles.kvTermStyle}>Name</dt>
          <dd style={styles.kvDescStyle}>{p.name}</dd>
          <dt style={styles.kvTermStyle}>Tone</dt>
          <dd style={styles.kvDescStyle}>{p.toneVoice || '—'}</dd>
          <dt style={styles.kvTermStyle}>Description</dt>
          <dd style={styles.kvDescStyle}>{p.description || '—'}</dd>
          <dt style={styles.kvTermStyle}>Images</dt>
          <dd style={styles.kvDescStyle}>{p.imageCount ?? p.attachments?.length ?? 0}</dd>
        </dl>
      );
    }

    return null;
  }, []);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Suggested flow</div>
        <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0', lineHeight: 1.55 }}>
          1) List snapshots → 2) Register product (description + tone + image) → 3) Open{' '}
          <strong>Blog MCP</strong> to schedule or generate a post for that product.
        </p>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/bi-products-mcp"
      eyebrow="BI Products MCP"
      title="Product catalog playground"
      subtitle="Register Business Identity products/services with description, images, and per-product tone for EGDesk blog generation."
      apiPath="/api/bi-products"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#5865f2"
      sessionBar={sessionBar}
      postProcessArgs={postProcessArgs}
      renderDisplay={renderDisplay}
    />
  );
}
