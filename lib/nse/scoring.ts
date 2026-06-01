import type { LiveQuote } from './types';

// When available (curated stocks), real fundamentals replace proxy estimates.
export interface ScoringExtras {
  roce?: number | null;
  promoterHolding?: number | null;
  revenueCagr3y?: number | null;
}

// ── Sector tailwind scores (out of 25) ───────────────────────────────────────
// Yahoo Finance sector names for Indian stocks
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

// ── Valuation (out of 5) ──────────────────────────────────────────────────────
function valuationScore(pe: number | null): number {
  if (!pe || pe <= 0) return 2;
  if (pe <= 12) return 5;
  if (pe <= 22) return 4;
  if (pe <= 40) return 3;
  if (pe <= 65) return 2;
  return 1;
}

// ── Moat (out of 15) — market cap proxy ──────────────────────────────────────
function moatScore(marketCap: number | null): number {
  if (!marketCap) return 6;
  const cr = marketCap / 1e7;
  if (cr >= 100000) return 15;
  if (cr >= 30000) return 13;
  if (cr >= 8000) return 11;
  if (cr >= 2000) return 9;
  if (cr >= 500) return 7;
  return 5;
}

// ── Financial quality (out of 15) ────────────────────────────────────────────
// Uses ROCE when available (far more accurate); falls back to PE proxy.
function financialScore(pe: number | null, roce?: number | null): number {
  if (roce != null) {
    if (roce >= 25) return 15;
    if (roce >= 18) return 13;
    if (roce >= 12) return 11;
    if (roce >= 8) return 8;
    return 5;
  }
  if (!pe || pe <= 0) return 5;
  if (pe <= 20) return 14;
  if (pe <= 35) return 12;
  if (pe <= 55) return 10;
  return 8;
}

// ── Growth efficiency (out of 5) ─────────────────────────────────────────────
// Uses 3Y revenue CAGR when available; falls back to 52W range position.
function growthScore(
  week52High: number, week52Low: number, cmp: number,
  revenueCagr3y?: number | null
): number {
  if (revenueCagr3y != null) {
    if (revenueCagr3y >= 30) return 5;
    if (revenueCagr3y >= 20) return 4;
    if (revenueCagr3y >= 10) return 3;
    return 2;
  }
  if (!week52High || !week52Low || week52High <= week52Low || cmp <= 0) return 2;
  const pos = (cmp - week52Low) / (week52High - week52Low);
  if (pos >= 0.75) return 5;
  if (pos >= 0.50) return 4;
  if (pos >= 0.30) return 3;
  return 2;
}

// ── Revenue opportunity (out of 15) ──────────────────────────────────────────
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

// ── Management quality (out of 20) ───────────────────────────────────────────
// Uses promoter holding when available; falls back to market cap + sector proxy.
function managementScore(
  sector: string, marketCap: number | null,
  promoterHolding?: number | null
): number {
  if (promoterHolding != null) {
    if (promoterHolding >= 65) return 19;
    if (promoterHolding >= 50) return 17;
    if (promoterHolding >= 35) return 15;
    if (promoterHolding >= 20) return 12;
    return 10;
  }
  if (!marketCap) return 12;
  const cr = marketCap / 1e7;
  let base = cr >= 50000 ? 18 : cr >= 15000 ? 16 : cr >= 3000 ? 14 : 11;
  if (['Technology', 'Healthcare', 'Financial Services'].includes(sector)) base += 1;
  return Math.min(20, base);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeIscfScore(quote: LiveQuote, extras?: ScoringExtras): number {
  const t  = tailwindScore(quote.sector, quote.industry);
  const v  = valuationScore(quote.pe);
  const mo = moatScore(quote.marketCap);
  const f  = financialScore(quote.pe, extras?.roce);
  const g  = growthScore(quote.week52High, quote.week52Low, quote.cmp, extras?.revenueCagr3y);
  const r  = revenueOpportunityScore(quote.sector, quote.marketCap);
  const m  = managementScore(quote.sector, quote.marketCap, extras?.promoterHolding);
  return Math.min(100, Math.max(1, t + v + mo + f + g + r + m));
}

export function scoreToConviction(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 78) return 'High';
  if (score >= 62) return 'Medium';
  return 'Low';
}
