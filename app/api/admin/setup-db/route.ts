import { setupSchema } from '@/lib/db';

export async function POST() {
  try {
    await setupSchema();
    return Response.json({ ok: true, message: 'stock_data table created (or already exists)' });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
