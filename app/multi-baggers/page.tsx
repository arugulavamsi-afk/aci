'use client';

import { useState, useEffect, useRef } from 'react';
import { stocks as curatedStocks } from '@/lib/data/mockData';
import { getScoreColor } from '@/lib/utils';
import { Zap, Search, Plus, Loader2, X, ChevronRight, Star, Database, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { LiveQuote } from '@/lib/nse/types';
import { computeIscfScore, scoreToConviction } from '@/lib/nse/scoring';

type DbStatus = 'loading' | 'ok' | 'not_configured' | 'empty' | 'error';

// ── Multi-Bagger Potential Score (0–100) ─────────────────────────────────────
// Quality  40%  — ISCF score (7-factor compounder model)
// Growth   30%  — Revenue growth rate (actual monetisation of opportunity)
// Runway   20%  — Inverse market cap (smaller = more room left to 10x)
// Value    10%  — PEG ratio (not overpaying for the growth)

function computeMbScore(q: LiveQuote): number {
  const iscf = computeIscfScore(q);

  const qualityPts = Math.round((iscf / 100) * 40);

  const g = q.revenueGrowth ?? q.earningsGrowth;
  const growthPts =
    g == null ? 10
    : g >= 40  ? 30 : g >= 25 ? 24 : g >= 15 ? 18
    : g >= 8   ? 12 : g >= 0  ? 6  : 0;

  const mcCr = (q.marketCap ?? 0) / 1e7;
  const runwayPts =
    mcCr <= 0       ? 10
    : mcCr < 3000   ? 20 : mcCr < 15000 ? 16 : mcCr < 50000 ? 12
    : mcCr < 150000 ? 8  : 4;

  const pe = q.pe; const eg = q.earningsGrowth;
  let valPts = 5;
  if (pe && pe > 0 && eg && eg > 8) {
    const peg = pe / eg;
    valPts = peg < 0.5 ? 10 : peg < 1.0 ? 8 : peg < 1.5 ? 6 : peg < 2.5 ? 4 : 2;
  } else if (pe && pe > 0) {
    valPts = pe < 15 ? 9 : pe < 25 ? 7 : pe < 40 ? 5 : pe < 60 ? 3 : 2;
  }

  return Math.min(100, qualityPts + growthPts + runwayPts + valPts);
}

function mbTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '🚀 Strong Buy',     color: '#10b981' };
  if (score >= 65) return { label: '⭐ High Potential', color: '#d4a853' };
  if (score >= 50) return { label: '👀 Watch List',     color: '#f59e0b' };
  return               { label: '⏸ Low Potential',     color: '#6b7280' };
}

function computeMbComponents(q: LiveQuote) {
  const iscf       = computeIscfScore(q);
  const qualityPts = Math.round((iscf / 100) * 40);
  const g          = q.revenueGrowth ?? q.earningsGrowth;
  const growthPts  =
    g == null ? 10
    : g >= 40  ? 30 : g >= 25 ? 24 : g >= 15 ? 18
    : g >= 8   ? 12 : g >= 0  ? 6  : 0;
  const mcCr      = (q.marketCap ?? 0) / 1e7;
  const runwayPts =
    mcCr <= 0       ? 10
    : mcCr < 3000   ? 20 : mcCr < 15000 ? 16 : mcCr < 50000 ? 12
    : mcCr < 150000 ? 8  : 4;
  const pe = q.pe; const eg = q.earningsGrowth;
  let valPts = 5;
  if (pe && pe > 0 && eg && eg > 8) {
    const peg = pe / eg;
    valPts = peg < 0.5 ? 10 : peg < 1.0 ? 8 : peg < 1.5 ? 6 : peg < 2.5 ? 4 : 2;
  } else if (pe && pe > 0) {
    valPts = pe < 15 ? 9 : pe < 25 ? 7 : pe < 40 ? 5 : pe < 60 ? 3 : 2;
  }
  return { qualityPts, growthPts, runwayPts, valPts };
}

