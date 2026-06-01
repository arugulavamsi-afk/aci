'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Zap, BarChart3, Target, TrendingUp, FileText, RefreshCw } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `Welcome to **Aishwaryamasthu AI Copilot** — your institutional-grade research partner powered by the ISCF framework.

I can help you:
• **Analyze companies** and generate investment theses
• **Compare stocks** across ISCF dimensions
• **Explain moats, risks**, and structural tailwinds
• **Summarize annual reports** and earnings calls
• **Generate Bull / Bear / Base case** scenarios
• **Identify compounders** aligned with India's growth themes

What would you like to research today?`,
  timestamp: new Date(),
};

const AI_RESPONSES: Record<string, string> = {
  default: `Based on the ISCF framework analysis, let me provide you a structured perspective.

**Structural Tailwind Analysis:**
The company scores exceptionally well on India's mega-themes — particularly in the Power & Defense intersection, which carries a combined capex opportunity of ₹25L Cr over the next decade.

**Management Quality (18/20):**
Promoter holding above 51% with zero pledging signals strong alignment. Capital allocation track record shows disciplined reinvestment with ROCE improvement from 18% → 24% over 5 years.

**Moat Assessment (13/15):**
• Regulatory barriers: Defense clearances take 3–5 years — creating near-impenetrable entry barriers
• Technology IP: 40+ patents in radar and electronic warfare systems
• Scale economics: Production scale enables cost leadership vs. smaller peers

**Investment Thesis:**
This represents a **Strong Candidate** (Score: 88/100) with 10-year earnings CAGR potential of 20–25%. The combination of policy tailwind + execution capability + strong balance sheet creates a rare compounding opportunity in India's public markets.

**Key Watch Points:**
1. Defense budget allocation in Feb 2027 Union Budget
2. Q2 FY27 order inflow trajectory
3. Export revenue as % of total — target 15% by FY28`,

  bel: `**BEL (Bharat Electronics Limited) — ISCF Deep Dive**

**Compounder Score: 91/100 — RARE OPPORTUNITY**

**Structural Tailwinds (23/25):**
BEL sits at the epicenter of three of India's most powerful structural themes: Defense indigenization, Digital transformation, and AI/sensor fusion. The Atmanirbhar Bharat defense push represents a generational shift in procurement policy — and BEL is the primary beneficiary.

**Management Excellence (19/20):**
51% promoter holding (Government of India) provides political will backing. Zero pledging, no auditor concerns, consistent dividend payout, and proven execution on INS Vikrant systems demonstrate governance strength.

**Moat — Exceptional (14/15):**
Four interlocking moats make disruption nearly impossible: (1) Defense security clearances take 5+ years, (2) Proprietary tech IP across 40+ patents, (3) Scale gives cost leadership, (4) Regulatory moat from MoD procurement rules favoring domestic suppliers.

**Bull Case (3-Year Horizon):**
Revenue: ₹30,000 Cr by FY28 (vs ₹21,000 Cr FY26)
EBITDA Margin: 18% (vs 15% FY26)
Target PE: 42-48x (justified by growth quality)
Price Target: ₹380–430

**Risks:**
• Customer concentration (85% MoD/PSU)
• Long project gestation periods
• Private sector competition from L&T Defense

**Verdict:** Core portfolio holding. Add aggressively on any correction below ₹230.`,

  compare: `**Comparison: BEL vs Cochin Shipyard — ISCF Framework**

| Metric | BEL | Cochin Shipyard |
|--------|-----|-----------------|
| ISCF Score | 91 | 88 |
| Management | 19/20 | 18/20 |
| Moat | 14/15 | 13/15 |
| Financial | 14/15 | 13/15 |
| Tailwind | 23/25 | 23/25 |
| Valuation | 3/5 | 3/5 |

**BEL Advantages:**
• Broader product portfolio (radar, sonar, EW, communication)
• Larger order book visibility (₹65,000+ Cr)
• More diversified revenue streams
• Stronger R&D capabilities

