"use client";

import { useState } from "react";

// ABF Market Data (based on industry research)
// Colors matched to reference image aesthetic - muted earth tones and teal
const ABF_MARKET_DATA = {
  total: 25.3,
  segments: [
    {
      name: "Government Real-Estate Finance",
      value: 10.1,
      bgColor: "bg-[#8B7355]",
      childBg: "bg-[#D4C4B0]",
      children: [
        { name: "Agency RMBS", value: 9.0 },
        { name: "Agency CMBS", value: 1.1 },
      ],
    },
    {
      name: "Private Real-Estate Finance",
      value: 9.2,
      bgColor: "bg-[#C9B896]",
      childBg: "bg-[#E8DFD0]",
      children: [
        { name: "Residential Loans", value: 3.0 },
        { name: "CRE Loans", value: 4.8 },
        { name: "Non-Agency CMBS", value: 0.72 },
        { name: "Non-Agency RMBS", value: 0.71 },
      ],
    },
    {
      name: "Consumer & Commercial Specialty",
      value: 6.1,
      bgColor: "bg-[#6B9B9C]",
      childBg: "bg-[#B8D4D5]",
      children: [
        { name: "Private ABS + Loans", value: 4.5 },
        { name: "Tradeable ABS", value: 1.6, highlight: true },
      ],
    },
  ],
};

// Tradeable ABS Sector Breakdown with 2025 YTD issuance data
const ABS_SECTORS = [
  { sector: "Prime Auto", balance: 214, issuance2025: 45, color: "bg-[#1E3A5F]" },
  { sector: "Credit Card", balance: 126, issuance2025: 28, color: "bg-[#2E5A8F]" },
  { sector: "Subprime Auto", balance: 100, issuance2025: 22, color: "bg-[#4A7AB0]" },
  { sector: "Digital Infrastructure", balance: 70, issuance2025: 12, color: "bg-[#6B8BB8]" },
  { sector: "Student Loan (Non-FFELP)", balance: 68, issuance2025: 8, color: "bg-[#8BA4C7]" },
  { sector: "Consumer Unsecured", balance: 61, issuance2025: 15, color: "bg-[#A8BDD4]" },
  { sector: "Solar", balance: 30, issuance2025: 6, color: "bg-[#C4D4E2]" },
  { sector: "Home Improvement", balance: 10, issuance2025: 3, color: "bg-[#D9E4EF]" },
];

const totalABSSectors = ABS_SECTORS.reduce((sum, s) => sum + s.balance, 0);
const totalIssuance2025 = ABS_SECTORS.reduce((sum, s) => sum + s.issuance2025, 0);

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg mb-2">
      <button className="w-full px-4 py-3 text-left font-medium flex justify-between items-center hover:bg-gray-50" onClick={() => setIsOpen(!isOpen)}>
        {title}
        <span className="text-gray-400">{isOpen ? "-" : "+"}</span>
      </button>
      {isOpen && <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-700">{children}</div>}
    </div>
  );
}

function ModuleCard({ title, description, features }: { title: string; description: string; features: string[] }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all border border-slate-100 hover:border-slate-200">
      <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">{title}</h3>
      <p className="text-sm text-slate-600 font-medium mb-3">{description}</p>
      <ul className="text-sm text-slate-500 space-y-1.5">
        {features.map((f, i) => <li key={i} className="flex items-start gap-2"><span className="text-[#1E3A5F] mt-0.5">-</span>{f}</li>)}
      </ul>
    </div>
  );
}

type ViewMode = 'balance' | 'issuance';

