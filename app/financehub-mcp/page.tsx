'use client';

import { useCallback, useState } from 'react';
import {
  McpPlayground,
  playgroundStyles,
  type PlaygroundToolDef,
} from '@/components/mcp-playground';

const TOOLS: PlaygroundToolDef[] = [
  {
    name: 'financehub_list_banks',
    title: 'List banks',
    description: 'All registered banks and card companies with metadata.',
    category: 'overview',
    helperName: 'listBanks',
    fields: [],
  },
  {
    name: 'financehub_list_accounts',
    title: 'List accounts',
    description: 'Bank accounts with balances, optionally filtered by bank or active status.',
    category: 'accounts',
    helperName: 'listAccounts',
    fields: [
      { name: 'bankId', label: 'Bank ID', type: 'string', placeholder: 'shinhan, kookmin, bc-card…' },
      {
        name: 'isActive',
        label: 'Active only',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'financehub_query_transactions',
    title: 'Query transactions',
    description: 'Bank account transactions with filters, sort, and pagination.',
    category: 'accounts',
    helperName: 'queryBankTransactions',
    fields: [
      { name: 'bankId', label: 'Bank ID', type: 'string', placeholder: 'shinhan' },
      { name: 'accountId', label: 'Account ID', type: 'string' },
      { name: 'startDate', label: 'Start date', type: 'string', placeholder: '2025-01-01' },
      { name: 'endDate', label: 'End date', type: 'string', placeholder: '2025-12-31' },
      { name: 'searchText', label: 'Search text', type: 'string', placeholder: 'memo, counterparty…' },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { name: 'offset', label: 'Offset', type: 'number', defaultValue: 0 },
    ],
  },
  {
    name: 'financehub_query_card_transactions',
    title: 'Card transactions',
    description: 'Card-specific transactions with merchant and card filters.',
    category: 'accounts',
    helperName: 'queryCardTransactions',
    fields: [
      { name: 'cardCompanyId', label: 'Card company ID', type: 'string', placeholder: 'bc-card' },
      { name: 'merchantName', label: 'Merchant', type: 'string' },
      { name: 'startDate', label: 'Start date', type: 'string', placeholder: '2025-01-01' },
      { name: 'endDate', label: 'End date', type: 'string', placeholder: '2025-12-31' },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
    ],
  },
  {
    name: 'financehub_get_overall_stats',
    title: 'Overall stats',
    description: 'Aggregate balances and transaction counts across all accounts.',
    category: 'stats',
    helperName: 'getOverallStats',
    fields: [],
  },
  {
    name: 'financehub_get_monthly_summary',
    title: 'Monthly summary',
    description: 'Income/expense summary for a month.',
    category: 'stats',
    helperName: 'getMonthlySummary',
    fields: [
      { name: 'year', label: 'Year', type: 'number', required: true, defaultValue: 2025 },
      { name: 'month', label: 'Month (1–12)', type: 'number', required: true, defaultValue: 1 },
      { name: 'bankId', label: 'Bank ID (optional)', type: 'string' },
    ],
  },
  {
    name: 'financehub_list_hometax_connections',
    title: 'Hometax connections',
    description: 'Registered Hometax business connections.',
    category: 'hometax',
    helperName: 'listHometaxConnections',
    fields: [],
  },
  {
    name: 'financehub_query_tax_invoices',
    title: 'Tax invoices',
    description: 'Query electronic tax invoices (세금계산서).',
    category: 'hometax',
    helperName: 'queryTaxInvoices',
    fields: [
      { name: 'businessNumber', label: 'Business number', type: 'string' },
      { name: 'startDate', label: 'Start date', type: 'string', placeholder: '2025-01-01' },
      { name: 'endDate', label: 'End date', type: 'string', placeholder: '2025-12-31' },
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
    ],
  },
  {
    name: 'financehub_get_sync_history',
    title: 'Sync history',
    description: 'Recent bank sync runs and their status.',
    category: 'stats',
    helperName: 'getSyncHistory',
    fields: [
      { name: 'limit', label: 'Limit', type: 'number', defaultValue: 20 },
    ],
  },
];

const CATEGORIES = [
  { key: 'overview', label: 'Overview' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'stats', label: 'Statistics' },
  { key: 'hometax', label: 'Hometax' },
];

function renderRowsTable(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  label: string,
) {
  const { miniLabelStyle, tableWrapStyle, tableStyle, thStyle, tdStyle } = playgroundStyles;
  if (rows.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>No rows returned.</p>;
  }
  return (
    <div>
      <div style={miniLabelStyle}>{label} ({rows.length})</div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={thStyle}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((row, i) => (
              <tr key={i}>
                {columns.map(col => (
                  <td key={col.key} style={tdStyle}>
                    {String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 40 && (
        <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>
          Showing first 40 of {rows.length} — see raw JSON for full results.
        </p>
      )}
    </div>
  );
}

export default function FinanceHubPlayground() {
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const onResult = useCallback((tool: string, parsed: any) => {
    if (tool === 'financehub_list_banks' && Array.isArray(parsed?.banks) && parsed.banks[0]?.id) {
      setSelectedBankId(parsed.banks[0].id);
    }
  }, []);

  const getDefaultFieldValues = useCallback((tool: PlaygroundToolDef) => {
    if (!selectedBankId) return {};
    if (tool.fields.some(f => f.name === 'bankId')) {
      return { bankId: selectedBankId };
    }
    return {};
  }, [selectedBankId]);

  const renderDisplay = useCallback((data: any, tool: string) => {
    const { miniLabelStyle, tableWrapStyle, tableStyle, thStyle, tdStyle, inlineCodeStyle, secondaryBtnStyle, kvGridStyle, kvTermStyle, kvDescStyle } = playgroundStyles;

    if (Array.isArray(data?.banks)) {
      return (
        <div>
          {renderRowsTable(data.banks, [
            { key: 'id', label: 'ID' },
            { key: 'nameKo', label: 'Name' },
            { key: 'supportsAutomation', label: 'Automation' },
          ], 'Banks')}
          <div style={{ marginTop: 10 }}>
            {data.banks.slice(0, 8).map((bank: any) => (
              bank.id ? (
                <button
                  key={bank.id}
                  onClick={() => setSelectedBankId(bank.id)}
                  style={{ ...secondaryBtnStyle, fontSize: 12, padding: '3px 8px', marginRight: 6, marginBottom: 6 }}
                >
                  Use {bank.id}
                </button>
              ) : null
            ))}
          </div>
        </div>
      );
    }

    if (Array.isArray(data?.accounts)) {
      return renderRowsTable(data.accounts, [
        { key: 'bankId', label: 'Bank' },
        { key: 'accountName', label: 'Account' },
        { key: 'accountNumber', label: 'Number' },
        { key: 'balance', label: 'Balance' },
      ], 'Accounts');
    }

    if (Array.isArray(data?.transactions)) {
      return renderRowsTable(data.transactions, [
        { key: 'date', label: 'Date' },
        { key: 'description', label: 'Description' },
        { key: 'deposit', label: 'Deposit' },
        { key: 'withdrawal', label: 'Withdrawal' },
        { key: 'balance', label: 'Balance' },
      ], 'Transactions');
    }

    if (Array.isArray(data?.connections)) {
      return renderRowsTable(data.connections, [
        { key: 'businessNumber', label: 'Business #' },
        { key: 'businessName', label: 'Name' },
        { key: 'isActive', label: 'Active' },
      ], 'Hometax connections');
    }

    if (Array.isArray(data?.invoices)) {
      return renderRowsTable(data.invoices, [
        { key: 'issueDate', label: 'Date' },
        { key: 'supplierName', label: 'Supplier' },
        { key: 'totalAmount', label: 'Amount' },
      ], 'Tax invoices');
    }

    if (Array.isArray(data?.history)) {
      return renderRowsTable(data.history, [
        { key: 'bankId', label: 'Bank' },
        { key: 'status', label: 'Status' },
        { key: 'syncedAt', label: 'Synced' },
      ], 'Sync history');
    }

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const scalarEntries = Object.entries(data).filter(
        ([, v]) => v != null && typeof v !== 'object',
      );
      if (scalarEntries.length > 0) {
        return (
          <dl style={kvGridStyle}>
            {scalarEntries.map(([key, value]) => (
              <span key={key} style={{ display: 'contents' }}>
                <dt style={kvTermStyle}>{key}</dt>
                <dd style={kvDescStyle}>{String(value)}</dd>
              </span>
            ))}
          </dl>
        );
      }
    }

    if (selectedBankId) {
      return (
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Selected bank: <code style={inlineCodeStyle}>{selectedBankId}</code>
        </p>
      );
    }

    return null;
  }, [selectedBankId]);

  const sessionBar = (
    <div style={playgroundStyles.sessionBarStyle}>
      <div style={{ flex: 1 }}>
        <div style={playgroundStyles.miniLabelStyle}>Selected bank ID</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '4px 0 0' }}>
          {selectedBankId ? (
            <code style={playgroundStyles.inlineCodeStyle}>{selectedBankId}</code>
          ) : 'Run List banks and pick a bank ID to pre-fill filters'}
        </p>
      </div>
      <div style={playgroundStyles.sessionPillsStyle}>
        <span style={{
          ...playgroundStyles.statusBadgeStyle,
          background: '#fef3c7',
          color: '#92400e',
        }}>
          Read-only demo — no imports or deletes
        </span>
      </div>
    </div>
  );

  return (
    <McpPlayground
      currentHref="/financehub-mcp"
      eyebrow="EGDesk FinanceHub MCP"
      title="FinanceHub Playground"
      subtitle="Query Korean bank accounts, transactions, and Hometax data synced in EGDesk. Enable FinanceHub MCP and import data in the EGDesk app first."
      apiPath="/api/financehub"
      tools={TOOLS}
      categories={CATEGORIES}
      accentColor="#ca8a04"
      sessionBar={sessionBar}
      renderDisplay={renderDisplay}
      onResult={onResult}
      getDefaultFieldValues={getDefaultFieldValues}
    />
  );
}
