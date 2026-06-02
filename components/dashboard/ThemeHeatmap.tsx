'use client';

import { tailwindConfig } from '@/lib/nse/tailwindConfig';
import Link from 'next/link';

// Display metadata for each sector key in tailwind-config.json
const SECTOR_META: Record<string, { name: string; icon: string; color: string }> = {
  pharma_healthcare:     { name: 'Pharma & Healthcare',   icon: '💊', color: '#10b981' },
  digital_it:            { name: 'Digital & IT Services', icon: '💻', color: '#2bb5d4' },
  power_renewable:       { name: 'Power & Renewables',    icon: '⚡', color: '#f59e0b' },
  pli_manufacturing:     { name: 'Manufacturing & PLI',   icon: '🏭', color: '#10b981' },
  railways:              { name: 'Railways & Metro',       icon: '🚄', color: '#8b5cf6' },
  roads_ports_logistics: { name: 'Roads & Ports',         icon: '🛣️', color: '#6366f1' },
  financial_services:    { name: 'Financial Services',    icon: '🏦', color: '#0c7b93' },
  defense:               { name: 'Defense & Aerospace',   icon: '🛡️', color: '#d4a853' },
  ev_mobility:           { name: 'EV & Mobility',         icon: '🔋', color: '#ec4899' },
  semiconductor:         { name: 'Semiconductors',        icon: '🔲', color: '#a855f7' },
  specialty_chemicals:   { name: 'Specialty Chemicals',   icon: '🧪', color: '#06b6d4' },
  water_infra:           { name: 'Water Infrastructure',  icon: '💧', color: '#0891b2' },
  capital_goods:         { name: 'Capital Goods',         icon: '⚙️', color: '#78716c' },
  agri_food:             { name: 'Agriculture & Food',    icon: '🌾', color: '#65a30d' },
  shipbuilding:          { name: 'Shipbuilding',          icon: '🚢', color: '#0891b2' },
  drone_space:           { name: 'Drones & Space',        icon: '🚀', color: '#7c3aed' },
  real_estate:           { name: 'Real Estate',           icon: '🏗️', color: '#b45309' },
};

const STRENGTH_LABEL: Record<string, string> = {
  very_strong: 'Very Strong',
  strong:      'Strong',
  moderate:    'Moderate',
  weak:        'Weak',
};

// Top 8 sectors by policyWeight — drives the heatmap
const heatmapSectors = Object.entries(tailwindConfig.sectors)
  .sort((a, b) => b[1].policyWeight - a[1].policyWeight)
  .slice(0, 8)
  .map(([key, cfg]) => ({
    key,
    cfg,
    meta: SECTOR_META[key] ?? { name: key, icon: '📊', color: '#6b7280' },
    // policyWeight is 0–20; scale to 0–100 for the score display and bar
    score: Math.round((cfg.policyWeight / 20) * 100),
  }));

export default function ThemeHeatmap() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-bold text-base" style={{ color: '#e8ecf4' }}>Structural Tailwind Engine</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
            {tailwindConfig.budgetYear} budget allocation · ranked by policy weight · updated {tailwindConfig.lastUpdated}
          </p>
        </div>
        <Link href="/discovery" className="btn-ghost text-xs py-1.5 px-3">
          Screen Stocks
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {heatmapSectors.map(({ key, cfg, meta, score }) => {
          const intensity = score / 100;
          return (
            <div
              key={key}
              className="heat-cell p-4 flex flex-col gap-2"
              style={{
                background: `linear-gradient(135deg, ${meta.color}${Math.round(intensity * 28).toString(16).padStart(2, '0')}, ${meta.color}${Math.round(intensity * 14).toString(16).padStart(2, '0')})`,
                border: `1px solid ${meta.color}${Math.round(intensity * 40).toString(16).padStart(2, '0')}`,
              }}
            >
              <div className="flex items-start justify-between">
                <span className="text-xl">{meta.icon}</span>
                <div className="text-right">
                  <div className="font-black metric-number" style={{ color: meta.color, fontSize: '20px', lineHeight: 1 }}>
                    {cfg.policyWeight}
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>/20</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-bold leading-tight" style={{ color: 'rgba(232,236,244,0.9)', fontSize: '12px' }}>
                  {meta.name}
                </div>
                <div className="mt-0.5" style={{ color: meta.color, fontSize: '9.5px', fontWeight: 600, opacity: 0.8 }}>
                  {STRENGTH_LABEL[cfg.tailwindStrength]}
                </div>
              </div>

              <div className="text-xs leading-snug" style={{ color: 'rgba(232,236,244,0.4)', fontSize: '10px' }}>
                {cfg.keyHighlight
                  ? cfg.keyHighlight.slice(0, 72) + (cfg.keyHighlight.length > 72 ? '…' : '')
                  : cfg.schemes.slice(0, 2).join(', ') || meta.name}
              </div>

              {/* Policy weight bar */}
              <div className="score-bar mt-auto">
                <div
                  className="score-bar-fill"
                  style={{ width: `${score}%`, background: `linear-gradient(90deg, ${meta.color}60, ${meta.color})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