function ABSSectorChart() {
  const [viewMode, setViewMode] = useState<ViewMode>('balance');

  const maxBalance = 220;
  const maxIssuance = 50;
  const currentMax = viewMode === 'balance' ? maxBalance : maxIssuance;
  const total = viewMode === 'balance' ? totalABSSectors : totalIssuance2025;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1E3A5F]">Tradeable ABS by Sector</h2>
          <p className="text-sm text-slate-500">
            {viewMode === 'balance' ? 'Current outstanding balance' : '2025 YTD issuance'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('balance')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'balance'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Outstanding
            </button>
            <button
              onClick={() => setViewMode('issuance')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'issuance'
                  ? 'bg-white text-[#6B9B9C] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              2025 Issuance
            </button>
          </div>
          <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${
            viewMode === 'balance'
              ? 'bg-[#1E3A5F]/10 text-[#1E3A5F]'
              : 'bg-[#6B9B9C]/10 text-[#6B9B9C]'
          }`}>
            ${total}B Total
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {ABS_SECTORS.map((sector, idx) => {
          const value = viewMode === 'balance' ? sector.balance : sector.issuance2025;
          const barColor = viewMode === 'balance' ? sector.color : 'bg-[#6B9B9C]';

          return (
            <div key={sector.sector} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-700">{sector.sector}</span>
                <span className={`text-sm font-bold ${viewMode === 'balance' ? 'text-[#1E3A5F]' : 'text-[#6B9B9C]'}`}>
                  ${value}B
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-md h-6 overflow-hidden">
                <div
                  className={`${barColor} h-6 rounded-md transition-all duration-500 ease-out group-hover:opacity-80`}
                  style={{
                    width: `${(value / currentMax) * 100}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#1E3A5F] mb-2">ABF/Structured Credit Analytics Portal</h1>
        <p className="text-gray-600">Interactive tools for analyzing Asset-Based Finance and Structured Credit products</p>
      </div>

      {/* ABF Market Universe - Hero Visual */}
      <div className="bg-gradient-to-b from-slate-50 to-white rounded-xl shadow-lg p-8 mb-8 border border-slate-100">
        <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6 text-center">Asset-Backed Finance Market Universe</h2>

        {/* Top Level - Root Node */}
        <div className="flex justify-center mb-2">
          <div className="bg-[#4A4A4A] text-white rounded-xl px-10 py-5 text-center shadow-lg border-2 border-[#3A3A3A]">
            <p className="text-sm font-semibold tracking-wide">Asset Backed Finance Market</p>
            <p className="text-3xl font-bold mt-1">${ABF_MARKET_DATA.total} trillion</p>
          </div>
        </div>

        {/* Connector Lines - SVG for cleaner rendering */}
        <div className="flex justify-center">
          <svg width="700" height="40" className="overflow-visible">
            {/* Vertical line from root */}
            <line x1="350" y1="0" x2="350" y2="15" stroke="#9CA3AF" strokeWidth="2" />
            {/* Horizontal connector */}
            <line x1="115" y1="15" x2="585" y2="15" stroke="#9CA3AF" strokeWidth="2" />
            {/* Three vertical drops */}
            <line x1="115" y1="15" x2="115" y2="40" stroke="#9CA3AF" strokeWidth="2" />
            <line x1="350" y1="15" x2="350" y2="40" stroke="#9CA3AF" strokeWidth="2" />
            <line x1="585" y1="15" x2="585" y2="40" stroke="#9CA3AF" strokeWidth="2" />
          </svg>
        </div>

        {/* Second Level - 3 Segments */}
        <div className="grid grid-cols-3 gap-6 mb-3">
          {ABF_MARKET_DATA.segments.map((segment, idx) => (
            <div key={segment.name} className="flex flex-col items-center">
              <div className={`${segment.bgColor} ${idx === 1 ? 'text-[#4A4A4A]' : 'text-white'} rounded-xl px-4 py-4 text-center w-full shadow-md transition-transform hover:scale-[1.02]`}>
                <p className="text-xs font-semibold leading-tight tracking-wide">{segment.name}</p>
                <p className="text-xl font-bold mt-1">${segment.value} trillion</p>
              </div>
            </div>
          ))}
        </div>

        {/* Connector dots */}
        <div className="grid grid-cols-3 gap-6 mb-2">
          {ABF_MARKET_DATA.segments.map((segment) => (
            <div key={segment.name} className="flex justify-center">
              <div className="w-0.5 h-4 bg-slate-300 rounded-full"></div>
            </div>
          ))}
        </div>

        {/* Third Level - Children */}
        <div className="grid grid-cols-3 gap-6">
          {ABF_MARKET_DATA.segments.map((segment) => (
            <div key={segment.name}>
              {/* Children boxes */}
              <div className="grid grid-cols-2 gap-2">
                {segment.children.map((child) => (
                  <div
                    key={child.name}
                    className={`rounded-lg px-3 py-3 text-center transition-all ${
                      child.highlight
                        ? "bg-[#1E3A5F] text-white shadow-lg ring-2 ring-[#1E3A5F]/30 ring-offset-2"
                        : `${segment.childBg} text-slate-700 shadow-sm hover:shadow-md`
                    }`}
                  >
                    <p className="text-xs font-semibold leading-tight">{child.name}</p>
                    <p className="text-sm font-bold mt-1">{child.value >= 1 ? `$${child.value}T` : `$${(child.value * 1000).toFixed(0)}B`}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Source */}
        <p className="text-xs text-slate-400 mt-6 text-center font-medium">Source: Industry estimates, KKR, Guggenheim</p>
      </div>

      {/* Tradeable ABS Sector Breakdown - Full Width with Toggle */}
      <ABSSectorChart />

      {/* Portal Modules */}
      <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">Portal Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <ModuleCard
          title="Deal Modeler"
          description="Compare, stress test & model waterfalls"
          features={["Side-by-side structure comparison", "Scenario stress testing", "Full waterfall modeling", "ARD trigger support", "MOIC, WAL, CNL tracking"]}
        />
        <ModuleCard
          title="Spread Monitor"
          description="Track relative value"
          features={["Private vs public credit yields", "Corporate benchmarks", "ABS/CLO spreads by rating", "Historical trends"]}
        />
        <ModuleCard
          title="Market Tracker"
          description="Monitor new issuance"
          features={["Deal database", "Filter by collateral", "Issuance analytics", "Export to CSV"]}
        />
      </div>

      {/* Key Concepts */}
      <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">Key Concepts</h2>
      <div className="max-w-3xl mb-8">
        <Accordion title="OC Test (Overcollateralization)"><p>Formula: Collateral Value / Outstanding Notes. Ensures enough collateral to cover debt. Typical thresholds: 122% for CLO AAA, 105-110% for ABS.</p></Accordion>
        <Accordion title="IC Test (Interest Coverage)"><p>Formula: Interest Income / Interest Expense. Ensures income covers interest payments. Typical threshold: 120%.</p></Accordion>
        <Accordion title="CNL Trigger"><p>Cumulative Net Loss trigger. When CNL exceeds threshold (e.g., 8-12%), deal switches to sequential pay to protect seniors.</p></Accordion>
        <Accordion title="Sequential vs Pro-Rata"><p>Sequential pays seniors first. Pro-rata pays proportionally. Deals switch from pro-rata to sequential when triggers breach.</p></Accordion>
        <Accordion title="ARD (Anticipated Repayment Date)"><p>Timing-based trigger. If deal extends past ARD, excess cash flow diverts to accelerate senior amortization.</p></Accordion>
      </div>

      {/* Footer */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>ABF Analytics Portal</span>
          <span className="font-medium text-[#1E3A5F]">Bain Capital Credit | For Consideration by Brett Wilzbach</span>
        </div>
      </div>
    </div>
  );
}
