// Uses Groq (Llama 3.3 70B) to extract structured policy intelligence from
// 5 Indian government sources: NITI Aayog, Invest India, MoD, Jal Shakti, Power.
// Saves to lib/nse/gov-intelligence.json via GitHub API.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const GOV_SOURCES = [
  { name: 'Ministry of Power',    url: 'https://powermin.gov.in/en/content/power-sector-glance-all-india' },
  { name: 'Ministry of Jal Shakti', url: 'https://jaljeevanmission.gov.in/' },
  { name: 'Ministry of Defence — Make in India', url: 'https://www.mod.gov.in/dod/Make-in-India' },
  { name: 'Invest India — Defence', url: 'https://www.investindia.gov.in/sector/defence' },
  { name: 'Invest India — Renewable Energy', url: 'https://www.investindia.gov.in/sector/renewable-energy' },
  { name: 'NITI Aayog — Verticals', url: 'https://www.niti.gov.in/verticals' },
];

const SECTORS_TO_ANALYZE = [
  'defense', 'power_renewable', 'water_infra', 'capital_goods',
  'pharma_healthcare', 'semiconductor', 'railways', 'ev_mobility',
  'shipbuilding', 'steel_metals', 'telecom_infra',
];

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ACI-Research/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip HTML tags and collapse whitespace
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);
    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

function buildExtractionPrompt(fetchedSources: { name: string; content: string | null }[]): string {
  const sourceBlocks = fetchedSources.map(s =>
    `[${s.name}]\n${s.content ?? '(fetch failed — use your training knowledge about this ministry)'}`
  ).join('\n\n---\n\n');

  return `You are an Indian equity research analyst extracting structured government policy intelligence.

## Government Sources (partially fetched, supplement with training knowledge through 2025):

${sourceBlocks}

## Task
Extract government policy signals for Indian equity research. For each sector below, analyze:
- Active PLI (Production-Linked Incentive) schemes with allocation amounts
- Ministry capex plans with ₹ crore amounts and timelines
- Import substitution mandates and domestic content requirements
- NITI Aayog / ministry growth targets and deadlines

Sectors to analyze: ${SECTORS_TO_ANALYZE.join(', ')}

## govBoost scoring (0–3 additional tailwind points beyond Union Budget allocation):
- 3: Multiple active PLI schemes + explicit ₹ capex target + import substitution mandate with timeline
- 2: Active PLI scheme AND (capex plan OR import substitution target with specifics)
- 1: Some ministry push but no concrete scheme / vague targets
- 0: No specific ministry initiative beyond budget allocation

## Required output — return ONLY valid JSON, no markdown, no explanation:
{
  "lastUpdated": "${new Date().toISOString().split('T')[0]}",
  "extractedBy": "Groq llama-3.3-70b-versatile — automated extraction",
  "sources": {
    "NITI Aayog": "https://www.niti.gov.in/",
    "Invest India": "https://www.investindia.gov.in/",
    "Ministry of Defence": "https://www.mod.gov.in/",
    "Ministry of Jal Shakti": "https://jaljeevanmission.gov.in/",
    "Ministry of Power": "https://powermin.gov.in/"
  },
  "sectors": {
    "<sector_key>": {
      "govBoost": <integer 0-3>,
      "confidence": "<high|medium|low>",
      "pliSchemes": ["<scheme name + ₹ amount>"],
      "capexPlan": "<specific capex with ₹ crore amount and year/timeline>",
      "importSubstitution": "<specific targets, mandates, duties — not generic>",
      "govTargets": "<NITI Aayog or ministry quantified targets with year>",
      "primaryMinistry": "<ministry name>",
      "lastSignal": "${new Date().toISOString().split('T')[0]}"
    }
  }
}`;
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

async function commitToGitHub(
  token: string, owner: string, repo: string, newContent: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const path = 'lib/nse/gov-intelligence.json';
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
      message: 'chore: refresh gov intelligence from ministry sources (automated)',
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

// POST /api/admin/refresh-gov-intelligence
// Body: { commit?: boolean }
export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({})) as { commit?: boolean };
  const shouldCommit = body.commit === true;

  // ── Step 1: Fetch gov source pages in parallel ────────────────────────────
  const fetched = await Promise.all(
    GOV_SOURCES.map(async s => ({
      name: s.name,
      content: await fetchPageText(s.url),
    }))
  );

  const fetchedCount = fetched.filter(f => f.content !== null).length;

  // ── Step 2: Extract via Groq ──────────────────────────────────────────────
  const prompt = buildExtractionPrompt(fetched);
  let rawJson: string;
  try {
    rawJson = await callGroq(prompt, apiKey);
  } catch (err) {
    return Response.json({ error: `Groq extraction failed: ${String(err)}` }, { status: 500 });
  }

  // ── Step 3: Parse and validate ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let newIntel: any;
  try {
    const cleaned = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    newIntel = JSON.parse(cleaned);
    if (!newIntel.sectors || typeof newIntel.sectors !== 'object') {
      throw new Error('Missing sectors object');
    }
  } catch (err) {
    return Response.json(
      { error: `JSON parse failed: ${String(err)}`, raw: rawJson },
      { status: 422 }
    );
  }

  const intelJson = JSON.stringify(newIntel, null, 2);

  // ── Step 4: Commit to GitHub if requested ─────────────────────────────────
  let commitResult: { success: boolean; url?: string; error?: string } | null = null;
  if (shouldCommit) {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER ?? 'arugulavamsi-afk';
    const repo  = process.env.GITHUB_REPO  ?? 'aci';
    if (!token) {
      return Response.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 });
    }
    commitResult = await commitToGitHub(token, owner, repo, intelJson);
  }

  return Response.json({
    success: true,
    sourcesFetched: fetchedCount,
    sourcesTotal: GOV_SOURCES.length,
    intel: newIntel,
    committed: commitResult?.success ?? false,
    commitUrl: commitResult?.url ?? null,
    commitError: commitResult?.error ?? null,
  });
}
