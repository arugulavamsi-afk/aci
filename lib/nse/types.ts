export interface NSESymbol {
  symbol: string;
  name: string;
  isin: string;
}

export interface LiveQuote {
  symbol: string;
  name: string;
  cmp: number;
  change: number;
  changePct: number;
  marketCap: number | null;
  marketCapLabel: string;
  pe: number | null;
  sector: string;
  industry: string;
  week52High: number;
  week52Low: number;
  volume: number;
}

// Fetched per-stock from Yahoo Finance quoteSummary
export interface StockFundamentals {
  roe: number | null;            // Return on Equity %
  revenueGrowthYoy: number | null; // Revenue growth YoY %
  revenueCagr3y: number | null;  // 3-year revenue CAGR % (computed from income statements)
  operatingMargin: number | null;// Operating margin %
  grossMargin: number | null;    // Gross margin %
  debtEquity: number | null;     // D/E ratio
  pb: number | null;             // Price-to-book
  evEbitda: number | null;       // EV/EBITDA
  description: string;
  city: string;
}
