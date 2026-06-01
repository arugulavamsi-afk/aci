import type { LiveQuote } from './types';

// ── Sector tailwind scores (out of 25) ───────────────────────────────────────
// Yahoo Finance uses these sector names for Indian stocks
const SECTOR_TAILWIND: Record<string, number> = {
  'Industrials': 22,
  'Technology': 21,
  'Financial Services': 19,
  'Healthcare': 18,
  'Energy': 17,
  'Utilities': 16,
  'Basic Materials': 14,
  'Consumer Cyclical': 14,
  'Consumer Defensive': 13,
  'Communication Services': 13,
  'Real Estate': 11,
};

// High-conviction industry keywords that override sector score
const INDUSTRY_BOOST: [RegExp, number][] = [
  [/defense|defence|aerospace|naval/i, 25],
  [/railway|rail\s*infra/i, 24],
  [/power\s*finance|energy\s*financ/i, 23],
  [/renewable|solar|wind\s*energy/i, 23],
  [/shipbuild/i, 23],
  [/water\s*treat|water\s*infra/i, 22],
  [/semiconductor|drone|space/i, 22],
  [/epc|infra.*construct/i, 21],
];

function tailwindScore(sector: string, industry: string): number {
  for (const [re, score] of INDUSTRY_BOOST) {
    if (re.test(industry)) return score;
  }
  return SECTOR_TAILWIND[sector] ?? 10;
}

// ── Valuation score (out of 5) ────────────────────────────────────────────────
function valuationScore(pe: number | null): number {
  if (!pe || pe <= 0) return 2;
  if (pe <= 12) return 5;
  if (pe <= 22) return 4;
  if (pe <= 40) return 3;
  if (pe <= 65) return 2;
  return 1;
}

// ── Moat score (out of 15) ────────────────────────────────────────────────────
// Market cap is the strongest publicly-available moat proxy
function moatScore(marketCap: number | null): number {
  if (!marketCap) return 6;
  const cr = marketCap / 1e7; // convert to crores
  if (cr >= 100000) return 15;
  if (cr >= 30000) return 13;
  if (cr >= 8000) return 11;
  if (cr >= 2000) return 9;
  if (cr >= 500) return 7;
  return 5;
}

// ── Financial quality score (out of 15) ──────────────────────────────────────
// PE existence signals profitability; lower PE signals financial discipline
function financialScore(pe: number | null): number {
  if (!pe || pe <= 0) return 5;  // unprofitable
  if (pe <= 20) return 14;
  if (pe <= 35) return 12;
  if (pe <= 55) return 10;
  return 8;
}

// ── Growth efficiency score (out of 5) ───────────────────────────────────────
// 52-week range position as a momentum/growth proxy
function growthScore(week52High: number, week52Low: number, cmp: number): number {
  if (!week52High || !week52Low || week52High <= week52Low || cmp <= 0) return 2;
  const pos = (cmp - week52Low) / (week52High - week52Low);
  if (pos >= 0.75) return 5;
  if (pos >= 0.50) return 4;
  if (pos >= 0.30) return 3;
  return 2;
}

// ── Revenue opportunity score (out of 15) ────────────────────────────────────
// Mid-cap stocks in high-growth sectors have the most headroom
function revenueOpportunityScore(sector: string, marketCap: number | null): number {
  if (!marketCap) return 8;
  const cr = marketCap / 1e7;
  const highGrowth = ['Technology', 'Industrials', 'Healthcare', 'Financial Services', 'Energy'];
  const isHigh = highGrowth.includes(sector);
  if (cr >= 5000 && cr <= 80000 && isHigh) return 14;
  if (cr >= 1000 && isHigh) return 12;
  if (isHigh) return 10;
  if (cr >= 5000) return 9;
  return 7;
}

// ── Management quality score (out of 20) ─────────────────────────────────────
// Size + sector as a proxy (larger = longer track record; India PSU sectors penalised slightly)
function managementScore(sector: string, marketCap: number | null): number {
  if (!marketCap) return 12;
  const cr = marketCap / 1e7;
  let base = cr >= 50000 ? 18 : cr >= 15000 ? 16 : cr >= 3000 ? 14 : 11;
  // Sectors where promoter governance tends to be stronger
  if (['Technology', 'Healthcare', 'Financial Services'].includes(sector)) base += 1;
  return Math.min(20, base);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeIscfScore(quote: LiveQuote): number {
  const t = tailwindScore(quote.sector, quote.industry);
  const v = valuationScore(quote.pe);
  const mo = moatScore(quote.marketCap);
  const f = financialScore(quote.pe);
  const g = growthScore(quote.week52High, quote.week52Low, quote.cmp);
  const r = revenueOpportunityScore(quote.sector, quote.marketCap);
  const m = managementScore(quote.sector, quote.marketCap);
  return Math.min(100, Math.max(1, t + v + mo + f + g + r + m));
}

export function scoreToConviction(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 78) return 'High';
  if (score >= 62) return 'Medium';
  return 'Low';
}
