'use client';

import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, getEgdeskBasePath } from '@/lib/api';
import { getDemoNavLinks } from '@/lib/demo-pages';

// ── Types ───────────────────────────────────────────────────────────────────

interface UserDataChangeEvent {
  kind: 'schema' | 'data';
  action: 'create_table' | 'delete_table' | 'rename_table' | 'insert' | 'update' | 'delete';
  tableName?: string;
  tableId?: string;
  source?: 'mcp' | 'ipc' | 'sync' | 'import';
}

interface Notification {
  id: number;
  title: string;
  body: string;
  time: string;
  action: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function PubSubDemo() {
  const [basePath, setBasePath] = useState('');
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [orderName, setOrderName] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderStatus, setOrderStatus] = useState('pending');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    setBasePath(getEgdeskBasePath());
    connect();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const apiUrl = process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080';
    const es = new EventSource(`${apiUrl}/user-data/sse`);
    eventSourceRef.current = es;

    es.addEventListener('message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.method !== 'egdesk/user-data-changed') return;
        const event: UserDataChangeEvent = msg.params;

        const notif = buildNotification(event);
        if (notif) {
          setNotifications((prev) => [notif, ...prev].slice(0, 20));
        }
      } catch { /* ignore */ }
    });

    es.addEventListener('connected', () => setConnected(true));
    es.addEventListener('open', () => setConnected(true));
    es.addEventListener('error', () => setConnected(false));
  }, []);

  function buildNotification(event: UserDataChangeEvent): Notification | null {
    const id = ++idCounter.current;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const table = event.tableName || 'unknown';

    switch (event.action) {
      case 'insert':
        return { id, title: 'New order received', body: `A new row was added to "${table}".`, time, action: 'insert' };
      case 'update':
        return { id, title: 'Order updated', body: `A row in "${table}" was modified.`, time, action: 'update' };
      case 'delete':
        return { id, title: 'Order removed', body: `A row was deleted from "${table}".`, time, action: 'delete' };
      case 'create_table':
        return { id, title: 'Table created', body: `New table "${table}" was created.`, time, action: 'create_table' };
      default:
        return { id, title: `Data changed`, body: `${event.action} on "${table}".`, time, action: event.action };
    }
  }

  const handleSubmitOrder = async () => {
    if (!orderName.trim()) return;
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const res = await apiFetch('/__user_data_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'user_data_insert_rows',
          arguments: {
            tableName: 'orders',
            rows: [{
              customer_name: orderName.trim(),
              amount: orderAmount || '0',
              status: orderStatus,
              created_at: new Date().toISOString(),
            }],
          },
        }),
      });
      const data = await res.json();
      if (data?.success || data?.result) {
        setSubmitMessage('Order saved!');
        setOrderName('');
        setOrderAmount('');
      } else {
        setSubmitMessage(`Error: ${data?.error || 'Unknown'}`);
      }
    } catch (err: any) {
      setSubmitMessage(`Error: ${err.message}`);
    }
    setSubmitting(false);
  };

  const navLinks = getDemoNavLinks(basePath, '/pubsub');

  return (
    <main style={pageStyle}>
      <nav style={navStyle}>
        {navLinks.map((l) => (
          <a key={l.href} href={l.href} style={navLinkStyle}>{l.label}</a>
        ))}
      </nav>

      <h1 style={titleStyle}>Real-Time Pub/Sub</h1>
      <p style={descStyle}>
        Submit an order on the desktop — the mobile device receives a push notification instantly via SSE.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <span style={{ ...statusDot, background: connected ? '#10b981' : '#ef4444' }} />
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {connected ? 'SSE connected' : 'SSE disconnected'}
        </span>
      </div>

      {/* Split screen */}
      <div style={splitContainer}>
        {/* Desktop panel */}
        <div style={desktopFrame}>
          <div style={desktopTitleBar}>
            <div style={trafficLights}>
              <span style={{ ...dot, background: '#ff5f57' }} />
              <span style={{ ...dot, background: '#febc2e' }} />
              <span style={{ ...dot, background: '#28c840' }} />
            </div>
            <span style={desktopTitleText}>Admin Dashboard</span>
            <div style={{ width: 52 }} />
          </div>
          <div style={desktopContent}>
            <h3 style={panelTitle}>New Order</h3>
            <div style={formGroup}>
              <label style={labelStyle}>Customer Name</label>
              <input
                style={inputStyle}
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div style={formGroup}>
              <label style={labelStyle}>Amount</label>
              <input
                style={inputStyle}
                value={orderAmount}
                onChange={(e) => setOrderAmount(e.target.value)}
                placeholder="49900"
                type="number"
              />
            </div>
            <div style={formGroup}>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
              </select>
            </div>
            <button
              style={{ ...desktopBtn, opacity: submitting ? 0.6 : 1 }}
              onClick={handleSubmitOrder}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Order'}
            </button>
            {submitMessage && (
              <p style={{ fontSize: 13, marginTop: 8, color: submitMessage.startsWith('Error') ? '#ef4444' : '#10b981' }}>
                {submitMessage}
              </p>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div style={arrowContainer}>
          <div style={arrowLine} />
          <span style={arrowLabel}>SSE push</span>
        </div>

        {/* Mobile panel */}
        <div style={phoneFrame}>
          <div style={phoneNotch} />
          <div style={phoneScreen}>
            <div style={phoneStatusBar}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>9:41</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ fontSize: 10 }}>5G</span>
                <span style={{ fontSize: 10 }}>100%</span>
              </div>
            </div>
            <div style={phoneContent}>
              <h4 style={phoneTitle}>Notifications</h4>
              {notifications.length === 0 ? (
                <div style={emptyState}>
                  <span style={{ fontSize: 28 }}>&#128276;</span>
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
                    No notifications yet.<br />Submit an order to see one appear.
                  </p>
                </div>
              ) : (
                <div style={notifList}>
                  {notifications.map((n) => (
                    <div key={n.id} style={notifCard}>
                      <div style={notifIcon(n.action)}>
                        {n.action === 'insert' ? '＋' : n.action === 'update' ? '✎' : '✕'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={notifTitleStyle}>{n.title}</div>
                        <div style={notifBody}>{n.body}</div>
                      </div>
                      <span style={notifTime}>{n.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={phoneHomeBar} />
          </div>
        </div>
      </div>

      {/* Code example */}
      <section style={codeSection}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Usage in your app</h3>
        <pre style={codeBlockStyle}>{`import { onUserDataChanged } from './egdesk-helpers';

// Subscribe — fires on every insert/update/delete
const unsub = onUserDataChanged((event) => {
  if (event.action === 'insert' && event.tableName === 'orders') {
    showNotification('New order received!');
  }
});

// Cleanup when component unmounts
unsub();`}</pre>
      </section>
    </main>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  maxWidth: 1000,
  margin: '0 auto',
  padding: '32px 24px 64px',
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 24,
  fontSize: 13,
};

const navLinkStyle: React.CSSProperties = { color: '#2563eb', textDecoration: 'none' };

const titleStyle: React.CSSProperties = {
  fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8,
};

const descStyle: React.CSSProperties = {
  color: '#4b5563', fontSize: 15, lineHeight: 1.6, marginBottom: 16,
};

const statusDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
};

// Split layout
const splitContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  marginBottom: 40,
  flexWrap: 'wrap',
};

// Desktop frame
const desktopFrame: React.CSSProperties = {
  width: 380,
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  overflow: 'hidden',
};

const desktopTitleBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: '#f3f4f6',
  padding: '8px 12px',
  borderBottom: '1px solid #e5e7eb',
};

const trafficLights: React.CSSProperties = { display: 'flex', gap: 5 };

const dot: React.CSSProperties = { width: 10, height: 10, borderRadius: '50%' };

const desktopTitleText: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#6b7280',
};

const desktopContent: React.CSSProperties = { padding: 20 };

const panelTitle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 16,
};

const formGroup: React.CSSProperties = { marginBottom: 12 };

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
};

const desktopBtn: React.CSSProperties = {
  marginTop: 8,
  width: '100%',
  padding: '10px 0',
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
  background: '#2563eb',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};

// Arrow
const arrowContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

const arrowLine: React.CSSProperties = {
  width: 48,
  height: 2,
  background: 'linear-gradient(90deg, #2563eb, #8b5cf6)',
  position: 'relative',
};

const arrowLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6366f1',
  letterSpacing: 0.5,
};

