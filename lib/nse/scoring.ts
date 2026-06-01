import type { LiveQuote } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR 1 — STRUCTURAL TAILWIND  (max 25 pts)
//
// Two-part score:
//   A. Policy weight (0–20): How much has the Govt committed in ₹ and policy?
//   B. Materialisation bonus (0–5): Is THIS company actually capturing the benefit?
//      → Measured by revenue/earnings growth momentum.
// ─────────────────────────────────────────────────────────────────────────────

// Ordered highest-to-lowest so the first matching industry wins.
// Sources: Union Budgets FY25-26, NIP, Atmanirbhar Bharat documents.
const INDUSTRY_POLICY_WEIGHT: [RegExp, number, string][] = [
  // Defense & Security — ₹6.2L Cr budget, 25% local procurement mandate (DPP 2020)
  [/defense|defence|aerospace|naval|ordnance|military/i, 20, 'defense'],
  // Power & Energy Transition — ₹18.8L Cr capex, 500 GW RE by 2030
  [/power\s*(finance|sector|grid|transmission)|renewable|solar|wind\s*energy|green\s*hydrogen/i, 20, 'power'],
  // Railways — ₹2.4L Cr annual capex, Vande Bharat, DFC
  [/railway|rail\s*(infra|vikas)|metro\s*rail|dedicated\s*freight/i, 19, 'railways'],
  // Semiconductor & Electronics — ₹76K Cr PLI, India Semiconductor Mission
  [/semiconductor|electronics\s*mfg|pcb|display\s*fab/i, 19, 'semiconductor'],
  // Water Infrastructure — ₹3.6L Cr Jal Jeevan Mission + AMRUT 2.0
  [/water\s*(treat|infra|supply|utility)|effluent\s*treat|desalin/i, 18, 'water'],
  // Roads & Ports — ₹111L Cr NIP, Gati Shakti
  [/road|highway|port\s*infra|logistics\s*infra|epc.*infra|infra.*construct/i, 18, 'infra'],
  // Shipbuilding — Maritime India Vision 2030, ₹24K Cr
  [/shipbuild|shipyard|marine\s*(eng|infra)/i, 18, 'shipbuilding'],
  // EV & New Mobility — FAME III, EV30@30
  [/electric\s*vehicle|ev\s*(component|battery|charging)|battery\s*(cell|pack)/i, 17, 'ev'],
  // Pharma & Healthcare — ₹15L Cr market, PLI scheme, API self-sufficiency
  [/pharma|drug\s*mfg|api\s*mfg|hospital|medical\s*device/i, 17, 'pharma'],
  // Drone & Space — PLI drones, ISRO commercialisation
  [/drone|uav|space\s*(tech|satellite)|satellite/i, 17, 'drone_space'],
  // Digital & IT Services — GCC boom, AI Mission, ₹14,903 Cr Digital India
  [/information\s*tech|software|it\s*service|cloud|cybersec|data\s*(center|centre)|artificial\s*intel/i, 16, 'digital'],
  // Specialty Chemicals — China+1 shift
  [/specialty\s*chem|agrochemical|fine\s*chem|pigment|dye|fluorochem/i, 15, 'spec_chem'],
  // Financial Services — PMJDY, credit expansion, insurance penetration
  [/bank|nbfc|insurance|microfinance|housing\s*financ|asset\s*manag/i, 15, 'finance'],
  // Capital Goods & Heavy Engineering — Make in India, PLI
  [/capital\s*goods|heavy\s*eng|industrial\s*mach|turbine|boiler|compressor/i, 15, 'capgoods'],
  // PLI Manufacturing (textiles, auto, food processing)
  [/auto\s*(comp|mfg)|textile|food\s*(process|mfg)|consumer\s*electric/i, 14, 'pli_mfg'],
  // Agriculture & Agri-tech — PM Kisan, food security
  [/agri|fertiliz|pesticide|irrigation|seed/i, 13, 'agri'],
  // Real Estate — PMAY, Smart Cities (execution-dependent, less reliable)
  [/real\s*estate|housing\s*develop|construction\s*dev/i, 11, 'realty'],
];

// Sector-level fallback when no industry keyword matches
const SECTOR_POLICY_WEIGHT: Record<string, number> = {
  'Industrials': 16,
  'Technology': 16,
  'Healthcare': 15,
  'Financial Services': 14,
  'Energy': 14,
  'Utilities': 13,
  'Basic Materials': 12,
  'Consumer Cyclical': 12,
  'Consumer Defensive': 11,
  'Communication Services': 11,
  'Real Estate': 10,
};

// Materialisation bonus: is this company ACTUALLY benefiting?
// Revenue/earnings growth proves the tailwind is playing out for THIS stock.
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
  return 0;                // negative growth = tailwind not materialising yet
}

function tailwindScore(
  sector: string, industry: string,
  revenueGrowth: number | null, earningsGrowth: number | null
): number {
  let policyWeight = SECTOR_POLICY_WEIGHT[sector] ?? 9;
  for (const [re, weight] of INDUSTRY_POLICY_WEIGHT) {
    if (re.test(industry)) { policyWeight = weight; break; }
  }
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
