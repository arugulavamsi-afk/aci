// GET /api/nse/screener
// Returns top multi-bagger candidates from the stock_data DB table.
// Pre-filters for stocks with sufficient data quality, then sorts by a
// SQL-level rough MB proxy (growth + quality − size-penalty) so the
// frontend receives the most promising candidates first.
//
// Falls back gracefully when the DB is not configured.

import type { NextRequest } from 'next/server';
import { getSql, isDbConfigured, rowToLiveQuote } from '@/lib/db';
import type { StockRow } from '@/lib/db';

export const revalidate = 300; // cache 5 min

export async function GET(req: NextRequest) {
  if (!isDbConfigured()) {
    return Response.json({ dbConfigured: false, quotes: [], total: 0 });
  }

  const limit = Math.min(
    500,
    parseInt(req.nextUrl.searchParams.get('limit') ?? '300', 10) || 300,
  );

  try {
    const sql = getSql();

    // Pre-filter: stocks with a price, a market cap ≥ ₹500 Cr (5e9 INR),
    // and at least one quality signal (growth or ROE/ROCE).
    // Pre-sort by a rough MB proxy so the most promising ones arrive first;
    // the frontend re-ranks with the full computeMbScore() function.
    //
    // market_cap column stores absolute INR (1 Cr = 10,000,000 = 1e7).
    // ₹500 Cr = 500 × 1e7 = 5e9 = 5,000,000,000.
    //
    // Rough proxy score (not the same as computeMbScore):
    //   growth_pts : revenue_growth  (max 30)
    //   quality_pts: roe             (max 20 via cap)
    //   runway_pen : market cap tiers (large caps penalised)

    const rows = await sql`
      SELECT *
      FROM stock_data
      WHERE
        cmp                > 0
        AND market_cap     > 5000000000
        AND (
          revenue_growth  IS NOT NULL
          OR earnings_growth IS NOT NULL
          OR roe          IS NOT NULL
          OR roce         IS NOT NULL
        )
      ORDER BY (
        -- Growth signal (0–30)
        LEAST(30, GREATEST(0, COALESCE(revenue_growth::numeric, 0)))
        +
        -- Quality signal (0–20)
        LEAST(20, GREATEST(0, COALESCE(roe::numeric, 0) * 0.6
                             + COALESCE(roce::numeric, 0) * 0.4))
        -
        -- Runway penalty for large/mega caps
        CASE
          WHEN market_cap > 1500000000000 THEN 18  -- >₹1.5L Cr
          WHEN market_cap > 500000000000  THEN 10  -- >₹50K Cr
          WHEN market_cap > 100000000000  THEN 4   -- >₹10K Cr
          ELSE 0
        END
      ) DESC NULLS LAST
      LIMIT ${limit}
    ` as unknown as StockRow[];

    const quotes = rows.map(rowToLiveQuote);
    return Response.json({ dbConfigured: true, quotes, total: quotes.length });
  } catch (err) {
    return Response.json(
      { dbConfigured: true, error: String(err), quotes: [], total: 0 },
      { status: 500 },
    );
  }
}