// Phone frame
const phoneFrame: React.CSSProperties = {
  width: 260,
  height: 520,
  background: '#1f2937',
  borderRadius: 36,
  padding: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  position: 'relative',
};

const phoneNotch: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 80,
  height: 22,
  background: '#1f2937',
  borderRadius: '0 0 14px 14px',
  zIndex: 2,
};

const phoneScreen: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: '#f9fafb',
  borderRadius: 28,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const phoneStatusBar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 20px 6px',
  fontSize: 12,
  color: '#374151',
};

const phoneContent: React.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  overflowY: 'auto',
};

const phoneTitle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 12px 4px',
};

const emptyState: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '60%',
  gap: 8,
  textAlign: 'center',
};

const notifList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const notifCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '10px 12px',
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const iconColors: Record<string, string> = {
  insert: '#10b981',
  update: '#f59e0b',
  delete: '#ef4444',
  create_table: '#8b5cf6',
};

function notifIcon(action: string): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: (iconColors[action] || '#6b7280') + '18',
    color: iconColors[action] || '#6b7280',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  };
}

const notifTitleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2,
};

const notifBody: React.CSSProperties = {
  fontSize: 11, color: '#6b7280', lineHeight: 1.4,
};

const notifTime: React.CSSProperties = {
  fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap', marginTop: 2,
};

const phoneHomeBar: React.CSSProperties = {
  width: 100,
  height: 4,
  background: '#d1d5db',
  borderRadius: 2,
  margin: '8px auto 10px',
};

// Code section
const codeSection: React.CSSProperties = {
  padding: 20,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
};

const codeBlockStyle: React.CSSProperties = {
  padding: 16,
  background: '#1f2937',
  color: '#e5e7eb',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'monospace',
  lineHeight: 1.6,
  overflow: 'auto',
};
