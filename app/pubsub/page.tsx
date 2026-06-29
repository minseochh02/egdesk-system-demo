'use client';

import type React from 'react';
import { useState, useEffect, useRef } from 'react';

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

// ── Page ────────────────────────────────────────────────────────────────────

export default function PubSubMobilePage() {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const notifId = useRef(0);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_EGDESK_API_URL || 'http://localhost:8080';
    const apiKey = process.env.NEXT_PUBLIC_EGDESK_API_KEY || '';
    const sseUrl = apiKey
      ? `${apiUrl}/user-data/sse?key=${encodeURIComponent(apiKey)}`
      : `${apiUrl}/user-data/sse`;

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('message', (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.method !== 'egdesk/user-data-changed') return;
        const evt: UserDataChangeEvent = msg.params;
        const id = ++notifId.current;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const table = evt.tableName || 'unknown';
        let title = 'Data changed';
        if (evt.action === 'insert') title = 'New order received';
        else if (evt.action === 'update') title = 'Order updated';
        else if (evt.action === 'delete') title = 'Order removed';
        else if (evt.action === 'create_table') title = 'Table created';
        setNotifications(prev => [{ id, title, body: `${evt.action} on "${table}"`, time, action: evt.action }, ...prev].slice(0, 50));
      } catch { /* ignore */ }
    });

    es.addEventListener('connected', () => setConnected(true));
    es.addEventListener('open', () => setConnected(true));
    es.addEventListener('error', () => setConnected(false));

    return () => { es.close(); };
  }, []);

  return (
    <div style={shellStyle}>
      {/* Status bar */}
      <div style={statusBarStyle}>
        <span style={{ fontWeight: 700 }}>
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...dotStyle, background: connected ? '#22c55e' : '#ef4444' }} />
          <span style={{ fontSize: 12, color: connected ? '#047857' : '#dc2626' }}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </span>
      </div>

      {/* Header */}
      <div style={headerStyle}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>Notifications</h1>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
          Real-time push via SSE from EGDesk
        </p>
      </div>

      {/* Notification list */}
      <div style={listStyle}>
        {notifications.length === 0 ? (
          <div style={emptyStyle}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#128276;</div>
            <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
              {connected ? 'Waiting for events…' : 'Connecting to EGDesk…'}
            </p>
            <p style={{ color: '#d1d5db', fontSize: 12, margin: '8px 0 0' }}>
              Insert data from the Database demo to see notifications here
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} style={notifStyle}>
              <div style={notifIconStyle(n.action)}>
                {n.action === 'insert' ? '+' : n.action === 'update' ? '~' : n.action === 'delete' ? '−' : '•'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{n.title}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: 8 }}>{n.time}</span>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{n.body}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const shellStyle: React.CSSProperties = {
  maxWidth: 420,
  margin: '0 auto',
  minHeight: '100vh',
  background: '#f9fafb',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const statusBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 20px',
  background: '#fff',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 13,
};

const dotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
};

const headerStyle: React.CSSProperties = {
  padding: '20px 20px 16px',
  background: '#fff',
  borderBottom: '1px solid #e5e7eb',
};

const listStyle: React.CSSProperties = {
  padding: '12px 16px',
  display: 'grid',
  gap: 10,
};

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '60px 20px',
};

const notifStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '14px 16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const notifIconStyle = (action: string): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  fontWeight: 700,
  flexShrink: 0,
  background: action === 'insert' ? '#ecfdf5' : action === 'delete' ? '#fef2f2' : '#eff6ff',
  color: action === 'insert' ? '#047857' : action === 'delete' ? '#dc2626' : '#2563eb',
});
