'use client';

import { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface DbStats {
  count: number;
  lastUpdated: string | null;
  source: string;
}

interface RefreshResult {
  ok?: boolean;
  error?: string;
  symbols?: number;
  fetched?: number;
  upserted?: number;
  elapsed?: string;
}

export default function StocksAdminPage() {
  const [stats, setStats]     = useState<DbStats | null>(null);
  const [setting, setSetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult]   = useState<RefreshResult | null>(null);

  useEffect(() => {
    fetch('/api/stocks')
      .then(r => r.json())
      .then(d => setStats({ count: d.count ?? 0, lastUpdated: d.lastUpdated ?? null, source: d.source }))
      .catch(() => setStats({ count: 0, lastUpdated: null, source: 'error' }));
  }, []);

  async function setupDb() {
    setSetting(true);
    try {
      const r = await fetch('/api/admin/setup-db', { method: 'POST' });
      const d = await r.json();
      setResult(d.ok ? { ok: true } : { error: d.error });
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setSetting(false);
    }
  }

  async function runRefresh() {
    setRefreshing(true);
    setResult(null);
    try {
      const r = await fetch('/api/admin/run-refresh', { method: 'POST' });
      const d = await r.json();
      setResult(d);
      // Re-fetch stats
      const s = await fetch('/api/stocks').then(x => x.json());
      setStats({ count: s.count ?? 0, lastUpdated: s.lastUpdated ?? null, source: s.source });
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="p-6 bg-mesh min-h-full max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7b93, #10b981)' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#0c7b93', fontSize: '10.5px' }}>
            Admin
          </span>
        </div>
        <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>Stock Database</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
          Manage the Postgres cache for NSE + BSE stock data
        </p>
      </div>

      {/* DB Stats */}
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Database size={16} style={{ color: '#0c7b93' }} />
          <span className="font-semibold text-sm" style={{ color: '#e8ecf4' }}>Database Status</span>
        </div>
        {stats === null ? (
          <div className="flex items-center gap-2" style={{ color: 'rgba(232,236,244,0.4)' }}>
            <Loader2 size={14} className="animate-spin" /> Checking…
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Stocks in DB',   value: stats.count > 0 ? stats.count.toLocaleString() : '—' },
              { label: 'Last Refreshed', value: stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never' },
              { label: 'Source',         value: stats.source === 'db' ? 'Postgres' : stats.source === 'none' ? 'Not configured' : 'Error' },
            ].map(m => (
              <div key={m.label} className="text-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="font-bold text-sm" style={{ color: '#e8ecf4' }}>{m.value}</div>
                <div style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="glass-card p-5 mb-4">
        <p className="text-xs mb-4" style={{ color: 'rgba(232,236,244,0.5)' }}>
          Run these steps in order the first time. After initial setup, the nightly cron handles refreshes automatically.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="font-semibold text-sm" style={{ color: '#e8ecf4' }}>Step 1 — Create Schema</div>
              <div style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px' }}>Creates the stock_data table if it doesn't exist</div>
            </div>
            <button onClick={setupDb} disabled={setting} className="btn-ghost text-xs flex items-center gap-1.5">
              {setting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              {setting ? 'Running…' : 'Run'}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div className="font-semibold text-sm" style={{ color: '#e8ecf4' }}>Step 2 — Populate Database</div>
              <div style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px' }}>Fetches all NSE + BSE stocks from Yahoo Finance and stores to DB (~1–2 min)</div>
            </div>
            <button onClick={runRefresh} disabled={refreshing} className="btn-primary text-xs flex items-center gap-1.5">
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {refreshing ? 'Fetching…' : 'Populate'}
            </button>
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="glass-card p-4" style={{
          borderColor: result.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
          background: result.ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: '1px solid',
        }}>
          <div className="flex items-center gap-2 mb-2">
            {result.ok
              ? <CheckCircle size={14} color="#10b981" />
              : <AlertCircle size={14} color="#ef4444" />}
            <span className="font-semibold text-sm" style={{ color: result.ok ? '#10b981' : '#ef4444' }}>
              {result.ok ? 'Success' : 'Error'}
            </span>
          </div>
          {result.ok && result.upserted != null && (
            <p className="text-xs" style={{ color: 'rgba(232,236,244,0.6)' }}>
              {result.symbols?.toLocaleString()} symbols → {result.fetched?.toLocaleString()} fetched → {result.upserted?.toLocaleString()} upserted in {result.elapsed}
            </p>
          )}
          {result.error && (
            <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{result.error}</p>
          )}
        </div>
      )}

      {/* Cron info */}
      <p className="text-xs mt-4" style={{ color: 'rgba(232,236,244,0.25)' }}>
        Automatic refresh: every night at 12:30 AM IST via Vercel Cron (vercel.json).
        Requires Vercel Pro for functions over 60s — set <code>CRON_SECRET</code> env var to protect the endpoint.
      </p>
    </div>
  );
}
