'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { stocks as curatedStocks } from '@/lib/data/mockData';
import { getScoreColor, getScoreLabel } from '@/lib/utils';
import {
  Search, Filter, TrendingUp, TrendingDown, Star, ChevronRight,
  SlidersHorizontal, ChevronLeft, RefreshCw, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import ScoreGauge from '@/components/ui/ScoreGauge';
import type { LiveQuote, StockFundamentals } from '@/lib/nse/types';
import { computeIscfScore, scoreToConviction } from '@/lib/nse/scoring';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DisplayStock {
  symbol: string;
  name: string;
  cmp: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  marketCapLabel: string;
  pe: number | null;
  sector: string;
  industry: string;
  week52High: number;
  week52Low: number;
  watchlisted: boolean;
  isCurated: boolean;
  // live quote used for score recomputation
  quote: LiveQuote;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SECTORS = [
  'All', 'Technology', 'Financial Services', 'Industrials', 'Basic Materials',
  'Consumer Cyclical', 'Consumer Defensive', 'Healthcare', 'Energy',
  'Utilities', 'Communication Services', 'Real Estate',
];
const CONVICTIONS = ['All', 'High', 'Medium', 'Low'];
const SORT_OPTIONS = [
  { value: 'score', label: 'ISCF Score' },
  { value: 'marketCap', label: 'Market Cap' },
  { value: 'changePct', label: 'Day Change' },
  { value: 'pe', label: 'PE Ratio' },
] as const;
const PAGE_SIZE = 50;
const BATCH_SIZE = 400;

// ── Curated lookup ─────────────────────────────────────────────────────────────

const curatedMap = new Map(curatedStocks.map(s => [s.ticker, s]));

function quoteToDisplayStock(q: LiveQuote): DisplayStock {
  const curated = curatedMap.get(q.symbol);
  return {
    symbol: q.symbol,
    name: q.name || curated?.name || q.symbol,
    cmp: q.cmp,
    change: q.change,
    changePct: q.changePct,
    marketCap: q.marketCap,
    marketCapLabel: q.marketCapLabel,
    pe: q.pe,
    sector: q.sector || curated?.sector || '',
    industry: q.industry || curated?.industry || '',
    week52High: q.week52High,
    week52Low: q.week52Low,
    watchlisted: curated?.watchlisted ?? false,
    isCurated: !!curated,
    quote: q,
  };
}

// ── Score derivation (live = uses cached fundamentals) ────────────────────────

function deriveScore(stock: DisplayStock, fundamentals: Map<string, StockFundamentals>): number {
  return computeIscfScore(stock.quote, fundamentals.get(stock.symbol) ?? null);
}

function deriveConviction(score: number) {
  return scoreToConviction(score);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DiscoveryPage() {
  const [allStocks, setAllStocks]           = useState<DisplayStock[]>([]);
  const [fundamentals, setFundamentals]     = useState<Map<string, StockFundamentals>>(new Map());
  const [loadingSymbols, setLoadingSymbols] = useState(true);
  const [loadedBatches, setLoadedBatches]   = useState(0);
  const [totalBatches, setTotalBatches]     = useState(0);
  const [fetchingFundamentals, setFetchingFundamentals] = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const [search, setSearch]       = useState('');
  const [sector, setSector]       = useState('All');
  const [conviction, setConviction] = useState('All');
  const [minScore, setMinScore]   = useState(0);
  const [sortBy, setSortBy]       = useState<'score' | 'marketCap' | 'changePct' | 'pe'>('marketCap');
  const [view, setView]           = useState<'table' | 'grid'>('table');
  const [page, setPage]           = useState(1);

  const abortRef      = useRef<AbortController | null>(null);
  const fundAbortRef  = useRef<AbortController | null>(null);

  // ── Load all NSE price data ──────────────────────────────────────────────────

  const loadPriceData = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoadingSymbols(true);
    setError(null);
    setAllStocks([]);
    setFundamentals(new Map());
    setLoadedBatches(0);
    setTotalBatches(0);
    setPage(1);

    try {
      const symRes = await fetch('/api/nse/symbols', { signal });
      if (!symRes.ok) throw new Error(`Symbol fetch failed: ${symRes.status}`);
      const { symbols } = await symRes.json() as { symbols: { symbol: string }[] };
      setLoadingSymbols(false);

      const curatedSymbols = curatedStocks.map(s => s.ticker);
      const restSymbols = symbols.map(s => s.symbol).filter(s => !curatedMap.has(s));
      const ordered = [...curatedSymbols, ...restSymbols];

      const batches: string[][] = [];
      for (let i = 0; i < ordered.length; i += BATCH_SIZE) batches.push(ordered.slice(i, i + BATCH_SIZE));
      setTotalBatches(batches.length);

      for (let b = 0; b < batches.length; b++) {
        if (signal.aborted) break;
        try {
          const qRes = await fetch(`/api/nse/quotes?symbols=${batches[b].join(',')}`, { signal });
          if (!qRes.ok) continue;
          const { quotes } = await qRes.json() as { quotes: LiveQuote[] };
          setAllStocks(prev => {
            const map = new Map(prev.map(s => [s.symbol, s]));
            quotes.map(quoteToDisplayStock).forEach(d => map.set(d.symbol, d));
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
    loadPriceData();
    return () => abortRef.current?.abort();
  }, [loadPriceData]);

  // ── Fetch fundamentals for current page ──────────────────────────────────────

  const fetchPageFundamentals = useCallback(async (symbols: string[]) => {
    const missing = symbols.filter(s => !fundamentals.has(s));
    if (missing.length === 0) return;

    fundAbortRef.current?.abort();
    fundAbortRef.current = new AbortController();
    const { signal } = fundAbortRef.current;

    setFetchingFundamentals(true);
    try {
      await Promise.allSettled(
        missing.map(async (sym) => {
          if (signal.aborted) return;
          try {
            const r = await fetch(`/api/nse/stock/${sym}`, { signal });
            if (!r.ok) return;
            const { fundamentals: fd } = await r.json() as { fundamentals: StockFundamentals };
            setFundamentals(prev => new Map(prev).set(sym, fd));
          } catch { /* skip */ }
        })
      );
    } finally {
      if (!signal.aborted) setFetchingFundamentals(false);
    }
  }, [fundamentals]);

  // ── Filtering & sorting ────────────────────────────────────────────────────

  const filtered = allStocks
    .filter(s => {
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.symbol.toLowerCase().includes(q)) return false;
      }
      if (sector !== 'All' && s.sector !== sector) return false;
      if (minScore > 0 && deriveScore(s, fundamentals) < minScore) return false;
      if (conviction !== 'All') {
        if (deriveConviction(deriveScore(s, fundamentals)) !== conviction) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score') return deriveScore(b, fundamentals) - deriveScore(a, fundamentals);
      if (sortBy === 'marketCap') return (b.marketCap ?? 0) - (a.marketCap ?? 0);
      if (sortBy === 'changePct') return b.changePct - a.changePct;
      if (sortBy === 'pe') {
        const pa = a.pe && a.pe > 0 ? a.pe : Infinity;
        const pb = b.pe && b.pe > 0 ? b.pe : Infinity;
        return pa - pb;
      }
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStocks = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Trigger fundamentals fetch when visible page changes
  useEffect(() => {
    if (pageStocks.length > 0) {
      fetchPageFundamentals(pageStocks.map(s => s.symbol));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, allStocks.length]);

  const isLoadingPrices = loadingSymbols || (totalBatches > 0 && loadedBatches < totalBatches);
  const progress = totalBatches > 0 ? Math.round((loadedBatches / totalBatches) * 100) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

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
          </div>
          <div className="flex items-center gap-2">
            {fetchingFundamentals && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(212,168,83,0.1)', color: '#d4a853' }}>
                <Loader2 size={11} className="animate-spin" />
                Analysing…
              </div>
            )}
            {isLoadingPrices && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(12,123,147,0.12)', color: '#2bb5d4' }}>
                <Loader2 size={11} className="animate-spin" />
                {progress}%
              </div>
            )}
            <button onClick={loadPriceData} className="btn-ghost text-xs" disabled={isLoadingPrices}>
              <RefreshCw size={12} className={isLoadingPrices ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {isLoadingPrices && totalBatches > 0 && (
          <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #0c7b93, #10b981)' }} />
          </div>
        )}
      </div>

      {error && (
        <div className="glass-card p-4 mb-4 border" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={loadPriceData} className="btn-ghost text-xs mt-2">Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal size={14} style={{ color: '#d4a853' }} />
          <span className="font-semibold text-sm" style={{ color: '#e8ecf4' }}>Screening Filters</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setView('table')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}>Table</button>
            <button onClick={() => setView('grid')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'grid' ? 'btn-primary' : 'btn-ghost'}`}>Cards</button>
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
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <div className="w-7 h-7 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <div className="h-2 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </div>
              {[1,2,3,4].map(j => (
                <div key={j} className="h-3 w-16 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Table view */}
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
                  <th className="text-right">52W Range</th>
                  <th className="text-center">ISCF Score</th>
                  <th className="text-center">Conviction</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageStocks.map((stock, i) => {
                  const fd = fundamentals.get(stock.symbol);
                  const score = computeIscfScore(stock.quote, fd ?? null);
                  const conv = scoreToConviction(score);
                  const scoreColor = getScoreColor(score);
                  const convColor = conv === 'High' ? '#10b981' : conv === 'Medium' ? '#f59e0b' : '#ef4444';
                  const isUp = stock.changePct >= 0;
                  const week52Pct = stock.week52High > stock.week52Low
                    ? Math.round(((stock.cmp - stock.week52Low) / (stock.week52High - stock.week52Low)) * 100)
                    : 0;
                  const isFetchingThis = fetchingFundamentals && !fd;

                  const row = (
                    <tr key={stock.symbol} className="cursor-pointer"
                      onClick={() => { if (stock.isCurated) window.location.href = `/company/${stock.symbol.toLowerCase()}`; }}>
                      <td>
                        <span className="text-xs" style={{ color: 'rgba(232,236,244,0.25)' }}>
                          {(page - 1) * PAGE_SIZE + i + 1}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                            style={{ background: `${scoreColor}18`, color: scoreColor, border: `1px solid ${scoreColor}25`, fontSize: '10px' }}>
                            {stock.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm" style={{ color: '#e8ecf4', fontSize: '13px' }}>{stock.name}</span>
                              {stock.watchlisted && <Star size={10} fill="#d4a853" color="#d4a853" />}
                            </div>
                            <div className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>
                              {stock.symbol}{stock.industry ? ` · ${stock.industry}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="font-bold metric-number" style={{ color: '#e8ecf4', fontSize: '13px' }}>
                          {stock.cmp > 0 ? `₹${stock.cmp.toFixed(2)}` : '—'}
                        </div>
                        {stock.cmp > 0 && (
                          <div className="flex items-center justify-end gap-1">
                            {isUp ? <TrendingUp size={9} color="#10b981" /> : <TrendingDown size={9} color="#ef4444" />}
                            <span style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                              {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="text-sm font-medium metric-number" style={{ color: 'rgba(232,236,244,0.7)' }}>
                          {stock.marketCapLabel}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="font-medium metric-number" style={{ color: 'rgba(232,236,244,0.6)', fontSize: '13px' }}>
                          {stock.pe && stock.pe > 0 ? stock.pe.toFixed(1) : '—'}
                        </span>
                      </td>
                      {/* ROE */}
                      <td className="text-right">
                        {isFetchingThis ? (
                          <Loader2 size={10} className="animate-spin ml-auto" style={{ color: 'rgba(232,236,244,0.2)' }} />
                        ) : fd?.roe != null ? (
                          <span className="font-bold metric-number" style={{ color: fd.roe >= 18 ? '#10b981' : fd.roe >= 10 ? '#f59e0b' : '#ef4444', fontSize: '13px' }}>
                            {fd.roe.toFixed(1)}%
                          </span>
                        ) : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>
                      {/* Revenue Growth */}
                      <td className="text-right">
                        {isFetchingThis ? (
                          <Loader2 size={10} className="animate-spin ml-auto" style={{ color: 'rgba(232,236,244,0.2)' }} />
                        ) : (fd?.revenueCagr3y ?? fd?.revenueGrowthYoy) != null ? (
                          <span className="font-bold metric-number" style={{ color: (fd!.revenueCagr3y ?? fd!.revenueGrowthYoy)! > 20 ? '#10b981' : '#f59e0b', fontSize: '13px' }}>
                            {(fd!.revenueCagr3y ?? fd!.revenueGrowthYoy)!.toFixed(1)}%
                          </span>
                        ) : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>
                      {/* Operating Margin */}
                      <td className="text-right">
                        {isFetchingThis ? (
                          <Loader2 size={10} className="animate-spin ml-auto" style={{ color: 'rgba(232,236,244,0.2)' }} />
                        ) : fd?.operatingMargin != null ? (
                          <span className="font-bold metric-number" style={{ color: fd.operatingMargin >= 15 ? '#10b981' : fd.operatingMargin >= 8 ? '#f59e0b' : '#ef4444', fontSize: '13px' }}>
                            {fd.operatingMargin.toFixed(1)}%
                          </span>
                        ) : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>
                      {/* 52W range */}
                      <td className="text-right">
                        {stock.week52High > 0 ? (
                          <div>
                            <div className="text-xs font-medium metric-number" style={{ color: 'rgba(232,236,244,0.6)', fontSize: '11px' }}>
                              {week52Pct}%
                            </div>
                            <div className="w-16 h-1 rounded-full mt-1 ml-auto" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full" style={{ width: `${week52Pct}%`, background: week52Pct > 70 ? '#10b981' : week52Pct > 40 ? '#f59e0b' : '#ef4444' }} />
                            </div>
                          </div>
                        ) : <span style={{ color: 'rgba(232,236,244,0.2)' }}>—</span>}
                      </td>
                      {/* ISCF Score */}
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-black metric-number text-lg" style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
                          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9px' }}>{getScoreLabel(score)}</span>
                        </div>
                      </td>
                      {/* Conviction */}
                      <td className="text-center">
                        <span className="badge" style={{ background: `${convColor}15`, color: convColor, border: `1px solid ${convColor}25` }}>
                          {conv}
                        </span>
                      </td>
                      <td><ChevronRight size={14} style={{ color: 'rgba(232,236,244,0.2)' }} /></td>
                    </tr>
                  );
                  return row;
                })}
              </tbody>
            </table>

            {filtered.length === 0 && !isLoadingPrices && (
              <div className="text-center py-16">
                <Filter size={32} style={{ color: 'rgba(232,236,244,0.15)', margin: '0 auto 12px' }} />
                <p style={{ color: 'rgba(232,236,244,0.4)' }}>No stocks match your filters</p>
              </div>
            )}
          </div>

          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />}
        </>
      )}

      {/* Grid view */}
      {view === 'grid' && allStocks.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageStocks.map(stock => {
              const fd = fundamentals.get(stock.symbol);
              const score = computeIscfScore(stock.quote, fd ?? null);
              const conv = scoreToConviction(score);
              const scoreColor = getScoreColor(score);
              const convColor = conv === 'High' ? '#10b981' : conv === 'Medium' ? '#f59e0b' : '#ef4444';
              const isUp = stock.changePct >= 0;

              const card = (
                <div key={stock.symbol} className="glass-card p-5 hover-glow-gold transition-all duration-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                        style={{ background: `${scoreColor}18`, color: scoreColor, border: `1px solid ${scoreColor}25` }}>
                        {stock.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: '#e8ecf4' }}>{stock.name}</div>
                        <div className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>{stock.symbol}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {stock.watchlisted && <Star size={12} fill="#d4a853" color="#d4a853" />}
                      <ScoreGauge score={score} size="sm" showLabel={false} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'CMP', value: stock.cmp > 0 ? `₹${stock.cmp.toFixed(0)}` : '—', color: isUp ? '#10b981' : '#ef4444' },
                      { label: 'ROE', value: fd?.roe != null ? `${fd.roe.toFixed(1)}%` : '—', color: (fd?.roe ?? 0) >= 15 ? '#10b981' : '#f59e0b' },
                      { label: 'Op Margin', value: fd?.operatingMargin != null ? `${fd.operatingMargin.toFixed(1)}%` : '—', color: (fd?.operatingMargin ?? 0) >= 12 ? '#10b981' : '#f59e0b' },
                    ].map(m => (
                      <div key={m.label} className="text-center p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="font-bold text-sm metric-number" style={{ color: m.color }}>{m.value}</div>
                        <div className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9.5px' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px' }}>{stock.sector || stock.industry}</div>
                    <div className="flex items-center gap-2">
                      <span className="badge" style={{ background: `${convColor}15`, color: convColor, border: `1px solid ${convColor}25`, fontSize: '9px' }}>{conv}</span>
                      <span className="font-bold text-sm" style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '11px' }}>
                        {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );

              return stock.isCurated
                ? <Link key={stock.symbol} href={`/company/${stock.symbol.toLowerCase()}`} className="block">{card}</Link>
                : card;
            })}
          </div>
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />}
        </>
      )}
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────

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
          className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-30">
          <ChevronLeft size={13} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = start + i;
          return (
            <button key={p} onClick={() => onChange(p)}
              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${p === page ? 'btn-primary' : 'btn-ghost'}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
          className="btn-ghost text-xs px-2 py-1.5 disabled:opacity-30">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
