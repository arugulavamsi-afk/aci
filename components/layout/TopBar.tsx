'use client';

import { Search, Bell, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const marketTickers = [
  { name: 'NIFTY 50', value: '24,326.55', change: '+0.82%', up: true },
  { name: 'SENSEX', value: '80,248.12', change: '+0.74%', up: true },
  { name: 'NIFTY BANK', value: '52,136.40', change: '+1.12%', up: true },
  { name: 'NIFTY MIDCAP', value: '55,842.30', change: '-0.24%', up: false },
  { name: 'USD/INR', value: '83.42', change: '-0.08%', up: false },
  { name: 'GOLD', value: '₹72,450', change: '+0.34%', up: true },
];

export default function TopBar() {
  return (
    <header
      className="flex-shrink-0 flex flex-col"
      style={{ background: 'rgba(6,8,16,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Market ticker */}
      <div
        className="flex items-center gap-0 overflow-hidden px-4 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.3)' }}
      >
        <div className="flex items-center gap-4 overflow-x-auto pb-0 hide-scrollbar w-full" style={{ scrollbarWidth: 'none' }}>
          {marketTickers.map(ticker => (
            <div key={ticker.name} className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '10.5px', letterSpacing: '0.05em' }}>
                {ticker.name}
              </span>
              <span className="text-xs font-bold metric-number" style={{ color: 'rgba(232,236,244,0.75)', fontSize: '11px' }}>
                {ticker.value}
              </span>
              <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: ticker.up ? '#10b981' : '#ef4444', fontSize: '10.5px' }}>
                {ticker.up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {ticker.change}
              </span>
              <div className="w-px h-3 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <RefreshCw size={11} style={{ color: 'rgba(232,236,244,0.3)' }} />
          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>Live</span>
          <div className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: '#10b981' }} />
        </div>
      </div>

      {/* Main topbar */}
      <div className="flex items-center gap-4 px-5 py-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(232,236,244,0.3)' }} />
          <input
            type="text"
            placeholder="Search stocks, sectors, themes…"
            className="premium-input pl-9 py-2 text-sm"
            style={{ fontSize: '13px' }}
          />
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}
          >
            ⌘K
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Date */}
          <div className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(232,236,244,0.4)', fontSize: '11.5px' }}>
            01 Jun 2026
          </div>

          {/* Notification */}
          <button
            className="relative p-2 rounded-lg transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Bell size={14} style={{ color: 'rgba(232,236,244,0.5)' }} />
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#d4a853' }} />
          </button>

          {/* CTA */}
          <Link href="/discovery" className="btn-primary text-xs py-2">
            <Search size={12} />
            Screen Stocks
          </Link>
        </div>
      </div>
    </header>
  );
}
