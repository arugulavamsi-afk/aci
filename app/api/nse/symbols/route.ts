import type { NextRequest } from 'next/server';
import type { NSESymbol } from '@/lib/nse/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// NSE EQUITY_L.csv columns: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING,
// PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(
      'https://archives.nseindia.com/content/equities/EQUITY_L.csv',
      {
        headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*' },
        // Cache for 24 hours (symbol list rarely changes)
        next: { revalidate: 86400 },
      }
    );

    if (!res.ok) {
      return Response.json(
        { error: `NSE returned ${res.status}` },
        { status: 502 }
      );
    }

    const csv = await res.text();
    const lines = csv.trim().split('\n');

    const symbols: NSESymbol[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (!cols[0]) continue;
      const series = cols[2]?.trim();
      if (series !== 'EQ') continue; // equity series only
      symbols.push({
        symbol: cols[0].trim(),
        name: cols[1]?.trim() ?? '',
        isin: cols[6]?.trim() ?? '',
      });
    }

    return Response.json({ symbols, count: symbols.length });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
