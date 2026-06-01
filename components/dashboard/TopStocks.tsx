'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { stocks as curatedStocks } from '@/lib/data/mockData';
import { getScoreColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, ChevronRight, Loader2 } from 'lucide-react';
import type { LiveQuote } from '@/lib/nse/types';
import { computeIscfScore } from '@/lib/nse/scoring';

export default function TopStocks() {
  const [quotes, setQuotes] = useState<LiveQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const symbols = curatedStocks.map(s => s.ticker).join(',');
    fetch(`/api/nse/quotes?symbols=${symbols}`)
      .then(r => r.json())
      .then(({ quotes: q }: { quotes: LiveQuote[] }) => {
        setQuotes(q.sort((a, b) => computeIscfScore(b) - computeIscfScore(a)));
      })
      .finally(() => setLoading(false));
  }, []);

  const curatedMap = new Map(curatedStocks.map(s => [s.ticker, s]));

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>Top Compounders</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
            Ranked by live ISCF Score
          </p>
        </div>
        <Link href="/discovery" className="btn-ghost text-xs py-1.5 px-3">View All</Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'rgba(232,236,244,0.3)' }}>
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Loading live data…</span>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.slice(0, 6).map((q, i) => {
            const curated = curatedMap.get(q.symbol);
            const score = computeIscfScore(q);
            const color = getScoreColor(score);
            const isUp = q.changePct >= 0;
            const id = curated?.id ?? q.symbol.toLowerCase();

            return (
              <Link
                key={q.symbol}
                href={`/company/${id}`}
                className="flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,168,83,0.12)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.03)';
                }}
              >
                <span className="w-6 text-center text-xs font-bold" style={{ color: i < 3 ? '#d4a853' : 'rgba(232,236,244,0.25)', fontSize: '11px' }}>
                  #{i + 1}
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{ background: `${color}18`, color, border: `1px solid ${color}25`, fontSize: '11px' }}>
                  {q.symbol.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: 'rgba(232,236,244,0.9)' }}>
                    {q.name || curated?.name || q.symbol}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>{q.symbol}</span>
                    {curated?.tailwindThemes[0] && (
                      <div className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(232,236,244,0.35)', fontSize: '9.5px' }}>
                        {curated.tailwindThemes[0]}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm metric-number" style={{ color: 'rgba(232,236,244,0.85)' }}>
                    {q.cmp > 0 ? `₹${q.cmp.toFixed(0)}` : '—'}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {isUp ? <TrendingUp size={9} color="#10b981" /> : <TrendingDown size={9} color="#ef4444" />}
                    <span className="text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                      {isUp ? '+' : ''}{q.changePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black metric-number"
                  style={{ background: `${color}15`, color, border: `1px solid ${color}25`, fontSize: '16px' }}>
                  {score}
                </div>
                <ChevronRight size={14} style={{ color: 'rgba(232,236,244,0.2)' }} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
