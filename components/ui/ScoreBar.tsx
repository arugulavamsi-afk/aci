'use client';

interface ScoreBarProps {
  label: string;
  score: number;
  maxScore: number;
  color: string;
  weight?: number;
}

export default function ScoreBar({ label, score, maxScore, color, weight }: ScoreBarProps) {
  const pct = (score / maxScore) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'rgba(232,236,244,0.6)', fontSize: '12px' }}>
          {label}
          {weight !== undefined && (
            <span className="ml-1.5 text-xs" style={{ color: 'rgba(232,236,244,0.25)', fontSize: '10px' }}>
              (wt: {weight})
            </span>
          )}
        </span>
        <span className="text-xs font-bold metric-number" style={{ color }}>
          {score}<span style={{ color: 'rgba(232,236,244,0.25)', fontWeight: 400 }}>/{maxScore}</span>
        </span>
      </div>
      <div className="score-bar">
        <div
          className="score-bar-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }}
        />
      </div>
    </div>
  );
}
