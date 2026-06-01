import type { LiveQuote, StockFundamentals } from './types';

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

// ── Valuation (out of 5) ──────────────────────────────────────────────────────
function valuationScore(pe: number | null, pb: number | null): number {
  // PB as secondary signal when PE is missing or extreme
  let score = 2;
  if (pe && pe > 0) {
    score = pe <= 12 ? 5 : pe <= 22 ? 4 : pe <= 40 ? 3 : pe <= 65 ? 2 : 1;
  } else if (pb && pb > 0) {
    score = pb <= 1 ? 5 : pb <= 2.5 ? 4 : pb <= 5 ? 3 : 2;
  }
  return score;
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
// Priority: ROE → operating margin → PE proxy
function financialScore(
  pe: number | null,
  roe: number | null,
  operatingMargin: number | null
): number {
  if (roe != null) {
    if (roe >= 25) return 15;
    if (roe >= 18) return 13;
    if (roe >= 12) return 11;
    if (roe >= 7) return 8;
    return 5;
  }
  if (operatingMargin != null) {
    if (operatingMargin >= 25) return 14;
    if (operatingMargin >= 15) return 12;
    if (operatingMargin >= 8) return 10;
    if (operatingMargin >= 3) return 7;
    return 4;
  }
  // PE as last-resort proxy for profitability
  if (!pe || pe <= 0) return 5;
  if (pe <= 20) return 13;
  if (pe <= 35) return 11;
  if (pe <= 55) return 9;
  return 7;
}

// ── Growth efficiency (out of 5) ─────────────────────────────────────────────
// Priority: 3Y revenue CAGR → YoY revenue growth → 52W range position
function growthScore(
  week52High: number, week52Low: number, cmp: number,
  revenueCagr3y: number | null,
  revenueGrowthYoy: number | null
): number {
  const growth = revenueCagr3y ?? revenueGrowthYoy;
  if (growth != null) {
    if (growth >= 30) return 5;
    if (growth >= 20) return 4;
    if (growth >= 10) return 3;
    if (growth >= 0) return 2;
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
  sector: string, marketCap: number | null,
  grossMargin: number | null
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

  // High gross margin = pricing power = larger revenue opportunity
  if (grossMargin != null && grossMargin >= 40) base = Math.min(15, base + 1);
  return base;
}

// ── Management quality (out of 20) ───────────────────────────────────────────
// ROE is a strong management efficiency signal; market cap as fallback
function managementScore(
  sector: string, marketCap: number | null,
  roe: number | null,
  debtEquity: number | null
): number {
  let base = 12;

  if (roe != null) {
    base = roe >= 25 ? 18 : roe >= 18 ? 16 : roe >= 12 ? 14 : roe >= 7 ? 11 : 8;
  } else if (marketCap) {
    const cr = marketCap / 1e7;
    base = cr >= 50000 ? 17 : cr >= 15000 ? 15 : cr >= 3000 ? 13 : 11;
    if (['Technology', 'Healthcare', 'Financial Services'].includes(sector)) base += 1;
  }

  // Penalise high leverage (D/E > 1 is a yellow flag in capital-light businesses)
  if (debtEquity != null && debtEquity > 1.5) base = Math.max(8, base - 2);
  return Math.min(20, base);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeIscfScore(
  quote: LiveQuote,
  fundamentals?: StockFundamentals | null
): number {
  const f = fundamentals;
  const t  = tailwindScore(quote.sector, quote.industry);
  const v  = valuationScore(quote.pe, f?.pb ?? null);
  const mo = moatScore(quote.marketCap);
  const fi = financialScore(quote.pe, f?.roe ?? null, f?.operatingMargin ?? null);
  const g  = growthScore(
    quote.week52High, quote.week52Low, quote.cmp,
    f?.revenueCagr3y ?? null, f?.revenueGrowthYoy ?? null
  );
  const r  = revenueOpportunityScore(quote.sector, quote.marketCap, f?.grossMargin ?? null);
  const m  = managementScore(quote.sector, quote.marketCap, f?.roe ?? null, f?.debtEquity ?? null);
  return Math.min(100, Math.max(1, t + v + mo + fi + g + r + m));
}

export function scoreToConviction(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 78) return 'High';
  if (score >= 62) return 'Medium';
  return 'Low';
}
