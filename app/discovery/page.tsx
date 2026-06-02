'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { stocks as curatedStocks } from '@/lib/data/mockData';
import { getScoreColor, getScoreLabel } from '@/lib/utils';
import {
  Search, Filter, TrendingUp, TrendingDown, Star, ChevronRight,
  SlidersHorizontal, ChevronLeft, Loader2, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import ScoreGauge from '@/components/ui/ScoreGauge';
import type { LiveQuote, StockFundamentals } from '@/lib/nse/types';
import { computeIscfScore, scoreToConviction } from '@/lib/nse/scoring';
import { tailwindConfig } from '@/lib/nse/tailwindConfig';
import { govIntelligence } from '@/lib/nse/govIntelligence';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DisplayStock {
  quote: LiveQuote;
  name: string;
  watchlisted: boolean;
  isCurated: boolean;
  tailwindThemes: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SECTORS = [
  'All', 'Technology', 'Financial Services', 'Industrials', 'Basic Materials',
  'Consumer Cyclical', 'Consumer Defensive', 'Healthcare', 'Energy',
  'Utilities', 'Communication Services', 'Real Estate',
];
const CONVICTIONS = ['All', 'High', 'Medium', 'Low'];
const SORT_OPTIONS = [
  { value: 'score',     label: 'ISCF Score' },
  { value: 'marketCap', label: 'Market Cap' },
  { value: 'changePct', label: 'Day Change' },
  { value: 'pe',        label: 'PE Ratio' },
] as const;
const PAGE_SIZE  = 50;
const BATCH_SIZE = 400;

const curatedMap = new Map(curatedStocks.map(s => [s.ticker, s]));

function quoteToDisplay(q: LiveQuote): DisplayStock {
  const curated = curatedMap.get(q.symbol);
  return {
    quote: q,
    name: q.name || curated?.name || q.symbol,
    watchlisted: curated?.watchlisted ?? false,
    isCurated: !!curated,
    tailwindThemes: curated?.tailwindThemes ?? [],
  };
}

// Stub for stocks not yet returned by Yahoo Finance
function symbolToStub(symbol: string, name: string, exchange: 'NSE' | 'BSE' = /^\d+$/.test(symbol) ? 'BSE' : 'NSE'): DisplayStock {
  const curated = curatedMap.get(symbol);
  const stub: LiveQuote = {
    symbol, name: name || curated?.name || symbol,
    exchange,
    cmp: 0, change: 0, changePct: 0,
    marketCap: null, marketCapLabel: '—',
    pe: null, forwardPe: null, pb: null,
    roe: null, operatingMargin: null, grossMargin: null, profitMargin: null,
    revenueGrowth: null, earningsGrowth: null, debtEquity: null,
    insiderHolding: null, roce: null, operatingCashFlow: null,
    sector: curated?.sector ?? '', industry: curated?.industry ?? '',
    week52High: 0, week52Low: 0, volume: 0,
  };
  return {
    quote: stub,
    name: stub.name,
    watchlisted: curated?.watchlisted ?? false,
    isCurated: !!curated,
    tailwindThemes: curated?.tailwindThemes ?? [],
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DiscoveryPage() {
  const [allStocks, setAllStocks]       = useState<DisplayStock[]>([]);
  const [fundamentals, setFundamentals] = useState<Map<string, StockFundamentals>>(new Map());
  const [loadingSymbols, setLoadingSymbols] = useState(true);
  const [loadedBatches, setLoadedBatches]   = useState(0);
  const [totalBatches, setTotalBatches]     = useState(0);
  const [error, setError]               = useState<string | null>(null);

  const [search, setSearch]       = useState('');
  const [sector, setSector]       = useState('All');
  const [conviction, setConviction] = useState('All');
  const [minScore, setMinScore]   = useState(0);
  const [sortBy, setSortBy]       = useState<'score' | 'marketCap' | 'changePct' | 'pe'>('marketCap');
  const [view, setView]           = useState<'table' | 'grid'>('table');
  const [page, setPage]           = useState(1);

  const abortRef     = useRef<AbortController | null>(null);
  const fundAbortRef = useRef<AbortController | null>(null);
  const fetchedRef   = useRef<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoadingSymbols(true);
    setError(null);
    setAllStocks([]);
    setFundamentals(new Map());
    fetchedRef.current.clear();
    setLoadedBatches(0);
    setTotalBatches(0);
    setPage(1);

    try {
      // ── Fast path: read from Postgres cache (single query, instant) ──────────
      const dbRes = await fetch('/api/stocks', { signal });
      if (dbRes.ok) {
        const { quotes } = await dbRes.json() as { quotes: LiveQuote[] };
        if (quotes.length > 0) {
          setAllStocks(quotes.map(quoteToDisplay));
          setLoadingSymbols(false);
          return;
        }
      }

      // ── Fallback: live Yahoo Finance batching (DB empty or not configured) ───
      // Step 1: fetch combined NSE + BSE-only symbol list; seed all as stubs immediately
      const symRes = await fetch('/api/symbols', { signal });
      if (!symRes.ok) throw new Error(`Symbol fetch failed: ${symRes.status}`);
      const { symbols } = await symRes.json() as { symbols: { symbol: string; name: string; exchange: 'NSE' | 'BSE' }[] };
      setLoadingSymbols(false);

      // Curated stocks first, then the rest — seed ALL as stubs so count is correct immediately
      const restSymbols = symbols.filter(s => !curatedMap.has(s.symbol));
      const allSymbols: { symbol: string; name: string; exchange: 'NSE' | 'BSE' }[] = [
        ...curatedStocks.map(s => ({ symbol: s.ticker, name: s.name, exchange: 'NSE' as const })),
        ...restSymbols,
      ];

      // Seed table with stub entries for every symbol right away
      setAllStocks(allSymbols.map(s => symbolToStub(s.symbol, s.name, s.exchange)));

      const ordered = allSymbols.map(s => s.symbol);

      // Step 2: batch quotes — update stubs with live data as each batch returns
      const batches: string[][] = [];
      for (let i = 0; i < ordered.length; i += BATCH_SIZE) batches.push(ordered.slice(i, i + BATCH_SIZE));
      setTotalBatches(batches.length);

      for (let b = 0; b < batches.length; b++) {
        if (signal.aborted) break;
        try {
          const r = await fetch(`/api/nse/quotes?symbols=${batches[b].join(',')}`, { signal });
          if (!r.ok) continue;
          const { quotes } = await r.json() as { quotes: LiveQuote[] };
          setAllStocks(prev => {
            const map = new Map(prev.map(s => [s.quote.symbol, s]));
            // Update only symbols Yahoo Finance returned; stubs for the rest remain
            quotes.map(quoteToDisplay).forEach(d => map.set(d.quote.symbol, d));
            return Array.from(map.values());
          });
          setLoadedBatches(b + 1);
        } catch { /* skip failed batch */ }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(String(err));
    } finally {
      setLoadingSymbols(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => abortRef.current?.abort();
  }, [loadData]);

  // Silently fetch fundamentals (ROE, margins) for visible page — doesn't block scores
  const fetchFundamentals = useCallback((symbols: string[]) => {
    const missing = symbols.filter(s => !fetchedRef.current.has(s));
    if (missing.length === 0) return;
    missing.forEach(s => fetchedRef.current.add(s));

    fundAbortRef.current?.abort();
    fundAbortRef.current = new AbortController();
    const { signal } = fundAbortRef.current;

    Promise.allSettled(
      missing.map(async sym => {
        try {
          const r = await fetch(`/api/nse/stock/${sym}`, { signal });
          if (!r.ok) return;
          const { fundamentals: fd } = await r.json() as { fundamentals: StockFundamentals };
          setFundamentals(prev => new Map(prev).set(sym, fd));
        } catch { /* silent */ }
      })
    );
  }, []);

  useEffect(() => {
    if (pageStocks.length > 0) fetchFundamentals(pageStocks.map(s => s.quote.symbol));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, allStocks.length]);

  // ── Filtering & sorting ────────────────────────────────────────────────────

  const filtered = allStocks
    .filter(s => {
      const q = s.quote;
      if (search) {
        const lq = search.toLowerCase();
        if (!s.name.toLowerCase().includes(lq) && !q.symbol.toLowerCase().includes(lq)) return false;
      }
      if (sector !== 'All' && q.sector !== sector) return false;
      const score = computeIscfScore(q);
      if (minScore > 0 && score < minScore) return false;
      if (conviction !== 'All' && scoreToConviction(score) !== conviction) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score')     return computeIscfScore(b.quote) - computeIscfScore(a.quote);
      if (sortBy === 'marketCap') return (b.quote.marketCap ?? 0) - (a.quote.marketCap ?? 0);
      if (sortBy === 'changePct') return b.quote.changePct - a.quote.changePct;
      if (sortBy === 'pe') {
        const pa = a.quote.pe && a.quote.pe > 0 ? a.quote.pe : Infinity;
        const pb = b.quote.pe && b.quote.pe > 0 ? b.quote.pe : Infinity;
        return pa - pb;
      }
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStocks = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isLoading = loadingSymbols || (totalBatches > 0 && loadedBatches < totalBatches);
  const progress  = totalBatches > 0 ? Math.round((loadedBatches / totalBatches) * 100) : 0;

  return (
    <div className="p-6 bg-mesh min-h-full">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #0c7b93, #10b981)' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#0c7b93', fontSize: '10.5px', letterSpacing: '0.14em' }}>
            Stock Discovery
          </span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>Compounder Screener</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
              {allStocks.length > 0
                ? `${allStocks.length.toLocaleString()} NSE stocks · ${filtered.length.toLocaleString()} matching`
                : 'Loading NSE universe…'}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853', border: '1px solid rgba(212,168,83,0.2)', fontSize: '10.5px' }}>
                Tailwind: {tailwindConfig.budgetYear}
              </span>
              <span className="text-xs" style={{ color: 'rgba(232,236,244,0.25)', fontSize: '10px' }}>
                Updated {tailwindConfig.lastUpdated} · <a href="/admin/tailwind" className="underline" style={{ color: 'rgba(212,168,83,0.5)' }}>Refresh</a>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.15)', fontSize: '10.5px' }}>
                Gov Intel: {govIntelligence.lastUpdated}
              </span>
              <a href="/admin/gov-intelligence" className="text-xs underline" style={{ color: 'rgba(16,185,129,0.5)', fontSize: '10px' }}>Refresh</a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(12,123,147,0.12)', color: '#2bb5d4' }}>
                <Loader2 size={11} className="animate-spin" />
                {progress}%
              </div>
            )}
            <button onClick={loadData} disabled={isLoading} className="btn-ghost text-xs">
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading && totalBatches > 0 && (
          <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0c7b93, #10b981)' }} />
          </div>
        )}
      </div>

      {error && (
        <div className="glass-card p-4 mb-4 border" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={loadData} className="btn-ghost text-xs mt-2">Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal size={14} style={{ color: '#d4a853' }} />
          <span className="font-semibold text-sm" style={{ color: '#e8ecf4' }}>Screening Filters</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}>Table</button>
            <button onClick={() => setView('grid')}  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'grid'  ? 'btn-primary' : 'btn-ghost'}`}>Cards</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(232,236,244,0.3)' }} />
            <input type="text" placeholder="Search company or ticker…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="premium-input pl-8 text-xs py-2" />
          </div>
          <select value={sector} onChange={e => { setSector(e.target.value); setPage(1); }}
            className="premium-input text-xs py-2 cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {SECTORS.map(s => <option key={s} value={s} style={{ background: '#0a0e1a' }}>{s === 'All' ? 'All Sectors' : s}</option>)}
          </select>
          <select value={conviction} onChange={e => { setConviction(e.target.value); setPage(1); }}
            className="premium-input text-xs py-2 cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {CONVICTIONS.map(c => <option key={c} value={c} style={{ background: '#0a0e1a' }}>{c === 'All' ? 'All Conviction' : `${c} Conviction`}</option>)}
          </select>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
            className="premium-input text-xs py-2 cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0a0e1a' }}>Sort: {o.label}</option>)}
          </select>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px', whiteSpace: 'nowrap' }}>
            Min Score: <strong style={{ color: '#d4a853' }}>{minScore}</strong>
          </span>
          <input type="range" min={0} max={90} step={5} value={minScore}
            onChange={e => { setMinScore(Number(e.target.value)); setPage(1); }}
            className="flex-1 h-1 rounded-full cursor-pointer" style={{ accentColor: '#d4a853' }} />
          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '11px' }}>
            {filtered.length.toLocaleString()} results
          </span>
        </div>
      </div>

      {/* Skeleton */}
      {loadingSymbols && allStocks.length === 0 && (
        <div className="glass-card overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <div className="w-7 h-7 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-36 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-2 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </div>
              {[80, 64, 48, 48, 48, 32].map((w, j) => (
                <div key={j} className="h-3 rounded animate-pulse" style={{ width: w, background: 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {view === 'table' && allStocks.length > 0 && (
        <>
          <div className="glass-card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Company</th>
                  <th className="text-right">CMP</th>
                  <th className="text-right">Mkt Cap</th>
                  <th className="text-right">PE</th>
                  <th className="text-right">ROE</th>
                  <th className="text-right">Rev Growth</th>
                  <th className="text-right">Op Margin</th>
                  <th className="text-right">52W</th>
                  <th className="text-center">ISCF Score</th>
                  <th className="text-center">Conviction</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageStocks.map((stock, i) => {
                  const q          = stock.quote;
                  const fd         = fundamentals.get(q.symbol);
                  const score      = computeIscfScore(q);
                  const conv       = scoreToConviction(score);
                  const scoreColor = getScoreColor(score);
                  const convColor  = conv === 'High' ? '#10b981' : conv === 'Medium' ? '#f59e0b' : '#ef4444';
                  const isUp       = q.changePct >= 0;
                  const w52Pct     = q.week52High > q.week52Low
                    ? Math.round(((q.cmp - q.week52Low) / (q.week52High - q.week52Low)) * 100)
                    : 0;
                  const isFetching = !fd && fetchedRef.current.has(q.symbol);
                  // Prefer per-stock fundamentals (3Y CAGR etc.); fall back to DB/batch data
                  const roe        = fd?.roe ?? q.roe;
                  const revGrowth  = fd?.revenueCagr3y ?? fd?.revenueGrowthYoy ?? q.revenueGrowth;
                  const opMargin   = fd?.operatingMargin ?? q.operatingMargin;

                  return (
                    <tr key={q.symbol} className="cursor-pointer"
                      onClick={() => { if (stock.isCurated) window.location.href = `/company/${q.symbol.toLowerCase()}`; }}>
                      <td><span className="text-xs" style={{ color: 'rgba(232,236,244,0.25)' }}>{(page - 1) * PAGE_SIZE + i + 1}</span></td>

                      {/* Company */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black flex-shrink-0"
                            style={{ background: `${scoreColor}18`, color: scoreColor, border: `1px solid ${scoreColor}25`, fontSize: '10px' }}>
                            {q.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold" style={{ color: '#e8ecf4', fontSize: '13px' }}>{stock.name}</span>
                              {stock.watchlisted && <Star size={10} fill="#d4a853" color="#d4a853" />}
                            </div>
                            <div style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>
                              {q.symbol}{q.industry ? ` · ${q.industry}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CMP */}
                      <td className="text-right">
                        <div className="font-bold metric-number" style={{ color: '#e8ecf4', fontSize: '13px' }}>
                          {q.cmp > 0 ? `₹${q.cmp.toFixed(2)}` : '—'}
                        </div>
                        {q.cmp > 0 && (
                          <div className="flex items-center justify-end gap-1">
                            {isUp ? <TrendingUp size={9} color="#10b981" /> : <TrendingDown size={9} color="#ef4444" />}
                            <span style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                              {isUp ? '+' : ''}{q.changePct.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Mkt Cap */}
                      <td className="text-right">
                        <span className="text-sm font-medium metric-number" style={{ color: 'rgba(232,236,244,0.7)' }}>{q.marketCapLabel}</span>
                      </td>

                      {/* PE */}
                      <td className="text-right">
                        <span className="font-medium metric-number" style={{ color: 'rgba(232,236,244,0.6)', fontSize: '13px' }}>
                          {q.pe && q.pe > 0 ? q.pe.toFixed(1) : '—'}
                        </span>
                      </td>

                      {/* ROE */}
                      <td className="text-right">
                        {isFetching
                          ? <Loader2 size={10} className="animate-spin ml-auto" style={{ color: 'rgba(232,236,244,0.2)' }} />
                          : roe != null
                            ? <span className="font-bold metric-number" style={{ color: roe >= 18 ? '#10b981' : roe >= 10 ? '#f59e0b' : '#ef4444', fontSize: '13px' }}>{roe.toFixed(1)}%</span>
                            : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>

                      {/* Rev Growth */}
                      <td className="text-right">
                        {isFetching
                          ? <Loader2 size={10} className="animate-spin ml-auto" style={{ color: 'rgba(232,236,244,0.2)' }} />
                          : revGrowth != null
                            ? <span className="font-bold metric-number" style={{ color: revGrowth > 15 ? '#10b981' : '#f59e0b', fontSize: '13px' }}>{revGrowth.toFixed(1)}%</span>
                            : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>

                      {/* Op Margin */}
                      <td className="text-right">
                        {isFetching
                          ? <Loader2 size={10} className="animate-spin ml-auto" style={{ color: 'rgba(232,236,244,0.2)' }} />
                          : opMargin != null
                            ? <span className="font-bold metric-number" style={{ color: opMargin >= 15 ? '#10b981' : opMargin >= 8 ? '#f59e0b' : '#ef4444', fontSize: '13px' }}>{opMargin.toFixed(1)}%</span>
                            : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>

                      {/* 52W range bar */}
                      <td className="text-right">
                        {q.week52High > 0 ? (
                          <div>
                            <div style={{ color: 'rgba(232,236,244,0.6)', fontSize: '11px' }}>{w52Pct}%</div>
                            <div className="w-16 h-1 rounded-full mt-1 ml-auto" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full" style={{ width: `${w52Pct}%`, background: w52Pct > 70 ? '#10b981' : w52Pct > 40 ? '#f59e0b' : '#ef4444' }} />
                            </div>
                          </div>
                        ) : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>

                      {/* ISCF Score */}
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-black metric-number text-lg" style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
                          <span style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9px' }}>{getScoreLabel(score)}</span>
                        </div>
                      </td>

                      {/* Conviction */}
                      <td className="text-center">
                        <span className="badge" style={{ background: `${convColor}15`, color: convColor, border: `1px solid ${convColor}25` }}>{conv}</span>
                      </td>

                      <td><ChevronRight size={14} style={{ color: 'rgba(232,236,244,0.2)' }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <Filter size={32} style={{ color: 'rgba(232,236,244,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(232,236,244,0.4)' }}>No stocks match your filters</p>
              </div>
            )}
          </div>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />}
        </>
      )}

      {/* Grid */}
      {view === 'grid' && allStocks.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageStocks.map(stock => {
              const q          = stock.quote;
              const fd         = fundamentals.get(q.symbol);
              const score      = computeIscfScore(q);
              const conv       = scoreToConviction(score);
              const scoreColor = getScoreColor(score);
              const convColor  = conv === 'High' ? '#10b981' : conv === 'Medium' ? '#f59e0b' : '#ef4444';
              const isUp       = q.changePct >= 0;
              const gRoe       = fd?.roe ?? q.roe;
              const gOpMargin  = fd?.operatingMargin ?? q.operatingMargin;

              const card = (
                <div key={q.symbol} className="glass-card p-5 hover-glow-gold transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                        style={{ background: `${scoreColor}18`, color: scoreColor, border: `1px solid ${scoreColor}25` }}>
                        {q.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-1.5" style={{ color: '#e8ecf4' }}>
                          {stock.name}
                          {stock.watchlisted && <Star size={11} fill="#d4a853" color="#d4a853" />}
                        </div>
                        <div style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>{q.symbol}</div>
                      </div>
                    </div>
                    <ScoreGauge score={score} size="sm" showLabel={false} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'CMP',       value: q.cmp > 0 ? `₹${q.cmp.toFixed(0)}` : '—', color: isUp ? '#10b981' : '#ef4444' },
                      { label: 'ROE',       value: gRoe != null ? `${gRoe.toFixed(1)}%` : '—', color: (gRoe ?? 0) >= 15 ? '#10b981' : '#f59e0b' },
                      { label: 'Op Margin', value: gOpMargin != null ? `${gOpMargin.toFixed(1)}%` : '—', color: (gOpMargin ?? 0) >= 12 ? '#10b981' : '#f59e0b' },
                    ].map(m => (
                      <div key={m.label} className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="font-bold text-sm metric-number" style={{ color: m.color }}>{m.value}</div>
                        <div style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9.5px' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px' }}>{q.sector || q.industry}</div>
                    <div className="flex items-center gap-2">
                      <span className="badge" style={{ background: `${convColor}15`, color: convColor, border: `1px solid ${convColor}25`, fontSize: '9px' }}>{conv}</span>
                      <span className="font-bold" style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '11px' }}>
                        {isUp ? '+' : ''}{q.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );

              return stock.isCurated
                ? <Link key={q.symbol} href={`/company/${q.symbol.toLowerCase()}`} className="block">{card}</Link>
                : card;
            })}
          </div>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />}
        </>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, total, onChange }: {
  page: number; totalPages: number; total: number; onChange: (p: number) => void;
}) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  return (
    <div className="flex items-center justify-between mt-4 px-2">
      <span className="text-xs" style={{ color: 'rgba(232,236,244,0.35)' }}>
        Page {page} of {totalPages} · {total.toLocaleString()} stocks
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
          className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-30"><ChevronLeft size={13} /></button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = start + i;
          return (
            <button key={p} onClick={() => onChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${p === page ? 'btn-primary' : 'btn-ghost'}`}>{p}</button>
          );
        })}
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
          className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-30"><ChevronRight size={13} /></button>
      </div>
    </div>
  );
}