**Cochin Shipyard Advantages:**
• Higher ROCE (20% vs 26% — wait, BEL wins here too)
• Asset-heavy business with strategic importance
• Green hydrogen vessel technology opportunity
• Smaller base = potentially higher growth rate

**Verdict:**
Both are High Conviction holdings. BEL is the larger, safer compounder; Cochin Shipyard offers higher risk-adjusted upside from a smaller base. Ideal to hold both — they're complementary, not substitutes, in a defense portfolio.`,

  water: `**Water Infrastructure Theme — Structural Tailwind Analysis**

**Theme Score: 88/100 | Capital Opportunity: ₹3.8L Cr**

India faces a critical water infrastructure gap: 40% of population lacks access to clean drinking water, industrial water demand growing at 8% CAGR, and agricultural water efficiency at 30% vs global best of 70%.

**Government Initiatives Driving Demand:**
• Jal Jeevan Mission: ₹3.6L Cr for rural water supply (FY19–FY24, extended)
• AMRUT 2.0: ₹2.77L Cr for urban water infrastructure
• National Water Policy 2025: Mandating water recycling in industries
• Smart Cities Mission: Water metering and monitoring systems

**Top ISCF Picks in Water Theme:**

1. **VA Tech Wabag (84/100 — HIGH CONVICTION)**
   - Global water tech leader with project execution in 40+ countries
   - Order book: ₹5,200+ Cr, revenue visibility for 3+ years
   - ROCE: 18.4% | Revenue CAGR: 16.4%
   - Unique: Municipal + industrial + desalination capabilities

2. **Ion Exchange India (Watch)**
   - Industrial water treatment focus
   - Chemical and equipment segments

3. **Enviro Infratech (Emerging)**
   - Municipal STP/WTP execution specialist

**Investment Thesis:**
Water is India's most underdiscussed structural theme. The ₹100B+ opportunity over 2025–2035 will be served by very few listed companies — creating exceptional scarcity value for quality operators like Wabag.`,
};

function getAIResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('bel') || lower.includes('bharat electronics')) return AI_RESPONSES.bel;
  if (lower.includes('compare') || lower.includes('vs') || lower.includes('versus')) return AI_RESPONSES.compare;
  if (lower.includes('water') || lower.includes('wabag')) return AI_RESPONSES.water;
  return AI_RESPONSES.default;
}

const PROMPTS = [
  { icon: '🎯', label: 'Analyze BEL', prompt: 'Give me a deep ISCF analysis of BEL (Bharat Electronics Limited)' },
  { icon: '⚖️', label: 'Compare Stocks', prompt: 'Compare BEL vs Cochin Shipyard using the ISCF framework' },
  { icon: '💧', label: 'Water Theme', prompt: 'Explain the water infrastructure investment theme and top picks' },
  { icon: '🛡️', label: 'Defense Thesis', prompt: 'What is the investment thesis for India defense sector compounders?' },
  { icon: '📊', label: 'Top 5 Picks', prompt: 'Give me the top 5 highest conviction ISCF stocks right now' },
  { icon: '⚡', label: 'Power Theme', prompt: 'Analyze the power infrastructure structural tailwind and best plays' },
];

