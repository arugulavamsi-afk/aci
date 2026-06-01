// Module-level cache persists across requests within the same server process.
// Crumb + cookie expire after ~1 hour on Yahoo's side, so we refresh every 50 minutes.
let cached: { crumb: string; cookie: string; expiresAt: number } | null = null;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function getYahooAuth(): Promise<{ crumb: string; cookie: string }> {
  if (cached && Date.now() < cached.expiresAt) {
    return { crumb: cached.crumb, cookie: cached.cookie };
  }

  // Step 1 — get session cookie
  const r1 = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  const rawCookie = r1.headers.get('set-cookie') ?? '';
  // Extract just the cookie values (name=value pairs), not directives
  const cookie = rawCookie
    .split(',')
    .map(c => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');

  // Step 2 — fetch crumb using that cookie
  const r2 = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  });
  const crumb = (await r2.text()).trim();

  if (!crumb || crumb.includes('<')) {
    throw new Error('Failed to obtain Yahoo Finance crumb');
  }

  cached = { crumb, cookie, expiresAt: Date.now() + 50 * 60 * 1000 };
  return { crumb, cookie };
}

export function formatMarketCap(cap: number | null | undefined): string {
  if (!cap) return '—';
  const cr = cap / 1e7; // INR to Crores
  if (cr >= 100000) return `₹${(cr / 100000).toFixed(2)}L Cr`;
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(1)}K Cr`;
  return `₹${cr.toFixed(0)} Cr`;
}
