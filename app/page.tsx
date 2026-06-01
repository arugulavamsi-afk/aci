'use client';

import { portfolioStats, stocks, scoreBreakdown } from '@/lib/data/mockData';
import StatCard from '@/components/ui/StatCard';
import ThemeHeatmap from '@/components/dashboard/ThemeHeatmap';
import TopStocks from '@/components/dashboard/TopStocks';
import PortfolioChart from '@/components/dashboard/PortfolioChart';
import ScoreGauge from '@/components/ui/ScoreGauge';
import ScoreBar from '@/components/ui/ScoreBar';
import { BarChart3, Target, Star, TrendingUp, Zap, Award } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const highConviction = stocks.filter(s => s.conviction === 'High').length;

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

      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Stocks Tracked"
          value={portfolioStats.totalStocks}
          sub="Across 12 sectors"
          icon={<BarChart3 size={14} />}
          color="#0c7b93"
          trend={12}
        />
        <StatCard
          label="Avg Compounder Score"
          value={portfolioStats.avgCompoundScore}
          sub="ISCF 7-factor model"
          icon={<Award size={14} />}
          color="#d4a853"
        />
        <StatCard
          label="High Conviction"
          value={highConviction}
          sub="Score ≥ 80 threshold"
          icon={<Target size={14} />}
          color="#10b981"
          trend={6}
        />
        <StatCard
          label="Watchlist"
          value={portfolioStats.watchlist}
          sub="Active monitoring"
          icon={<Star size={14} />}
          color="#8b5cf6"
        />
      </div>

      {/* Second row — chart + ISCF breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PortfolioChart />
        </div>

        {/* ISCF Score Breakdown */}
        <div className="glass-card p-6">
          <div className="mb-4">
            <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>ISCF Score Model</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
              7-factor compounder scoring
            </p>
          </div>

          <div className="flex flex-col items-center mb-6">
            <ScoreGauge score={86} size="md" />
            <p className="text-xs mt-3 text-center" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11px' }}>
              Avg score — High Conviction basket
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

      {/* Top stocks + quick insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopStocks />
        </div>

        <div className="space-y-4">
          {/* AI Insight card */}
          <div
            className="glass-card p-5"
            style={{ borderColor: 'rgba(212,168,83,0.15)', background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(10,14,26,0.9))' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: '#d4a853' }} />
              <span className="font-bold text-sm" style={{ color: '#d4a853' }}>AI Insight</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,236,244,0.65)', fontSize: '12.5px' }}>
              <strong style={{ color: '#e8ecf4' }}>Power infrastructure</strong> stocks showing exceptional momentum. PFC, RVNL, and Cochin Shipyard form a high-conviction cluster aligned with India&apos;s ₹18.8L Cr energy transition capex.
            </p>
            <Link href="/copilot" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color: '#d4a853' }}>
              Deep dive with AI <TrendingUp size={11} />
            </Link>
          </div>

          {/* Score legend */}
          <div className="glass-card p-5">
            <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Score Categories</h3>
            <div className="space-y-2.5">
              {[
                { range: '90–100', label: 'Rare Opportunity', color: '#d4a853' },
                { range: '80–89', label: 'Strong Candidate', color: '#10b981' },
                { range: '70–79', label: 'Watchlist', color: '#0c7b93' },
                { range: '60–69', label: 'Speculative', color: '#f59e0b' },
                { range: '< 60', label: 'Avoid', color: '#ef4444' },
              ].map(item => (
                <div key={item.range} className="flex items-center gap-3">
                  <div
                    className="w-8 h-5 rounded-md flex items-center justify-center text-xs font-black"
                    style={{ background: `${item.color}20`, color: item.color, fontSize: '9px' }}
                  >
                    {item.range.split('–')[0]}
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '12px' }}>
                    {item.label}
                  </span>
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
