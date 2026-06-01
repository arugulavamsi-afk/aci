'use client';

import { getScoreColor, getScoreLabel } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function ScoreGauge({ score, size = 'md', showLabel = true }: ScoreGaugeProps) {
  const sizes = { sm: 80, md: 120, lg: 160 };
  const dim = sizes[size];
  const strokeWidths = { sm: 6, md: 8, lg: 10 };
  const sw = strokeWidths[size];
  const r = (dim / 2) - sw - 2;
  const circumference = 2 * Math.PI * r;
  const dashArray = circumference * 0.75;
  const dashOffset = dashArray * (1 - score / 100);
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
          {/* Track */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${dashArray} ${circumference}`}
            strokeDashoffset={0}
            transform={`rotate(135 ${dim / 2} ${dim / 2})`}
          />
          {/* Progress */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${dashArray} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(135 ${dim / 2} ${dim / 2})`}
            style={{
              filter: `drop-shadow(0 0 8px ${color}60)`,
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
          {/* Inner glow circle */}
          <circle cx={dim / 2} cy={dim / 2} r={r - sw / 2 - 4}
            fill="none" stroke={`${color}10`} strokeWidth={1} />
        </svg>

        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-black metric-number"
            style={{ color, fontSize: size === 'lg' ? 40 : size === 'md' ? 28 : 20, lineHeight: 1 }}
          >
            {score}
          </span>
          {size !== 'sm' && (
            <span className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>
              / 100
            </span>
          )}
        </div>
      </div>

      {showLabel && (
        <div className="text-center">
          <div
            className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
            style={{
              background: `${color}15`,
              color,
              border: `1px solid ${color}30`,
              fontSize: '10px',
              letterSpacing: '0.08em',
            }}
          >
            {getScoreLabel(score)}
          </div>
        </div>
      )}
    </div>
  );
}
