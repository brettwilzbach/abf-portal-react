"use client";

import { useState, useEffect } from "react";

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

function MetricCard({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-[#1E3A5F]">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#1E3A5F]">{value}</p>
      {help && <p className="text-xs text-gray-400 mt-1">{help}</p>}
    </div>
  );
}

function ModuleCard({ emoji, title, description, features }: { emoji: string; title: string; description: string; features: string[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">{title}</h3>
      <p className="text-sm text-gray-600 font-medium mb-3">{description}</p>
      <ul className="text-sm text-gray-500 space-y-1">
        {features.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}

export default function Home() {
  const [sofr, setSofr] = useState("4.33%");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchSofr() {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:8000/api/market/sofr");
        if (res.ok) {
          const data = await res.json();
          setSofr(data.rate.toFixed(2) + "%");
        }
      } catch {}
      setLoading(false);
    }
    fetchSofr();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1E3A5F] mb-2">ABF/Structured Credit Analytics Portal</h1>
        <p className="text-gray-600">Interactive tools for analyzing Asset-Based Finance and Structured Credit products</p>
      </div>
      <hr className="mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total ABF Market" value="$20T+" help="Total addressable ABF market" />
        <MetricCard label="Private ABF" value="~$6T" help="Private ABF market size" />
        <MetricCard label="2024 Private ABS" value="$130B" help="Private ABS issuance in 2024" />
        <MetricCard label="SOFR" value={loading ? "..." : sofr} help="Current SOFR rate" />
      </div>
      <hr className="mb-8" />
      <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">Portal Modules</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <ModuleCard emoji="" title="Deal Analyzer" description="Educational ABS Explorer" features={["Interactive scenario sliders", "CPR/CDR/severity impact", "OC trigger visualization", "MOIC, WAL dashboard"]} />
        <ModuleCard emoji="" title="Waterfall Modeler" description="Advanced deal modeling" features={["Pre-built templates", "Custom deal input", "OC, IC, CNL triggers", "Break-even CDR"]} />
        <ModuleCard emoji="" title="Spread Monitor" description="Track relative value" features={["Bloomberg/FRED data", "Corporate benchmarks", "ABS/CLO spreads", "Historical trends"]} />
        <ModuleCard emoji="" title="Market Tracker" description="Monitor new issuance" features={["Deal database", "Filter by collateral", "Issuance analytics", "Export to CSV"]} />
      </div>
      <hr className="mb-8" />
      <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">Key Concepts</h2>
      <div className="max-w-3xl">
        <Accordion title="OC Test (Overcollateralization)"><p>Formula: Collateral Value / Outstanding Notes. Ensures enough collateral to cover debt.</p></Accordion>
        <Accordion title="IC Test (Interest Coverage)"><p>Formula: Interest Income / Interest Expense. Ensures income covers interest payments.</p></Accordion>
        <Accordion title="CNL Trigger"><p>Cumulative Net Loss trigger. Caps losses before structural changes.</p></Accordion>
        <Accordion title="Sequential vs Pro-Rata"><p>Sequential pays seniors first. Pro-rata pays proportionally. Switches on trigger breach.</p></Accordion>
      </div>
      <div className="border-t pt-4 mt-8">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>ABF Analytics Portal</span>
          <span className="font-medium text-[#1E3A5F]">Bain Capital Credit | For Consideration by Brett Wilzbach</span>
        </div>
      </div>
    </div>
  );
}
