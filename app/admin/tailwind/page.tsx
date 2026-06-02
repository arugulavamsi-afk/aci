'use client';

import { useState } from 'react';
import { tailwindConfig, type TailwindConfig } from '@/lib/nse/tailwindConfig';
import { RefreshCw, CheckCircle, AlertTriangle, GitCommit, FileText, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const STRENGTH_COLOR: Record<string, string> = {
  very_strong: '#10b981',
  strong:      '#d4a853',
  moderate:    '#0c7b93',
  weak:        '#6b7280',
};

export default function TailwindAdminPage() {
  const [loading, setLoading]       = useState(false);
  const [preview, setPreview]       = useState<TailwindConfig | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [committed, setCommitted]   = useState(false);
  const [commitUrl, setCommitUrl]   = useState<string | null>(null);
  const [docsProcessed, setDocsProcessed] = useState<string[]>([]);
  const [expanded, setExpanded]     = useState<string | null>(null);

  const active = preview ?? tailwindConfig;

  async function runExtraction(commit: boolean) {
    setLoading(true);
    setError(null);
    setCommitted(false);
    setCommitUrl(null);

    try {
      const res = await fetch('/api/admin/refresh-tailwind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit }),
      });
      const data = await res.json() as {
        success?: boolean;
        config?: TailwindConfig;
        committed?: boolean;
        commitUrl?: string;
        commitError?: string;
        docsProcessed?: string[];
        error?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Unknown error');
        return;
      }

      setPreview(data.config ?? null);
      setDocsProcessed(data.docsProcessed ?? []);
      if (commit) {
        setCommitted(data.committed ?? false);
        setCommitUrl(data.commitUrl ?? null);
        if (data.commitError) setError(`Commit failed: ${data.commitError}`);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 bg-mesh min-h-full space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #d4a853, #0c7b93)' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#d4a853', fontSize: '10.5px' }}>
            Admin · Tailwind Config
          </span>
        </div>
        <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>Structural Tailwind Manager</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
          Extract sector weights from Union Budget PDFs using Claude · Commit to GitHub · Auto-redeploy
        </p>
      </div>

      {/* Status card */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(232,236,244,0.35)' }}>
              Current Config
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
                <span className="text-xs font-semibold" style={{ color: '#10b981' }}>{tailwindConfig.budgetYear}</span>
              </div>
              <span className="text-xs" style={{ color: 'rgba(232,236,244,0.4)' }}>
                Last updated: {tailwindConfig.lastUpdated}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '11px' }}>
              {tailwindConfig.extractedBy}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => runExtraction(false)}
              disabled={loading}
              className="btn-ghost text-xs"
            >
              <FileText size={12} />
              Preview Extract
            </button>
            <button
              onClick={() => runExtraction(true)}
              disabled={loading}
              className="btn-primary text-xs"
            >
              {loading
                ? <><RefreshCw size={12} className="animate-spin" /> Extracting…</>
                : <><Zap size={12} /> Extract + Commit</>
              }
            </button>
          </div>
        </div>

        {/* Source docs */}
        <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '11px' }}>Sources:</span>
          {tailwindConfig.sourceDocuments.map(url => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer"
              className="text-xs underline" style={{ color: '#2bb5d4', fontSize: '11px' }}>
              {url.split('/').pop()}
            </a>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} style={{ color: '#ef4444', marginTop: 1 }} />
            <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Commit success */}
      {committed && (
        <div className="glass-card p-4 border" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}>
          <div className="flex items-center gap-2">
            <CheckCircle size={14} style={{ color: '#10b981' }} />
            <span className="text-sm font-semibold" style={{ color: '#10b981' }}>
              Committed to GitHub — Vercel is redeploying with new weights
            </span>
            {commitUrl && (
              <a href={commitUrl} target="_blank" rel="noopener noreferrer"
                className="ml-2 flex items-center gap-1 text-xs underline" style={{ color: '#2bb5d4' }}>
                <GitCommit size={11} /> View commit
              </a>
            )}
          </div>
          {docsProcessed.length > 0 && (
            <p className="text-xs mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
              Processed: {docsProcessed.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Preview banner */}
      {preview && !committed && (
        <div className="glass-card p-4 border" style={{ borderColor: 'rgba(212,168,83,0.3)', background: 'rgba(212,168,83,0.06)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: '#d4a853' }} />
              <span className="text-sm font-semibold" style={{ color: '#d4a853' }}>
                Preview ready — {preview.budgetYear} · {docsProcessed.join(', ')}
              </span>
            </div>
            <button onClick={() => runExtraction(true)} disabled={loading} className="btn-primary text-xs py-1.5">
              <GitCommit size={11} /> Apply &amp; Commit
            </button>
          </div>
        </div>
      )}

      {/* Sector table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <h2 className="font-bold text-sm" style={{ color: '#e8ecf4' }}>
            {preview ? '✨ Extracted Sector Weights (preview)' : 'Current Sector Weights'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.35)' }}>
            policyWeight feeds directly into ISCF Structural Tailwind score
          </p>
        </div>

        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {Object.entries(active.sectors).map(([key, sec]) => {
            const isOpen = expanded === key;
            const strengthColor = STRENGTH_COLOR[sec.tailwindStrength] ?? '#6b7280';
            const barWidth = `${(sec.policyWeight / 20) * 100}%`;

            return (
              <div key={key}>
                <button
                  className="w-full px-6 py-4 flex items-center gap-4 text-left transition-colors"
                  style={{ background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  {/* Sector key */}
                  <div className="w-40 flex-shrink-0">
                    <span className="text-xs font-bold" style={{ color: '#e8ecf4', fontSize: '12px' }}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>

                  {/* Weight bar */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: barWidth, background: `linear-gradient(90deg, ${strengthColor}60, ${strengthColor})` }} />
                    </div>
                    <span className="w-8 text-right font-black metric-number text-sm" style={{ color: strengthColor }}>
                      {sec.policyWeight}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>/20</span>
                  </div>

                  {/* Strength badge */}
                  <span className="badge flex-shrink-0" style={{
                    background: `${strengthColor}15`,
                    color: strengthColor,
                    border: `1px solid ${strengthColor}25`,
                    fontSize: '9.5px',
                    width: 80,
                    textAlign: 'center',
                  }}>
                    {sec.tailwindStrength.replace('_', ' ')}
                  </span>

                  {/* Allocation */}
                  <span className="w-28 text-right text-xs font-medium metric-number flex-shrink-0" style={{ color: 'rgba(232,236,244,0.5)' }}>
                    {sec.allocationCrore > 0
                      ? sec.allocationCrore >= 100000
                        ? `₹${(sec.allocationCrore / 100000).toFixed(1)}L Cr`
                        : `₹${(sec.allocationCrore / 1000).toFixed(0)}K Cr`
                      : '—'}
                  </span>

                  {/* YoY */}
                  <span className="w-14 text-right text-xs font-bold flex-shrink-0" style={{ color: sec.yoyChangePct >= 10 ? '#10b981' : sec.yoyChangePct >= 0 ? '#f59e0b' : '#ef4444' }}>
                    {sec.yoyChangePct > 0 ? '+' : ''}{sec.yoyChangePct}%
                  </span>

                  {isOpen ? <ChevronUp size={13} style={{ color: 'rgba(232,236,244,0.3)' }} /> : <ChevronDown size={13} style={{ color: 'rgba(232,236,244,0.3)' }} />}
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-6 pb-5" style={{ background: 'rgba(255,255,255,0.01)' }}>
                    <p className="text-sm mb-3 leading-relaxed" style={{ color: 'rgba(232,236,244,0.65)', fontSize: '12.5px' }}>
                      {sec.keyHighlight}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sec.schemes.map(scheme => (
                        <span key={scheme} className="badge" style={{ background: 'rgba(12,123,147,0.12)', color: '#2bb5d4', border: '1px solid rgba(12,123,147,0.2)', fontSize: '10px' }}>
                          {scheme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Setup instructions */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-bold text-sm" style={{ color: '#e8ecf4' }}>Required environment variables</h3>
        <div className="space-y-2">
          {[
            { key: 'ANTHROPIC_API_KEY', desc: 'Claude API key — for PDF extraction', required: true },
            { key: 'GITHUB_TOKEN',      desc: 'GitHub fine-grained PAT with repo Contents write permission', required: true },
            { key: 'GITHUB_OWNER',      desc: 'GitHub username (default: arugulavamsi-afk)', required: false },
            { key: 'GITHUB_REPO',       desc: 'Repository name (default: aci)', required: false },
          ].map(v => (
            <div key={v.key} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <code className="text-xs font-bold" style={{ color: '#d4a853', fontFamily: 'monospace' }}>{v.key}</code>
              <span className="text-xs flex-1" style={{ color: 'rgba(232,236,244,0.5)' }}>{v.desc}</span>
              <span className="badge text-xs" style={{ background: v.required ? 'rgba(239,68,68,0.1)' : 'rgba(107,114,128,0.1)', color: v.required ? '#ef4444' : '#6b7280', fontSize: '9px' }}>
                {v.required ? 'Required' : 'Optional'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '11px' }}>
          Set these in Vercel → Settings → Environment Variables, then redeploy.
          For GITHUB_TOKEN: go to GitHub → Settings → Developer settings → Fine-grained tokens → create token with Contents: Read &amp; Write on the aci repo.
        </p>
      </div>
    </div>
  );
}
