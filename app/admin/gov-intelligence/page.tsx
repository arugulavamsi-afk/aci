'use client';

import { useState } from 'react';
import { govIntelligence, type GovIntelligence, type SectorGovIntel } from '@/lib/nse/govIntelligence';
import { RefreshCw, CheckCircle, AlertTriangle, GitCommit, Globe, Zap, ChevronDown, ChevronUp, Building2 } from 'lucide-react';

const BOOST_COLOR = (b: number) => b >= 3 ? '#10b981' : b >= 2 ? '#d4a853' : b >= 1 ? '#0c7b93' : '#6b7280';
const CONF_COLOR  = { high: '#10b981', medium: '#d4a853', low: '#6b7280' } as const;

export default function GovIntelligencePage() {
  const [loading,    setLoading]    = useState(false);
  const [preview,    setPreview]    = useState<GovIntelligence | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [committed,  setCommitted]  = useState(false);
  const [commitUrl,  setCommitUrl]  = useState<string | null>(null);
  const [fetchStats, setFetchStats] = useState<{ fetched: number; total: number } | null>(null);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  const active = preview ?? govIntelligence;

  async function runExtraction(commit: boolean) {
    setLoading(true);
    setError(null);
    setCommitted(false);
    setCommitUrl(null);
    setFetchStats(null);

    try {
      const res = await fetch('/api/admin/refresh-gov-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit }),
      });
      const data = await res.json() as {
        success?: boolean;
        intel?: GovIntelligence;
        sourcesFetched?: number;
        sourcesTotal?: number;
        committed?: boolean;
        commitUrl?: string;
        commitError?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Unknown error');
        return;
      }

      setPreview(data.intel ?? null);
      setFetchStats({ fetched: data.sourcesFetched ?? 0, total: data.sourcesTotal ?? 0 });
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
          <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #10b981, #0c7b93)' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#10b981', fontSize: '10.5px' }}>
            Admin · Government Intelligence
          </span>
        </div>
        <h1 className="text-2xl font-black" style={{ color: '#e8ecf4' }}>Ministry Intelligence Engine</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(232,236,244,0.45)' }}>
          Groq (Llama 3.3 70B) analyses NITI Aayog · Invest India · MoD · Jal Shakti · Power Ministry · Boosts ISCF tailwind scores
        </p>
      </div>

      {/* Sources + actions */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(232,236,244,0.35)' }}>
              Government Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(active.sources ?? {}).map(([name, url]) => (
                <a key={name} href={url as string} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(12,123,147,0.1)', border: '1px solid rgba(12,123,147,0.2)', color: '#2bb5d4' }}>
                  <Globe size={10} />
                  {name}
                </a>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '11px' }}>
              Last updated: {active.lastUpdated} · {active.extractedBy}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
            <button onClick={() => runExtraction(false)} disabled={loading} className="btn-ghost text-xs">
              <Globe size={12} />
              Preview Extract
            </button>
            <button onClick={() => runExtraction(true)} disabled={loading} className="btn-primary text-xs">
              {loading
                ? <><RefreshCw size={12} className="animate-spin" /> Analysing…</>
                : <><Zap size={12} /> Extract + Commit</>
              }
            </button>
          </div>
        </div>

        {fetchStats && (
          <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Globe size={11} style={{ color: '#0c7b93' }} />
            <span className="text-xs" style={{ color: 'rgba(232,236,244,0.5)', fontSize: '11px' }}>
              {fetchStats.fetched}/{fetchStats.total} pages fetched live · remaining filled from Groq training knowledge
            </span>
          </div>
        )}
      </div>

      {/* What gets collected */}
      <div className="glass-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(232,236,244,0.35)' }}>
          Signals collected per sector
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Government Spending', desc: 'Budget trends & allocations' },
            { label: 'PLI Schemes',         desc: 'Active incentive programmes' },
            { label: 'Capex Plans',         desc: 'Ministry investment targets' },
            { label: 'Import Substitution', desc: 'Domestic content mandates' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)' }}>
              <p className="text-xs font-bold" style={{ color: '#10b981' }}>{item.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.45)', fontSize: '11px' }}>{item.desc}</p>
            </div>
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
              Committed to GitHub — Vercel is redeploying with updated intelligence
            </span>
            {commitUrl && (
              <a href={commitUrl} target="_blank" rel="noopener noreferrer"
                className="ml-2 flex items-center gap-1 text-xs underline" style={{ color: '#2bb5d4' }}>
                <GitCommit size={11} /> View commit
              </a>
            )}
          </div>
        </div>
      )}

      {/* Preview banner */}
      {preview && !committed && (
        <div className="glass-card p-4 border" style={{ borderColor: 'rgba(212,168,83,0.3)', background: 'rgba(212,168,83,0.06)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: '#d4a853' }} />
              <span className="text-sm font-semibold" style={{ color: '#d4a853' }}>
                Preview ready — {Object.keys(preview.sectors ?? {}).length} sectors extracted
              </span>
            </div>
            <button onClick={() => runExtraction(true)} disabled={loading} className="btn-primary text-xs py-1.5">
              <GitCommit size={11} /> Apply &amp; Commit
            </button>
          </div>
        </div>
      )}

      {/* Sector intelligence table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <h2 className="font-bold text-sm" style={{ color: '#e8ecf4' }}>
            {preview ? '✨ Extracted Sector Intelligence (preview)' : 'Current Sector Intelligence'}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.35)' }}>
            govBoost adds 0–3 pts to ISCF Structural Tailwind on top of budget policyWeight
          </p>
        </div>

        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {Object.entries(active.sectors ?? {}).map(([key, sec]) => {
            const s = sec as SectorGovIntel;
            const isOpen = expanded === key;
            const bc = BOOST_COLOR(s.govBoost);
            const cc = CONF_COLOR[s.confidence as keyof typeof CONF_COLOR] ?? '#6b7280';

            return (
              <div key={key}>
                <button
                  className="w-full px-6 py-4 flex items-center gap-4 text-left transition-colors"
                  style={{ background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  onClick={() => setExpanded(isOpen ? null : key)}
                >
                  {/* Sector name */}
                  <div className="w-40 flex-shrink-0">
                    <span className="text-xs font-bold" style={{ color: '#e8ecf4', fontSize: '12px' }}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>

                  {/* Gov boost bar */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(s.govBoost / 3) * 100}%`, background: `linear-gradient(90deg, ${bc}60, ${bc})` }} />
                    </div>
                    <span className="w-8 text-right font-black metric-number text-sm" style={{ color: bc }}>
                      +{s.govBoost}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>/3</span>
                  </div>

                  {/* Confidence badge */}
                  <span className="badge flex-shrink-0" style={{
                    background: `${cc}15`, color: cc, border: `1px solid ${cc}25`,
                    fontSize: '9.5px', width: 56, textAlign: 'center',
                  }}>
                    {s.confidence}
                  </span>

                  {/* Ministry */}
                  <span className="hidden sm:flex items-center gap-1 text-xs flex-shrink-0 w-52" style={{ color: 'rgba(232,236,244,0.4)' }}>
                    <Building2 size={10} />
                    <span className="truncate" style={{ fontSize: '11px' }}>{s.primaryMinistry}</span>
                  </span>

                  {isOpen ? <ChevronUp size={13} style={{ color: 'rgba(232,236,244,0.3)' }} /> : <ChevronDown size={13} style={{ color: 'rgba(232,236,244,0.3)' }} />}
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 space-y-3" style={{ background: 'rgba(255,255,255,0.01)' }}>
                    {[
                      { label: 'PLI Schemes',         value: s.pliSchemes.join(' · '), color: '#10b981' },
                      { label: 'Capex Plan',           value: s.capexPlan,             color: '#d4a853' },
                      { label: 'Import Substitution',  value: s.importSubstitution,    color: '#2bb5d4' },
                      { label: 'Gov Targets',          value: s.govTargets,            color: '#a78bfa' },
                    ].map(row => (
                      <div key={row.label}>
                        <span className="text-xs font-semibold" style={{ color: row.color, fontSize: '10.5px' }}>
                          {row.label}
                        </span>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(232,236,244,0.65)', fontSize: '12px' }}>
                          {row.value}
                        </p>
                      </div>
                    ))}
                    <p className="text-xs" style={{ color: 'rgba(232,236,244,0.25)', fontSize: '10px' }}>
                      Signal date: {s.lastSignal}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Env vars */}
      <div className="glass-card p-5 space-y-3">
        <h3 className="font-bold text-sm" style={{ color: '#e8ecf4' }}>Required environment variables</h3>
        <div className="space-y-2">
          {[
            { key: 'GROQ_API_KEY',  desc: 'Free Groq API key — for Llama 3.3 70B extraction', required: true },
            { key: 'GITHUB_TOKEN',  desc: 'GitHub fine-grained PAT with repo Contents write permission', required: true },
            { key: 'GITHUB_OWNER', desc: 'GitHub username (default: arugulavamsi-afk)', required: false },
            { key: 'GITHUB_REPO',  desc: 'Repository name (default: aci)', required: false },
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
      </div>
    </div>
  );
}