interface StockPoint {
  ticker: string;
  name: string;
  x: number;      // revenue growth %
  y: number;      // ISCF score
  mbScore: number;
  conviction: 'High' | 'Medium' | 'Low';
  quote: LiveQuote;
}

export default function MultiBaggerPage() {
  const [quotes, setQuotes]       = useState<Map<string, LiveQuote>>(new Map());
  const [loading, setLoading]     = useState(true);
  const [tickers, setTickers]     = useState<string[]>([]);
  const [dbStatus, setDbStatus]   = useState<DbStatus>('loading');
  const [dbTotal, setDbTotal]     = useState(0);

  // Add-ticker state
  const [showAdd, setShowAdd]     = useState(false);
  const [addInput, setAddInput]   = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from DB screener, fall back to curated stocks if DB not configured
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch('/api/nse/screener');
        const data = await res.json() as {
          dbConfigured: boolean; quotes: LiveQuote[]; total: number; error?: string;
        };

        if (data.dbConfigured && data.quotes.length > 0) {
          setDbStatus('ok');
          setDbTotal(data.total);
          setQuotes(new Map(data.quotes.map(q => [q.symbol, q])));
          setTickers(data.quotes.map(q => q.symbol));
        } else if (!data.dbConfigured) {
          // DB not set up — fall back to curated stocks
          setDbStatus('not_configured');
          const r2  = await fetch(`/api/nse/quotes?symbols=${curatedStocks.map(s => s.ticker).join(',')}`);
          const d2  = await r2.json() as { quotes: LiveQuote[] };
          const q   = d2.quotes ?? [];
          setQuotes(new Map(q.map(item => [item.symbol, item])));
          setTickers(q.map(item => item.symbol));
        } else {
          // DB configured but empty (not yet populated)
          setDbStatus('empty');
          const r2  = await fetch(`/api/nse/quotes?symbols=${curatedStocks.map(s => s.ticker).join(',')}`);
          const d2  = await r2.json() as { quotes: LiveQuote[] };
          const q   = d2.quotes ?? [];
          setQuotes(new Map(q.map(item => [item.symbol, item])));
          setTickers(q.map(item => item.symbol));
        }
      } catch {
        setDbStatus('error');
        // Still try curated stocks
        try {
          const r2 = await fetch(`/api/nse/quotes?symbols=${curatedStocks.map(s => s.ticker).join(',')}`);
          const d2 = await r2.json() as { quotes: LiveQuote[] };
          const q  = d2.quotes ?? [];
          setQuotes(new Map(q.map(item => [item.symbol, item])));
          setTickers(q.map(item => item.symbol));
        } catch { /* nothing */ }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (showAdd) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showAdd]);

  const addTicker = async () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym || tickers.includes(sym)) { setAddError(tickers.includes(sym) ? 'Already added' : ''); return; }
    setAddLoading(true); setAddError('');
    try {
      const res  = await fetch(`/api/nse/quotes?symbols=${sym}`);
      const data = await res.json();
      const q: LiveQuote | undefined = data.quotes?.[0];
      if (!q || q.cmp === 0) { setAddError(`"${sym}" not found`); return; }
      setTickers(prev => [...prev, sym]);
      setQuotes(prev => new Map(prev).set(sym, q));
      setAddInput(''); setShowAdd(false);
    } catch { setAddError('Network error'); }
    finally { setAddLoading(false); }
  };

  // Build points from live quotes
  const points: StockPoint[] = tickers
    .map(ticker => {
      const q = quotes.get(ticker);
      if (!q || q.cmp === 0) return null;
      const iscf = computeIscfScore(q);
      const g    = q.revenueGrowth ?? q.earningsGrowth ?? 0;
      const mcCr = (q.marketCap ?? 0) / 1e7;
      return {
        ticker,
        name:       q.name || ticker,
        x:          Math.round(g * 10) / 10,
        y:          iscf,
        mbScore:    computeMbScore(q),
        conviction: scoreToConviction(iscf),
        quote:      q,
      } as StockPoint;
    })
    .filter(Boolean) as StockPoint[];

  const sorted    = [...points].sort((a, b) => b.mbScore - a.mbScore);
  const mbZone    = points.filter(p => p.x >= 15 && p.y >= 75);
  const avgGrowth = points.length > 0
    ? Math.round(points.reduce((s, p) => s + p.x, 0) / points.length)
    : 0;
  const topScore  = sorted[0]?.mbScore ?? 0;

  const convColor = (c: string) =>
    c === 'High' ? '#10b981' : c === 'Medium' ? '#f59e0b' : '#ef4444';

  return (
    <div className="p-6 bg-mesh min-h-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #10b981, #d4a853)' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#10b981', fontSize: '10.5px', letterSpacing: '0.14em' }}>
              Multi-Bagger Radar
            </span>
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>Potential Multi-Baggers</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
            Quality × Growth × Runway — auto-screened from{' '}
            {dbStatus === 'ok'
              ? <span style={{ color: '#10b981' }}>{dbTotal.toLocaleString()} NSE stocks</span>
              : <span>the NSE universe</span>}
            {' '}for the highest 5–10x compounding potential
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost text-xs" onClick={() => setShowAdd(v => !v)}>
            {showAdd ? <X size={12} /> : <Plus size={12} />}
            {showAdd ? 'Cancel' : 'Add Ticker'}
          </button>
          <Link href="/discovery" className="btn-primary text-xs">
            <Search size={12} /> Full Screener
          </Link>
        </div>
      </div>

      {/* DB status banner */}
      {dbStatus === 'ok' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <Database size={13} style={{ color: '#10b981' }} />
          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.6)' }}>
            Screening <strong style={{ color: '#10b981' }}>{dbTotal.toLocaleString()} NSE stocks</strong> from the live database — ranked by Multi-Bagger Potential Score
          </span>
        </div>
      )}
      {dbStatus === 'not_configured' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.6)' }}>
            Showing <strong style={{ color: '#f59e0b' }}>10 curated stocks</strong> — database not set up yet.{' '}
            <Link href="/admin/stocks" className="underline" style={{ color: '#f59e0b' }}>Set up Postgres</Link>
            {' '}to screen the full NSE universe of 5,000+ stocks.
          </span>
        </div>
      )}
      {dbStatus === 'empty' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.6)' }}>
            Database is configured but not yet populated.{' '}
            <Link href="/admin/stocks" className="underline" style={{ color: '#f59e0b' }}>Run the stock refresh</Link>
            {' '}to populate it, then come back for the full NSE screen.
          </span>
        </div>
      )}

      {/* Add ticker panel */}
      {showAdd && (
        <div className="glass-card p-4" style={{ borderColor: 'rgba(16,185,129,0.2)' }}>
          <p className="text-xs mb-3" style={{ color: 'rgba(232,236,244,0.5)' }}>
            Add any NSE ticker to the multi-bagger analysis
          </p>
          <div className="flex items-center gap-3">
            <input ref={inputRef} value={addInput}
              onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') addTicker(); if (e.key === 'Escape') setShowAdd(false); }}
              placeholder="NSE TICKER (e.g. RELIANCE)"
              className="premium-input flex-1 font-mono tracking-wider" style={{ fontSize: '13px' }} />
            <button onClick={addTicker} disabled={addLoading || !addInput.trim()} className="btn-primary text-xs px-4 py-2.5">
              {addLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Analyze
            </button>
          </div>
          {addError && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{addError}</p>}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Stocks Analyzed',    value: loading ? '…' : points.length,    color: '#2bb5d4',  sub: `${tickers.length} tickers loaded` },
          { label: 'In Multi-Bagger Zone', value: loading ? '…' : mbZone.length,  color: '#10b981',  sub: 'ISCF ≥ 75 + Growth ≥ 15%' },
          { label: 'Avg Revenue Growth', value: loading ? '…' : `${avgGrowth}%`,  color: '#d4a853',  sub: 'YoY across universe' },
          { label: 'Top MB Score',       value: loading ? '…' : topScore,          color: '#8b5cf6',  sub: sorted[0]?.ticker ?? '—' },
        ].map(k => (
          <div key={k.label} className="glass-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>{k.label}</div>
            <div className="text-3xl font-black metric-number" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Opportunity Landscape + leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stacked score breakdown chart */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>Opportunity Landscape</h2>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
                MB score composition — see exactly what drives each ranking
              </p>
            </div>
            {loading && <Loader2 size={14} className="animate-spin" style={{ color: 'rgba(232,236,244,0.3)' }} />}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mb-5 mt-3 flex-wrap">
            {[
              { color: '#d4a853', label: 'Quality', pct: '40%' },
              { color: '#10b981', label: 'Growth',  pct: '30%' },
              { color: '#0c7b93', label: 'Runway',  pct: '20%' },
              { color: '#8b5cf6', label: 'Value',   pct: '10%' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
                <span className="text-xs" style={{ color: 'rgba(232,236,244,0.5)', fontSize: '11px' }}>
                  {l.label} <span style={{ color: 'rgba(232,236,244,0.25)' }}>{l.pct}</span>
                </span>
              </div>
            ))}
            <div className="ml-auto text-xs" style={{ color: 'rgba(232,236,244,0.2)', fontSize: '10px' }}>
              bar width = score out of 100
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2" style={{ color: 'rgba(232,236,244,0.3)' }}>
              <Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-xs" style={{ color: 'rgba(232,236,244,0.25)' }}>
              No stocks loaded
            </div>
          ) : (
            <div className="space-y-1.5">
              {sorted.slice(0, 20).map((p, i) => {
                const comps    = computeMbComponents(p.quote);
                const tier     = mbTier(p.mbScore);
                const iscfColor = getScoreColor(p.y);
                const mcCr     = (p.quote.marketCap ?? 0) / 1e7;
                const mcLabel  = mcCr > 0 ? (mcCr >= 100000 ? `₹${(mcCr / 100000).toFixed(1)}L Cr` : `₹${Math.round(mcCr).toLocaleString()} Cr`) : '—';
                return (
                  <div
                    key={p.ticker}
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 cursor-pointer transition-colors duration-150"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    onClick={() => { window.location.href = `/company/${p.ticker.toLowerCase()}`; }}
                  >
                    {/* Rank */}
                    <span className="w-5 text-right text-xs font-black flex-shrink-0"
                      style={{ color: i < 3 ? tier.color : 'rgba(232,236,244,0.2)', fontSize: '11px' }}>
                      {i + 1}
                    </span>

                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black flex-shrink-0"
                      style={{ background: `${iscfColor}18`, color: iscfColor, fontSize: '10px', border: `1px solid ${iscfColor}22` }}>
                      {p.ticker.slice(0, 2)}
                    </div>

                    {/* Ticker + cap */}
                    <div className="w-28 flex-shrink-0">
                      <div className="font-bold truncate" style={{ color: '#e8ecf4', fontSize: '12.5px' }}>{p.ticker}</div>
                      <div className="truncate" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>{mcLabel}</div>
                    </div>

                    {/* Stacked bar */}
                    <div className="flex-1 h-5 rounded-lg overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {comps.qualityPts > 0 && (
                        <div title={`Quality: ${comps.qualityPts}pts`}
                          style={{ width: `${comps.qualityPts}%`, background: 'rgba(212,168,83,0.8)', borderRight: '1px solid rgba(0,0,0,0.25)' }} />
                      )}
                      {comps.growthPts > 0 && (
                        <div title={`Growth: ${comps.growthPts}pts`}
                          style={{ width: `${comps.growthPts}%`, background: 'rgba(16,185,129,0.8)', borderRight: '1px solid rgba(0,0,0,0.25)' }} />
                      )}
                      {comps.runwayPts > 0 && (
                        <div title={`Runway: ${comps.runwayPts}pts`}
                          style={{ width: `${comps.runwayPts}%`, background: 'rgba(12,123,147,0.8)', borderRight: '1px solid rgba(0,0,0,0.25)' }} />
                      )}
                      {comps.valPts > 0 && (
                        <div title={`Value: ${comps.valPts}pts`}
                          style={{ width: `${comps.valPts}%`, background: 'rgba(139,92,246,0.8)' }} />
                      )}
                    </div>

                    {/* Growth % pill */}
                    <div className="w-14 text-right flex-shrink-0">
                      <span className="text-xs font-bold metric-number"
                        style={{ color: p.x >= 20 ? '#10b981' : p.x >= 8 ? '#f59e0b' : p.x >= 0 ? 'rgba(232,236,244,0.4)' : '#ef4444', fontSize: '11px' }}>
                        {p.x > 0 ? '+' : ''}{p.x}%
                      </span>
                    </div>

                    {/* Score */}
                    <div className="w-8 text-right flex-shrink-0">
                      <span className="font-black metric-number" style={{ color: tier.color, fontSize: '14px' }}>{p.mbScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="glass-card p-5">
          <h2 className="font-bold text-base mb-1" style={{ color: '#e8ecf4' }}>MB Leaderboard</h2>
          <p className="text-xs mb-4" style={{ color: 'rgba(232,236,244,0.4)' }}>Top candidates by MB Potential Score</p>

          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2" style={{ color: 'rgba(232,236,244,0.3)' }}>
              <Loader2 size={14} className="animate-spin" /><span className="text-xs">Loading…</span>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.slice(0, 8).map((p, i) => {
                const tier = mbTier(p.mbScore);
                const iscfColor = getScoreColor(p.y);
                return (
                  <Link key={p.ticker} href={`/company/${p.ticker.toLowerCase()}`}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group"
                    style={{ background: i === 0 ? `${tier.color}08` : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? `${tier.color}15` : 'rgba(255,255,255,0.04)'}` }}>

                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{ background: i < 3 ? `${tier.color}18` : 'rgba(255,255,255,0.05)', color: i < 3 ? tier.color : 'rgba(232,236,244,0.3)' }}>
                      {i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate" style={{ color: '#e8ecf4' }}>{p.ticker}</span>
                        {i === 0 && <Star size={9} fill="#d4a853" color="#d4a853" />}
                      </div>
                      <div className="text-xs truncate" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>
                        ISCF {p.y} · {p.x > 0 ? '+' : ''}{p.x}% growth
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-black metric-number text-base" style={{ color: tier.color }}>{p.mbScore}</div>
                      <div className="text-xs" style={{ color: 'rgba(232,236,244,0.25)', fontSize: '9px' }}>/100</div>
                    </div>

                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: 'rgba(232,236,244,0.3)' }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Full ranked table */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>Full Rankings</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
              All {sorted.length} stocks ranked by Multi-Bagger Potential Score
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left w-8">#</th>
                <th className="text-left">Stock</th>
                <th className="text-center">MB Score</th>
                <th className="text-center">ISCF</th>
                <th className="text-right">Rev Growth</th>
                <th className="text-right">Market Cap</th>
                <th className="text-right">P/E</th>
                <th className="text-right">ROE</th>
                <th className="text-center">Conviction</th>
                <th className="text-center">Tier</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const tier = mbTier(p.mbScore);
                const iscfColor = getScoreColor(p.y);
                const convColor2 = convColor(p.conviction);
                const mcCr = (p.quote.marketCap ?? 0) / 1e7;
                const mcLabel = p.quote.marketCapLabel || (mcCr > 0 ? `₹${Math.round(mcCr).toLocaleString()} Cr` : '—');

                return (
                  <tr key={p.ticker} className="cursor-pointer"
                    onClick={() => { window.location.href = `/company/${p.ticker.toLowerCase()}`; }}>
                    <td>
                      <span className="text-xs font-bold" style={{ color: i < 3 ? tier.color : 'rgba(232,236,244,0.25)' }}>{i + 1}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black flex-shrink-0"
                          style={{ background: `${iscfColor}18`, color: iscfColor, border: `1px solid ${iscfColor}25`, fontSize: '10px' }}>
                          {p.ticker.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold" style={{ color: '#e8ecf4', fontSize: '13px' }}>{p.ticker}</div>
                          <div className="text-xs truncate max-w-[120px]" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>
                            {p.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-black metric-number text-base" style={{ color: tier.color }}>{p.mbScore}</span>
                        <div className="w-12 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${p.mbScore}%`, background: `linear-gradient(90deg, ${tier.color}60, ${tier.color})` }} />
                        </div>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className="font-bold metric-number" style={{ color: iscfColor }}>{p.y}</span>
                    </td>
                    <td className="text-right">
                      <span className="font-bold metric-number" style={{ color: p.x >= 20 ? '#10b981' : p.x >= 8 ? '#f59e0b' : '#ef4444' }}>
                        {p.x > 0 ? '+' : ''}{p.x}%
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-sm metric-number" style={{ color: 'rgba(232,236,244,0.6)' }}>{mcLabel}</span>
                    </td>
                    <td className="text-right">
                      <span className="metric-number" style={{ color: 'rgba(232,236,244,0.6)' }}>
                        {p.quote.pe ? `${p.quote.pe.toFixed(1)}x` : '—'}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="metric-number" style={{ color: (p.quote.roe ?? 0) >= 18 ? '#10b981' : '#f59e0b' }}>
                        {p.quote.roe != null ? `${p.quote.roe.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="badge" style={{ background: `${convColor2}12`, color: convColor2, border: `1px solid ${convColor2}20`, fontSize: '9.5px' }}>
                        {p.conviction}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-xs" style={{ color: tier.color, fontSize: '10.5px' }}>{tier.label}</span>
                    </td>
                    <td>
                      <ChevronRight size={13} style={{ color: 'rgba(232,236,244,0.2)' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology */}
      <div className="glass-card p-6" style={{ borderColor: 'rgba(212,168,83,0.1)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} style={{ color: '#d4a853' }} />
          <h2 className="font-bold text-sm" style={{ color: '#d4a853' }}>MB Score Methodology</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Quality', weight: '40%', desc: 'ISCF 7-factor score (tailwind, management, financial, moat, revenue, growth, valuation)', color: '#d4a853' },
            { label: 'Growth',  weight: '30%', desc: 'Revenue growth rate — proves the opportunity is monetising; >25% earns full marks', color: '#10b981' },
            { label: 'Runway',  weight: '20%', desc: 'Inverse market cap — small/mid caps (₹3K–15K Cr) score highest; mega-caps penalised', color: '#0c7b93' },
            { label: 'Value',   weight: '10%', desc: 'PEG ratio (PE ÷ earnings growth) when growth >8%; absolute PE as fallback', color: '#8b5cf6' },
          ].map(m => (
            <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${m.color}15` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm" style={{ color: m.color }}>{m.label}</span>
                <span className="text-xs font-black metric-number" style={{ color: m.color }}>{m.weight}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.45)', fontSize: '11px' }}>{m.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs mt-4" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '11px' }}>
          ⚠ For research purposes only. Past multi-bagger performance does not guarantee future returns. Always do your own due diligence.
        </p>
      </div>
    </div>
  );
}
