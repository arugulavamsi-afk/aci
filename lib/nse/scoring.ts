import type { LiveQuote } from './types';
import { getSectorConfig, SECTOR_TO_CONFIG } from './tailwindConfig';

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 1 — STRUCTURAL TAILWIND  (max 25 pts)
//
// Two-part score:
//   A. Policy weight (0–20): Read from tailwind-config.json, sourced from
//      Union Budget PDFs via Claude extraction (run /admin/tailwind to refresh)
//   B. Materialisation bonus (0–5): Is THIS company actually capturing the benefit?
//      → Revenue/earnings growth proves the tailwind is flowing to the P&L
// ─────────────────────────────────────────────────────────────────────────────

function materialisationBonus(
  revenueGrowth: number | null,
  earningsGrowth: number | null
): number {
  const g = revenueGrowth ?? earningsGrowth;
  if (g == null) return 1; // unknown — neutral
  if (g >= 25)  return 5;  // tailwind clearly flowing through to P&L
  if (g >= 15)  return 4;
  if (g >= 8)   return 3;
  if (g >= 0)   return 2;
  return 0;                // negative growth = tailwind not materialising
}

function tailwindScore(
  sector: string, industry: string,
  revenueGrowth: number | null, earningsGrowth: number | null
): number {
  const cfg = getSectorConfig(sector, industry);
  const policyWeight = cfg?.policyWeight
    ?? (SECTOR_TO_CONFIG[sector] ? 12 : 9); // use sector fallback or unknown
  return Math.min(25, policyWeight + materialisationBonus(revenueGrowth, earningsGrowth));
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 2 — MANAGEMENT QUALITY  (max 20 pts)
//
// ROE is the primary signal for capital allocation quality.
// D/E penalises financial engineering (high ROE via leverage ≠ real skill).
// ─────────────────────────────────────────────────────────────────────────────

function managementScore(
  sector: string, marketCap: number | null,
  roe: number | null, debtEquity: number | null
): number {
  let base: number;

  if (roe != null) {
    // Distinguish organic ROE (low D/E) from leverage-inflated ROE
    const leverageFactor = (debtEquity ?? 0) > 1 ? 0.85 : 1;
    const adjustedRoe = roe * leverageFactor;
    base = adjustedRoe >= 25 ? 19
         : adjustedRoe >= 20 ? 17
         : adjustedRoe >= 15 ? 15
         : adjustedRoe >= 10 ? 12
         : adjustedRoe >= 5  ? 9
         : 6;
  } else if (marketCap) {
    const cr = marketCap / 1e7;
    base = cr >= 50000 ? 16 : cr >= 15000 ? 14 : cr >= 3000 ? 12 : 10;
    if (['Technology', 'Healthcare', 'Financial Services'].includes(sector)) base += 1;
  } else {
    base = 10;
  }

  // Hard penalty for extreme leverage — sign of poor capital discipline
  if (debtEquity != null && debtEquity > 2) base = Math.max(7, base - 3);

  return Math.min(20, base);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 3 — FINANCIAL QUALITY  (max 15 pts)
//
// Multi-parameter composite — each sub-dimension gets its own allocation:
//   A. Return on Capital (0–5): ROE quality
//   B. Margin Profile (0–4): Operating + gross margin combo
//   C. Balance Sheet (0–3): Debt discipline
//   D. Growth Quality (0–3): Revenue × earnings momentum
// ─────────────────────────────────────────────────────────────────────────────

function financialScore(
  pe: number | null,
  roe: number | null,
  operatingMargin: number | null,
  grossMargin: number | null,
  revenueGrowth: number | null,
  earningsGrowth: number | null,
  debtEquity: number | null
): number {
  // A. Return on Capital (0–5)
  let returnPts = 2; // default when no data
  if (roe != null) {
    returnPts = roe >= 25 ? 5 : roe >= 18 ? 4 : roe >= 12 ? 3 : roe >= 7 ? 2 : 1;
  } else if (pe && pe > 0) {
    // PE as rough profitability proxy when ROE missing
    returnPts = pe <= 20 ? 3 : pe <= 40 ? 2 : 1;
  }

  // B. Margin Profile (0–4): operating margin is efficiency; gross margin is pricing power
  let marginPts = 1;
  if (operatingMargin != null) {
    marginPts = operatingMargin >= 22 ? 4
              : operatingMargin >= 15 ? 3
              : operatingMargin >= 8  ? 2
              : operatingMargin >= 3  ? 1
              : 0;
    // Bonus if gross margin is also high (durable product economics)
    if (grossMargin != null && grossMargin >= 40 && marginPts < 4) marginPts += 1;
  } else if (grossMargin != null) {
    marginPts = grossMargin >= 50 ? 3 : grossMargin >= 30 ? 2 : 1;
  }

  // C. Balance Sheet Health (0–3)
  let debtPts = 1; // unknown = neutral
  if (debtEquity != null) {
    debtPts = debtEquity < 0.25 ? 3     // near debt-free = strong
            : debtEquity < 0.75 ? 2     // conservative
            : debtEquity < 1.5  ? 1     // manageable
            : 0;                        // leveraged
  }

  // D. Growth Quality (0–3): both revenue AND earnings growing = high quality
  let growthPts = 1;
  const revG = revenueGrowth ?? 0;
  const epsG = earningsGrowth ?? 0;
  if (revenueGrowth != null || earningsGrowth != null) {
    if (revG >= 20 && epsG >= 15)      growthPts = 3; // top-line and bottom-line both strong
    else if (revG >= 15 || epsG >= 20) growthPts = 2;
    else if (revG >= 0 && epsG >= 0)   growthPts = 1;
    else                                growthPts = 0; // deteriorating
  }

  return Math.min(15, returnPts + marginPts + debtPts + growthPts);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 4 — MOAT STRENGTH  (max 15 pts)
//
// Three distinct moat dimensions:
//   A. Pricing Power (0–5): Gross margin → can the company charge a premium?
//   B. Capital Efficiency Durability (0–5): High ROE without heavy leverage
//      = a real moat, not financial engineering
//   C. Structural / Regulatory Position (0–5): Industry barriers + scale
// ─────────────────────────────────────────────────────────────────────────────

// Industries with structural/regulatory moats — barriers to entry are non-financial
const REGULATORY_MOAT_INDUSTRIES = [
  /defense|defence|aerospace|naval/i,       // security clearances, 5+ year qualification
  /pharma|drug\s*mfg|api\s*mfg/i,           // drug approvals, patent protection
  /power\s*(utility|grid|transmiss)/i,       // regulated tariff, geographic monopoly
  /railway|rail\s*vikas/i,                   // government mandate, land acquisition
  /shipbuild|shipyard/i,                     // strategic national assets, NCCD
  /water\s*(utility|treat|supply)/i,         // municipal contracts, long tenure
  /telecom/i,                                // spectrum licenses, high capex
  /insurance/i,                              // IRDAI regulation, trust-based
];

function moatScore(
  sector: string, industry: string,
  marketCap: number | null,
  grossMargin: number | null,
  roe: number | null,
  debtEquity: number | null
): number {
  // A. Pricing Power (0–5): gross margin reveals whether customers pay a premium
  let pricingPts = 2; // default when no data
  if (grossMargin != null) {
    pricingPts = grossMargin >= 60 ? 5   // software, branded pharma, luxury
               : grossMargin >= 45 ? 4   // specialty chemicals, strong brands
               : grossMargin >= 28 ? 3   // industrial differentiation
               : grossMargin >= 15 ? 2   // moderate
               : 1;                      // commodity / pass-through
  }

  // B. Capital Efficiency Durability (0–5)
  // High ROE + low leverage = genuine competitive advantage, not financial tricks
  let efficiencyPts = 2;
  if (roe != null) {
    const isLeveraged = (debtEquity ?? 0) > 1.0;
    if (roe >= 22 && !isLeveraged)      efficiencyPts = 5;
    else if (roe >= 18)                 efficiencyPts = 4;
    else if (roe >= 12)                 efficiencyPts = 3;
    else if (roe >= 7)                  efficiencyPts = 2;
    else                                efficiencyPts = 1;
  } else if (marketCap) {
    const cr = marketCap / 1e7;
    efficiencyPts = cr >= 50000 ? 4 : cr >= 10000 ? 3 : cr >= 2000 ? 2 : 1;
  }

  // C. Structural / Regulatory Position (0–5)
  let structuralPts = 2; // default competitive market
  const hasRegMoat = REGULATORY_MOAT_INDUSTRIES.some(re => re.test(industry));
  if (hasRegMoat) {
    structuralPts = 5; // high barriers — clearances, licences, national importance
  } else {
    const cr = (marketCap ?? 0) / 1e7;
    const techSectors = ['Technology', 'Healthcare'];
    if (techSectors.includes(sector) && cr >= 5000)  structuralPts = 4; // IP + scale
    else if (cr >= 30000)                             structuralPts = 4; // scale moat
    else if (cr >= 8000)                              structuralPts = 3;
    else                                              structuralPts = 2;
  }

  return Math.min(15, pricingPts + efficiencyPts + structuralPts);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 5 — REVENUE OPPORTUNITY  (max 15 pts)
// ─────────────────────────────────────────────────────────────────────────────

function revenueOpportunityScore(
  sector: string, marketCap: number | null, grossMargin: number | null
): number {
  if (!marketCap) return 7;
  const cr = marketCap / 1e7;
  const highGrowth = ['Technology', 'Industrials', 'Healthcare', 'Financial Services', 'Energy'];
  const isHigh = highGrowth.includes(sector);

  // Sweet spot: mid-cap in high-growth sector = large runway ahead
  let base = 7;
  if (cr >= 5000 && cr <= 80000 && isHigh) base = 14;
  else if (cr >= 1000 && isHigh)           base = 12;
  else if (isHigh)                         base = 10;
  else if (cr >= 5000)                     base = 9;

  // Pricing power amplifies the opportunity (can expand margins as scale grows)
  if (grossMargin != null && grossMargin >= 40) base = Math.min(15, base + 1);
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 6 — GROWTH EFFICIENCY  (max 5 pts)
// ─────────────────────────────────────────────────────────────────────────────

function growthScore(
  week52High: number, week52Low: number, cmp: number,
  revenueGrowth: number | null, earningsGrowth: number | null
): number {
  const g = revenueGrowth ?? earningsGrowth;
  if (g != null) {
    if (g >= 30) return 5;
    if (g >= 20) return 4;
    if (g >= 10) return 3;
    if (g >= 0)  return 2;
    return 1;
  }
  // Fallback: 52W position as momentum proxy
  if (!week52High || !week52Low || week52High <= week52Low || cmp <= 0) return 2;
  const pos = (cmp - week52Low) / (week52High - week52Low);
  if (pos >= 0.75) return 5;
  if (pos >= 0.50) return 4;
  if (pos >= 0.30) return 3;
  return 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 7 — VALUATION  (max 5 pts)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export function computeIscfScore(quote: LiveQuote): number {
  const t  = tailwindScore(
    quote.sector, quote.industry,
    quote.revenueGrowth, quote.earningsGrowth
  );
  const m  = managementScore(quote.sector, quote.marketCap, quote.roe, quote.debtEquity);
  const fi = financialScore(
    quote.pe, quote.roe, quote.operatingMargin, quote.grossMargin,
    quote.revenueGrowth, quote.earningsGrowth, quote.debtEquity
  );
  const mo = moatScore(
    quote.sector, quote.industry, quote.marketCap,
    quote.grossMargin, quote.roe, quote.debtEquity
  );
  const r  = revenueOpportunityScore(quote.sector, quote.marketCap, quote.grossMargin);
  const g  = growthScore(
    quote.week52High, quote.week52Low, quote.cmp,
    quote.revenueGrowth, quote.earningsGrowth
  );
  const v  = valuationScore(quote.pe, quote.pb);

  return Math.min(100, Math.max(1, t + m + fi + mo + r + g + v));
}

export function scoreToConviction(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 78) return 'High';
  if (score >= 62) return 'Medium';
  return 'Low';
}
