// Using Groq — free tier, global availability, Llama 3.3 70B
// No SDK needed — Groq is OpenAI-compatible, we use fetch + SSE streaming

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

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
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'GROQ_API_KEY is not configured. Get a free key at console.groq.com and add it in Vercel → Settings → Environment Variables.' },
      { status: 503 }
    );
  }

  let messages: { role: 'user' | 'assistant'; content: string }[];
  try {
    ({ messages } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const groqMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: MODEL, messages: groqMessages, stream: true }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text();
          controller.enqueue(encoder.encode(`\n\n**Error from Groq:** ${res.status} — ${errText}`));
          controller.close();
          return;
        }

        // Parse SSE stream — each line is "data: {...}" or "data: [DONE]"
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // keep incomplete last line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') { controller.close(); return; }
            try {
              const chunk = JSON.parse(data);
              const text: string = chunk.choices?.[0]?.delta?.content ?? '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* skip malformed chunk */ }
          }
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
