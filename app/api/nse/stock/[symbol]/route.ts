import { getYahooAuth } from '@/lib/nse/yahooAuth';
import type { StockFundamentals } from '@/lib/nse/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function pct(raw: number | undefined): number | null {
  return raw != null ? Math.round(raw * 1000) / 10 : null; // raw 0.18 → 18.0%
}

function round1(raw: number | undefined): number | null {
  return raw != null ? Math.round(raw * 10) / 10 : null;
}

// Compute 3-year revenue CAGR from Yahoo income statement history
// Statements are newest-first; we want CAGR from 3 years ago to most recent.
function computeRevenueCagr(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statements: any[]
): number | null {
  if (!Array.isArray(statements) || statements.length < 2) return null;
  const sorted = [...statements].sort(
    (a, b) => (b.endDate?.raw ?? 0) - (a.endDate?.raw ?? 0)
  );
  const latest = sorted[0]?.totalRevenue?.raw as number | undefined;
  // Use 3 years back if available, else oldest available
  const oldest = (sorted[Math.min(3, sorted.length - 1)])?.totalRevenue?.raw as number | undefined;
  if (!latest || !oldest || oldest <= 0) return null;
  const years = Math.min(3, sorted.length - 1);
  const cagr = (Math.pow(latest / oldest, 1 / years) - 1) * 100;
  return Math.round(cagr * 10) / 10;
}

// GET /api/nse/stock/RELIANCE — full fundamentals for one stock
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  try {
    const { crumb, cookie } = await getYahooAuth();

    const modules = [
      'financialData',
      'defaultKeyStatistics',
      'assetProfile',
      'incomeStatementHistory',
    ].join(',');

    const url =
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.NS` +
      `?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return Response.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) {
      return Response.json({ error: 'No data' }, { status: 404 });
    }

    const fd  = result.financialData ?? {};
    const ks  = result.defaultKeyStatistics ?? {};
    const ap  = result.assetProfile ?? {};
    const ish = result.incomeStatementHistory?.incomeStatementHistory ?? [];

    const fundamentals: StockFundamentals = {
      roe:             pct(fd.returnOnEquity?.raw),
      revenueGrowthYoy: pct(fd.revenueGrowth?.raw),
      revenueCagr3y:   computeRevenueCagr(ish),
      operatingMargin: pct(fd.operatingMargins?.raw),
      grossMargin:     pct(fd.grossMargins?.raw),
      debtEquity:      round1(fd.debtToEquity?.raw != null ? fd.debtToEquity.raw / 100 : undefined),
      pb:              round1(ks.priceToBook?.raw),
      evEbitda:        round1(ks.enterpriseToEbitda?.raw),
      description:     (ap.longBusinessSummary as string) ?? '',
      city:            (ap.city as string) ?? '',
    };

    return Response.json({ symbol, fundamentals });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