function formatMessage(content: string) {
  const lines = content.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <div key={i} className="font-black mt-3 mb-1" style={{ color: '#e8ecf4', fontSize: '13px' }}>{line.slice(2, -2)}</div>;
    }
    if (line.startsWith('• ')) {
      const text = line.slice(2);
      return (
        <div key={i} className="flex items-start gap-2 my-1">
          <div className="w-1 h-1 rounded-full flex-shrink-0 mt-2" style={{ background: '#d4a853' }} />
          <span>{formatInline(text)}</span>
        </div>
      );
    }
    if (line.startsWith('| ')) {
      return <div key={i} className="font-mono text-xs my-0.5" style={{ color: 'rgba(232,236,244,0.6)' }}>{line}</div>;
    }
    if (line.match(/^\d\./)) {
      return <div key={i} className="my-1 ml-2">{formatInline(line)}</div>;
    }
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return <div key={i} className="my-0.5">{formatInline(line)}</div>;
  });
}

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#e8ecf4' }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    const aiResponse = getAIResponse(text);
    const aiMsg: Message = { role: 'assistant', content: aiResponse, timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-mesh">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #2bb5d4, #8b5cf6)' }} />
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#2bb5d4', fontSize: '10.5px', letterSpacing: '0.14em' }}>
                AI Research Copilot
              </span>
            </div>
            <h1 className="text-xl font-black" style={{ color: '#e8ecf4' }}>Aishwaryamasthu Intelligence</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232,236,244,0.4)' }}>
              ISCF-powered research · Bull / Bear / Base case · Moat analysis · Thesis generation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: '#10b981' }} />
              <span className="text-xs font-semibold" style={{ color: '#10b981', fontSize: '11px' }}>Online</span>
            </div>
            <button className="btn-ghost text-xs py-1.5">
              <RefreshCw size={11} />
              New Chat
            </button>
          </div>
        </div>

        {/* Prompt suggestions */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {PROMPTS.map(p => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.prompt)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0 transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(232,236,244,0.6)',
                fontSize: '12px',
                fontWeight: 500,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(212,168,83,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,168,83,0.15)';
                (e.currentTarget as HTMLElement).style.color = '#d4a853';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(232,236,244,0.6)';
              }}
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
              style={{
                background: msg.role === 'assistant'
                  ? 'linear-gradient(135deg, #d4a853, #c49440)'
                  : 'rgba(255,255,255,0.08)',
                border: msg.role === 'assistant' ? 'none' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {msg.role === 'assistant'
                ? <Bot size={14} color="#060810" strokeWidth={2.5} />
                : <span style={{ color: '#e8ecf4', fontSize: '12px', fontWeight: 700 }}>V</span>
              }
            </div>

            {/* Bubble */}
            <div
              className="max-w-2xl rounded-2xl px-5 py-4 text-sm leading-relaxed"
              style={{
                background: msg.role === 'assistant'
                  ? 'rgba(15, 22, 40, 0.85)'
                  : 'linear-gradient(135deg, rgba(12,123,147,0.2), rgba(43,181,212,0.1))',
                border: msg.role === 'assistant'
                  ? '1px solid rgba(255,255,255,0.06)'
                  : '1px solid rgba(12,123,147,0.25)',
                color: 'rgba(232,236,244,0.75)',
                fontSize: '13px',
                lineHeight: '1.7',
                borderRadius: msg.role === 'assistant' ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
              }}
            >
              {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #d4a853, #c49440)' }}
            >
              <Bot size={14} color="#060810" strokeWidth={2.5} />
            </div>
            <div
              className="px-5 py-4 rounded-2xl flex items-center gap-2"
              style={{ background: 'rgba(15,22,40,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px 18px 18px 18px' }}
            >
              <div className="flex items-center gap-1.5">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
              <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', marginLeft: 6 }}>Analyzing via ISCF framework…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,8,16,0.9)' }}>
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask anything about Indian stocks, sectors, or investment thesis…"
              className="premium-input resize-none pr-12"
              rows={2}
              style={{ fontSize: '13.5px', lineHeight: '1.6', paddingRight: '44px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="absolute right-3 bottom-3 p-2 rounded-lg transition-all duration-200"
              style={{
                background: input.trim() ? 'linear-gradient(135deg, #d4a853, #c49440)' : 'rgba(255,255,255,0.04)',
                border: input.trim() ? 'none' : '1px solid rgba(255,255,255,0.06)',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={13} color={input.trim() ? '#060810' : 'rgba(232,236,244,0.2)'} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Zap size={10} style={{ color: '#d4a853' }} />
              <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>ISCF Framework</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 size={10} style={{ color: '#0c7b93' }} />
              <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>Financial Analysis</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Target size={10} style={{ color: '#10b981' }} />
              <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>Thesis Generation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText size={10} style={{ color: '#8b5cf6' }} />
              <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>Annual Reports</span>
            </div>
          </div>
          <div className="ml-auto">
            <span className="text-xs" style={{ color: 'rgba(232,236,244,0.2)', fontSize: '10px' }}>
              Press Enter to send · Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
