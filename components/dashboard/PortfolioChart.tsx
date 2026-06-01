'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const data = [
  { month: 'Jun\'25', value: 100, nifty: 100 },
  { month: 'Jul', value: 108, nifty: 103 },
  { month: 'Aug', value: 114, nifty: 101 },
  { month: 'Sep', value: 122, nifty: 106 },
  { month: 'Oct', value: 119, nifty: 104 },
  { month: 'Nov', value: 131, nifty: 109 },
  { month: 'Dec', value: 138, nifty: 112 },
  { month: 'Jan\'26', value: 142, nifty: 110 },
  { month: 'Feb', value: 155, nifty: 115 },
  { month: 'Mar', value: 162, nifty: 118 },
  { month: 'Apr', value: 174, nifty: 120 },
  { month: 'May', value: 185, nifty: 122 },
  { month: 'Jun', value: 194, nifty: 124 },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(232,236,244,0.6)' }}>{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: i === 0 ? '#d4a853' : '#0c7b93' }} />
            <span className="text-xs" style={{ color: 'rgba(232,236,244,0.5)' }}>{p.name === 'value' ? 'ISCF Portfolio' : 'NIFTY 50'}:</span>
            <span className="text-xs font-bold" style={{ color: i === 0 ? '#d4a853' : '#0c7b93' }}>{p.value}%</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function PortfolioChart() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>Portfolio Performance</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
            ISCF High Conviction vs NIFTY 50 (base 100)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#d4a853' }} />
            <span className="text-xs" style={{ color: 'rgba(232,236,244,0.5)', fontSize: '11px' }}>ISCF Portfolio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#0c7b93' }} />
            <span className="text-xs" style={{ color: 'rgba(232,236,244,0.5)', fontSize: '11px' }}>NIFTY 50</span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-6 mb-5">
        <div>
          <span className="text-3xl font-black metric-number" style={{ color: '#d4a853' }}>+94%</span>
          <span className="text-sm ml-2" style={{ color: 'rgba(232,236,244,0.4)' }}>vs NIFTY +24%</span>
        </div>
        <div className="pb-1">
          <span className="text-xs px-2 py-1 rounded-lg font-semibold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: '11px' }}>
            Alpha: +70% pts in 12 months
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#d4a853" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#d4a853" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0c7b93" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0c7b93" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(232,236,244,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="nifty" stroke="#0c7b93" strokeWidth={1.5}
            fill="url(#niftyGrad)" dot={false} activeDot={{ r: 4, fill: '#0c7b93' }} />
          <Area type="monotone" dataKey="value" stroke="#d4a853" strokeWidth={2}
            fill="url(#portfolioGrad)" dot={false} activeDot={{ r: 5, fill: '#d4a853', strokeWidth: 2, stroke: '#060810' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
