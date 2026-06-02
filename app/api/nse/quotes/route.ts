import type { NextRequest } from 'next/server';
import { getYahooAuth, formatMarketCap } from '@/lib/nse/yahooAuth';
import type { LiveQuote } from '@/lib/nse/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// All fields we request in a single batch call — prices + financials together
const FIELDS = [
  'regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent',
  'regularMarketVolume',
  'marketCap',
  'trailingPE', 'forwardPE', 'priceToBook',
  'returnOnEquity', 'operatingMargins', 'grossMargins', 'profitMargins',
  'revenueGrowth', 'earningsGrowth',
  'debtToEquity',
  'totalRevenue', 'totalDebt', 'bookValue', 'sharesOutstanding',
  'operatingCashflow',
  'heldPercentInsiders',
  'shortName', 'longName',
  'sector', 'industry',
  'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
].join(',');

function pct(v: number | undefined | null): number | null {
  // Yahoo returns ratios (0.18 = 18%) — convert to percentage
  return v != null && isFinite(v) ? Math.round(v * 1000) / 10 : null;
}

function num(v: number | undefined | null): number | null {
  return v != null && isFinite(v) ? v : null;
}

// ROCE = EBIT / Capital Employed
// EBIT ≈ operatingMargins × totalRevenue (operating income ≈ EBIT)
// Capital Employed = (bookValue per share × sharesOutstanding) + totalDebt
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeRoce(q: any): number | null {
  const opMargin = q.operatingMargins;    // ratio, e.g. 0.18
  const revenue  = q.totalRevenue;        // absolute INR
  const bvps     = q.bookValue;           // book value per share INR
  const shares   = q.sharesOutstanding;   // total shares
  const debt     = q.totalDebt ?? 0;      // absolute INR, optional

  if (opMargin == null || !isFinite(opMargin)) return null;
  if (!revenue   || !isFinite(revenue))  return null;
  if (!bvps      || !isFinite(bvps))     return null;
  if (!shares    || !isFinite(shares))   return null;

  const ebit           = opMargin * revenue;
  const equity         = bvps * shares;
  const capitalEmployed = equity + (isFinite(debt) ? debt : 0);

  if (capitalEmployed <= 0) return null; // negative book value edge case
  return Math.round((ebit / capitalEmployed) * 1000) / 10; // ROCE as %
}

// GET /api/nse/quotes?symbols=RELIANCE,TCS,INFY
export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) {
    return Response.json({ error: 'symbols query param required' }, { status: 400 });
  }

  // BSE scrip codes are all-numeric (e.g. "500325"); NSE tickers are alphanumeric ("RELIANCE")
  const nsSymbols = symbolsParam
    .split(',')
    .map(s => { const t = s.trim(); return /^\d+$/.test(t) ? `${t}.BO` : `${t}.NS`; })
    .join(',');

  try {
    const { crumb, cookie } = await getYahooAuth();

    const url =
      `https://query1.finance.yahoo.com/v7/finance/quote` +
      `?symbols=${encodeURIComponent(nsSymbols)}` +
      `&fields=${encodeURIComponent(FIELDS)}` +
      `&crumb=${encodeURIComponent(crumb)}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return Response.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = data?.quoteResponse?.result ?? [];

    const quotes: LiveQuote[] = raw.map(q => ({
      symbol:          (q.symbol as string)?.replace(/\.(NS|BO)$/, '') ?? '',
      name:            (q.shortName || q.longName || '') as string,
      cmp:             num(q.regularMarketPrice) ?? 0,
      change:          num(q.regularMarketChange) ?? 0,
      changePct:       num(q.regularMarketChangePercent) ?? 0,
      marketCap:       num(q.marketCap),
      marketCapLabel:  formatMarketCap(q.marketCap),
      // Valuation
      pe:              num(q.trailingPE),
      forwardPe:       num(q.forwardPE),
      pb:              num(q.priceToBook),
      // Profitability — Yahoo returns as ratios, convert to %
      roe:             pct(q.returnOnEquity),
      operatingMargin: pct(q.operatingMargins),
      grossMargin:     pct(q.grossMargins),
      profitMargin:    pct(q.profitMargins),
      // Growth
      revenueGrowth:   pct(q.revenueGrowth),
      earningsGrowth:  pct(q.earningsGrowth),
      // Leverage — Yahoo returns already as ratio (not %)
      debtEquity:      q.debtToEquity != null ? Math.round(q.debtToEquity * 10) / 10 : null,
      // Capital efficiency — ROCE computed from operating income / capital employed
      roce:              computeRoce(q),
      operatingCashFlow: num(q.operatingCashflow),
      // Ownership — Yahoo returns as ratio (0.52 = 52%), convert to %
      insiderHolding:  pct(q.heldPercentInsiders),
      // Context
      sector:          (q.sector as string) ?? '',
      industry:        (q.industry as string) ?? '',
      week52High:      num(q.fiftyTwoWeekHigh) ?? 0,
      week52Low:       num(q.fiftyTwoWeekLow) ?? 0,
      volume:          num(q.regularMarketVolume) ?? 0,
    }));

    return Response.json({ quotes });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
