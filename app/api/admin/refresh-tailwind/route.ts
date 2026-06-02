import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Budget documents — Budget Speech is concise (~30 pages) and has all key numbers.
// Budget at a Glance covers sector allocations in tabular form.
const BUDGET_DOCS = [
  { label: 'Budget Speech',        url: 'https://www.indiabudget.gov.in/doc/Speech/bs.pdf' },
  { label: 'Budget at a Glance',   url: 'https://www.indiabudget.gov.in/doc/bh/bagall.pdf' },
];

const EXTRACTION_PROMPT = `You are analyzing India's Union Budget documents to extract sector-wise fiscal allocations and policy priorities for an investment scoring system.

From the provided budget documents, extract data for EACH of these sectors:
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

Return ONLY valid JSON in this exact structure — no explanation, no markdown:
{
  "lastUpdated": "<today's date YYYY-MM-DD>",
  "budgetYear": "<budget year e.g. FY2025-26>",
  "presentedOn": "<budget presentation date YYYY-MM-DD>",
  "extractedBy": "Claude claude-sonnet-4-6 — automated extraction",
  "sourceDocuments": ["<list of PDF URLs used>"],
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

async function fetchPdfAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ACI-Platform/1.0)' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    // Reject if suspiciously large (>15 MB) — likely wrong document
    if (buffer.byteLength > 15_000_000) return null;
    return Buffer.from(buffer).toString('base64');
  } catch {
    return null;
  }
}

async function commitToGitHub(
  token: string, owner: string, repo: string,
  newContent: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const path = 'lib/nse/tailwind-config.json';
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // Get current file SHA (needed to update)
  const currentRes = await fetch(apiBase, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!currentRes.ok) return { success: false, error: `GitHub GET failed: ${currentRes.status}` };
  const current = await currentRes.json() as { sha: string };

  // Commit new content
  const body = {
    message: `chore: refresh tailwind config from Union Budget (automated)`,
    content: Buffer.from(newContent).toString('base64'),
    sha: current.sha,
  };
  const updateRes = await fetch(apiBase, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!updateRes.ok) {
    const err = await updateRes.text();
    return { success: false, error: `GitHub PUT failed: ${updateRes.status} — ${err}` };
  }
  const result = await updateRes.json() as { content: { html_url: string } };
  return { success: true, url: result.content?.html_url };
}

// POST /api/admin/refresh-tailwind
// Body: { commit?: boolean }   (commit=true writes back to GitHub → triggers redeploy)
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({})) as { commit?: boolean };
  const shouldCommit = body.commit === true;

  // ── Step 1: Fetch budget PDFs in parallel ──────────────────────────────────
  const pdfResults = await Promise.all(
    BUDGET_DOCS.map(async doc => ({
      label: doc.label,
      url: doc.url,
      base64: await fetchPdfAsBase64(doc.url),
    }))
  );

  const available = pdfResults.filter(r => r.base64 !== null);
  if (available.length === 0) {
    return Response.json(
      { error: 'Could not fetch any budget documents from indiabudget.gov.in' },
      { status: 502 }
    );
  }

  // ── Step 2: Send to Claude for extraction ──────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlocks: any[] = available.map(doc => ({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 },
    title: doc.label,
  }));
  contentBlocks.push({ type: 'text', text: EXTRACTION_PROMPT });

  let extractedText: string;
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: contentBlocks }],
    });
    extractedText = (message.content[0] as { text: string }).text;
  } catch (err) {
    return Response.json({ error: `Claude extraction failed: ${String(err)}` }, { status: 500 });
  }

  // ── Step 3: Parse and validate JSON ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newConfig: any;
  try {
    // Claude sometimes wraps in markdown code fences — strip them
    const cleaned = extractedText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    newConfig = JSON.parse(cleaned);
    if (!newConfig.sectors || typeof newConfig.sectors !== 'object') {
      throw new Error('Missing sectors object');
    }
  } catch (err) {
    return Response.json(
      { error: `JSON parse failed: ${String(err)}`, raw: extractedText },
      { status: 422 }
    );
  }

  const configJson = JSON.stringify(newConfig, null, 2);

  // ── Step 4: Commit to GitHub if requested ─────────────────────────────────
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
    docsProcessed: available.map(d => d.label),
    config: newConfig,
    committed: commitResult?.success ?? false,
    commitUrl: commitResult?.url ?? null,
    commitError: commitResult?.error ?? null,
    configJson,
  });
}
