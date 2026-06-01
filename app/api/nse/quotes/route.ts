import type { NextRequest } from 'next/server';
import { getYahooAuth, formatMarketCap } from '@/lib/nse/yahooAuth';
import type { LiveQuote } from '@/lib/nse/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// GET /api/nse/quotes?symbols=RELIANCE,TCS,INFY
// Returns price, market cap, PE, sector, 52W range for up to 500 symbols per call.
export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols');
  if (!symbolsParam) {
    return Response.json({ error: 'symbols query param required' }, { status: 400 });
  }

  const nsSymbols = symbolsParam
    .split(',')
    .map(s => `${s.trim()}.NS`)
    .join(',');

  try {
    const { crumb, cookie } = await getYahooAuth();

    const url =
      `https://query1.finance.yahoo.com/v7/finance/quote` +
      `?symbols=${encodeURIComponent(nsSymbols)}` +
      `&crumb=${encodeURIComponent(crumb)}` +
      `&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,` +
      `marketCap,trailingPE,shortName,longName,sector,industry,` +
      `fiftyTwoWeekHigh,fiftyTwoWeekLow,regularMarketVolume`;

    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json' },
      next: { revalidate: 300 }, // Cache 5 minutes
    });

    if (!res.ok) {
      return Response.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = data?.quoteResponse?.result ?? [];

    const quotes: LiveQuote[] = raw.map(q => ({
      symbol: (q.symbol as string)?.replace('.NS', '') ?? '',
      name: (q.shortName || q.longName || '') as string,
      cmp: (q.regularMarketPrice as number) ?? 0,
      change: (q.regularMarketChange as number) ?? 0,
      changePct: (q.regularMarketChangePercent as number) ?? 0,
      marketCap: (q.marketCap as number | null) ?? null,
      marketCapLabel: formatMarketCap(q.marketCap as number | null),
      pe: (q.trailingPE as number | null) ?? null,
      sector: (q.sector as string) ?? '',
      industry: (q.industry as string) ?? '',
      week52High: (q.fiftyTwoWeekHigh as number) ?? 0,
      week52Low: (q.fiftyTwoWeekLow as number) ?? 0,
      volume: (q.regularMarketVolume as number) ?? 0,
    }));

    return Response.json({ quotes });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
