// Import from the internal lib path to bypass pdf-parse's self-test at module load
// (the self-test reads test/data/05-versions-space.pdf which doesn't exist in the project)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// Budget documents — try multiple URL patterns.
// The gov site consistently blocks Vercel IPs (returns 503), so this is a
// best-effort attempt; the admin UI provides a manual upload fallback.
const BUDGET_DOCS = [
  {
    label: 'Budget Speech',
    urls: [
      'https://www.indiabudget.gov.in/doc/Speech/bs.pdf',
      'https://www.indiabudget.gov.in/bspeech/bs2627.pdf',
      'https://www.indiabudget.gov.in/bspeech/bs2526.pdf',
    ],
  },
  {
    label: 'Budget at a Glance',
    urls: [
      'https://www.indiabudget.gov.in/doc/bh/bagall.pdf',
      'https://www.indiabudget.gov.in/doc/Budget_at_Glance/bag.pdf',
      'https://www.indiabudget.gov.in/doc/bh/bagh1.pdf',
    ],
  },
];

const EXTRACTION_PROMPT = `You are analyzing India's Union Budget documents to extract sector-wise fiscal allocations and policy priorities for an investment scoring system.

From the provided budget text, extract data for EACH of these sectors:
defense, power_renewable, railways, semiconductor, water_infra, roads_ports_logistics,
shipbuilding, ev_mobility, pharma_healthcare, drone_space, digital_it, specialty_chemicals,
financial_services, capital_goods, pli_manufacturing, agri_food, real_estate

For each sector return:
- policyWeight (integer 0-20): Government commitment strength based on allocation size, YoY growth, and policy emphasis
- allocationCrore (number): Total budget allocation in ₹ Crore (use 0 if not directly allocatable)
- yoyChangePct (number): % change vs previous year budget
- tailwindStrength ("very_strong" | "strong" | "moderate" | "weak"): Your assessment
- schemes (array of strings): Key government schemes mentioned for this sector
- keyHighlight (string): One sentence summarizing the most important policy development

Scoring guidelines for policyWeight:
- 18-20: Massive allocation (>₹50K Cr), explicit targets, dedicated mission
- 15-17: Strong allocation, PLI or major scheme backing
- 12-14: Moderate government interest, some scheme support
- 9-11: Mentioned but not a priority
- 0-8:  Not mentioned or being cut

Return ONLY valid JSON — no explanation, no markdown fences:
{
  "lastUpdated": "<today's date YYYY-MM-DD>",
  "budgetYear": "<budget year e.g. FY2026-27>",
  "presentedOn": "<budget presentation date YYYY-MM-DD>",
  "extractedBy": "Groq llama-3.3-70b-versatile — automated extraction",
  "sourceDocuments": ["<list of document names used>"],
  "sectors": {
    "<sector_key>": {
      "policyWeight": <number>,
      "allocationCrore": <number>,
      "yoyChangePct": <number>,
      "tailwindStrength": "<string>",
      "schemes": ["<scheme1>", "<scheme2>"],
      "keyHighlight": "<string>"
    }
  }
}`;

interface PdfDoc { label: string; text: string }

async function tryFetchDocs(): Promise<{ docs: PdfDoc[]; diagnostics: string }> {
  const results = await Promise.all(
    BUDGET_DOCS.map(async doc => {
      for (const url of doc.urls) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
              'Accept': 'application/pdf,*/*',
              'Referer': 'https://www.indiabudget.gov.in/',
            },
            signal: AbortSignal.timeout(25000),
          });
          if (!res.ok) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 1000 || buf.length > 15_000_000) continue;
          if (buf.subarray(0, 4).toString('ascii') !== '%PDF') continue;
          const { text } = await pdfParse(buf);
          return { label: doc.label, text: text.slice(0, 60000), status: `${url} → 200` };
        } catch {
          // try next url
        }
      }
      return { label: doc.label, text: null as string | null, status: doc.urls.map(u => `${u} → 503`).join(', ') };
    })
  );

  const docs = results.filter(r => r.text !== null).map(r => ({ label: r.label, text: r.text! }));
  const diagnostics = results.map(r => `${r.label}: ${r.status}`).join(' | ');
  return { docs, diagnostics };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractWithGroq(docs: PdfDoc[], apiKey: string): Promise<any> {
  // Free-tier Groq limit: 12,000 TPM. Budget text is token-dense (~1 token per 2 chars).
  // Target: ~7,000 input tokens for doc text → ~14,000 chars total across all docs.
  const perDocLimit = Math.floor(14000 / Math.max(docs.length, 1));
  const docText = docs
    .map(d => `=== ${d.label} ===\n${d.text.slice(0, perDocLimit)}`)
    .join('\n\n');

  const userMessage = `${docText}\n\n---\n${EXTRACTION_PROMPT}`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0].message.content;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const config = JSON.parse(cleaned);
  if (!config.sectors || typeof config.sectors !== 'object') throw new Error('Missing sectors object');
  return config;
}

