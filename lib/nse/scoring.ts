import type { LiveQuote } from './types';
import { getSectorConfig, SECTOR_TO_CONFIG } from './tailwindConfig';
import { getGovBoost } from './govIntelligence';

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
  earningsGrowth: number | null,
  operatingMargin: number | null,
  grossMargin: number | null,
): number {
  // Growth signal (0–3): lagging confirmation that tailwind is flowing to revenue
  const g = revenueGrowth ?? earningsGrowth;
  let growthPts: number;
  if (g == null)    growthPts = 1; // unknown — neutral
  else if (g >= 25) growthPts = 3;
  else if (g >= 8)  growthPts = 2;
  else if (g >= 0)  growthPts = 1;
  else              growthPts = 0; // negative = tailwind not materialising

  // Margin signal (0–2): earnings outpacing revenue = margins expanding = PLI monetisation
  // More direct than revenue growth alone — PLI incentives flow straight to the bottom line
  let marginPts = 0;
  if (revenueGrowth != null && earningsGrowth != null) {
    const spread = earningsGrowth - revenueGrowth;
    if (spread >= 8)      marginPts = 2; // clear margin expansion — PLI flowing through
    else if (spread >= 3) marginPts = 1; // mild expansion
  } else if (operatingMargin != null && operatingMargin >= 15) {
    marginPts = 1; // structurally healthy margins in a tailwind sector
  } else if (grossMargin != null && grossMargin >= 35) {
    marginPts = 1; // pricing power — capturing tailwind at the gross level
  }

  return Math.min(5, growthPts + marginPts);
}

