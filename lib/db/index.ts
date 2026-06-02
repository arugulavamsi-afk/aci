import { neon } from '@neondatabase/serverless';
import type { LiveQuote } from '@/lib/nse/types';
import { formatMarketCap } from '@/lib/nse/yahooAuth';

// Vercel injects DATABASE_URL (new Neon integration) or POSTGRES_URL (legacy)
function getConnectionString(): string {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '';
}

export function getSql() {
  const url = getConnectionString();
  if (!url) throw new Error('No database URL configured. Set DATABASE_URL in environment variables.');
  return neon(url);
}

export function isDbConfigured(): boolean {
  return !!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

// ── Schema ────────────────────────────────────────────────────────────────────

export async function setupSchema() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS stock_data (
      symbol              TEXT PRIMARY KEY,
      exchange            TEXT NOT NULL DEFAULT 'NSE',
      name                TEXT,
      sector              TEXT,
      industry            TEXT,
      cmp                 NUMERIC,
      change_pct          NUMERIC,
      market_cap          BIGINT,
      pe                  NUMERIC,
      forward_pe          NUMERIC,
      pb                  NUMERIC,
      roe                 NUMERIC,
      roce                NUMERIC,
      operating_margin    NUMERIC,
      gross_margin        NUMERIC,
      profit_margin       NUMERIC,
      revenue_growth      NUMERIC,
      earnings_growth     NUMERIC,
      debt_equity         NUMERIC,
      insider_holding     NUMERIC,
      operating_cash_flow BIGINT,
      week_52_high        NUMERIC,
      week_52_low         NUMERIC,
      volume              BIGINT,
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_stock_market_cap ON stock_data (market_cap DESC NULLS LAST)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stock_sector     ON stock_data (sector)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stock_exchange   ON stock_data (exchange)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stock_updated    ON stock_data (updated_at DESC)`;
}

// ── Row type (Postgres returns NUMERIC/BIGINT as strings) ─────────────────────

export interface StockRow {
  symbol: string;
  exchange: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  cmp: string | null;
  change_pct: string | null;
  market_cap: string | null;
  pe: string | null;
  forward_pe: string | null;
  pb: string | null;
  roe: string | null;
  roce: string | null;
  operating_margin: string | null;
  gross_margin: string | null;
  profit_margin: string | null;
  revenue_growth: string | null;
  earnings_growth: string | null;
  debt_equity: string | null;
  insider_holding: string | null;
  operating_cash_flow: string | null;
  week_52_high: string | null;
  week_52_low: string | null;
  volume: string | null;
  updated_at: string | null;
}

function n(v: string | null | undefined): number | null {
  if (v == null) return null;
  const f = parseFloat(v);
  return isFinite(f) ? f : null;
}

export function rowToLiveQuote(row: StockRow): LiveQuote {
  const marketCap = n(row.market_cap);
  return {
    symbol:            row.symbol,
    name:              row.name ?? row.symbol,
    cmp:               n(row.cmp) ?? 0,
    change:            0,
    changePct:         n(row.change_pct) ?? 0,
    marketCap,
    marketCapLabel:    formatMarketCap(marketCap),
    pe:                n(row.pe),
    forwardPe:         n(row.forward_pe),
    pb:                n(row.pb),
    roe:               n(row.roe),
    operatingMargin:   n(row.operating_margin),
    grossMargin:       n(row.gross_margin),
    profitMargin:      n(row.profit_margin),
    revenueGrowth:     n(row.revenue_growth),
    earningsGrowth:    n(row.earnings_growth),
    debtEquity:        n(row.debt_equity),
    insiderHolding:    n(row.insider_holding),
    roce:              n(row.roce),
    operatingCashFlow: n(row.operating_cash_flow),
    sector:            row.sector ?? '',
    industry:          row.industry ?? '',
    week52High:        n(row.week_52_high) ?? 0,
    week52Low:         n(row.week_52_low) ?? 0,
    volume:            n(row.volume) ?? 0,
  };
}
