// Serves all stocks from Postgres cache — single query, instant response.
// Falls back gracefully if DB is not configured (returns empty array so
// the discovery page can fall back to live Yahoo Finance batching).

import { getSql, isDbConfigured, rowToLiveQuote } from '@/lib/db';
import type { StockRow } from '@/lib/db';

export async function GET() {
  if (!isDbConfigured()) {
    return Response.json({ quotes: [], source: 'none' });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM stock_data
      ORDER BY market_cap DESC NULLS LAST
    ` as StockRow[];

    const quotes = rows.map(rowToLiveQuote);

    // Surface metadata for the discovery page header
    const lastUpdated = rows[0]?.updated_at ?? null;

    return Response.json({ quotes, count: quotes.length, lastUpdated, source: 'db' });
  } catch (err) {
    // DB error should not crash the app — discovery page falls back to live fetch
    console.error('stock_data query failed:', err);
    return Response.json({ quotes: [], source: 'error', error: String(err) });
  }
}
