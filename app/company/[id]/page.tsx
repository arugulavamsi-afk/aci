'use client';

import { use, useState } from 'react';
import { stocks, revenueData, moatRadarData, riskData, scoreBreakdown } from '@/lib/data/mockData';
import { getScoreColor, getScoreLabel, getRiskColor } from '@/lib/utils';
import ScoreGauge from '@/components/ui/ScoreGauge';
import ScoreBar from '@/components/ui/ScoreBar';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Star, TrendingUp, TrendingDown, Shield, Zap, Building2, MapPin, ChevronRight, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

const TABS = ['Overview', 'Financials', 'Management', 'Moat', 'Valuation', 'Risk', 'AI Thesis'];

const revenueSegments = [
  { name: 'Defense Electronics', value: 58, color: '#d4a853' },
  { name: 'Homeland Security', value: 18, color: '#0c7b93' },
  { name: 'Railway Systems', value: 14, color: '#10b981' },
  { name: 'Export & Others', value: 10, color: '#8b5cf6' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(232,236,244,0.5)' }}>{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="text-xs font-bold" style={{ color: '#d4a853' }}>
            {p.name}: ₹{(p.value as number).toLocaleString()} Cr
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function CompanyPage({ params }: PageProps) {
  const { id } = use(params);
  const [tab, setTab] = useState('Overview');
  const [watchlisted, setWatchlisted] = useState(false);

  const stock = stocks.find(s => s.id === id) || stocks[8]; // Default to BEL
  const color = getScoreColor(stock.compoundScore);
  const isUp = stock.changePct >= 0;

  const mgmtScoreItems = [
    { label: 'Promoter Holding', score: stock.promoterHolding > 50 ? 7 : stock.promoterHolding > 35 ? 5 : 3, max: 8, color: '#10b981' },
    { label: 'Capital Allocation', score: 6, max: 7, color: '#0c7b93' },
    { label: 'Governance Quality', score: 5, max: 5, color: '#d4a853' },
  ];

  return (
    <div className="min-h-full bg-mesh">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 glass-strong px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(232,236,244,0.35)' }}>
            <Link href="/" style={{ color: 'rgba(232,236,244,0.35)' }}>Home</Link>
            <ChevronRight size={10} />
            <Link href="/discovery" style={{ color: 'rgba(232,236,244,0.35)' }}>Discovery</Link>
            <ChevronRight size={10} />
            <span style={{ color: '#d4a853' }}>{stock.ticker}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Price */}
            <div className="text-right">
              <div className="font-black metric-number text-lg" style={{ color: '#e8ecf4' }}>₹{stock.cmp}</div>
              <div className="flex items-center justify-end gap-1">
                {isUp ? <TrendingUp size={10} color="#10b981" /> : <TrendingDown size={10} color="#ef4444" />}
                <span className="text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#ef4444' }}>
                  {isUp ? '+' : ''}₹{stock.change} ({stock.changePct.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Watchlist */}
            <button
              onClick={() => setWatchlisted(!watchlisted)}
              className="p-2.5 rounded-xl transition-all duration-200"
              style={{
                background: watchlisted ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${watchlisted ? 'rgba(212,168,83,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <Star size={14} fill={watchlisted ? '#d4a853' : 'none'} color={watchlisted ? '#d4a853' : 'rgba(232,236,244,0.4)'} />
            </button>

            <Link href="/copilot" className="btn-primary text-xs py-2">
              <Zap size={12} />
              AI Analysis
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Company hero */}
        <div className="glass-card p-6" style={{ borderColor: `${color}20` }}>
          <div className="flex items-start gap-6">
            {/* Logo/avatar */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0"
              style={{ background: `${color}18`, color, border: `2px solid ${color}30`, fontSize: '20px' }}
            >
              {stock.ticker.slice(0, 2)}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>{stock.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-bold" style={{ color: 'rgba(232,236,244,0.4)' }}>{stock.ticker}</span>
                    <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <div className="flex items-center gap-1" style={{ color: 'rgba(232,236,244,0.4)' }}>
                      <MapPin size={11} />
                      <span className="text-xs">{stock.headquarters}</span>
                    </div>
                    <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    <div className="flex items-center gap-1" style={{ color: 'rgba(232,236,244,0.4)' }}>
                      <Building2 size={11} />
                      <span className="text-xs">{stock.sector}</span>
                    </div>
                  </div>
                  <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(232,236,244,0.55)' }}>
                    {stock.description}
                  </p>
                </div>

                <div className="flex-shrink-0 ml-4">
                  <ScoreGauge score={stock.compoundScore} size="lg" />
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mt-5">
                {[
                  { label: 'Market Cap', value: stock.marketCapLabel, color: '#e8ecf4' },
                  { label: 'ROCE', value: `${stock.roce}%`, color: stock.roce > 20 ? '#10b981' : '#f59e0b' },
                  { label: 'ROE', value: `${stock.roe}%`, color: stock.roe > 18 ? '#10b981' : '#f59e0b' },
                  { label: 'D/E Ratio', value: stock.debtEquity.toFixed(2), color: stock.debtEquity < 0.5 ? '#10b981' : stock.debtEquity < 1 ? '#f59e0b' : '#ef4444' },
                  { label: 'Promoter', value: `${stock.promoterHolding}%`, color: stock.promoterHolding > 50 ? '#10b981' : '#f59e0b' },
                  { label: 'Rev CAGR', value: `${stock.revenueCagr3y}%`, color: '#0c7b93' },
                  { label: 'PAT CAGR', value: `${stock.profitCagr3y}%`, color: '#d4a853' },
                ].map(m => (
                  <div key={m.label} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="font-black metric-number text-base" style={{ color: m.color }}>{m.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Themes */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>Tailwind Themes:</span>
                {stock.tailwindThemes.map(t => (
                  <span key={t} className="badge" style={{ background: 'rgba(12,123,147,0.12)', color: '#2bb5d4', border: '1px solid rgba(12,123,147,0.2)' }}>
                    {t}
                  </span>
                ))}
                {stock.moatType.slice(0, 2).map(m => (
                  <span key={m} className="badge" style={{ background: 'rgba(212,168,83,0.08)', color: '#d4a853', border: '1px solid rgba(212,168,83,0.15)' }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: tab === t ? 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(12,123,147,0.1))' : 'rgba(255,255,255,0.04)',
                color: tab === t ? '#d4a853' : 'rgba(232,236,244,0.45)',
                border: tab === t ? '1px solid rgba(212,168,83,0.2)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Revenue trend */}
              <div className="glass-card p-6">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>10-Year Revenue & Profit Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0c7b93" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0c7b93" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d4a853" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#d4a853" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}K`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0c7b93" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                    <Area type="monotone" dataKey="profit" name="Profit" stroke="#d4a853" strokeWidth={2} fill="url(#profGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-px" style={{ background: '#0c7b93', height: 2 }} />
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '10.5px' }}>Revenue (₹Cr)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-px" style={{ background: '#d4a853', height: 2 }} />
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '10.5px' }}>Profit (₹Cr)</span>
                  </div>
                </div>
              </div>

              {/* EPS & FCF */}
              <div className="glass-card p-6">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>EPS & Free Cash Flow</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={revenueData.slice(4)} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="eps" name="EPS (₹)" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.8} />
                    <Bar dataKey="fcf" name="FCF (₹Cr)" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              {/* Revenue pie */}
              <div className="glass-card p-5">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Revenue Segments</h3>
                <div className="flex justify-center mb-4">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={revenueSegments}
                      cx={80} cy={80} innerRadius={45} outerRadius={72}
                      paddingAngle={3} dataKey="value"
                    >
                      {revenueSegments.map((entry, index) => (
                        <Cell key={index} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
                <div className="space-y-2">
                  {revenueSegments.map(seg => (
                    <div key={seg.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
                        <span className="text-xs" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '11px' }}>{seg.name}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: seg.color }}>{seg.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ISCF Score breakdown */}
              <div className="glass-card p-5">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>ISCF Score Breakdown</h3>
                <div className="space-y-3">
                  {scoreBreakdown.map(item => (
                    <ScoreBar
                      key={item.category}
                      label={item.category}
                      score={item.score}
                      maxScore={item.weight}
                      color={item.color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Financials */}
        {tab === 'Financials' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Financial Quality Engine</h3>
              <div className="space-y-4">
                {[
                  { label: 'Revenue CAGR (3Y)', value: `${stock.revenueCagr3y}%`, score: Math.min(15, Math.round(stock.revenueCagr3y / 3)), max: 15, color: '#0c7b93', good: stock.revenueCagr3y > 15 },
                  { label: 'Profit CAGR (3Y)', value: `${stock.profitCagr3y}%`, score: Math.min(15, Math.round(stock.profitCagr3y / 3.5)), max: 15, color: '#d4a853', good: stock.profitCagr3y > 20 },
                  { label: 'ROCE', value: `${stock.roce}%`, score: Math.min(15, Math.round(stock.roce / 2)), max: 15, color: '#10b981', good: stock.roce > 20 },
                  { label: 'ROE', value: `${stock.roe}%`, score: Math.min(15, Math.round(stock.roe / 2)), max: 15, color: '#8b5cf6', good: stock.roe > 18 },
                  { label: 'Debt / Equity', value: `${stock.debtEquity}x`, score: stock.debtEquity < 0.3 ? 15 : stock.debtEquity < 0.7 ? 11 : stock.debtEquity < 1.5 ? 7 : 3, max: 15, color: stock.debtEquity < 0.5 ? '#10b981' : '#f59e0b', good: stock.debtEquity < 0.5 },
                ].map(m => (
                  <div key={m.label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'rgba(232,236,244,0.55)' }}>{m.label}</span>
                      <span className="font-bold text-sm metric-number" style={{ color: m.good ? '#10b981' : '#f59e0b' }}>{m.value}</span>
                    </div>
                    <div className="score-bar">
                      <div className="score-bar-fill" style={{ width: `${(m.score / m.max) * 100}%`, background: `linear-gradient(90deg, ${m.color}60, ${m.color})` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: '#e8ecf4' }}>Financial Quality Score</span>
                  <span className="text-2xl font-black metric-number" style={{ color: '#10b981' }}>{stock.financialScore}<span className="text-sm" style={{ color: 'rgba(232,236,244,0.3)' }}>/15</span></span>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Historical Profit Growth</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenueData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v/1000}K`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="profit" name="Net Profit" fill="#d4a853" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tab: Management */}
        {tab === 'Management' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Management Quality Engine</h3>
              <div className="space-y-5">
                {mgmtScoreItems.map(item => (
                  <div key={item.label}>
                    <ScoreBar label={item.label} score={item.score} maxScore={item.max} color={item.color} />
                  </div>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Auditor Resignations', status: 'None', good: true },
                  { label: 'Promoter Pledging', status: '0%', good: true },
                  { label: 'Equity Dilution', status: 'Minimal', good: true },
                  { label: 'Related Party Txns', status: 'Within Limits', good: true },
                  { label: 'Dividend Track Record', status: 'Consistent', good: true },
                  { label: 'Management Tenure', status: '8+ Years', good: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.5)' }}>{item.label}</span>
                    <span className="text-xs font-bold badge" style={{
                      background: item.good ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: item.good ? '#10b981' : '#ef4444',
                      border: `1px solid ${item.good ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-5 flex flex-col items-center">
              <h3 className="font-bold text-sm mb-4 self-start" style={{ color: '#e8ecf4' }}>Management Score</h3>
              <ScoreGauge score={Math.round((stock.managementScore / 20) * 100)} size="lg" showLabel={false} />
              <div className="text-center mt-4">
                <div className="text-3xl font-black metric-number" style={{ color: '#10b981' }}>
                  {stock.managementScore}<span className="text-lg" style={{ color: 'rgba(232,236,244,0.3)' }}>/20</span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'rgba(232,236,244,0.4)' }}>Management Quality Score</p>
              </div>
              <div className="mt-5 w-full p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>
                <div className="flex items-start gap-2">
                  <Shield size={12} style={{ color: '#10b981', marginTop: 2 }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '11.5px' }}>
                    <strong style={{ color: '#10b981' }}>Strong governance.</strong> Promoter holding above 51% with zero pledging indicates strong alignment with minority shareholders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Moat */}
        {tab === 'Moat' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Competitive Moat Radar</h3>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={moatRadarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(232,236,244,0.45)', fontSize: 11 }} />
                  <Radar name="Moat" dataKey="score" stroke="#d4a853" fill="#d4a853" fillOpacity={0.12} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Moat Analysis</h3>
              <div className="space-y-3 mb-5">
                {stock.moatType.map((m, i) => (
                  <div key={m} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(212,168,83,0.04)', border: '1px solid rgba(212,168,83,0.08)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: 'rgba(212,168,83,0.15)', color: '#d4a853', fontSize: '10px' }}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-xs" style={{ color: '#d4a853', fontSize: '12px' }}>{m}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.45)', fontSize: '11px' }}>
                        {m === 'Technology IP' ? 'Proprietary tech with 40+ patents across defense electronics' :
                         m === 'Defense Relationships' ? 'Decades of MoD trust and qualification processes create 5–7 year switching costs' :
                         m === 'Scale Advantage' ? 'Production scale of ₹20,000+ Cr enables cost leadership' :
                         m === 'Regulatory Moat' ? 'Defense sector clearances take 3–5 years to obtain, creating durable barriers' :
                         'Sustainable competitive advantage driving long-term returns'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(212,168,83,0.04)', border: '1px solid rgba(212,168,83,0.1)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={12} style={{ color: '#d4a853' }} />
                  <span className="text-xs font-bold" style={{ color: '#d4a853' }}>AI Moat Summary</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '11.5px' }}>
                  This company is <strong style={{ color: '#e8ecf4' }}>extremely difficult to disrupt</strong> due to a combination of regulatory barriers (defense clearances), technology IP, and entrenched government relationships built over decades. The combination of Atmanirbhar Bharat policy tailwind + captive order flow creates a near-impenetrable competitive position for the next 10–15 years.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="font-bold text-sm" style={{ color: '#e8ecf4' }}>Moat Score</span>
                <span className="text-2xl font-black metric-number" style={{ color: '#d4a853' }}>{stock.moatScore}<span className="text-sm" style={{ color: 'rgba(232,236,244,0.3)' }}>/15</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Valuation */}
        {tab === 'Valuation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Valuation Metrics</h3>
              <div className="space-y-4">
                {[
                  { label: 'P/E Ratio', current: stock.pe, historical: 32.4, industry: 28.6, unit: 'x' },
                  { label: 'P/B Ratio', current: stock.pb, historical: 6.8, industry: 5.2, unit: 'x' },
                  { label: 'EV/EBITDA', current: stock.evEbitda, historical: 22.4, industry: 18.8, unit: 'x' },
                  { label: 'PEG Ratio', current: 1.54, historical: 2.1, industry: 1.8, unit: 'x' },
                ].map(m => {
                  const vs = m.current / m.historical;
                  const verdict = vs < 0.85 ? 'Undervalued' : vs < 1.15 ? 'Fairly Valued' : 'Premium';
                  const verdictColor = vs < 0.85 ? '#10b981' : vs < 1.15 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm" style={{ color: '#e8ecf4' }}>{m.label}</span>
                        <span className="badge" style={{ background: `${verdictColor}15`, color: verdictColor, border: `1px solid ${verdictColor}25` }}>
                          {verdict}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="font-black metric-number text-lg" style={{ color: '#d4a853' }}>{m.current}{m.unit}</div>
                          <div className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>Current</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold metric-number" style={{ color: 'rgba(232,236,244,0.5)' }}>{m.historical}{m.unit}</div>
                          <div className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>5Y Avg</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold metric-number" style={{ color: 'rgba(232,236,244,0.5)' }}>{m.industry}{m.unit}</div>
                          <div className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>Industry</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 rounded-xl flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="font-bold text-sm" style={{ color: '#e8ecf4' }}>Valuation Score</span>
                <span className="text-2xl font-black metric-number" style={{ color: '#f59e0b' }}>{stock.valuationScore}<span className="text-sm" style={{ color: 'rgba(232,236,244,0.3)' }}>/5</span></span>
              </div>
            </div>
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>PE Band History</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={[
                  { year: '2020', pe: 22, high: 28, low: 18 },
                  { year: '2021', pe: 30, high: 36, low: 24 },
                  { year: '2022', pe: 26, high: 32, low: 20 },
                  { year: '2023', pe: 34, high: 42, low: 28 },
                  { year: '2024', pe: 38, high: 46, low: 32 },
                  { year: '2025', pe: 42, high: 52, low: 36 },
                  { year: '2026', pe: 38.4, high: 50, low: 32 },
                ]} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="high" stroke="rgba(239,68,68,0.4)" fill="rgba(239,68,68,0.06)" strokeDasharray="4 4" dot={false} />
                  <Area type="monotone" dataKey="pe" stroke="#d4a853" strokeWidth={2} fill="rgba(212,168,83,0.08)" dot={false} />
                  <Area type="monotone" dataKey="low" stroke="rgba(16,185,129,0.4)" fill="rgba(16,185,129,0.04)" strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tab: Risk */}
        {tab === 'Risk' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Risk Intelligence Engine</h3>
              <div className="space-y-3">
                {riskData.map(r => (
                  <div key={r.category} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${r.color}15` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {r.level === 'High' ? <AlertTriangle size={12} style={{ color: r.color }} /> : <Shield size={12} style={{ color: r.color }} />}
                        <span className="text-sm font-semibold" style={{ color: '#e8ecf4' }}>{r.category}</span>
                      </div>
                      <span className="badge" style={{ background: `${r.color}15`, color: r.color, border: `1px solid ${r.color}25` }}>
                        {r.level}
                      </span>
                    </div>
                    <div className="score-bar">
                      <div className="score-bar-fill" style={{ width: `${r.score}%`, background: `linear-gradient(90deg, ${r.color}60, ${r.color})` }} />
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10.5px' }}>
                      Risk intensity: {r.score}/100
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Risk Heatmap</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {riskData.map(r => (
                  <div
                    key={r.category}
                    className="heat-cell p-3 flex flex-col gap-1"
                    style={{ background: `${r.color}${Math.round(r.score / 5).toString(16).padStart(2,'0')}`, border: `1px solid ${r.color}30` }}
                  >
                    <span className="text-xs font-semibold" style={{ color: '#e8ecf4', fontSize: '10.5px' }}>{r.category}</span>
                    <span className="text-xs" style={{ color: r.color, fontSize: '11px', fontWeight: 700 }}>{r.level}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={12} style={{ color: '#10b981' }} />
                  <span className="text-xs font-bold" style={{ color: '#10b981' }}>Risk Summary</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '11.5px' }}>
                  Overall risk profile is <strong style={{ color: '#10b981' }}>Low-to-Moderate</strong>. Primary watch point is customer concentration (85%+ revenue from government/PSU customers). However, this is mitigated by the structural nature of India&apos;s defense indigenization program providing long-term policy visibility.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: AI Thesis */}
        {tab === 'AI Thesis' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Bull Case',
                emoji: '🚀',
                color: '#10b981',
                target: '₹380–420',
                upside: '+55–70%',
                points: [
                  'India\'s defense budget reaches 3% of GDP by FY28, accelerating domestic procurement',
                  'Export-led revenue doubles to ₹6,000 Cr by FY27 as Western nations diversify supply chains',
                  'Radar and electronic warfare order book ₹65,000 Cr+ with 3-year executable pipeline',
                  'Margin expansion from 15% → 18% EBITDA as higher-value systems dominate revenue mix',
                ],
                triggers: ['Defense budget announcement', 'Large export order', 'New product launch'],
              },
              {
                title: 'Base Case',
                emoji: '📊',
                color: '#d4a853',
                target: '₹280–320',
                upside: '+15–30%',
                points: [
                  'Revenue CAGR of 18–22% driven by steady domestic defense order execution',
                  'EBITDA margins stable at 14–16% as product mix evolves',
                  'Order book maintains 3x coverage on annual revenue',
                  'Dividend payout ratio of 25–30% continues, rewarding patient investors',
                ],
                triggers: ['Quarterly order inflows', 'Budget allocation', 'Q2 earnings beat'],
              },
              {
                title: 'Bear Case',
                emoji: '⚠️',
                color: '#ef4444',
                target: '₹180–220',
                downside: '-10–27%',
                points: [
                  'Budget constraints delay procurement cycles, creating execution shortfalls',
                  'Import content remains elevated as indigenous supply chains develop slowly',
                  'Competition from private sector (L&T Defense, TATA Advanced Systems) intensifies',
                  'Global defense tech companies enter India through JV routes at attractive terms',
                ],
                triggers: ['Budget cuts', 'Order cancellations', 'Import policy reversal'],
              },
            ].map(scenario => (
              <div
                key={scenario.title}
                className="glass-card p-5"
                style={{ borderColor: `${scenario.color}20` }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{scenario.emoji}</span>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: scenario.color }}>{scenario.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-black metric-number" style={{ color: '#e8ecf4' }}>{scenario.target}</span>
                      <span className="text-xs font-bold" style={{ color: scenario.color }}>{scenario.upside || scenario.downside}</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 mb-4">
                  {scenario.points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full flex-shrink-0 mt-2" style={{ background: scenario.color }} />
                      <span className="text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '11.5px' }}>{p}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-3" style={{ borderTop: `1px solid ${scenario.color}15` }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>KEY TRIGGERS</p>
                  <div className="flex flex-wrap gap-1">
                    {scenario.triggers.map(t => (
                      <span key={t} className="badge" style={{ background: `${scenario.color}10`, color: scenario.color, border: `1px solid ${scenario.color}20`, fontSize: '9.5px' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Long-term potential */}
            <div className="lg:col-span-3 glass-card p-6" style={{ borderColor: 'rgba(212,168,83,0.15)', background: 'linear-gradient(135deg, rgba(212,168,83,0.04), rgba(10,14,26,0.95))' }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} style={{ color: '#d4a853' }} />
                <h3 className="font-bold text-sm" style={{ color: '#d4a853' }}>10-Year Investment Thesis — {stock.name}</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,236,244,0.6)', maxWidth: '720px', lineHeight: '1.8' }}>
                {stock.name} represents a <strong style={{ color: '#e8ecf4' }}>generational compounder opportunity</strong> at the intersection of India&apos;s two most powerful structural themes: defense indigenization and digital sovereignty. With a captive order book, government-backed revenue visibility, expanding international footprint, and a management team with proven capital allocation discipline, the company is positioned to compound earnings at 20–25% CAGR over a decade. The current valuation, while not cheap in absolute terms, is reasonable relative to the <strong style={{ color: '#d4a853' }}>quality and longevity of the growth runway</strong>. ISCF Score of {stock.compoundScore} places this firmly in the <strong style={{ color: '#d4a853' }}>{getScoreLabel(stock.compoundScore)}</strong> category.
              </p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span className="text-xs font-semibold" style={{ color: '#10b981' }}>10Y Target: 8–12x from current levels</span>
                </div>
                <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <div className="flex items-center gap-2">
                  <Star size={14} style={{ color: '#d4a853' }} />
                  <span className="text-xs font-semibold" style={{ color: '#d4a853' }}>ISCF Conviction: {stock.conviction}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
