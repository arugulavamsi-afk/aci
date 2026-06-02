'use client';

import { useState, useEffect } from 'react';
import { stocks as curatedStocks, scoreBreakdown } from '@/lib/data/mockData';
import StatCard from '@/components/ui/StatCard';
import ThemeHeatmap from '@/components/dashboard/ThemeHeatmap';
import TopStocks from '@/components/dashboard/TopStocks';
import PortfolioChart from '@/components/dashboard/PortfolioChart';
import ScoreGauge from '@/components/ui/ScoreGauge';
import ScoreBar from '@/components/ui/ScoreBar';
import { BarChart3, Target, Star, TrendingUp, Zap, Award } from 'lucide-react';
import Link from 'next/link';
import type { LiveQuote } from '@/lib/nse/types';
import { computeIscfScore, scoreToConviction } from '@/lib/nse/scoring';

export default function Dashboard() {
  const [quotes, setQuotes] = useState<LiveQuote[]>([]);
  const [totalNse, setTotalNse] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const symbols = curatedStocks.map(s => s.ticker).join(',');
    Promise.all([
      fetch(`/api/nse/quotes?symbols=${symbols}`).then(r => r.json()),
      fetch('/api/symbols').then(r => r.json()),
    ]).then(([quotesData, symbolsData]) => {
      setQuotes(quotesData.quotes ?? []);
      setTotalNse(symbolsData.count ?? 0);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Live stats from real data
  const scores = quotes.map(q => computeIscfScore(q));
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highConviction = scores.filter(s => scoreToConviction(s) === 'High').length;
  const watchlistCount = curatedStocks.filter(s => s.watchlisted).length;

  // Best score for the gauge
  const bestScore = scores.length > 0 ? Math.max(...scores) : 86;

  return (
    <div className="p-6 space-y-6 bg-mesh">
      {/* Hero header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #d4a853, #0c7b93)' }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#d4a853', fontSize: '10.5px', letterSpacing: '0.14em' }}>
              Command Center
            </span>
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>
            Aishwaryamasthu Intelligence
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
            Find Tomorrow&apos;s Wealth Creators Today — India Structural Compounder Framework
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/copilot" className="btn-ghost text-xs">
            <Zap size={12} />
            AI Copilot
          </Link>
          <Link href="/discovery" className="btn-primary text-xs">
            <Target size={12} />
            Screen Compounders
          </Link>
        </div>
      </div>

      {/* Portfolio KPIs — live */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="NSE Stocks Tracked"
          value={loaded ? totalNse : curatedStocks.length}
          sub={loaded ? `${totalNse} listed equities` : 'Loading…'}
          icon={<BarChart3 size={14} />}
          color="#0c7b93"
          trend={12}
        />
        <StatCard
          label="Avg Compounder Score"
          value={loaded ? avgScore : '—'}
          sub="ISCF 7-factor model · Live"
          icon={<Award size={14} />}
          color="#d4a853"
        />
        <StatCard
          label="High Conviction"
          value={loaded ? highConviction : '—'}
          sub="ISCF Score ≥ 78"
          icon={<Target size={14} />}
          color="#10b981"
          trend={6}
        />
        <StatCard
          label="Watchlist"
          value={watchlistCount}
          sub="Active monitoring"
          icon={<Star size={14} />}
          color="#8b5cf6"
        />
      </div>

      {/* Chart + ISCF breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PortfolioChart />
        </div>

        <div className="glass-card p-6">
          <div className="mb-4">
            <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>ISCF Score Model</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
              7-factor compounder scoring
            </p>
          </div>

          <div className="flex flex-col items-center mb-6">
            <ScoreGauge score={loaded ? bestScore : 86} size="md" />
            <p className="text-xs mt-3 text-center" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px' }}>
              {loaded ? 'Highest score — curated universe' : 'Loading live scores…'}
            </p>
          </div>

          <div className="space-y-3">
            {scoreBreakdown.map(item => (
              <ScoreBar
                key={item.category}
                label={item.category}
                score={item.score}
                maxScore={item.weight}
                color={item.color}
                weight={item.weight}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Theme heatmap */}
      <ThemeHeatmap />

      {/* Top stocks + AI insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopStocks />
        </div>

        <div className="space-y-4">
          <div
            className="glass-card p-5"
            style={{ borderColor: 'rgba(212,168,83,0.15)', background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(10,14,26,0.9))' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: '#d4a853' }} />
              <span className="font-bold text-sm" style={{ color: '#d4a853' }}>AI Insight</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,236,244,0.65)', fontSize: '12.5px' }}>
              <strong style={{ color: '#e8ecf4' }}>Pharma & Healthcare</strong> has the highest budget policy weight (18/20) in FY26-27, with very_strong tailwind classification. Combined with Power (15/20) and PLI Manufacturing (15/20), these three sectors form the core ISCF allocation thesis.
            </p>
            <Link href="/copilot" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color: '#d4a853' }}>
              Deep dive with AI <TrendingUp size={11} />
            </Link>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Score Categories</h3>
            <div className="space-y-2.5">
              {[
                { range: '90–100', label: 'Rare Compounder', color: '#d4a853' },
                { range: '78–89', label: 'High Conviction', color: '#10b981' },
                { range: '62–77', label: 'Medium Conviction', color: '#0c7b93' },
                { range: '50–61', label: 'Watch & Wait', color: '#f59e0b' },
                { range: '< 50',  label: 'Avoid', color: '#ef4444' },
              ].map(item => (
                <div key={item.range} className="flex items-center gap-3">
                  <div className="w-8 h-5 rounded-md flex items-center justify-center text-xs font-black"
                    style={{ background: `${item.color}20`, color: item.color, fontSize: '9px' }}>
                    {item.range.split('–')[0]}
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '12px' }}>{item.label}</span>
                  <div className="ml-auto w-2 h-2 rounded-full" style={{ background: item.color }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
