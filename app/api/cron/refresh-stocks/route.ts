// Nightly stock data refresh — fetches all NSE + BSE symbols from Yahoo Finance
// and upserts into the stock_data Postgres table.
//
// Triggered automatically by Vercel Cron (vercel.json) or manually via the
// /admin/stocks admin page.
//
// Requires DATABASE_URL (or POSTGRES_URL) environment variable.
// Set CRON_SECRET to protect manual triggers (Vercel validates cron calls automatically).

import type { NextRequest } from 'next/server';
import { getSql, isDbConfigured } from '@/lib/db';
import { getYahooAuth } from '@/lib/nse/yahooAuth';

export const maxDuration = 300; // requires Vercel Pro; Hobby capped at 60s

const UA           = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const BATCH_SIZE   = 400;
const NSE_MAIN     = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const NSE_SME      = 'https://archives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv';
const BSE_LIST     = 'https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active';
const VALID_SERIES = new Set(['EQ', 'BE', 'SM', 'ST']);

const YAHOO_FIELDS = [
  'regularMarketPrice', 'regularMarketChangePercent', 'regularMarketVolume',
  'marketCap', 'trailingPE', 'forwardPE', 'priceToBook',
  'returnOnEquity', 'operatingMargins', 'grossMargins', 'profitMargins',
  'revenueGrowth', 'earningsGrowth', 'debtToEquity',
  'totalRevenue', 'totalDebt', 'bookValue', 'sharesOutstanding',
  'operatingCashflow', 'heldPercentInsiders',
  'shortName', 'longName', 'sector', 'industry',
  'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
].join(',');

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number | undefined | null): number | null {
  return v != null && isFinite(v) ? Math.round(v * 1000) / 10 : null;
}
function num(v: number | undefined | null): number | null {
  return v != null && isFinite(v) ? v : null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeRoce(q: any): number | null {
  const opMargin = q.operatingMargins;
  const revenue  = q.totalRevenue;
  const bvps     = q.bookValue;
  const shares   = q.sharesOutstanding;
  const debt     = q.totalDebt ?? 0;
  if (opMargin == null || !isFinite(opMargin)) return null;
  if (!revenue   || !isFinite(revenue))  return null;
  if (!bvps      || !isFinite(bvps))     return null;
  if (!shares    || !isFinite(shares))   return null;
  const ebit           = opMargin * revenue;
  const equity         = bvps * shares;
  const capitalEmployed = equity + (isFinite(debt) ? debt : 0);
  if (capitalEmployed <= 0) return null;
  return Math.round((ebit / capitalEmployed) * 1000) / 10;
}

// ── Symbol fetching ───────────────────────────────────────────────────────────

interface SymbolEntry { symbol: string; exchange: 'NSE' | 'BSE' }

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    return res.ok ? res.text() : null;
  } catch { return null; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function getAllSymbols(): Promise<SymbolEntry[]> {
  const [mainCsv, smeCsv, bseData] = await Promise.all([
    fetchText(NSE_MAIN),
    fetchText(NSE_SME),
    fetchJson(BSE_LIST),
  ]);

  const nseIsins = new Set<string>();
  const entries: SymbolEntry[] = [];

  const parseNse = (csv: string, all = false) => {
    csv.trim().split('\n').slice(1).forEach(line => {
      const cols = line.split(',');
      const sym  = cols[0]?.trim();
      const isin = cols[6]?.trim();
      if (!sym || !isin) return;
      if (!all && !VALID_SERIES.has(cols[2]?.trim())) return;
      if (!nseIsins.has(isin)) {
        nseIsins.add(isin);
        entries.push({ symbol: sym, exchange: 'NSE' });
      }
    });
  };

  if (mainCsv) parseNse(mainCsv, false);
  if (smeCsv)  parseNse(smeCsv,  true);

  // BSE-only: companies whose ISIN is not in NSE
  const bseTable = bseData?.Table ?? bseData?.table ?? [];
  if (Array.isArray(bseTable)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bseTable.forEach((r: any) => {
      const sym  = String(r.Scrip_Code ?? r.scripCode ?? '').trim();
      const isin = String(r.ISIN_No ?? r.ISIN ?? '').trim();
      if (sym && isin && !nseIsins.has(isin)) {
        entries.push({ symbol: sym, exchange: 'BSE' });
      }
    });
  }

  return entries;
}

// ── Yahoo Finance batch fetch ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchYahooBatch(symbols: SymbolEntry[], crumb: string, cookie: string): Promise<any[]> {
  const yahooSymbols = symbols
    .map(s => /^\d+$/.test(s.symbol) ? `${s.symbol}.BO` : `${s.symbol}.NS`)
    .join(',');

  const url =
    `https://query1.finance.yahoo.com/v7/finance/quote` +
    `?symbols=${encodeURIComponent(yahooSymbols)}` +
    `&fields=${encodeURIComponent(YAHOO_FIELDS)}` +
    `&crumb=${encodeURIComponent(crumb)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.quoteResponse?.result ?? [];
  } catch { return []; }
}

// ── DB upsert ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertQuotes(quotes: any[], exchangeMap: Map<string, 'NSE' | 'BSE'>) {
  if (quotes.length === 0) return;
  const sql = getSql();

  // Process in parallel chunks of 20 to avoid overwhelming the connection pool
  const CHUNK = 20;
  for (let i = 0; i < quotes.length; i += CHUNK) {
    await Promise.all(
      quotes.slice(i, i + CHUNK).map(q => {
        const rawSym  = (q.symbol as string)?.replace(/\.(NS|BO)$/, '') ?? '';
        const exchange = exchangeMap.get(rawSym) ?? 'NSE';
        return sql`
          INSERT INTO stock_data (
            symbol, exchange, name, sector, industry,
            cmp, change_pct, market_cap,
            pe, forward_pe, pb,
            roe, roce, operating_margin, gross_margin, profit_margin,
            revenue_growth, earnings_growth, debt_equity, insider_holding,
            operating_cash_flow, week_52_high, week_52_low, volume,
            updated_at
          ) VALUES (
            ${rawSym}, ${exchange},
            ${(q.shortName || q.longName || '') as string},
            ${(q.sector as string) ?? null},
            ${(q.industry as string) ?? null},
            ${num(q.regularMarketPrice)},
            ${num(q.regularMarketChangePercent)},
            ${num(q.marketCap)},
            ${num(q.trailingPE)},
            ${num(q.forwardPE)},
            ${num(q.priceToBook)},
            ${pct(q.returnOnEquity)},
            ${computeRoce(q)},
            ${pct(q.operatingMargins)},
            ${pct(q.grossMargins)},
            ${pct(q.profitMargins)},
            ${pct(q.revenueGrowth)},
            ${pct(q.earningsGrowth)},
            ${q.debtToEquity != null ? Math.round(q.debtToEquity * 10) / 10 : null},
            ${pct(q.heldPercentInsiders)},
            ${num(q.operatingCashflow)},
            ${num(q.fiftyTwoWeekHigh)},
            ${num(q.fiftyTwoWeekLow)},
            ${num(q.regularMarketVolume)},
            NOW()
          )
          ON CONFLICT (symbol) DO UPDATE SET
            exchange            = EXCLUDED.exchange,
            name                = COALESCE(EXCLUDED.name, stock_data.name),
            sector              = COALESCE(EXCLUDED.sector, stock_data.sector),
            industry            = COALESCE(EXCLUDED.industry, stock_data.industry),
            cmp                 = COALESCE(EXCLUDED.cmp, stock_data.cmp),
            change_pct          = EXCLUDED.change_pct,
            market_cap          = COALESCE(EXCLUDED.market_cap, stock_data.market_cap),
            pe                  = COALESCE(EXCLUDED.pe, stock_data.pe),
            forward_pe          = COALESCE(EXCLUDED.forward_pe, stock_data.forward_pe),
            pb                  = COALESCE(EXCLUDED.pb, stock_data.pb),
            roe                 = COALESCE(EXCLUDED.roe, stock_data.roe),
            roce                = COALESCE(EXCLUDED.roce, stock_data.roce),
            operating_margin    = COALESCE(EXCLUDED.operating_margin, stock_data.operating_margin),
            gross_margin        = COALESCE(EXCLUDED.gross_margin, stock_data.gross_margin),
            profit_margin       = COALESCE(EXCLUDED.profit_margin, stock_data.profit_margin),
            revenue_growth      = COALESCE(EXCLUDED.revenue_growth, stock_data.revenue_growth),
            earnings_growth     = COALESCE(EXCLUDED.earnings_growth, stock_data.earnings_growth),
            debt_equity         = COALESCE(EXCLUDED.debt_equity, stock_data.debt_equity),
            insider_holding     = COALESCE(EXCLUDED.insider_holding, stock_data.insider_holding),
            operating_cash_flow = COALESCE(EXCLUDED.operating_cash_flow, stock_data.operating_cash_flow),
            week_52_high        = COALESCE(EXCLUDED.week_52_high, stock_data.week_52_high),
            week_52_low         = COALESCE(EXCLUDED.week_52_low, stock_data.week_52_low),
            volume              = COALESCE(EXCLUDED.volume, stock_data.volume),
            updated_at          = NOW()
        `;
      })
    );
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth: Vercel validates cron requests automatically via CRON_SECRET.
  // For manual admin triggers, pass the same secret as a query param.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const querySecret = req.nextUrl.searchParams.get('secret');
    const valid = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
    if (!valid) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return Response.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  }

  const start = Date.now();
  let totalFetched = 0;
  let totalUpserted = 0;

  try {
    // 1. Get all symbols
    const symbols = await getAllSymbols();
    const exchangeMap = new Map(symbols.map(s => [s.symbol, s.exchange]));

    // 2. Get Yahoo Finance auth once (crumb + cookie)
    const { crumb, cookie } = await getYahooAuth();

    // 3. Batch into groups of BATCH_SIZE, run 2 batches in parallel to stay fast
    const batches: SymbolEntry[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      batches.push(symbols.slice(i, i + BATCH_SIZE));
    }

    const PARALLEL = 2;
    for (let i = 0; i < batches.length; i += PARALLEL) {
      const chunk = batches.slice(i, i + PARALLEL);
      const results = await Promise.all(
        chunk.map(batch => fetchYahooBatch(batch, crumb, cookie))
      );
      for (const quotes of results) {
        totalFetched += quotes.length;
        await upsertQuotes(quotes, exchangeMap);
        totalUpserted += quotes.length;
      }
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    return Response.json({
      ok: true,
      symbols: symbols.length,
      fetched: totalFetched,
      upserted: totalUpserted,
      elapsed: `${elapsed}s`,
    });
  } catch (err) {
    return Response.json({ error: String(err), elapsed: `${Math.round((Date.now() - start) / 1000)}s` }, { status: 500 });
  }
}
