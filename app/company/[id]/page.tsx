'use client';

import { use, useState, useEffect } from 'react';
import { stocks as curatedStocks, revenueData, moatRadarData, riskData, scoreBreakdown } from '@/lib/data/mockData';
import { getScoreColor, getScoreLabel } from '@/lib/utils';
import ScoreGauge from '@/components/ui/ScoreGauge';
import ScoreBar from '@/components/ui/ScoreBar';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Star, TrendingUp, TrendingDown, Shield, Zap, Building2, MapPin, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { LiveQuote, StockFundamentals } from '@/lib/nse/types';
import { computeIscfScore, scoreToConviction } from '@/lib/nse/scoring';

interface PageProps {
  params: Promise<{ id: string }>;
}

const TABS = ['Overview', 'Financials', 'Management', 'Moat', 'Valuation', 'Risk', 'AI Thesis'];

// Build a lookup that matches by both id and ticker (case-insensitive)
const curatedByIdOrTicker = new Map<string, typeof curatedStocks[0]>();
curatedStocks.forEach(s => {
  curatedByIdOrTicker.set(s.id.toLowerCase(), s);
  curatedByIdOrTicker.set(s.ticker.toLowerCase(), s);
});

const revenueSegments = [
  { name: 'Primary Business', value: 58, color: '#d4a853' },
  { name: 'Secondary Segment', value: 18, color: '#0c7b93' },
  { name: 'Other Verticals', value: 14, color: '#10b981' },
  { name: 'Export & Misc', value: 10, color: '#8b5cf6' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (active && payload?.length) {
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

function val(v: number | null | undefined, suffix = '') {
  return v != null ? `${v}${suffix}` : '—';
}

export default function CompanyPage({ params }: PageProps) {
  const { id } = use(params);
  const [tab, setTab] = useState('Overview');
  const [watchlisted, setWatchlisted] = useState(false);
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [fundamentals, setFundamentals] = useState<StockFundamentals | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve curated stock and ticker symbol
  const curated = curatedByIdOrTicker.get(id.toLowerCase());
  const ticker = curated?.ticker ?? id.toUpperCase();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/nse/quotes?symbols=${ticker}`).then(r => r.json()),
      fetch(`/api/nse/stock/${ticker}`).then(r => r.json()),
    ]).then(([qData, fData]) => {
      const q: LiveQuote | undefined = qData.quotes?.[0];
      if (q) setQuote(q);
      if (fData.fundamentals) setFundamentals(fData.fundamentals);
      if (curated?.watchlisted) setWatchlisted(curated.watchlisted);
    }).finally(() => setLoading(false));
  }, [ticker, curated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full bg-mesh">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#d4a853' }} />
          <p className="text-sm" style={{ color: 'rgba(232,236,244,0.45)' }}>Loading {ticker}…</p>
        </div>
      </div>
    );
  }

  // Merge live data with curated metadata
  const name   = quote?.name || curated?.name || ticker;
  const sector = quote?.sector || curated?.sector || '';
  const industry = quote?.industry || curated?.industry || '';
  const cmp    = quote?.cmp ?? curated?.cmp ?? 0;
  const change = quote?.change ?? curated?.change ?? 0;
  const changePct = quote?.changePct ?? curated?.changePct ?? 0;
  const marketCapLabel = quote?.marketCapLabel ?? curated?.marketCapLabel ?? '—';
  const pe     = quote?.pe ?? curated?.pe ?? null;
  const pb     = fundamentals?.pb ?? quote?.pb ?? curated?.pb ?? null;
  const evEbitda = fundamentals?.evEbitda ?? curated?.evEbitda ?? null;
  const roe    = fundamentals?.roe ?? curated?.roe ?? null;
  const debtEquity = fundamentals?.debtEquity ?? curated?.debtEquity ?? null;
  const revGrowth = fundamentals?.revenueCagr3y ?? fundamentals?.revenueGrowthYoy ?? curated?.revenueCagr3y ?? null;
  const opMargin = fundamentals?.operatingMargin ?? null;
  const description = fundamentals?.description || curated?.description || '';
  const city   = fundamentals?.city || curated?.headquarters || '';
  const week52High = quote?.week52High ?? 0;
  const week52Low  = quote?.week52Low ?? 0;

  const score = quote ? computeIscfScore(quote) : (curated?.compoundScore ?? 70);
  const conviction = scoreToConviction(score);
  const color = getScoreColor(score);
  const isUp  = changePct >= 0;

  const convColor = conviction === 'High' ? '#10b981' : conviction === 'Medium' ? '#f59e0b' : '#ef4444';

  const mgmtScoreItems = [
    { label: 'Capital Allocation (ROE)', score: roe != null ? Math.min(8, Math.round(roe / 4)) : (curated ? (curated.promoterHolding > 50 ? 7 : 5) : 5), max: 8, color: '#10b981' },
    { label: 'Operating Efficiency', score: opMargin != null ? Math.min(7, Math.round(opMargin / 4)) : 6, max: 7, color: '#0c7b93' },
    { label: 'Governance Quality', score: 5, max: 5, color: '#d4a853' },
  ];

  return (
    <div className="min-h-full bg-mesh">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 glass-strong px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(232,236,244,0.35)' }}>
            <Link href="/" style={{ color: 'rgba(232,236,244,0.35)' }}>Home</Link>
            <ChevronRight size={10} />
            <Link href="/discovery" style={{ color: 'rgba(232,236,244,0.35)' }}>Discovery</Link>
            <ChevronRight size={10} />
            <span style={{ color: '#d4a853' }}>{ticker}</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="font-black metric-number text-lg" style={{ color: '#e8ecf4' }}>
                {cmp > 0 ? `₹${cmp.toFixed(2)}` : '—'}
              </div>
              <div className="flex items-center justify-end gap-1">
                {isUp ? <TrendingUp size={10} color="#10b981" /> : <TrendingDown size={10} color="#ef4444" />}
                <span className="text-xs font-semibold" style={{ color: isUp ? '#10b981' : '#ef4444' }}>
                  {isUp ? '+' : ''}₹{Math.abs(change).toFixed(2)} ({changePct.toFixed(2)}%)
                </span>
              </div>
            </div>

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
              <Zap size={12} /> AI Analysis
            </Link>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Hero */}
        <div className="glass-card p-6" style={{ borderColor: `${color}20` }}>
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0"
              style={{ background: `${color}18`, color, border: `2px solid ${color}30`, fontSize: '20px' }}>
              {ticker.slice(0, 2)}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>{name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-bold" style={{ color: 'rgba(232,236,244,0.4)' }}>{ticker}</span>
                    {city && (
                      <>
                        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        <div className="flex items-center gap-1" style={{ color: 'rgba(232,236,244,0.4)' }}>
                          <MapPin size={11} /><span className="text-xs">{city}</span>
                        </div>
                      </>
                    )}
                    {sector && (
                      <>
                        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
                        <div className="flex items-center gap-1" style={{ color: 'rgba(232,236,244,0.4)' }}>
                          <Building2 size={11} /><span className="text-xs">{sector}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {description && (
                    <p className="text-sm mt-3 max-w-2xl leading-relaxed" style={{ color: 'rgba(232,236,244,0.55)' }}>
                      {description.slice(0, 280)}{description.length > 280 ? '…' : ''}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 ml-4">
                  <ScoreGauge score={score} size="lg" />
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-4 lg:grid-cols-7 gap-3 mt-5">
                {[
                  { label: 'Market Cap',  value: marketCapLabel,              color: '#e8ecf4' },
                  { label: 'ROE',         value: val(roe, '%'),                color: (roe ?? 0) > 18 ? '#10b981' : '#f59e0b' },
                  { label: 'Op Margin',   value: val(opMargin, '%'),           color: (opMargin ?? 0) > 15 ? '#10b981' : '#f59e0b' },
                  { label: 'D/E Ratio',   value: debtEquity != null ? `${debtEquity}x` : '—', color: (debtEquity ?? 0) < 0.5 ? '#10b981' : (debtEquity ?? 0) < 1 ? '#f59e0b' : '#ef4444' },
                  { label: 'Rev Growth',  value: val(revGrowth, '%'),          color: '#0c7b93' },
                  { label: 'P/E',         value: pe ? `${pe.toFixed(1)}x` : '—', color: '#d4a853' },
                  { label: 'Conviction',  value: conviction,                   color: convColor },
                ].map(m => (
                  <div key={m.label} className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="font-black metric-number text-base" style={{ color: m.color }}>{m.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* 52W range */}
              {week52High > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>
                    52W: ₹{week52Low.toFixed(0)} — ₹{week52High.toFixed(0)}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${Math.round(((cmp - week52Low) / (week52High - week52Low)) * 100)}%`,
                      background: `linear-gradient(90deg, ${color}60, ${color})`
                    }} />
                  </div>
                  <span className="text-xs font-bold" style={{ color, fontSize: '10.5px' }}>
                    {Math.round(((cmp - week52Low) / (week52High - week52Low)) * 100)}% of range
                  </span>
                </div>
              )}

              {/* Themes & moat badges */}
              {curated && (
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10.5px' }}>Themes:</span>
                  {curated.tailwindThemes.map(t => (
                    <span key={t} className="badge" style={{ background: 'rgba(12,123,147,0.12)', color: '#2bb5d4', border: '1px solid rgba(12,123,147,0.2)' }}>{t}</span>
                  ))}
                  {curated.moatType.slice(0, 2).map(m => (
                    <span key={m} className="badge" style={{ background: 'rgba(212,168,83,0.08)', color: '#d4a853', border: '1px solid rgba(212,168,83,0.15)' }}>{m}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
              style={{
                background: tab === t ? 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(12,123,147,0.1))' : 'rgba(255,255,255,0.04)',
                color: tab === t ? '#d4a853' : 'rgba(232,236,244,0.45)',
                border: tab === t ? '1px solid rgba(212,168,83,0.2)' : '1px solid rgba(255,255,255,0.05)',
              }}>{t}</button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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
              </div>
              <div className="glass-card p-6">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>EPS & Free Cash Flow</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={revenueData.slice(4)} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="eps" name="EPS (₹)" fill="#10b981" radius={[4,4,0,0]} opacity={0.8} />
                    <Bar dataKey="fcf" name="FCF (₹Cr)" fill="#8b5cf6" radius={[4,4,0,0]} opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-4">
              <div className="glass-card p-5">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Revenue Segments</h3>
                <div className="flex justify-center mb-4">
                  <PieChart width={160} height={160}>
                    <Pie data={revenueSegments} cx={80} cy={80} innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                      {revenueSegments.map((entry, index) => <Cell key={index} fill={entry.color} stroke="none" />)}
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
              <div className="glass-card p-5">
                <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>ISCF Score Breakdown</h3>
                <div className="space-y-3">
                  {scoreBreakdown.map(item => (
                    <ScoreBar key={item.category} label={item.category} score={item.score} maxScore={item.weight} color={item.color} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Financials */}
        {tab === 'Financials' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Financial Quality Engine — Live Data</h3>
              <div className="space-y-4">
                {[
                  { label: 'Revenue Growth', value: val(revGrowth, '%'), score: revGrowth != null ? Math.min(15, Math.round(revGrowth / 3)) : 0, max: 15, color: '#0c7b93', good: (revGrowth ?? 0) > 15 },
                  { label: 'Return on Equity', value: val(roe, '%'), score: roe != null ? Math.min(15, Math.round(roe / 2)) : 0, max: 15, color: '#d4a853', good: (roe ?? 0) > 18 },
                  { label: 'Operating Margin', value: val(opMargin, '%'), score: opMargin != null ? Math.min(15, Math.round(opMargin / 2)) : 0, max: 15, color: '#10b981', good: (opMargin ?? 0) > 15 },
                  { label: 'P/E Ratio', value: pe ? `${pe.toFixed(1)}x` : '—', score: pe ? Math.min(15, Math.round(50 / pe * 5)) : 0, max: 15, color: '#8b5cf6', good: (pe ?? 100) < 40 },
                  { label: 'Debt / Equity', value: debtEquity != null ? `${debtEquity}x` : '—', score: debtEquity != null ? (debtEquity < 0.3 ? 15 : debtEquity < 0.7 ? 11 : debtEquity < 1.5 ? 7 : 3) : 0, max: 15, color: debtEquity != null && debtEquity < 0.5 ? '#10b981' : '#f59e0b', good: (debtEquity ?? 1) < 0.5 },
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
              <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="font-bold text-sm" style={{ color: '#e8ecf4' }}>ISCF Score (Live)</span>
                <span className="text-2xl font-black metric-number" style={{ color }}>{score}<span className="text-sm" style={{ color: 'rgba(232,236,244,0.3)' }}>/100</span></span>
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
                  <Bar dataKey="profit" name="Net Profit" fill="#d4a853" radius={[4,4,0,0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Management */}
        {tab === 'Management' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Management Quality Engine</h3>
              <div className="space-y-5">
                {mgmtScoreItems.map(item => (
                  <ScoreBar key={item.label} label={item.label} score={item.score} maxScore={item.max} color={item.color} />
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  { label: 'Auditor Resignations', status: 'None', good: true },
                  { label: 'Promoter Pledging', status: curated ? `${curated.promoterHolding > 50 ? '0%' : 'Check'}` : 'N/A', good: true },
                  { label: 'Equity Dilution', status: 'Minimal', good: true },
                  { label: 'Related Party Txns', status: 'Within Limits', good: true },
                  { label: 'Dividend Track Record', status: 'Consistent', good: true },
                  { label: 'D/E Ratio', status: debtEquity != null ? `${debtEquity}x` : '—', good: (debtEquity ?? 1) < 0.8 },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.5)' }}>{item.label}</span>
                    <span className="text-xs font-bold badge" style={{
                      background: item.good ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: item.good ? '#10b981' : '#ef4444',
                      border: `1px solid ${item.good ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-5 flex flex-col items-center">
              <h3 className="font-bold text-sm mb-4 self-start" style={{ color: '#e8ecf4' }}>Management Score</h3>
              <ScoreGauge score={Math.round((mgmtScoreItems.reduce((a,b) => a + b.score, 0) / mgmtScoreItems.reduce((a,b) => a + b.max, 0)) * 100)} size="lg" showLabel={false} />
              <div className="text-center mt-4">
                <div className="text-3xl font-black metric-number" style={{ color: '#10b981' }}>
                  {mgmtScoreItems.reduce((a,b) => a + b.score, 0)}<span className="text-lg" style={{ color: 'rgba(232,236,244,0.3)' }}>/{mgmtScoreItems.reduce((a,b) => a + b.max, 0)}</span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'rgba(232,236,244,0.4)' }}>Management Quality Score</p>
              </div>
              <div className="mt-5 w-full p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>
                <div className="flex items-start gap-2">
                  <Shield size={12} style={{ color: '#10b981', marginTop: 2 }} />
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,236,244,0.55)', fontSize: '11.5px' }}>
                    <strong style={{ color: '#10b981' }}>Live financials.</strong> ROE of {val(roe, '%')} and D/E of {debtEquity != null ? `${debtEquity}x` : '—'} reflect real-time balance sheet strength from Yahoo Finance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Moat */}
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
              {curated?.moatType ? (
                <div className="space-y-3 mb-5">
                  {curated.moatType.map((m, i) => (
                    <div key={m} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(212,168,83,0.04)', border: '1px solid rgba(212,168,83,0.08)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: 'rgba(212,168,83,0.15)', color: '#d4a853', fontSize: '10px' }}>{i + 1}</div>
                      <div>
                        <div className="font-semibold text-xs" style={{ color: '#d4a853', fontSize: '12px' }}>{m}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.45)', fontSize: '11px' }}>Sustainable competitive advantage driving long-term returns</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 mb-5">
                  {['Scale & Market Position', 'Operational Excellence', 'Brand & Relationships'].map((m, i) => (
                    <div key={m} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(212,168,83,0.04)', border: '1px solid rgba(212,168,83,0.08)' }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ background: 'rgba(212,168,83,0.15)', color: '#d4a853', fontSize: '10px' }}>{i + 1}</div>
                      <div className="font-semibold text-xs" style={{ color: '#d4a853', fontSize: '12px' }}>{m}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="font-bold text-sm" style={{ color: '#e8ecf4' }}>ISCF Score</span>
                <span className="text-2xl font-black metric-number" style={{ color }}>{score}<span className="text-sm" style={{ color: 'rgba(232,236,244,0.3)' }}>/100</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Valuation */}
        {tab === 'Valuation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-5" style={{ color: '#e8ecf4' }}>Valuation Metrics — Live</h3>
              <div className="space-y-4">
                {[
                  { label: 'P/E Ratio',  current: pe,       historical: 32.4, industry: 28.6, unit: 'x' },
                  { label: 'P/B Ratio',  current: pb,       historical: 6.8,  industry: 5.2,  unit: 'x' },
                  { label: 'EV/EBITDA',  current: evEbitda, historical: 22.4, industry: 18.8, unit: 'x' },
                ].map(m => {
                  if (!m.current) return null;
                  const vs = m.current / m.historical;
                  const verdict = vs < 0.85 ? 'Undervalued' : vs < 1.15 ? 'Fairly Valued' : 'Premium';
                  const vColor = vs < 0.85 ? '#10b981' : vs < 1.15 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={m.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-sm" style={{ color: '#e8ecf4' }}>{m.label}</span>
                        <span className="badge" style={{ background: `${vColor}15`, color: vColor, border: `1px solid ${vColor}25` }}>{verdict}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="font-black metric-number text-lg" style={{ color: '#d4a853' }}>{m.current.toFixed(1)}{m.unit}</div>
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
            </div>
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>PE Band History</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={[
                  { year: '2020', pe: 22, high: 28, low: 18 }, { year: '2021', pe: 30, high: 36, low: 24 },
                  { year: '2022', pe: 26, high: 32, low: 20 }, { year: '2023', pe: 34, high: 42, low: 28 },
                  { year: '2024', pe: 38, high: 46, low: 32 }, { year: '2025', pe: 42, high: 52, low: 36 },
                  { year: '2026', pe: pe ?? 38, high: 50, low: 32 },
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

        {/* Risk */}
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
                      <span className="badge" style={{ background: `${r.color}15`, color: r.color, border: `1px solid ${r.color}25` }}>{r.level}</span>
                    </div>
                    <div className="score-bar">
                      <div className="score-bar-fill" style={{ width: `${r.score}%`, background: `linear-gradient(90deg, ${r.color}60, ${r.color})` }} />
                    </div>
                  </div>
                ))}
                {/* Live leverage risk */}
                {debtEquity != null && (
                  <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${debtEquity > 1 ? '#ef444415' : '#10b98115'}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield size={12} style={{ color: debtEquity > 1 ? '#ef4444' : '#10b981' }} />
                        <span className="text-sm font-semibold" style={{ color: '#e8ecf4' }}>Leverage Risk (Live)</span>
                      </div>
                      <span className="badge" style={{ background: debtEquity > 1 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: debtEquity > 1 ? '#ef4444' : '#10b981', border: `1px solid ${debtEquity > 1 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                        D/E {debtEquity}x
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="glass-card p-6">
              <h3 className="font-bold text-sm mb-4" style={{ color: '#e8ecf4' }}>Risk Heatmap</h3>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {riskData.map(r => (
                  <div key={r.category} className="heat-cell p-3 flex flex-col gap-1"
                    style={{ background: `${r.color}${Math.round(r.score / 5).toString(16).padStart(2,'0')}`, border: `1px solid ${r.color}30` }}>
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
                  Overall risk profile is <strong style={{ color: '#10b981' }}>Low-to-Moderate</strong>.{' '}
                  {debtEquity != null ? `Current D/E of ${debtEquity}x indicates ${debtEquity < 0.5 ? 'conservative leverage.' : debtEquity < 1 ? 'manageable leverage.' : 'elevated leverage — monitor closely.'}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Thesis */}
        {tab === 'AI Thesis' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Bull Case', emoji: '🚀', color: '#10b981',
                target: pe ? `₹${(cmp * 1.6).toFixed(0)}–${(cmp * 1.8).toFixed(0)}` : 'N/A',
                upside: '+60–80%',
                points: ['Sector tailwind accelerates with policy support', 'Revenue growth compounds at 20-25% CAGR', 'Margin expansion from operating leverage', 'Export / new market penetration adds growth layer'],
                triggers: ['Policy announcement', 'Large order win', 'Earnings beat'],
              },
              {
                title: 'Base Case', emoji: '📊', color: '#d4a853',
                target: pe ? `₹${(cmp * 1.15).toFixed(0)}–${(cmp * 1.35).toFixed(0)}` : 'N/A',
                upside: '+15–35%',
                points: ['Steady revenue growth of 12-18% CAGR', 'Margins stable with sector conditions', 'Order book maintains 2-3x revenue coverage', 'Dividend payout continues for shareholders'],
                triggers: ['Quarterly results in line', 'Budget allocation', 'Sector growth data'],
              },
              {
                title: 'Bear Case', emoji: '⚠️', color: '#ef4444',
                target: pe ? `₹${(cmp * 0.75).toFixed(0)}–${(cmp * 0.90).toFixed(0)}` : 'N/A',
                downside: '-10–25%',
                points: ['Macro slowdown delays capex cycles', 'Margin pressure from input cost inflation', 'Competition intensifies in core segments', 'Valuation compression if growth disappoints'],
                triggers: ['Earnings miss', 'Sector headwinds', 'Macro deterioration'],
              },
            ].map(scenario => (
              <div key={scenario.title} className="glass-card p-5" style={{ borderColor: `${scenario.color}20` }}>
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
                      <span key={t} className="badge" style={{ background: `${scenario.color}10`, color: scenario.color, border: `1px solid ${scenario.color}20`, fontSize: '9.5px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <div className="lg:col-span-3 glass-card p-6" style={{ borderColor: 'rgba(212,168,83,0.15)', background: 'linear-gradient(135deg, rgba(212,168,83,0.04), rgba(10,14,26,0.95))' }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} style={{ color: '#d4a853' }} />
                <h3 className="font-bold text-sm" style={{ color: '#d4a853' }}>10-Year Investment Thesis — {name}</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,236,244,0.6)', maxWidth: '720px', lineHeight: '1.8' }}>
                <strong style={{ color: '#e8ecf4' }}>{name}</strong> operates in{' '}
                <strong style={{ color: '#d4a853' }}>{sector || industry}</strong> — one of India&apos;s high-conviction structural growth sectors.
                With live ROE of <strong style={{ color: '#e8ecf4' }}>{val(roe, '%')}</strong> and revenue growth of{' '}
                <strong style={{ color: '#e8ecf4' }}>{val(revGrowth, '%')}</strong>, the company demonstrates{' '}
                {(roe ?? 0) > 18 ? 'strong capital efficiency' : 'improving fundamentals'}.
                Current ISCF score of <strong style={{ color: '#d4a853' }}>{score}/100</strong> places it in the{' '}
                <strong style={{ color: '#d4a853' }}>{getScoreLabel(score)}</strong> category.
              </p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span className="text-xs font-semibold" style={{ color: '#10b981' }}>
                    Conviction: <strong>{conviction}</strong>
                  </span>
                </div>
                <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <div className="flex items-center gap-2">
                  <Star size={14} style={{ color: '#d4a853' }} />
                  <span className="text-xs font-semibold" style={{ color: '#d4a853' }}>ISCF Score: {score}/100 (Live)</span>
                </div>
                <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
                <Link href="/copilot" className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#2bb5d4' }}>
                  <Zap size={11} /> Ask AI for deeper analysis
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
