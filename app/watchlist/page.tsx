'use client';

import { useState, useEffect } from 'react';
import { stocks } from '@/lib/data/mockData';
import { getScoreColor } from '@/lib/utils';
import { Star, Bell, FileText, TrendingUp, TrendingDown, Plus, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { LiveQuote } from '@/lib/nse/types';
import { computeIscfScore, scoreToConviction } from '@/lib/nse/scoring';

const watchlistStocks = stocks.filter(s => s.watchlisted);

const notes: Record<string, string> = {
  pfc: 'Strong order book visibility through FY27. Watch for asset quality in renewable project financing. Add on dips below ₹400.',
  'va-tech': 'Ideal proxy for India water infrastructure decade. Order book at 3x revenue. Core holding.',
  carysil: 'Watch Q3 export data closely. European market slowdown a near-term headwind.',
  'cochin-ship': 'Exceptional execution on INS Vikrant follow-up orders. Defense capex supercycle beneficiary.',
  'bharat-elec': 'Long-term core holding. Any correction below ₹220 is an add opportunity.',
};

const alerts = [
  { stock: 'BEL',  type: 'Price Alert',      detail: 'Alert: ₹240 (below current)',            active: true },
  { stock: 'PFC',  type: 'Quarterly Review', detail: 'Q1 FY27 results expected Jul 15',         active: true },
  { stock: 'WABAG',type: 'Order Win',         detail: 'Watch for Jal Jeevan Mission announcement', active: false },
];

export default function WatchlistPage() {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [quotes, setQuotes] = useState<Map<string, LiveQuote>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const symbols = watchlistStocks.map(s => s.ticker).join(',');
    fetch(`/api/nse/quotes?symbols=${symbols}`)
      .then(r => r.json())
      .then(({ quotes: q }: { quotes: LiveQuote[] }) => {
        const map = new Map(q.map(item => [item.symbol, item]));
        setQuotes(map);
      })
      .finally(() => setLoading(false));
  }, []);

  // Live stats
  const scores = watchlistStocks.map(s => {
    const q = quotes.get(s.ticker);
    return q ? computeIscfScore(q) : s.compoundScore;
  });
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const highConviction = scores.filter(sc => scoreToConviction(sc) === 'High').length;

  return (
    <div className="p-6 bg-mesh min-h-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #8b5cf6, #d4a853)' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#8b5cf6', fontSize: '10.5px', letterSpacing: '0.14em' }}>
              Watchlist
            </span>
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>My Watchlist</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
            {watchlistStocks.length} stocks tracked · Live prices · Notes · Alerts
          </p>
        </div>
        <button className="btn-primary text-xs">
          <Plus size={12} /> Add Stock
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Watchlist Stocks',  value: watchlistStocks.length, color: '#8b5cf6' },
          { label: 'Avg ISCF Score',    value: loading ? '…' : avgScore, color: '#d4a853' },
          { label: 'High Conviction',   value: loading ? '…' : highConviction, color: '#10b981' },
          { label: 'Active Alerts',     value: alerts.filter(a => a.active).length, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="glass-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>
              {k.label}
            </div>
            <div className="text-3xl font-black metric-number" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {loading && (
            <div className="glass-card p-6 flex items-center justify-center gap-2" style={{ color: 'rgba(232,236,244,0.35)' }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Fetching live prices…</span>
            </div>
          )}
          {watchlistStocks.map(stock => {
            const liveQ = quotes.get(stock.ticker);
            const cmp       = liveQ?.cmp        ?? stock.cmp;
            const changePct = liveQ?.changePct   ?? stock.changePct;
            const score     = liveQ ? computeIscfScore(liveQ) : stock.compoundScore;
            const conviction = scoreToConviction(score);
            const roe       = liveQ?.roe;
            const opMargin  = liveQ?.operatingMargin;
            const pe        = liveQ?.pe ?? stock.pe;

            const color    = getScoreColor(score);
            const isUp     = changePct >= 0;
            const hasNote  = activeNote === stock.id;
            const convColor = conviction === 'High' ? '#10b981' : conviction === 'Medium' ? '#f59e0b' : '#ef4444';

            return (
              <div key={stock.id} className="glass-card p-5 hover-glow-gold transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}25` }}>
                    {stock.ticker.slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: '#e8ecf4' }}>{stock.name}</span>
                      <Star size={11} fill="#d4a853" color="#d4a853" />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>{stock.ticker}</span>
                      <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>{stock.sector}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold metric-number" style={{ color: '#e8ecf4' }}>
                      {cmp > 0 ? `₹${cmp.toFixed(2)}` : '—'}
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {isUp ? <TrendingUp size={9} color="#10b981" /> : <TrendingDown size={9} color="#ef4444" />}
                      <span className="text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                        {isUp ? '+' : ''}{changePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg metric-number"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                    {score}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveNote(hasNote ? null : stock.id)}
                      className="p-2 rounded-lg transition-all"
                      style={{ background: hasNote ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${hasNote ? 'rgba(212,168,83,0.2)' : 'rgba(255,255,255,0.07)'}` }}
                    >
                      <FileText size={13} style={{ color: hasNote ? '#d4a853' : 'rgba(232,236,244,0.35)' }} />
                    </button>
                    <button className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <Bell size={13} style={{ color: 'rgba(232,236,244,0.35)' }} />
                    </button>
                    <Link href={`/company/${stock.id}`} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <ChevronRight size={13} style={{ color: 'rgba(232,236,244,0.35)' }} />
                    </Link>
                  </div>
                </div>

                {/* Live metrics row */}
                <div className="flex items-center gap-4 mt-3 pt-3 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {[
                    { label: 'ISCF Score', value: `${score}`, good: score >= 78 },
                    { label: 'ROE',        value: roe != null ? `${roe.toFixed(1)}%` : `${stock.roe}%`, good: (roe ?? stock.roe) > 18 },
                    { label: 'PE',         value: pe ? `${pe.toFixed(1)}x` : '—', good: (pe ?? 100) < 40 },
                    { label: 'Op Margin',  value: opMargin != null ? `${opMargin.toFixed(1)}%` : '—', good: (opMargin ?? 0) > 15 },
                  ].map(m => (
                    <div key={m.label} className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>{m.label}:</span>
                      <span className="text-xs font-bold metric-number" style={{ color: m.good ? '#10b981' : '#f59e0b', fontSize: '10.5px' }}>{m.value}</span>
                    </div>
                  ))}
                  <div className="ml-auto">
                    <span className="badge" style={{
                      background: `${convColor}12`,
                      color: convColor,
                      border: `1px solid ${convColor}20`,
                      fontSize: '9px',
                    }}>
                      {conviction} Conviction
                    </span>
                  </div>
                </div>

                {/* Notes panel */}
                {hasNote && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {notes[stock.id] && !noteText && (
                      <p className="text-xs leading-relaxed mb-3 italic" style={{ color: 'rgba(232,236,244,0.5)', fontSize: '12px' }}>
                        📝 {notes[stock.id]}
                      </p>
                    )}
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add your research notes, thesis updates, or reminders…"
                      className="premium-input resize-none text-xs"
                      rows={3}
                      style={{ fontSize: '12px' }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button className="btn-primary text-xs py-1.5 px-3">Save Note</button>
                      <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setActiveNote(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: '#e8ecf4' }}>Active Alerts</h3>
              <button className="btn-ghost text-xs py-1 px-2"><Plus size={10} /> Add</button>
            </div>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: alert.active ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${alert.active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)'}` }}>
                  <Bell size={12} style={{ color: alert.active ? '#f59e0b' : 'rgba(232,236,244,0.2)', marginTop: 2 }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold" style={{ color: alert.active ? '#f59e0b' : 'rgba(232,236,244,0.35)', fontSize: '11px' }}>{alert.stock}</span>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(232,236,244,0.35)', fontSize: '9px' }}>{alert.type}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'rgba(232,236,244,0.45)', fontSize: '10.5px' }}>{alert.detail}</p>
                  </div>
                  <button><Trash2 size={11} style={{ color: 'rgba(232,236,244,0.2)' }} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Quarterly Review</h3>
            <div className="space-y-3">
              {[
                { company: 'BEL',        date: 'Jul 15, 2026', quarter: 'Q1 FY27', status: 'Upcoming' },
                { company: 'PFC',        date: 'Jul 22, 2026', quarter: 'Q1 FY27', status: 'Upcoming' },
                { company: 'WABAG',      date: 'Aug 1, 2026',  quarter: 'Q1 FY27', status: 'Scheduled' },
                { company: 'COCHINSHIP', date: 'Aug 8, 2026',  quarter: 'Q1 FY27', status: 'Scheduled' },
              ].map(item => (
                <div key={item.company} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div>
                    <div className="text-xs font-bold" style={{ color: '#e8ecf4', fontSize: '12px' }}>{item.company}</div>
                    <div className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>{item.quarter} · {item.date}</div>
                  </div>
                  <span className="badge" style={{ background: 'rgba(12,123,147,0.12)', color: '#2bb5d4', border: '1px solid rgba(12,123,147,0.2)', fontSize: '9px' }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Live score distribution */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Live Score Distribution</h3>
            <div className="flex items-end justify-around h-24 mb-3">
              {watchlistStocks.map(s => {
                const liveQ = quotes.get(s.ticker);
                const sc = liveQ ? computeIscfScore(liveQ) : s.compoundScore;
                const color = getScoreColor(sc);
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <div className="w-6 rounded-t-md transition-all" style={{ height: `${(sc / 100) * 96}px`, background: `linear-gradient(180deg, ${color}, ${color}60)` }} />
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '36px' }}>
                      {s.ticker}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
