import type { NextRequest } from 'next/server';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const NSE_MAIN = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const NSE_SME  = 'https://archives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv';
// BSE active equity list — scrip code, name, ISIN
const BSE_LIST = 'https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active';

interface CombinedSymbol {
  symbol: string;
  name: string;
  isin: string;
  exchange: 'NSE' | 'BSE';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      next: { revalidate: 86400 },
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

function parseNSECsv(csv: string, acceptAllSeries = false): CombinedSymbol[] {
  const lines = csv.trim().split('\n');
  const result: CombinedSymbol[] = [];
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBSEJson(data: any): CombinedSymbol[] {
  const table = data?.Table ?? data?.table ?? [];
  if (!Array.isArray(table)) return [];
  return table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      symbol:   String(r.Scrip_Code ?? r.scripCode ?? '').trim(),
      name:     String(r.Scrip_Name ?? r.Corp_Name ?? r.scripName ?? '').trim(),
      isin:     String(r.ISIN_No ?? r.ISIN ?? r.isin ?? '').trim(),
      exchange: 'BSE' as const,
    }))
    .filter((s: CombinedSymbol) => s.symbol && s.isin);
}

export async function GET(_req: NextRequest) {
  const [mainCsv, smeCsv, bseData] = await Promise.all([
    fetchText(NSE_MAIN),
    fetchText(NSE_SME),
    fetchJson(BSE_LIST),
  ]);

  if (!mainCsv) {
    return Response.json({ error: 'NSE main board fetch failed' }, { status: 502 });
  }

  // Build NSE symbol list, deduplicated by ISIN
  const nseRaw    = parseNSECsv(mainCsv, false);
  const nseSme    = smeCsv ? parseNSECsv(smeCsv, true) : [];
  const nseIsins  = new Set<string>();
  const nseSymbols: CombinedSymbol[] = [];
  for (const s of [...nseRaw, ...nseSme]) {
    if (s.isin && !nseIsins.has(s.isin)) {
      nseIsins.add(s.isin);
      nseSymbols.push(s);
    }
  }

  // BSE-only: companies whose ISIN does not appear in NSE list
  const bseRaw  = bseData ? parseBSEJson(bseData) : [];
  const bseOnly = bseRaw.filter(s => s.isin && !nseIsins.has(s.isin));

  const symbols = [...nseSymbols, ...bseOnly];

  return Response.json({
    symbols,
    count: symbols.length,
    breakdown: { nse: nseSymbols.length, bseOnly: bseOnly.length },
  });
}