async function commitToGitHub(
  token: string, owner: string, repo: string,
  newContent: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const path = 'lib/nse/tailwind-config.json';
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const currentRes = await fetch(apiBase, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!currentRes.ok) return { success: false, error: `GitHub GET failed: ${currentRes.status}` };
  const current = await currentRes.json() as { sha: string };

  const updateRes = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'chore: refresh tailwind config from Union Budget (automated)',
      content: Buffer.from(newContent).toString('base64'),
      sha: current.sha,
    }),
  });
  if (!updateRes.ok) {
    const err = await updateRes.text();
    return { success: false, error: `GitHub PUT failed: ${updateRes.status} — ${err}` };
  }
  const result = await updateRes.json() as { content: { html_url: string } };
  return { success: true, url: result.content?.html_url };
}

// POST /api/admin/refresh-tailwind
//
// Mode A — JSON body:  { commit?: boolean }
//   Tries to fetch PDFs from indiabudget.gov.in automatically.
//
// Mode B — FormData:   pdf0: File, pdf1?: File, commit: "true"|"false"
//   Uses uploaded PDFs directly (bypasses gov site).
export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  let docs: PdfDoc[] = [];
  let shouldCommit = false;
  let source = 'url';

  const ct = req.headers.get('content-type') ?? '';

  if (ct.includes('multipart/form-data')) {
    // ── Mode B: uploaded files ───────────────────────────────────────────────
    source = 'upload';
    const form = await req.formData();
    shouldCommit = form.get('commit') === 'true';

    for (const key of ['pdf0', 'pdf1', 'pdf2']) {
      const file = form.get(key);
      if (!file || !(file instanceof File)) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length < 1000) continue;
      if (buf.subarray(0, 4).toString('ascii') !== '%PDF') continue;
      const { text } = await pdfParse(buf);
      docs.push({ label: file.name.replace(/\.pdf$/i, ''), text: text.slice(0, 60000) });
    }

    if (docs.length === 0) {
      return Response.json({ error: 'No valid PDF files received. Ensure files start with %PDF.' }, { status: 400 });
    }
  } else {
    // ── Mode A: URL fetch ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({})) as { commit?: boolean };
    shouldCommit = body.commit === true;

    const { docs: fetched, diagnostics } = await tryFetchDocs();
    if (fetched.length === 0) {
      return Response.json(
        { error: `Could not fetch any budget documents from indiabudget.gov.in. Details: ${diagnostics}`, canUpload: true },
        { status: 502 }
      );
    }
    docs = fetched;
  }

  // ── Extract with Groq ────────────────────────────────────────────────────
  let newConfig;
  try {
    newConfig = await extractWithGroq(docs, apiKey);
  } catch (err) {
    return Response.json({ error: `Extraction failed: ${String(err)}` }, { status: 500 });
  }

  const configJson = JSON.stringify(newConfig, null, 2);

  // ── Commit to GitHub if requested ────────────────────────────────────────
  let commitResult: { success: boolean; url?: string; error?: string } | null = null;
  if (shouldCommit) {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER ?? 'arugulavamsi-afk';
    const repo  = process.env.GITHUB_REPO  ?? 'aci';
    if (!token) {
      return Response.json(
        { error: 'GITHUB_TOKEN not set — cannot commit. Set it in Vercel env vars.' },
        { status: 500 }
      );
    }
    commitResult = await commitToGitHub(token, owner, repo, configJson);
  }

  return Response.json({
    success: true,
    source,
    docsProcessed: docs.map(d => d.label),
    config: newConfig,
    committed: commitResult?.success ?? false,
    commitUrl: commitResult?.url ?? null,
    commitError: commitResult?.error ?? null,
    configJson,
  });
}