function tailwindScore(
  sector: string, industry: string,
  revenueGrowth: number | null, earningsGrowth: number | null,
  operatingMargin: number | null, grossMargin: number | null,
): number {
  const cfg = getSectorConfig(sector, industry);
  const policyWeight = cfg?.policyWeight
    ?? (SECTOR_TO_CONFIG[sector] ? 12 : 9);
  // govBoost (0–3): ministry-level signals beyond budget — PLI activeness, capex plans, import substitution
  const govBoost = getGovBoost(sector, industry);
  return Math.min(25, policyWeight + govBoost + materialisationBonus(revenueGrowth, earningsGrowth, operatingMargin, grossMargin));
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 2 — MANAGEMENT QUALITY  (max 20 pts)
//
// ROE is the primary signal for capital allocation quality.
// D/E penalises financial engineering (high ROE via leverage ≠ real skill).
// ─────────────────────────────────────────────────────────────────────────────

function managementScore(
  sector: string, marketCap: number | null,
  roe: number | null, debtEquity: number | null,
  insiderHolding: number | null,
  revenueGrowth: number | null, earningsGrowth: number | null,
): number {
  // ── Sub 1: Capital Efficiency (0–10 pts) ──────────────────────────────────
  // ROE adjusted for leverage — high ROE via debt is engineering, not skill
  let efficiencyPts: number;
  if (roe != null) {
    const leverageFactor = (debtEquity ?? 0) > 1 ? 0.85 : 1;
    const adjustedRoe = roe * leverageFactor;
    efficiencyPts = adjustedRoe >= 25 ? 10
                  : adjustedRoe >= 20 ? 8
                  : adjustedRoe >= 15 ? 7
                  : adjustedRoe >= 10 ? 5
                  : adjustedRoe >= 5  ? 3
                  : 2;
  } else if (marketCap) {
    const cr = marketCap / 1e7;
    efficiencyPts = cr >= 50000 ? 7 : cr >= 15000 ? 6 : cr >= 3000 ? 5 : 4;
    if (['Technology', 'Healthcare', 'Financial Services'].includes(sector))
      efficiencyPts = Math.min(8, efficiencyPts + 1);
  } else {
    efficiencyPts = 4;
  }

  // ── Sub 2: Promoter Alignment (0–6 pts) ───────────────────────────────────
  // Insider/promoter holding — skin in the game aligns management with shareholders
  let alignmentPts: number;
  if (insiderHolding == null)       alignmentPts = 3; // unknown = neutral
  else if (insiderHolding >= 50)    alignmentPts = 6; // founder/promoter controlled
  else if (insiderHolding >= 35)    alignmentPts = 5; // good alignment
  else if (insiderHolding >= 25)    alignmentPts = 3; // moderate
  else                              alignmentPts = 1; // low — weak accountability

  // ── Sub 3: Capital Discipline (0–4 pts) ───────────────────────────────────
  // Proxy for reinvestment quality and avoiding diworsification
  // Debt discipline (0–2): conservative capital structure = organic growth preference
  const debtPts = debtEquity == null ? 1
               : debtEquity < 0.5   ? 2
               : debtEquity < 1.5   ? 1
               : 0;

  // Earnings efficiency (0–2): earnings outpacing revenue = no value destruction via bad acquisitions
  let earnPts = 1; // neutral when data missing
  if (revenueGrowth != null && earningsGrowth != null) {
    earnPts = earningsGrowth > revenueGrowth + 2 ? 2
            : (earningsGrowth >= 0 && revenueGrowth >= 0) ? 1
            : 0;
  } else if ((revenueGrowth ?? earningsGrowth ?? 0) < 0) {
    earnPts = 0;
  }

  const disciplinePts = debtPts + earnPts;

  // ── Hard penalty for extreme leverage ─────────────────────────────────────
  const base = Math.min(20, efficiencyPts + alignmentPts + disciplinePts);
  if (debtEquity != null && debtEquity > 2) return Math.max(7, base - 3);
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 3 — FINANCIAL QUALITY  (max 15 pts)
//
// Multi-parameter composite — each sub-dimension gets its own allocation:
//   A. ROCE / ROA (0–5): leverage-neutral capital efficiency (ROA as ROCE proxy)
//   B. Margin Profile (0–4): Operating + gross margin combo
//   C. Balance Sheet (0–3): Debt discipline
//   D. Cash Conversion Quality (0–3): Operating cash flow vs PAT
// ─────────────────────────────────────────────────────────────────────────────

function financialScore(
  pe: number | null,
  roce: number | null,
  operatingMargin: number | null,
  grossMargin: number | null,
  debtEquity: number | null,
  operatingCashFlow: number | null,
  marketCap: number | null,
): number {
  // A. ROCE — EBIT / (Equity + LT Debt); leverage-neutral, superior to ROE for capital efficiency
  let returnPts = 2; // default when no data
  if (roce != null) {
    returnPts = roce >= 25 ? 5 : roce >= 15 ? 4 : roce >= 10 ? 3 : roce >= 6 ? 2 : 1;
  } else if (pe && pe > 0) {
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
    debtPts = debtEquity < 0.25 ? 3
            : debtEquity < 0.75 ? 2
            : debtEquity < 1.5  ? 1
            : 0;
  }

  // D. Cash Conversion Quality (0–3): OCF > PAT = earnings are cash-backed, not accrual-inflated
  // OCF/PAT ≈ (operatingCashFlow × trailingPE) / marketCap — ratio > 1.0 means cash exceeds earnings
  let cashPts = 1; // neutral when data unavailable
  if (operatingCashFlow != null && marketCap != null && marketCap > 0 && pe != null && pe > 0) {
    const ocfToPat = (operatingCashFlow * pe) / marketCap;
    cashPts = ocfToPat >= 1.2 ? 3  // excellent — OCF well above PAT, low accruals
            : ocfToPat >= 1.0 ? 2  // good — cash-backed earnings
            : ocfToPat >= 0.7 ? 1  // acceptable
            : 0;                    // earnings quality concern
  }

  return Math.min(15, returnPts + marginPts + debtPts + cashPts);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 4 — MOAT STRENGTH  (max 15 pts)
//
// Three distinct moat dimensions:
//   A. Pricing Power (0–5): Gross margin → can the company charge a premium?
//   B. Competitive Durability (0–5): ROCE sustainability + customer switching costs
//   C. Structural / Regulatory Position (0–5): Tiered by scale within barrier type
// ─────────────────────────────────────────────────────────────────────────────

// Non-financial entry barriers — clearances, licences, long procurement cycles
const REGULATORY_MOAT_INDUSTRIES = [
  /defense|defence|aerospace|naval/i,       // security clearances, 5+ year qualification
  /pharma|drug\s*mfg|api\s*mfg/i,           // drug approvals, patent protection
  /power\s*(utility|grid|transmiss)/i,       // regulated tariff, geographic monopoly
  /railway|rail\s*vikas/i,                   // government mandate, land acquisition
  /shipbuild|shipyard/i,                     // strategic national assets, NCCD
  /water\s*(utility|treat|supply)/i,         // municipal contracts, long tenure
  /telecom/i,                                // spectrum licenses, high capex barrier
  /insurance/i,                              // IRDAI regulation, trust inertia
];

// Industries where switching supplier/vendor is costly or slow for the customer
const SWITCHING_COST_INDUSTRIES = [
  /software|it\s*serv|saas|erp|crm/i,       // re-implementation takes 6–18 months
  /specialty\s*chem|agrochemi/i,             // customer re-qualification 12–24 months
  /banking|nbfc|microfinance/i,              // account/loan migration friction
  /exchange|depository|clearing/i,           // network lock-in (NSE/BSE/CDSL/NSDL)
  /hospital|diagnostic|lab.*serv/i,          // patient-doctor-record lock-in
  /pharma.*api|api.*mfg|cram/i,              // FDA/DCGI re-approval for supplier change
];

function moatScore(
  sector: string, industry: string,
  marketCap: number | null,
  grossMargin: number | null,
  roce: number | null,
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

  // B. Competitive Durability (0–5)
  // ROCE is leverage-neutral — sustained high ROCE = moat is real, not financial engineering
  // Switching costs compound durability: locked-in customers protect ROCE over time
  const hasSwitchCost = SWITCHING_COST_INDUSTRIES.some(re => re.test(industry));
  let durabilityPts = 2;
  if (roce != null) {
    if      (roce >= 22 && hasSwitchCost) durabilityPts = 5; // durable + locked-in customers
    else if (roce >= 22)                  durabilityPts = 4; // strong ROCE, open market
    else if (roce >= 14 && hasSwitchCost) durabilityPts = 4; // good ROCE + stickiness
    else if (roce >= 14)                  durabilityPts = 3;
    else if (roce >= 8)                   durabilityPts = 2;
    else if (hasSwitchCost)               durabilityPts = 2; // stickiness despite low ROCE
    else                                  durabilityPts = 1;
  } else {
    durabilityPts = hasSwitchCost ? 3 : 2; // ROCE unavailable — switching cost as sole signal
  }

  // C. Structural / Regulatory Position (0–5)
  // Tiered by market cap — larger = more clearances, contracts, and embedded relationships
  const cr = (marketCap ?? 0) / 1e7;
  let structuralPts: number;
  const hasRegMoat = REGULATORY_MOAT_INDUSTRIES.some(re => re.test(industry));
  if (hasRegMoat) {
    structuralPts = cr >= 20000 ? 5   // large regulated platform (HAL, BEL, NTPC)
                 : cr >= 5000  ? 4   // established player, multiple clearances
                 : cr >= 1000  ? 3   // niche player, limited clearances/contracts
                 : 2;                // new/small entrant in regulated space
  } else {
    const techSectors = ['Technology', 'Healthcare'];
    if (techSectors.includes(sector) && cr >= 5000) structuralPts = 4; // IP + proven scale
    else if (cr >= 30000)                            structuralPts = 4; // scale moat
    else if (cr >= 8000)                             structuralPts = 3;
    else if (cr >= 2000)                             structuralPts = 2;
    else                                             structuralPts = 1;
  }

  return Math.min(15, pricingPts + durabilityPts + structuralPts);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 5 — REVENUE OPPORTUNITY  (max 15 pts)
//
// Three independent dimensions:
//   A. Growth Capture (0–6):  actual revenue growth proves the opportunity is monetising
//   B. Opportunity Quality (0–5): sector's structural backing via policyWeight (Budget allocations)
//   C. Runway Remaining (0–4): how much room left before scale constraints bite
// ─────────────────────────────────────────────────────────────────────────────

function revenueOpportunityScore(
  sector: string, industry: string,
  marketCap: number | null,
  revenueGrowth: number | null, earningsGrowth: number | null,
): number {
  // A. Growth Capture (0–6): positive and accelerating revenue = opportunity actively monetising
  const g = revenueGrowth ?? earningsGrowth;
  let growthPts: number;
  if (g == null)    growthPts = 3; // neutral when no data
  else if (g >= 30) growthPts = 6;
  else if (g >= 20) growthPts = 5;
  else if (g >= 10) growthPts = 4;
  else if (g >= 5)  growthPts = 3;
  else if (g >= 0)  growthPts = 2;
  else              growthPts = 0; // declining revenue = not capturing the opportunity

  // B. Opportunity Quality (0–5): how large and durable is the addressable market?
  // Reuses tailwindConfig policyWeight (Union Budget allocations) — India-specific, not a static list
  const cfg = getSectorConfig(sector, industry);
  const pw = cfg?.policyWeight ?? (SECTOR_TO_CONFIG[sector] ? 12 : 9);
  const opportunityPts = pw >= 18 ? 5   // defense, power, railways, semis
                       : pw >= 15 ? 4   // pharma, digital, water
                       : pw >= 12 ? 3
                       : pw >= 9  ? 2
                       : 1;

  // C. Runway Remaining (0–4): room left to compound before scale constraints bite
  // Mid-cap (₹2K–80K Cr) = proven model + maximum remaining runway
  let runwayPts: number;
  if (!marketCap) {
    runwayPts = 2;
  } else {
    const cr = marketCap / 1e7;
    runwayPts = (cr >= 2000 && cr <= 80000) ? 4
              : cr < 2000                   ? 3  // small-cap: unproven scale, lots of room
              : cr <= 200000                ? 2  // large-cap: still meaningful
              : 1;                               // mega-cap: TAM constraints
  }

  return Math.min(15, growthPts + opportunityPts + runwayPts);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 6 — GROWTH EFFICIENCY  (max 5 pts)
//
// Measures whether growth is *efficient*, not just fast.
//   A. Operating Leverage (0–3): earnings outpacing revenue = margins expanding at scale
//   B. Scale Confirmation (0–2): growth must actually be happening for leverage to matter
// ─────────────────────────────────────────────────────────────────────────────

function growthScore(
  revenueGrowth: number | null,
  earningsGrowth: number | null,
): number {
  // A. Operating Leverage (0–3)
  // The spread (earningsGrowth − revenueGrowth) is the efficiency signal:
  //   positive spread = company is scaling without proportional cost growth
  //   negative spread = margins diluting as revenue grows (buying growth expensively)
  let leveragePts = 1; // neutral when data missing
  if (revenueGrowth != null && earningsGrowth != null) {
    if (revenueGrowth >= 0) {
      const spread = earningsGrowth - revenueGrowth;
      leveragePts = spread >= 10 ? 3   // strong operating leverage
                 : spread >= 4  ? 2   // modest leverage
                 : spread >= 0  ? 1   // growing, no leverage yet
                 : 0;                 // margins diluting — growing expensively
    } else {
      leveragePts = 0; // shrinking revenue — no growth to be efficient about
    }
  } else if (earningsGrowth != null) {
    leveragePts = earningsGrowth >= 15 ? 2 : earningsGrowth >= 0 ? 1 : 0;
  } else if (revenueGrowth != null) {
    leveragePts = revenueGrowth >= 0 ? 1 : 0;
  }

  // B. Scale Confirmation (0–2): leverage only matters if real top-line growth is happening
  const g = revenueGrowth ?? earningsGrowth;
  const scalePts = g == null ? 0 : g >= 20 ? 2 : g >= 8 ? 1 : 0;

  return Math.min(5, leveragePts + scalePts);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 7 — VALUATION  (max 5 pts)
//
// PEG (PE ÷ earningsGrowth) when growth > 8% — growth-adjusted, sector-neutral.
// Absolute PE fallback when growth is missing or too low for PEG to be meaningful.
// PB only as last resort when PE is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

function valuationScore(
  pe: number | null,
  pb: number | null,
  earningsGrowth: number | null,
): number {
  if (pe != null && pe > 0) {
    // PEG: only meaningful when earnings are actually growing at a decent rate
    // Below 8% growth, PEG inflates and punishes cheap cyclicals unfairly
    if (earningsGrowth != null && earningsGrowth > 8) {
      const peg = pe / earningsGrowth;
      return peg < 0.5 ? 5   // very cheap relative to growth
           : peg < 1.0 ? 4   // fairly priced for the growth
           : peg < 1.5 ? 3
           : peg < 2.5 ? 2
           : 1;              // expensive relative to growth
    }
    // Absolute PE fallback (low/no growth, or growth data missing)
    return pe <= 12 ? 5 : pe <= 22 ? 4 : pe <= 40 ? 3 : pe <= 65 ? 2 : 1;
  }
  // PB last resort — only reliable for asset-heavy businesses (banks, utilities)
  if (pb != null && pb > 0) {
    return pb <= 1 ? 5 : pb <= 2.5 ? 4 : pb <= 5 ? 3 : 2;
  }
  return 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export interface FactorBreakdownItem {
  category: string;
  score: number;
  weight: number;
  color: string;
}

export function computeFactorBreakdown(quote: LiveQuote): FactorBreakdownItem[] {
  return [
    { category: 'Structural Tailwind', weight: 25, color: '#d4a853',
      score: tailwindScore(quote.sector, quote.industry, quote.revenueGrowth, quote.earningsGrowth, quote.operatingMargin, quote.grossMargin) },
    { category: 'Management Quality',  weight: 20, color: '#10b981',
      score: managementScore(quote.sector, quote.marketCap, quote.roe, quote.debtEquity, quote.insiderHolding, quote.revenueGrowth, quote.earningsGrowth) },
    { category: 'Financial Quality',   weight: 15, color: '#2bb5d4',
      score: financialScore(quote.pe, quote.roce, quote.operatingMargin, quote.grossMargin, quote.debtEquity, quote.operatingCashFlow, quote.marketCap) },
    { category: 'Moat Strength',       weight: 15, color: '#8b5cf6',
      score: moatScore(quote.sector, quote.industry, quote.marketCap, quote.grossMargin, quote.roce) },
    { category: 'Revenue Opportunity', weight: 15, color: '#0c7b93',
      score: revenueOpportunityScore(quote.sector, quote.industry, quote.marketCap, quote.revenueGrowth, quote.earningsGrowth) },
    { category: 'Growth Efficiency',   weight:  5, color: '#f59e0b',
      score: growthScore(quote.revenueGrowth, quote.earningsGrowth) },
    { category: 'Valuation',           weight:  5, color: '#ec4899',
      score: valuationScore(quote.pe, quote.pb, quote.earningsGrowth) },
  ];
}

export function computeIscfScore(quote: LiveQuote): number {
  const t  = tailwindScore(
    quote.sector, quote.industry,
    quote.revenueGrowth, quote.earningsGrowth,
    quote.operatingMargin, quote.grossMargin
  );
  const m  = managementScore(
    quote.sector, quote.marketCap, quote.roe, quote.debtEquity,
    quote.insiderHolding, quote.revenueGrowth, quote.earningsGrowth
  );
  const fi = financialScore(
    quote.pe, quote.roce, quote.operatingMargin, quote.grossMargin,
    quote.debtEquity, quote.operatingCashFlow, quote.marketCap
  );
  const mo = moatScore(
    quote.sector, quote.industry, quote.marketCap,
    quote.grossMargin, quote.roce
  );
  const r  = revenueOpportunityScore(
    quote.sector, quote.industry, quote.marketCap,
    quote.revenueGrowth, quote.earningsGrowth
  );
  const g  = growthScore(quote.revenueGrowth, quote.earningsGrowth);
  const v  = valuationScore(quote.pe, quote.pb, quote.earningsGrowth);

  return Math.min(100, Math.max(1, t + m + fi + mo + r + g + v));
}

export function scoreToConviction(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 78) return 'High';
  if (score >= 62) return 'Medium';
  return 'Low';
}
