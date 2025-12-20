'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calculator,
  TrendingDown,
  Newspaper,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Deal Mechanics', href: '/deal-modeler', icon: Calculator },
  { label: 'Spread Monitor', href: '/spreads', icon: TrendingDown },
  { label: 'Market Tracker', href: '/market', icon: Newspaper },
];

const resources = [
  { label: 'Bain Capital Credit', href: 'https://www.baincapitalcredit.com/news' },
  { label: 'Pitchbook Private Credit', href: 'https://pitchbook.com/tag/private-credit' },
  { label: 'LCD CLO News', href: 'https://www.lcdcomps.com/' },
  { label: 'Creditflux', href: 'https://www.creditflux.com/' },
  { label: 'KBRA ABS Research', href: 'https://www.kbra.com/sectors/abs' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'sticky top-0 flex flex-col h-screen bg-slate-900 text-white transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-80'
      )}
    >
      {/* Header - Extended vertically */}
      <div className="flex flex-col p-4 border-b border-slate-700 min-h-[80px]">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <Image
                src="/logo_bain.svg"
                alt="Bain Capital Credit"
                width={48}
                height={48}
                className="flex-shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white leading-tight">Bain Capital Credit</span>
                <span className="text-xs text-slate-400">Structured Credit Analytics</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <Image
              src="/logo_bain.svg"
              alt="Bain Capital Credit"
              width={32}
              height={32}
              className="mx-auto"
            />
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn("p-1 hover:bg-slate-800 rounded", isCollapsed && "absolute right-2 top-6")}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                    isActive
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Resources (only when not collapsed) */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-700">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Data Sources</h3>
          <ul className="space-y-2">
            {resources.map((resource) => (
              <li key={resource.label}>
                <a
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <span className="truncate">{resource.label}</span>
                  {resource.href !== '#' && <ExternalLink size={12} className="flex-shrink-0" />}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className={cn('p-4 border-t border-slate-700', isCollapsed && 'p-2')}>
        {!isCollapsed ? (
          <>
            <p className="text-xs text-slate-500">Built for Bain Capital Credit</p>
            <p className="text-xs text-slate-500">ABF/Structured Credit Initiatives</p>
          </>
        ) : (
          <div className="text-center text-slate-500 text-xs">BCC</div>
        )}
      </div>
    </aside>
  );
}
