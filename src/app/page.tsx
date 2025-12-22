"use client";

import { useState } from "react";
import { Calculator, TrendingDown, BarChart3, Building, Home as HomeIcon, Landmark, ChevronDown, Plane, Server, Zap } from "lucide-react";

// =============================================================================
// DATA
// =============================================================================

// ABF Market Data - restructured for horizontal tree
// Source: Industry estimates (KKR, Guggenheim, SIFMA) - figures rounded for illustration
const MARKET_SEGMENTS = {
  govRealEstate: {
    name: "Government Real-Estate Finance",
    value: 12.5, // Sum of children: 6.5 + 4.5 + 0.8 + 0.7 = 12.5T
    icon: Landmark,
    children: [
      { name: "Agency MBS/RMBS", value: 6.5 },
      { name: "Agency CMBS", value: 4.5 },
      { name: "Non-Agency CMBS", value: 0.8 },
      { name: "Non-Agency RMBS", value: 0.7 },
    ],
  },
  privateRealEstate: {
    name: "Private Real-Estate Finance",
    value: 6.5,
    icon: Building,
    children: [], // Private credit, bridge loans, mezzanine
  },
  consumerCommercial: {
    name: "Consumer & Commercial Specialty",
    value: 6.3,
    icon: BarChart3,
    children: [
      { name: "Private ABS + Loans", value: 4.7 },
      { name: "Tradeable ABS", value: 1.6 },
    ],
  },
};

// Total calculated from segments for consistency
const MARKET_TOTAL = MARKET_SEGMENTS.govRealEstate.value +
                     MARKET_SEGMENTS.privateRealEstate.value +
                     MARKET_SEGMENTS.consumerCommercial.value; // = 25.3T

// Tradeable ABS Sector Breakdown (Ex-RMBS/CMBS)
// Aligned with $1.6T total in Consumer & Commercial Specialty → Tradeable ABS
// Source: SIFMA ABS outstanding data, 2024 estimates
const ABS_SECTORS = [
  { sector: "Prime Auto", balance: 380, issuance: 85 },
  { sector: "Credit Card", balance: 320, issuance: 68 },
  { sector: "Subprime Auto", balance: 215, issuance: 52 },
  { sector: "Student Loan", balance: 185, issuance: 25 },
  { sector: "Equipment", balance: 145, issuance: 38 },
  { sector: "Consumer Unsecured", balance: 120, issuance: 40 },
  { sector: "Digital Infrastructure", balance: 120, issuance: 32 },
  { sector: "Solar/Renewables", balance: 40, issuance: 15 },
  { sector: "Aviation/Transport", balance: 35, issuance: 12 },
  { sector: "Other Esoteric", balance: 40, issuance: 11 },
];
// Total: 380+320+215+185+145+120+120+40+35+40 = 1,600B = $1.6T

const totalOutstanding = ABS_SECTORS.reduce((sum, s) => sum + s.balance, 0);
const totalIssuance = ABS_SECTORS.reduce((sum, s) => sum + s.issuance, 0);

// =============================================================================
// COMPONENTS
// =============================================================================

