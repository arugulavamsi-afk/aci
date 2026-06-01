'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: number;
  color?: string;
  accent?: string;
}

export default function StatCard({ label, value, sub, icon, trend, color = '#d4a853', accent }: StatCardProps) {
  return (
    <div
      className="glass-card p-5 hover-glow-gold transition-all duration-300"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Background accent glow */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full"
        style={{ background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, transform: 'translate(30%, -30%)' }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '10.5px', letterSpacing: '0.08em' }}>
            {label}
          </span>
          {icon && (
            <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
              <span style={{ color }}>{icon}</span>
            </div>
          )}
        </div>

        <div className="flex items-end gap-3">
          <span className="font-black metric-number leading-none" style={{ color, fontSize: '32px' }}>
            {value}
          </span>
          {trend !== undefined && (
            <div className="flex items-center gap-1 mb-1">
              {trend >= 0 ? <TrendingUp size={12} color="#10b981" /> : <TrendingDown size={12} color="#ef4444" />}
              <span className="text-xs font-semibold" style={{ color: trend >= 0 ? '#10b981' : '#ef4444', fontSize: '11px' }}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            </div>
          )}
        </div>

        {sub && (
          <p className="mt-2 text-xs" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '11.5px' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
