import type { LiveQuote } from './types';

// ── Sector tailwind (out of 25) ───────────────────────────────────────────────
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

// ── Valuation (out of 5) — PE primary, PB secondary ──────────────────────────
function valuationScore(pe: number | null, pb: number | null): number {
  if (pe && pe > 0) {
    if (pe <= 12) return 5;
    if (pe <= 22) return 4;
    if (pe <= 40) return 3;
    if (pe <= 65) return 2;
    return 1;
  }
  if (pb && pb > 0) {
    if (pb <= 1)   return 5;
    if (pb <= 2.5) return 4;
    if (pb <= 5)   return 3;
    return 2;
  }
  return 2;
}

// ── Moat (out of 15) — market cap proxy ──────────────────────────────────────
function moatScore(marketCap: number | null): number {
  if (!marketCap) return 6;
  const cr = marketCap / 1e7;
  if (cr >= 100000) return 15;
  if (cr >= 30000)  return 13;
  if (cr >= 8000)   return 11;
  if (cr >= 2000)   return 9;
  if (cr >= 500)    return 7;
  return 5;
}

// ── Financial quality (out of 15) — ROE → op margin → PE proxy ───────────────
function financialScore(
  pe: number | null,
  roe: number | null,
  operatingMargin: number | null
): number {
  if (roe != null) {
    if (roe >= 25) return 15;
    if (roe >= 18) return 13;
    if (roe >= 12) return 11;
    if (roe >= 7)  return 8;
    return 5;
  }
  if (operatingMargin != null) {
    if (operatingMargin >= 25) return 14;
    if (operatingMargin >= 15) return 12;
    if (operatingMargin >= 8)  return 10;
    if (operatingMargin >= 3)  return 7;
    return 4;
  }
  if (!pe || pe <= 0) return 5;
  if (pe <= 20) return 13;
  if (pe <= 35) return 11;
  return 8;
}

// ── Growth efficiency (out of 5) — revenue growth → 52W position ─────────────
function growthScore(
  week52High: number, week52Low: number, cmp: number,
  revenueGrowth: number | null,
  earningsGrowth: number | null
): number {
  const g = revenueGrowth ?? earningsGrowth;
  if (g != null) {
    if (g >= 30) return 5;
    if (g >= 20) return 4;
    if (g >= 10) return 3;
    if (g >= 0)  return 2;
    return 1;
  }
  if (!week52High || !week52Low || week52High <= week52Low || cmp <= 0) return 2;
  const pos = (cmp - week52Low) / (week52High - week52Low);
  if (pos >= 0.75) return 5;
  if (pos >= 0.50) return 4;
  if (pos >= 0.30) return 3;
  return 2;
}

// ── Revenue opportunity (out of 15) ──────────────────────────────────────────
function revenueOpportunityScore(
  sector: string, marketCap: number | null, grossMargin: number | null
): number {
  if (!marketCap) return 8;
  const cr = marketCap / 1e7;
  const highGrowth = ['Technology', 'Industrials', 'Healthcare', 'Financial Services', 'Energy'];
  const isHigh = highGrowth.includes(sector);
  let base = 7;
  if (cr >= 5000 && cr <= 80000 && isHigh) base = 14;
  else if (cr >= 1000 && isHigh) base = 12;
  else if (isHigh) base = 10;
  else if (cr >= 5000) base = 9;
  if (grossMargin != null && grossMargin >= 40) base = Math.min(15, base + 1);
  return base;
}

// ── Management quality (out of 20) — ROE proxy, penalise high leverage ────────
function managementScore(
  sector: string, marketCap: number | null,
  roe: number | null, debtEquity: number | null
): number {
  let base: number;
  if (roe != null) {
    base = roe >= 25 ? 18 : roe >= 18 ? 16 : roe >= 12 ? 14 : roe >= 7 ? 11 : 8;
  } else if (marketCap) {
    const cr = marketCap / 1e7;
    base = cr >= 50000 ? 17 : cr >= 15000 ? 15 : cr >= 3000 ? 13 : 11;
    if (['Technology', 'Healthcare', 'Financial Services'].includes(sector)) base += 1;
  } else {
    base = 12;
  }
  if (debtEquity != null && debtEquity > 1.5) base = Math.max(8, base - 2);
  return Math.min(20, base);
}

// ── Public API ────────────────────────────────────────────────────────────────

// All inputs come directly from the LiveQuote — no separate fundamentals fetch needed.
export function computeIscfScore(quote: LiveQuote): number {
  const t  = tailwindScore(quote.sector, quote.industry);
  const v  = valuationScore(quote.pe, quote.pb);
  const mo = moatScore(quote.marketCap);
  const fi = financialScore(quote.pe, quote.roe, quote.operatingMargin);
  const g  = growthScore(
    quote.week52High, quote.week52Low, quote.cmp,
    quote.revenueGrowth, quote.earningsGrowth
  );
  const r  = revenueOpportunityScore(quote.sector, quote.marketCap, quote.grossMargin);
  const m  = managementScore(quote.sector, quote.marketCap, quote.roe, quote.debtEquity);
  return Math.min(100, Math.max(1, t + v + mo + fi + g + r + m));
}

export function scoreToConviction(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 78) return 'High';
  if (score >= 62) return 'Medium';
  return 'Low';
}