function MarketHierarchy() {
  // Calculate percentages for the donut chart
  const segments = [
    { name: 'Gov RE', value: MARKET_SEGMENTS.govRealEstate.value, color: '#1E3A5F' },
    { name: 'Private RE', value: MARKET_SEGMENTS.privateRealEstate.value, color: '#2E5A8F' },
    { name: 'Consumer', value: MARKET_SEGMENTS.consumerCommercial.value, color: '#C9B896' },
  ];

  // SVG donut chart calculations
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-8 mb-6">
      <h2 className="text-lg font-semibold text-slate-700 mb-6">Asset-Backed Finance Market Universe</h2>

      {/* Top section: Donut chart + headline */}
      <div className="flex items-center justify-center gap-12 mb-8">
        {/* Donut Chart */}
        <div className="relative">
          <svg width="180" height="180" viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }}>
            {segments.map((segment, i) => {
              const percent = segment.value / total;
              const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
              cumulativePercent += percent;
              const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
              const largeArcFlag = percent > 0.5 ? 1 : 0;
              const pathData = [
                `M ${startX} ${startY}`,
                `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                `L 0 0`,
              ].join(' ');
              return <path key={i} d={pathData} fill={segment.color} />;
            })}
            {/* Inner circle for donut effect */}
            <circle cx="0" cy="0" r="0.6" fill="white" />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-[#1E3A5F]">${MARKET_TOTAL}T</p>
            <p className="text-xs text-slate-500">Total Market</p>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-3">
          {segments.map((segment) => (
            <div key={segment.name} className="flex items-center gap-3">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: segment.color }} />
              <div>
                <p className="text-sm font-medium text-slate-700">{segment.name}</p>
                <p className="text-lg font-bold text-[#1E3A5F]">${segment.value}T</p>
              </div>
              <p className="text-sm text-slate-500 ml-2">({Math.round((segment.value / total) * 100)}%)</p>
            </div>
          ))}
        </div>
      </div>

      {/* Horizontal tree structure - larger */}
      <div className="flex items-start gap-6">
        {/* Left column - Gov RE & Private RE */}
        <div className="flex-1 space-y-4">
          {/* Government Real Estate */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-[#1E3A5F] text-white px-4 py-3 rounded-lg min-w-[220px] shadow-sm">
              <Landmark className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium leading-tight">Government Real-Estate Finance</p>
                <p className="text-lg font-bold">${MARKET_SEGMENTS.govRealEstate.value}T</p>
              </div>
            </div>
            {/* Connector line */}
            <div className="w-10 h-px bg-slate-300" />
            {/* Children */}
            <div className="flex-1 space-y-2">
              {MARKET_SEGMENTS.govRealEstate.children.map((child) => (
                <div key={child.name} className="flex items-center gap-3 bg-[#C9B896] text-slate-800 px-4 py-2 rounded-lg text-sm shadow-sm">
                  <HomeIcon className="h-4 w-4" />
                  <span className="font-medium">{child.name}</span>
                  <span className="font-bold ml-auto">${child.value >= 1 ? child.value + 'T' : (child.value * 1000).toFixed(0) + 'B'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Private Real Estate */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-[#2E5A8F] text-white px-4 py-3 rounded-lg min-w-[220px] shadow-sm">
              <Building className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium leading-tight">Private Real-Estate Finance</p>
                <p className="text-lg font-bold">${MARKET_SEGMENTS.privateRealEstate.value}T</p>
              </div>
            </div>
            {/* Connector line for visual balance */}
            <div className="w-10 h-px bg-slate-300" />
            <div className="flex-1 flex items-center">
              <p className="text-sm text-slate-500 italic">Private credit, bridge loans, mezzanine</p>
            </div>
          </div>
        </div>

        {/* Right column - Consumer & Commercial */}
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-[#1E3A5F] text-white px-4 py-3 rounded-lg min-w-[240px] shadow-sm">
              <BarChart3 className="h-5 w-5" />
              <div>
                <p className="text-sm font-medium leading-tight">Consumer & Commercial Specialty</p>
                <p className="text-lg font-bold">${MARKET_SEGMENTS.consumerCommercial.value}T</p>
              </div>
            </div>
            {/* Connector line */}
            <div className="w-10 h-px bg-slate-300" />
            {/* Children */}
            <div className="flex-1 space-y-2">
              {MARKET_SEGMENTS.consumerCommercial.children.map((child) => (
                <div
                  key={child.name}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm shadow-sm bg-[#C9B896] text-slate-800"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="font-medium">{child.name}</span>
                  <span className="font-bold ml-auto">${child.value}T</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-6 text-center">Source: SIFMA, KKR, Guggenheim | Figures rounded for illustration</p>
    </div>
  );
}

function PublicVsPrivateChart() {
  // 2025 issuance estimates based on market data:
  // - Auto ABS: KBRA forecasts ~$170B public (up from $160B in 2024)
  // - CLO: LCD data shows ~$200B+ new issuance, plus ~$45B middle-market/private credit CLOs
  // - Consumer: ~$70B public ABS, growing private credit share
  // - Equipment: ~$23B public (SIFMA), private warehouse financing ~2-3x public
  // - Real Estate: Private credit dominates (CMBS public ~$40B, private RE debt much larger)
  // - Specialty: Data centers, whole business, esoteric - mix of 144A and private
  // Sources: SIFMA, KBRA, LCD/PitchBook, Morgan Stanley Private Credit Outlook
  const data = [
    { category: 'Auto ABS', public: 170, private: 55 },
    { category: 'Consumer', public: 70, private: 45 },
    { category: 'Equipment', public: 23, private: 50 },
    { category: 'CLO/Loans', public: 200, private: 85 },
    { category: 'Real Estate', public: 40, private: 120 },
    { category: 'Specialty', public: 25, private: 40 },
  ];

  const totalPublic = data.reduce((sum, d) => sum + d.public, 0);
  const totalPrivate = data.reduce((sum, d) => sum + d.private, 0);
  const maxValue = Math.max(...data.map(d => Math.max(d.public, d.private)));

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-700">ABF Issuance: Public vs Private</h2>
          <p className="text-xs text-slate-500">2025 full-year estimates ($B)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-[#1E3A5F]">${totalPublic}B</p>
            <p className="text-xs text-slate-500">Public</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#6B9B9C]">${totalPrivate}B</p>
            <p className="text-xs text-slate-500">Private</p>
          </div>
        </div>
      </div>

      {/* Side by side bar chart - more compact */}
      <div className="space-y-2.5">
        {data.map((item) => (
          <div key={item.category} className="flex items-center gap-3">
            <div className="w-20 text-xs font-medium text-slate-700 text-right">{item.category}</div>
            <div className="flex-1 flex items-center gap-1">
              {/* Public bar */}
              <div className="flex-1 flex justify-end">
                <div className="flex items-center gap-1 w-full justify-end">
                  <span className="text-xs font-semibold text-[#1E3A5F] w-6 text-right">{item.public}</span>
                  <div className="h-5 bg-[#1E3A5F] rounded-l" style={{ width: `${(item.public / maxValue) * 100}%` }} />
                </div>
              </div>
              {/* Divider */}
              <div className="w-px h-6 bg-slate-300" />
              {/* Private bar */}
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <div className="h-5 bg-[#6B9B9C] rounded-r" style={{ width: `${(item.private / maxValue) * 100}%` }} />
                  <span className="text-xs font-semibold text-[#6B9B9C] w-6">{item.private}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#1E3A5F] rounded" />
          <span className="text-xs text-slate-600">Public (Tradeable)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-[#6B9B9C] rounded" />
          <span className="text-xs text-slate-600">Private (Bilateral)</span>
        </div>
      </div>
    </div>
  );
}

function ABSSectorChart() {
  const [viewMode, setViewMode] = useState<'outstanding' | 'issuance'>('outstanding');

  const data = viewMode === 'outstanding'
    ? ABS_SECTORS.map(s => ({ ...s, value: s.balance }))
    : ABS_SECTORS.map(s => ({ ...s, value: s.issuance }));

  const total = viewMode === 'outstanding' ? totalOutstanding : totalIssuance;
  // Dynamic max based on actual data to prevent bar overflow
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 h-full">
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-700">Tradeable ABS by Sector</h2>
          <p className="text-xs text-slate-500">Ex-RMBS/CMBS | Public market breakdown</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-full p-0.5">
            <button
              onClick={() => setViewMode('outstanding')}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                viewMode === 'outstanding'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Outstanding
            </button>
            <button
              onClick={() => setViewMode('issuance')}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                viewMode === 'issuance'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Issuance
            </button>
          </div>

          {/* Total */}
          <div className="text-right">
            <p className="text-lg font-bold text-[#1E3A5F]">${total}B</p>
            <p className="text-xs text-slate-500">Total</p>
          </div>
        </div>
      </div>

      {/* Single column for compact view */}
      <div className="space-y-2">
        {data.map((sector) => {
          const pct = Math.round((sector.value / total) * 100);
          return (
            <div key={sector.sector} className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-700 w-28 truncate">{sector.sector}</span>
              <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden">
                <div
                  className="bg-[#C9B896] h-4 rounded transition-all duration-500"
                  style={{ width: `${(sector.value / maxValue) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-[#1E3A5F] w-10 text-right">
                ${sector.value}B
              </span>
              <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PortalModules() {
  const modules = [
    {
      icon: Calculator,
      title: "Deal Modeler",
      features: ["Run waterfall cash flow scenarios", "Analyze tranche IRR, MOIC, and WAL", "Stress test with OC/CNL triggers"],
    },
    {
      icon: BarChart3,
      title: "Market Tracker",
      features: ["Track ABS/CLO sector spreads", "View relative value indicators", "Curated ABF news feed"],
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-700 mb-4">Portal Modules</h2>
      <div className="space-y-4">
        {modules.map((mod) => (
          <div key={mod.title} className="flex items-start gap-3">
            <mod.icon className="h-5 w-5 text-[#1E3A5F] mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-slate-800">{mod.title}</p>
              <ul className="text-sm text-slate-500 mt-1">
                {mod.features.map((f, i) => (
                  <li key={i}>&bull; {f}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfrastructureVisual() {
  // Tradeable ABS outstanding in each sector (aligned with ABS_SECTORS)
  const assets = [
    { icon: Plane, label: 'Aviation', value: '$35B', desc: 'Aircraft ABS' },
    { icon: Server, label: 'Data Centers', value: '$120B', desc: 'Digital infra ABS' },
    { icon: Zap, label: 'Renewables', value: '$40B', desc: 'Solar & clean energy' },
  ];

  return (
    <div className="rounded-lg p-6 text-white relative overflow-hidden">
      {/* Airplane background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80')`,
        }}
      />
      {/* Dark gradient overlay for readability - lightened to show airplane */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F]/60 via-[#2E5A8F]/50 to-[#1E3A5F]/60" />

      <div className="relative z-10">
        <h3 className="text-base font-semibold text-white uppercase tracking-wide mb-4 text-center">
          Transportation & Infrastructure ABS
        </h3>

        <div className="grid grid-cols-3 gap-4">
          {assets.map((asset) => {
            const Icon = asset.icon;
            return (
              <div key={asset.label} className="text-center">
                <div className="w-14 h-14 mx-auto mb-2 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <p className="text-xl font-bold">{asset.value}</p>
                <p className="text-sm text-white/80">{asset.label}</p>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-white/70 mt-4 text-center">
          Hard asset collateral with strong recovery profiles
        </p>
      </div>
    </div>
  );
}

function KeyConcepts() {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const concepts = [
    { id: 'oc', title: 'OC Test', content: 'Formula: Collateral Value / Outstanding Notes. Ensures enough collateral to cover debt. Typical thresholds: 122% for CLO AAA, 105-110% for ABS.' },
    { id: 'ic', title: 'IC Test', content: 'Formula: Interest Income / Interest Expense. Ensures income covers interest payments. Typical threshold: 120%.' },
    { id: 'cnl', title: 'CNL Trigger', content: 'Cumulative Net Loss trigger. When CNL exceeds threshold (e.g., 8-12%), deal switches to sequential pay to protect seniors.' },
    { id: 'seq', title: 'Sequential vs Pro-Rata', content: 'Sequential pays seniors first. Pro-rata pays proportionally. Deals switch from pro-rata to sequential when triggers breach.' },
    { id: 'ard', title: 'ARD', content: 'Anticipated Repayment Date: Timing-based trigger. If deal extends past ARD, excess cash flow diverts to accelerate senior amortization.' },
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-700 mb-4">Key Concepts</h2>
      <div className="space-y-1">
        {concepts.map((concept) => (
          <div key={concept.id} className="border-b border-slate-100 last:border-0">
            <button
              onClick={() => setOpenItem(openItem === concept.id ? null : concept.id)}
              className="w-full flex items-center justify-between py-2.5 text-left hover:bg-slate-50 rounded px-2 -mx-2"
            >
              <span className="font-medium text-slate-700">{concept.title}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openItem === concept.id ? 'rotate-180' : ''}`} />
            </button>
            {openItem === concept.id && (
              <p className="text-sm text-slate-600 pb-3 px-2">{concept.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function Home() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">ABF/Structured Credit Analytics Portal</h1>
        <p className="text-sm text-slate-600">Interactive tools for analyzing Asset-Based Finance and Structured Credit products</p>
      </div>

      {/* Market Hierarchy - Full Width */}
      <MarketHierarchy />

      {/* Two charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Public vs Private Issuance Comparison */}
        <PublicVsPrivateChart />
        {/* ABS Sector Chart */}
        <ABSSectorChart />
      </div>

      {/* Bottom row - Three columns: Modules, Infrastructure Visual, Key Concepts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <PortalModules />
        <InfrastructureVisual />
        <KeyConcepts />
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>ABF Analytics Portal</span>
          <span className="font-medium text-[#1E3A5F]">Bain Capital Credit | For Consideration by Brett Wilzbach</span>
        </div>
      </div>
    </div>
  );
}
