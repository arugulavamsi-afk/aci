'use client';

import Link from 'next/link';
import { stocks } from '@/lib/data/mockData';
import { getScoreColor, getScoreLabel } from '@/lib/utils';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';

export default function TopStocks() {
  const sorted = [...stocks].sort((a, b) => b.compoundScore - a.compoundScore).slice(0, 6);

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>Top Compounders</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
            Ranked by ISCF Compounder Score
          </p>
        </div>
        <Link href="/discovery" className="btn-ghost text-xs py-1.5 px-3">
          View All
        </Link>
      </div>

      <div className="space-y-2">
        {sorted.map((stock, i) => {
          const color = getScoreColor(stock.compoundScore);
          const isUp = stock.changePct >= 0;

          return (
            <Link
              key={stock.id}
              href={`/company/${stock.id}`}
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
              {/* Rank */}
              <div className="w-6 text-center">
                <span className="text-xs font-bold" style={{ color: i < 3 ? '#d4a853' : 'rgba(232,236,244,0.25)', fontSize: '11px' }}>
                  #{i + 1}
                </span>
              </div>

              {/* Avatar */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{ background: `${color}18`, color, border: `1px solid ${color}25`, fontSize: '11px' }}
              >
                {stock.ticker.slice(0, 2)}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: 'rgba(232,236,244,0.9)' }}>
                  {stock.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>
                    {stock.ticker}
                  </span>
                  <div
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(232,236,244,0.35)', fontSize: '9.5px' }}
                  >
                    {stock.tailwindThemes[0]}
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="text-right">
                <div className="font-bold text-sm metric-number" style={{ color: 'rgba(232,236,244,0.85)' }}>
                  ₹{stock.cmp.toFixed(0)}
                </div>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {isUp ? <TrendingUp size={9} color="#10b981" /> : <TrendingDown size={9} color="#ef4444" />}
                  <span className="text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '10px' }}>
                    {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Score */}
              <div className="flex items-center gap-2">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black metric-number"
                  style={{ background: `${color}15`, color, border: `1px solid ${color}25`, fontSize: '16px' }}
                >
                  {stock.compoundScore}
                </div>
              </div>

              <ChevronRight size={14} style={{ color: 'rgba(232,236,244,0.2)' }} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
