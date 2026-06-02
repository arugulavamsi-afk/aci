'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Search, Building2, Star, Bot,
  TrendingUp, Shield, Zap, ChevronRight, Database, Landmark, FileText,
} from 'lucide-react';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Command Center' },
  { href: '/discovery', icon: Search, label: 'Stock Discovery' },
  { href: '/company/bel', icon: Building2, label: 'Company Research' },
  { href: '/watchlist', icon: Star, label: 'My Watchlist' },
  { href: '/copilot', icon: Bot, label: 'AI Copilot' },
];

const quickLinks = [
  { href: '/company/bel', label: 'BEL', score: 91 },
  { href: '/company/pfc', label: 'PFC', score: 87 },
  { href: '/company/cochin-ship', label: 'COCHINSHIP', score: 88 },
  { href: '/company/va-tech', label: 'WABAG', score: 84 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-60 flex flex-col flex-shrink-0 h-full"
      style={{
        background: 'rgba(6,8,16,0.98)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #d4a853, #c49440)' }}
          >
            <TrendingUp size={16} color="#060810" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: '#d4a853', letterSpacing: '0.12em' }}>
              Aishwaryamasthu
            </div>
            <div className="text-xs" style={{ color: 'rgba(232,236,244,0.35)', fontSize: '10px' }}>
              Compounder Intelligence
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(232,236,244,0.25)', fontSize: '10px' }}>
            Platform
          </p>
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`nav-item mb-1 ${active ? 'active' : ''}`}>
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
                {active && <ChevronRight size={12} className="ml-auto" style={{ color: '#d4a853' }} />}
              </Link>
            );
          })}
        </div>

        {/* Admin */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(232,236,244,0.25)', fontSize: '10px' }}>
            Admin
          </p>
          {[
            { href: '/admin/stocks',           icon: Database,  label: 'Stock Database' },
            { href: '/admin/gov-intelligence', icon: Landmark,  label: 'Gov Intelligence' },
            { href: '/admin/tailwind',         icon: FileText,  label: 'Tailwind Config' },
          ].map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav-item mb-1 ${active ? 'active' : ''}`}>
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
                {active && <ChevronRight size={12} className="ml-auto" style={{ color: '#d4a853' }} />}
              </Link>
            );
          })}
        </div>

        {/* Quick Access */}
        <div className="mb-4">
          <p className="px-3 mb-2 text-xs font-semibold tracking-widest uppercase" style={{ color: 'rgba(232,236,244,0.25)', fontSize: '10px' }}>
            High Conviction
          </p>
          {quickLinks.map(({ href, label, score }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-3 py-2 rounded-lg mb-1 group transition-all duration-200"
              style={{ color: 'rgba(232,236,244,0.45)', fontSize: '12.5px' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(232,236,244,0.8)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'rgba(232,236,244,0.45)';
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: score >= 90 ? '#d4a853' : '#10b981' }} />
                {label}
              </div>
              <span className="text-xs font-bold" style={{ color: score >= 90 ? '#d4a853' : '#10b981' }}>
                {score}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom panel */}
      <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div
          className="rounded-xl p-3"
          style={{ background: 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(12,123,147,0.06))', border: '1px solid rgba(212,168,83,0.12)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield size={12} style={{ color: '#d4a853' }} />
            <span className="text-xs font-semibold" style={{ color: '#d4a853' }}>ISCF Framework v2.1</span>
          </div>
          <p className="text-xs" style={{ color: 'rgba(232,236,244,0.4)', lineHeight: '1.5' }}>
            India Structural Compounder Framework — 7-factor scoring model
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'rgba(212,168,83,0.15)', color: '#d4a853' }}>
            V
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'rgba(232,236,244,0.7)' }}>Vamshi</p>
            <p className="text-xs" style={{ color: 'rgba(232,236,244,0.3)', fontSize: '10px' }}>Professional Investor</p>
          </div>
          <Zap size={12} className="ml-auto" style={{ color: '#d4a853' }} />
        </div>
      </div>
    </aside>
  );
}
