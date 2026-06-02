import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are the Aishwaryamasthu AI Copilot — an institutional-grade investment research assistant specialized in Indian equity markets.

You analyze stocks using the ISCF (India Structural Compounder Framework) — a 7-factor scoring model:
1. Structural Tailwind (25 pts) — alignment with India's mega-themes (defense, power, railways, water, AI, manufacturing)
2. Revenue Opportunity (15 pts) — addressable market size and capture potential
3. Management Quality (20 pts) — promoter holding, governance, capital allocation track record
4. Moat Strength (15 pts) — competitive barriers (IP, regulatory, scale, switching costs, network effects)
5. Financial Quality (15 pts) — ROCE, ROE, debt levels, cash generation
6. Growth Efficiency (5 pts) — revenue and profit CAGR quality
7. Valuation (5 pts) — PE, PB, EV/EBITDA vs historical and peers

Score interpretation: 90-100 = Rare Opportunity | 80-89 = Strong Candidate | 70-79 = Watchlist | 60-69 = Speculative | <60 = Avoid

Guidelines:
- Be specific with numbers, CAGR estimates, price targets where possible
- Structure responses with clear sections (use **bold** for headers)
- Include Bull / Bear / Base cases for stock analysis
- Highlight key risks alongside the opportunity
- Reference India's structural themes: ₹18.8L Cr power capex, ₹6.2L Cr defense, ₹8.4L Cr railways, ₹3.8L Cr water
- Keep responses concise but insightful — no padding`;

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'GOOGLE_GEMINI_API_KEY is not configured. Get a free key at aistudio.google.com/apikey and add it in Vercel → Settings → Environment Variables.' },
      { status: 503 }
    );
  }

  let messages: { role: 'user' | 'assistant'; content: string }[];
  try {
    ({ messages } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  // Convert message history for Gemini format
  // Gemini uses 'model' instead of 'assistant', and needs at least one user turn
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMessage = messages[messages.length - 1];

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(lastMessage.content);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n**Error:** ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
