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

export interface StockFundamentals {
  roe: number | null;
  debtEquity: number | null;
  pb: number | null;
  evEbitda: number | null;
  description: string;
  city: string;
}
