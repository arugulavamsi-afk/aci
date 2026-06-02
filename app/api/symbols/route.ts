import type { NextRequest } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const NSE_MAIN = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const NSE_SME  = 'https://archives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv';

interface NseSymbol {
  symbol: string;
  name: string;
  isin: string;
  exchange: 'NSE';
}

const VALID_NSE_SERIES = new Set(['EQ', 'BE', 'SM', 'ST']);

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 86400 },
    });
    return res.ok ? res.text() : null;
  } catch { return null; }
}

function parseNSECsv(csv: string, acceptAllSeries = false): NseSymbol[] {
  const lines = csv.trim().split('\n');
  const result: NseSymbol[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (!cols[0]?.trim()) continue;
    const series = cols[2]?.trim();
    if (!acceptAllSeries && !VALID_NSE_SERIES.has(series)) continue;
    result.push({
      symbol:   cols[0].trim(),
      name:     cols[1]?.trim() ?? '',
      isin:     cols[6]?.trim() ?? '',
      exchange: 'NSE',
    });
  }
  return result;
}

export async function GET(_req: NextRequest) {
  const [mainCsv, smeCsv] = await Promise.all([
    fetchText(NSE_MAIN),
    fetchText(NSE_SME),
  ]);

  if (!mainCsv) {
    return Response.json({ error: 'NSE main board fetch failed' }, { status: 502 });
  }

  // Deduplicate by ISIN
  const nseIsins = new Set<string>();
  const symbols: NseSymbol[] = [];
  for (const s of [...parseNSECsv(mainCsv, false), ...(smeCsv ? parseNSECsv(smeCsv, true) : [])]) {
    if (s.isin && !nseIsins.has(s.isin)) {
      nseIsins.add(s.isin);
      symbols.push(s);
    }
  }

  return Response.json({ symbols, count: symbols.length });
}
