// Server-side proxy for triggering the stock refresh from the admin UI.
// The CRON_SECRET is only available server-side, so the browser calls this
// route instead of hitting /api/cron/refresh-stocks directly.

import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const secret = process.env.CRON_SECRET;

  const url = secret
    ? `${origin}/api/cron/refresh-stocks?secret=${encodeURIComponent(secret)}`
    : `${origin}/api/cron/refresh-stocks`;

  try {
    const res  = await fetch(url, { method: 'GET' });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
