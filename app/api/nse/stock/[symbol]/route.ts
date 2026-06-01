import { getYahooAuth } from '@/lib/nse/yahooAuth';
import type { StockFundamentals } from '@/lib/nse/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// GET /api/nse/stock/RELIANCE
// Returns fundamentals: ROE, D/E, PB, EV/EBITDA, description, city
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  try {
    const { crumb, cookie } = await getYahooAuth();

    const url =
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.NS` +
      `?modules=financialData,defaultKeyStatistics,summaryDetail,assetProfile` +
      `&crumb=${encodeURIComponent(crumb)}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' },
      next: { revalidate: 3600 }, // Cache 1 hour
    });

    if (!res.ok) {
      return Response.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) {
      return Response.json({ error: 'No data returned' }, { status: 404 });
    }

    const fd = result.financialData ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const ap = result.assetProfile ?? {};

    const fundamentals: StockFundamentals = {
      roe: (fd.returnOnEquity?.raw as number | null) != null
        ? Math.round((fd.returnOnEquity.raw as number) * 100 * 10) / 10
        : null,
      debtEquity: (fd.debtToEquity?.raw as number | null) != null
        ? Math.round((fd.debtToEquity.raw as number) * 100) / 100
        : null,
      pb: (ks.priceToBook?.raw as number | null) != null
        ? Math.round((ks.priceToBook.raw as number) * 10) / 10
        : null,
      evEbitda: (ks.enterpriseToEbitda?.raw as number | null) != null
        ? Math.round((ks.enterpriseToEbitda.raw as number) * 10) / 10
        : null,
      description: (ap.longBusinessSummary as string) ?? '',
      city: (ap.city as string) ?? '',
    };

    return Response.json({ symbol, fundamentals });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
