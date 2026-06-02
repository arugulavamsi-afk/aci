export interface NSESymbol {
  symbol: string;
  name: string;
  isin: string;
}

// Returned by the batch /api/nse/quotes endpoint — all fields from a single Yahoo Finance call
export interface LiveQuote {
  symbol: string;
  name: string;
  cmp: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  marketCapLabel: string;
  // Valuation
  pe: number | null;
  forwardPe: number | null;
  pb: number | null;
  // Profitability & efficiency
  roe: number | null;          // Return on Equity %
  operatingMargin: number | null;
  grossMargin: number | null;
  profitMargin: number | null;
  // Growth
  revenueGrowth: number | null; // YoY %
  earningsGrowth: number | null;
  // Leverage
  debtEquity: number | null;
  // Ownership
  insiderHolding: number | null;    // promoter/insider % held (Yahoo heldPercentInsiders × 100)
  // Capital efficiency
  roce: number | null;              // Return on Capital Employed % — EBIT / (Equity + LT Debt)
  operatingCashFlow: number | null; // Absolute operating cash flow (INR, same units as marketCap)
  // Price context
  sector: string;
  industry: string;
  week52High: number;
  week52Low: number;
  volume: number;
}

// Used only by the individual company detail page (/api/nse/stock/[symbol])
export interface StockFundamentals {
  roe: number | null;
  revenueGrowthYoy: number | null;
  revenueCagr3y: number | null;
  operatingMargin: number | null;
  grossMargin: number | null;
  debtEquity: number | null;
  pb: number | null;
  evEbitda: number | null;
  description: string;
  city: string;
}
