import type { NextRequest } from 'next/server';
import type { NSESymbol } from '@/lib/nse/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Main board CSV columns: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING,
//   PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
// SME CSV columns: same structure
const MAIN_BOARD_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const SME_URL        = 'https://archives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv';

// Valid trading series to include:
//   EQ  – regular equity (main board)
//   BE  – trade-for-trade settlement (valid listed companies, T+1)
//   SM  – SME Emerge platform
//   ST  – SME Emerge trade-for-trade
const VALID_SERIES = new Set(['EQ', 'BE', 'SM', 'ST']);

function parseCSV(csv: string, source: 'mainboard' | 'sme'): NSESymbol[] {
  const lines = csv.trim().split('\n');
  const result: NSESymbol[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (!cols[0]?.trim()) continue;

    const series = cols[2]?.trim();

    // For SME CSV accept any series; for main board apply the whitelist
    if (source === 'mainboard' && !VALID_SERIES.has(series)) continue;

    result.push({
      symbol: cols[0].trim(),
      name:   cols[1]?.trim() ?? '',
      isin:   cols[6]?.trim() ?? '',
    });
  }
  return result;
}

async function fetchCSV(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*' },
      next: { revalidate: 86400 }, // cache 24 h — symbol list rarely changes
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  try {
    // Fetch both lists in parallel; SME failure is non-fatal
    const [mainCsv, smeCsv] = await Promise.all([
      fetchCSV(MAIN_BOARD_URL),
      fetchCSV(SME_URL),
    ]);

    if (!mainCsv) {
      return Response.json({ error: 'NSE main board fetch failed' }, { status: 502 });
    }

    const mainSymbols = parseCSV(mainCsv, 'mainboard');
    const smeSymbols  = smeCsv ? parseCSV(smeCsv, 'sme') : [];

    // Deduplicate by symbol (main board takes precedence)
    const seen = new Set(mainSymbols.map(s => s.symbol));
    const uniqueSme = smeSymbols.filter(s => !seen.has(s.symbol));

    const symbols = [...mainSymbols, ...uniqueSme];

    return Response.json({
      symbols,
      count: symbols.length,
      breakdown: {
        mainboard: mainSymbols.length,
        sme: uniqueSme.length,
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
