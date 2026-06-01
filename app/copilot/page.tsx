'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Zap, BarChart3, Target, TrendingUp, FileText, RefreshCw } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: `Welcome to **Aishwaryamasthu AI Copilot** — your institutional-grade research partner powered by the ISCF framework.

I can help you:
• **Analyze companies** and generate investment theses
• **Compare stocks** across ISCF dimensions
• **Explain moats, risks**, and structural tailwinds
• **Generate Bull / Bear / Base case** scenarios
• **Identify compounders** aligned with India's growth themes

What would you like to research today?`,
};

const PROMPTS = [
  { icon: '🎯', label: 'Analyze BEL',     prompt: 'Give me a deep ISCF analysis of BEL (Bharat Electronics Limited)' },
  { icon: '⚖️', label: 'Compare Stocks',  prompt: 'Compare BEL vs Cochin Shipyard using the ISCF framework' },
  { icon: '💧', label: 'Water Theme',     prompt: 'Explain the water infrastructure investment theme and top picks' },
  { icon: '🛡️', label: 'Defense Thesis',  prompt: 'What is the investment thesis for India defense sector compounders?' },
  { icon: '📊', label: 'Top 5 Picks',     prompt: 'Give me the top 5 highest conviction ISCF stocks right now' },
  { icon: '⚡', label: 'Power Theme',     prompt: 'Analyze the power infrastructure structural tailwind and best plays' },
];

function formatMessage(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <div key={i} className="font-black mt-3 mb-1" style={{ color: '#e8ecf4', fontSize: '13px' }}>{line.slice(2, -2)}</div>;
    }
    if (line.startsWith('• ')) {
      return (
        <div key={i} className="flex items-start gap-2 my-1">
          <div className="w-1 h-1 rounded-full flex-shrink-0 mt-2" style={{ background: '#d4a853' }} />
          <span>{formatInline(line.slice(2))}</span>
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
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color: '#e8ecf4' }}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setStreamingContent(full);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: full }]);
      setStreamingContent('');
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Error:** Unable to reach the AI service. Please ensure \`ANTHROPIC_API_KEY\` is set in your Vercel environment variables.\n\n${String(err)}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setStreamingContent('');
  };

  const allMessages = streamingContent
    ? [...messages, { role: 'assistant' as const, content: streamingContent }]
    : messages;

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
              Powered by Claude · ISCF framework · Real-time analysis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981', animation: 'pulse 2s infinite' }} />
              <span className="text-xs font-semibold" style={{ color: '#10b981', fontSize: '11px' }}>Online</span>
            </div>
            <button onClick={clearChat} className="btn-ghost text-xs py-1.5">
              <RefreshCw size={11} /> New Chat
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {PROMPTS.map(p => (
            <button
              key={p.label}
              onClick={() => sendMessage(p.prompt)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0 transition-all duration-200 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(232,236,244,0.6)', fontSize: '12px', fontWeight: 500 }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(212,168,83,0.08)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,168,83,0.15)';
                  (e.currentTarget as HTMLElement).style.color = '#d4a853';
                }
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
        {allMessages.map((msg, i) => {
          const isStreaming = streamingContent && i === allMessages.length - 1 && msg.role === 'assistant';
          return (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1"
                style={{
                  background: msg.role === 'assistant' ? 'linear-gradient(135deg, #d4a853, #c49440)' : 'rgba(255,255,255,0.08)',
                  border: msg.role === 'assistant' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}>
                {msg.role === 'assistant'
                  ? <Bot size={14} color="#060810" strokeWidth={2.5} />
                  : <span style={{ color: '#e8ecf4', fontSize: '12px', fontWeight: 700 }}>V</span>}
              </div>
              <div
                className="max-w-2xl rounded-2xl px-5 py-4 text-sm leading-relaxed"
                style={{
                  background: msg.role === 'assistant' ? 'rgba(15,22,40,0.85)' : 'linear-gradient(135deg, rgba(12,123,147,0.2), rgba(43,181,212,0.1))',
                  border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(12,123,147,0.25)',
                  color: 'rgba(232,236,244,0.75)',
                  fontSize: '13px',
                  lineHeight: '1.7',
                  borderRadius: msg.role === 'assistant' ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                }}
              >
                {msg.role === 'assistant' ? formatMessage(msg.content) : msg.content}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse" style={{ background: '#d4a853' }} />
                )}
              </div>
            </div>
          );
        })}

        {loading && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #d4a853, #c49440)' }}>
              <Bot size={14} color="#060810" strokeWidth={2.5} />
            </div>
            <div className="px-5 py-4 rounded-2xl flex items-center gap-2"
              style={{ background: 'rgba(15,22,40,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px 18px 18px 18px' }}>
              <div className="flex items-center gap-1.5">
                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
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
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Ask anything about Indian stocks, sectors, or investment thesis…"
              className="premium-input resize-none pr-12"
              rows={2}
              style={{ fontSize: '13.5px', lineHeight: '1.6', paddingRight: '44px' }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="absolute right-3 bottom-3 p-2 rounded-lg transition-all duration-200"
              style={{
                background: input.trim() && !loading ? 'linear-gradient(135deg, #d4a853, #c49440)' : 'rgba(255,255,255,0.04)',
                border: input.trim() && !loading ? 'none' : '1px solid rgba(255,255,255,0.06)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              }}
            >
              <Send size={13} color={input.trim() && !loading ? '#060810' : 'rgba(232,236,244,0.2)'} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-3">
            {[
              { icon: <Zap size={10} style={{ color: '#d4a853' }} />,    label: 'ISCF Framework' },
              { icon: <BarChart3 size={10} style={{ color: '#0c7b93' }} />, label: 'Financial Analysis' },
              { icon: <Target size={10} style={{ color: '#10b981' }} />,  label: 'Thesis Generation' },
              { icon: <FileText size={10} style={{ color: '#8b5cf6' }} />, label: 'Annual Reports' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                {item.icon}
                <span className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TrendingUp size={10} style={{ color: 'rgba(232,236,244,0.2)' }} />
            <span className="text-xs" style={{ color: 'rgba(232,236,244,0.2)', fontSize: '10px' }}>
              Press Enter to send · Shift+Enter for new line
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
