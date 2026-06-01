'use client';

import { themeData } from '@/lib/data/mockData';
import Link from 'next/link';

export default function ThemeHeatmap() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>Structural Tailwind Engine</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
            India&apos;s mega-themes by growth potential & capital opportunity
          </p>
        </div>
        <Link href="/discovery" className="btn-ghost text-xs py-1.5 px-3">
          Explore All
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {themeData.map(theme => {
          const intensity = theme.growthScore / 100;
          return (
            <Link
              href={`/discovery?theme=${theme.id}`}
              key={theme.id}
              className="heat-cell p-4 flex flex-col gap-2 group"
              style={{
                background: `linear-gradient(135deg, ${theme.color}${Math.round(intensity * 28).toString(16).padStart(2,'0')}, ${theme.color}${Math.round(intensity * 14).toString(16).padStart(2,'0')})`,
                border: `1px solid ${theme.color}${Math.round(intensity * 40).toString(16).padStart(2,'0')}`,
              }}
            >
              <div className="flex items-start justify-between">
                <span className="text-xl">{theme.icon}</span>
                <div
                  className="text-xs font-black metric-number"
                  style={{ color: theme.color, fontSize: '22px', lineHeight: 1 }}
                >
                  {theme.growthScore}
                </div>
              </div>

              <div>
                <div className="font-bold text-xs leading-tight" style={{ color: 'rgba(232,236,244,0.9)', fontSize: '12px' }}>
                  {theme.name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '10.5px' }}>
                  {theme.description}
                </div>
              </div>

              <div className="flex items-center justify-between mt-1 pt-2" style={{ borderTop: `1px solid ${theme.color}20` }}>
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: theme.color, fontSize: '11px' }}>
                    {theme.companies}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9px' }}>
                    Companies
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: theme.color, fontSize: '11px' }}>
                    {theme.cagr}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9px' }}>
                    CAGR
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: theme.color, fontSize: '10px' }}>
                    {theme.capitalOpportunity}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '9px' }}>
                    Opportunity
                  </div>
                </div>
              </div>

              {/* Score bar */}
              <div className="score-bar mt-1">
                <div
                  className="score-bar-fill"
                  style={{ width: `${theme.growthScore}%`, background: `linear-gradient(90deg, ${theme.color}60, ${theme.color})` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
