'use client';

import { useState, useEffect, useRef } from 'react';
import { stocks as curatedStocks } from '@/lib/data/mockData';
import { getScoreColor } from '@/lib/utils';
import { Star, Bell, FileText, TrendingUp, TrendingDown, Plus, Trash2, ChevronRight, Loader2, X, Check, Search } from 'lucide-react';
import Link from 'next/link';
import type { LiveQuote } from '@/lib/nse/types';
import { computeIscfScore, scoreToConviction } from '@/lib/nse/scoring';

const STORAGE_KEY   = 'aci_watchlist';
const NOTES_KEY     = 'aci_watchlist_notes';

const DEFAULT_TICKERS = curatedStocks.filter(s => s.watchlisted).map(s => s.ticker);

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  // First visit — seed with curated watchlisted stocks
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TICKERS));
  return DEFAULT_TICKERS;
}

function saveWatchlist(tickers: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

function loadNotes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch { /* ignore */ }
  return {};
}

function saveNotes(notes: Record<string, string>) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export default function WatchlistPage() {
  const [tickers, setTickers]     = useState<string[]>([]);
  const [quotes, setQuotes]       = useState<Map<string, LiveQuote>>(new Map());
  const [notes, setNotes]         = useState<Record<string, string>>({});
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [noteText, setNoteText]   = useState('');
  const [loading, setLoading]     = useState(true);

  // Add-stock panel state
  const [showAdd, setShowAdd]     = useState(false);
  const [addInput, setAddInput]   = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]   = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setTickers(loadWatchlist());
    setNotes(loadNotes());
  }, []);

  // Fetch live quotes whenever ticker list changes
  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/nse/quotes?symbols=${tickers.join(',')}`)
      .then(r => r.json())
      .then(({ quotes: q }: { quotes: LiveQuote[] }) => {
        setQuotes(new Map((q ?? []).map(item => [item.symbol, item])));
      })
      .catch(() => { /* keep existing quotes */ })
      .finally(() => setLoading(false));
  }, [tickers]);

  // Focus input when add panel opens
  useEffect(() => {
    if (showAdd) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [showAdd]);

  const removeStock = (ticker: string) => {
    const next = tickers.filter(t => t !== ticker);
    setTickers(next);
    saveWatchlist(next);
    setQuotes(prev => { const m = new Map(prev); m.delete(ticker); return m; });
  };

  const addStock = async () => {
    const sym = addInput.trim().toUpperCase();
    if (!sym) return;
    if (tickers.includes(sym)) { setAddError('Already in watchlist'); return; }

    setAddLoading(true);
    setAddError('');
    try {
      const res  = await fetch(`/api/nse/quotes?symbols=${sym}`);
      const data = await res.json();
      const q: LiveQuote | undefined = data.quotes?.[0];
      if (!q || q.cmp === 0) {
        setAddError(`"${sym}" not found — check the NSE ticker symbol`);
        return;
      }
      const next = [...tickers, sym];
      setTickers(next);
      saveWatchlist(next);
      setQuotes(prev => new Map(prev).set(sym, q));
      setAddInput('');
      setShowAdd(false);
    } catch {
      setAddError('Network error — try again');
    } finally {
      setAddLoading(false);
    }
  };

  const openNote = (ticker: string) => {
    if (activeNote === ticker) { setActiveNote(null); return; }
    setActiveNote(ticker);
    setNoteText(notes[ticker] ?? '');
  };

  const saveNote = (ticker: string) => {
    const next = { ...notes, [ticker]: noteText };
    setNotes(next);
    saveNotes(next);
    setActiveNote(null);
  };

  const scores = tickers.map(t => {
    const q = quotes.get(t);
    return q ? computeIscfScore(q) : 0;
  }).filter(s => s > 0);

  const avgScore      = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highConviction = scores.filter(s => scoreToConviction(s) === 'High').length;

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
            {tickers.length} stocks tracked · Live prices · Notes
          </p>
        </div>
        <button className="btn-primary text-xs" onClick={() => setShowAdd(v => !v)}>
          {showAdd ? <X size={12} /> : <Plus size={12} />}
          {showAdd ? 'Cancel' : 'Add Stock'}
        </button>
      </div>

      {/* Add stock panel */}
      {showAdd && (
        <div className="glass-card p-5" style={{ borderColor: 'rgba(212,168,83,0.2)' }}>
          <p className="text-xs mb-3" style={{ color: 'rgba(232,236,244,0.5)' }}>
            Enter an NSE ticker symbol (e.g. RELIANCE, TCS, INFY)
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(232,236,244,0.3)' }} />
              <input
                ref={addInputRef}
                value={addInput}
                onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') addStock(); if (e.key === 'Escape') setShowAdd(false); }}
                placeholder="NSE TICKER"
                className="premium-input pl-8 font-mono tracking-wider"
                style={{ fontSize: '13px' }}
              />
            </div>
            <button
              onClick={addStock}
              disabled={addLoading || !addInput.trim()}
              className="btn-primary text-xs px-4 py-2.5"
            >
              {addLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Add
            </button>
          </div>
          {addError && (
            <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{addError}</p>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Watchlist Stocks', value: tickers.length,                    color: '#8b5cf6' },
          { label: 'Avg ISCF Score',   value: loading ? '…' : (avgScore || '—'), color: '#d4a853' },
          { label: 'High Conviction',  value: loading ? '…' : highConviction,    color: '#10b981' },
          { label: 'With Notes',       value: Object.values(notes).filter(n => n.trim()).length, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="glass-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>
              {k.label}
            </div>
            <div className="text-3xl font-black metric-number" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {loading && tickers.length > 0 && (
            <div className="glass-card p-6 flex items-center justify-center gap-2" style={{ color: 'rgba(232,236,244,0.35)' }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Fetching live prices…</span>
            </div>
          )}

          {tickers.length === 0 && !loading && (
            <div className="glass-card p-10 flex flex-col items-center gap-3" style={{ color: 'rgba(232,236,244,0.3)' }}>
              <Star size={28} style={{ opacity: 0.3 }} />
              <p className="text-sm">Your watchlist is empty</p>
              <button className="btn-primary text-xs mt-1" onClick={() => setShowAdd(true)}>
                <Plus size={12} /> Add your first stock
              </button>
            </div>
          )}

          {tickers.map(ticker => {
            const liveQ     = quotes.get(ticker);
            const cmp       = liveQ?.cmp ?? 0;
            const changePct = liveQ?.changePct ?? 0;
            const score     = liveQ ? computeIscfScore(liveQ) : 0;
            const conviction = score > 0 ? scoreToConviction(score) : null;
            const roe       = liveQ?.roe;
            const opMargin  = liveQ?.operatingMargin;
            const pe        = liveQ?.pe;
            const name      = liveQ?.name || ticker;

            const color     = score > 0 ? getScoreColor(score) : '#6b7280';
            const isUp      = changePct >= 0;
            const hasNote   = activeNote === ticker;
            const savedNote = notes[ticker] ?? '';
            const convColor = conviction === 'High' ? '#10b981' : conviction === 'Medium' ? '#f59e0b' : '#ef4444';

            return (
              <div key={ticker} className="glass-card p-5 hover-glow-gold transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}25` }}>
                    {ticker.slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate" style={{ color: '#e8ecf4' }}>{name}</span>
                      <Star size={11} fill="#d4a853" color="#d4a853" />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>{ticker}</span>
                      {liveQ?.sector && (
                        <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>{liveQ.sector}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {liveQ ? (
                      <>
                        <div className="font-bold metric-number" style={{ color: '#e8ecf4' }}>
                          {cmp > 0 ? `₹${cmp.toFixed(2)}` : '—'}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          {isUp ? <TrendingUp size={9} color="#10b981" /> : <TrendingDown size={9} color="#ef4444" />}
                          <span className="text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                            {isUp ? '+' : ''}{changePct.toFixed(2)}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <Loader2 size={14} className="animate-spin" style={{ color: 'rgba(232,236,244,0.2)' }} />
                    )}
                  </div>

                  {score > 0 && (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg metric-number"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                      {score}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openNote(ticker)}
                      className="p-2 rounded-lg transition-all"
                      title="Notes"
                      style={{
                        background: hasNote ? 'rgba(212,168,83,0.15)' : savedNote ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${hasNote || savedNote ? 'rgba(212,168,83,0.2)' : 'rgba(255,255,255,0.07)'}`,
                      }}
                    >
                      <FileText size={13} style={{ color: hasNote || savedNote ? '#d4a853' : 'rgba(232,236,244,0.35)' }} />
                    </button>
                    <button
                      onClick={() => removeStock(ticker)}
                      className="p-2 rounded-lg transition-all"
                      title="Remove from watchlist"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <Trash2 size={13} style={{ color: 'rgba(239,68,68,0.5)' }} />
                    </button>
                    <Link href={`/company/${ticker.toLowerCase()}`}
                      className="p-2 rounded-lg"
                      title="View company"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <ChevronRight size={13} style={{ color: 'rgba(232,236,244,0.35)' }} />
                    </Link>
                  </div>
                </div>

                {/* Live metrics row */}
                {liveQ && (
                  <div className="flex items-center gap-4 mt-3 pt-3 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {[
                      { label: 'ISCF',      value: String(score), good: score >= 78 },
                      { label: 'ROE',       value: roe != null ? `${roe.toFixed(1)}%` : '—', good: (roe ?? 0) > 18 },
                      { label: 'PE',        value: pe ? `${pe.toFixed(1)}x` : '—', good: (pe ?? 100) < 40 },
                      { label: 'Op Margin', value: opMargin != null ? `${opMargin.toFixed(1)}%` : '—', good: (opMargin ?? 0) > 15 },
                    ].map(m => (
                      <div key={m.label} className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>{m.label}:</span>
                        <span className="text-xs font-bold metric-number" style={{ color: m.good ? '#10b981' : '#f59e0b', fontSize: '10.5px' }}>{m.value}</span>
                      </div>
                    ))}
                    {conviction && (
                      <div className="ml-auto">
                        <span className="badge" style={{ background: `${convColor}12`, color: convColor, border: `1px solid ${convColor}20`, fontSize: '9px' }}>
                          {conviction} Conviction
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes panel */}
                {hasNote && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add your research notes, thesis updates, or reminders…"
                      className="premium-input resize-none text-xs w-full"
                      rows={3}
                      style={{ fontSize: '12px' }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button className="btn-primary text-xs py-1.5 px-3" onClick={() => saveNote(ticker)}>
                        <Check size={11} /> Save Note
                      </button>
                      <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setActiveNote(null)}>Cancel</button>
                      {noteText !== savedNote && savedNote && (
                        <button className="btn-ghost text-xs py-1.5 px-3" style={{ color: '#ef4444' }}
                          onClick={() => { const n = { ...notes }; delete n[ticker]; setNotes(n); saveNotes(n); setNoteText(''); setActiveNote(null); }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Saved note preview (when panel is closed) */}
                {!hasNote && savedNote && (
                  <div className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px', fontStyle: 'italic' }}>
                    📝 {savedNote.slice(0, 120)}{savedNote.length > 120 ? '…' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Score distribution */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Live Score Distribution</h3>
            {tickers.length > 0 ? (
              <div className="flex items-end justify-around h-24 mb-3 gap-1">
                {tickers.map(t => {
                  const liveQ = quotes.get(t);
                  const sc = liveQ ? computeIscfScore(liveQ) : 0;
                  const color = sc > 0 ? getScoreColor(sc) : '#374151';
                  return (
                    <div key={t} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(4, (sc / 100) * 96)}px`, background: `linear-gradient(180deg, ${color}, ${color}60)` }} />
                      <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '36px' }}>
                        {t}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-xs" style={{ color: 'rgba(232,236,244,0.2)' }}>No stocks</div>
            )}
          </div>

          {/* Conviction summary */}
          {!loading && scores.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Conviction Summary</h3>
              <div className="space-y-2.5">
                {(['High', 'Medium', 'Low'] as const).map(level => {
                  const count = scores.filter(s => scoreToConviction(s) === level).length;
                  const color = level === 'High' ? '#10b981' : level === 'Medium' ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-xs flex-1" style={{ color: 'rgba(232,236,244,0.55)' }}>{level} Conviction</span>
                      <span className="font-bold text-sm metric-number" style={{ color }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes summary */}
          {Object.keys(notes).filter(k => tickers.includes(k) && notes[k]?.trim()).length > 0 && (
            <div className="glass-card p-5">
              <h3 className="font-bold text-sm mb-3" style={{ color: '#e8ecf4' }}>Research Notes</h3>
              <div className="space-y-2">
                {Object.entries(notes)
                  .filter(([k, v]) => tickers.includes(k) && v.trim())
                  .map(([ticker, note]) => (
                    <div key={ticker} className="p-3 rounded-xl" style={{ background: 'rgba(212,168,83,0.04)', border: '1px solid rgba(212,168,83,0.1)' }}>
                      <div className="text-xs font-bold mb-1" style={{ color: '#d4a853' }}>{ticker}</div>
                      <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.5)', fontSize: '11px' }}>
                        {note.slice(0, 100)}{note.length > 100 ? '…' : ''}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="glass-card p-5">
            <h3 className="font-bold text-sm mb-3" style={{ color: '#e8ecf4' }}>Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full btn-ghost text-xs justify-start gap-2" onClick={() => setShowAdd(true)}>
                <Plus size={12} /> Add stock to watchlist
              </button>
              <Link href="/discovery" className="btn-ghost text-xs w-full justify-start gap-2 flex items-center">
                <Bell size={12} /> Discover more compounders
              </Link>
              <Link href="/copilot" className="btn-ghost text-xs w-full justify-start gap-2 flex items-center">
                <Star size={12} /> AI analysis of watchlist
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
