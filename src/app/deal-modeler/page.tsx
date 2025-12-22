'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Download,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Info,
  Calculator,
  TableIcon,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NotePad } from '@/components/ui/notepad';

import { DEAL_TEMPLATES, DEAL_TEMPLATE_KEYS, getRatingColorClass } from '@/lib/deal-templates';
import { getBloombergSOFR } from '@/lib/bloomberg';
import type {
  DealTemplate,
  ScenarioResult,
} from '@/types/waterfall';
import { calculateWaterfall } from '@/lib/waterfall-engine';
import { SCENARIO_PRESETS } from '@/lib/scenario-presets';
import {
  DEFAULT_SERVICING_FEE_BPS,
  DEFAULT_OTHER_FEES_BPS,
  getTemplateDefaults,
} from '@/lib/model-defaults';

// =============================================================================
// TOOLTIP HELPER
// =============================================================================

function Tip({ text }: { text: string }) {
  return (
    <span className="inline-flex ml-1 cursor-help" title={text}>
      <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600" />
    </span>
  );
}


// IRR, waterfall, and breakeven utilities live in src/lib/waterfall-engine.ts

// =============================================================================
// ASSET-CLASS SPECIFIC SCENARIO PRESETS
// Based on industry benchmarks for each asset type
// =============================================================================

// Defaults are defined in src/lib/model-defaults.ts

// =============================================================================
// BREAKEVEN CDR CALCULATION
// Binary search to find CDR at which a tranche first takes principal loss
// =============================================================================


// =============================================================================
// SCENARIO ANALYSIS (quick stress test)
// =============================================================================

function calculateScenarioResults(
  cpr: number,
  cdr: number,
  severity: number,
  template: DealTemplate,
  sofrRate: number = 4.25
): ScenarioResult[] {
  const totalLoss = (cdr / 100) * (severity / 100) * 100;
  const totalSize = template.tranches.reduce((sum, t) => sum + t.balance, 0);

  return template.tranches.map((tranche) => {
    const lossAbsorbed = Math.max(0, totalLoss - tranche.subordination);
    const trancheLoss = Math.min(lossAbsorbed, (tranche.balance / totalSize) * 100);
    const principalLoss = trancheLoss * (totalSize / tranche.balance);

    let moic = 1.0;
    let status: 'safe' | 'impaired' | 'loss' = 'safe';

    if (principalLoss > 50) {
      status = 'loss';
      moic = (100 - principalLoss) / 100;
    } else if (principalLoss > 0) {
      status = 'impaired';
      moic = (100 - principalLoss * 0.5) / 100;
    } else {
      moic = 1.0 + (tranche.spread / 10000) * 2;
    }

    const baseWal = tranche.rating === 'NR' ? 4.5 : 2.0 + (1 - tranche.subordination / 50) * 2;
    const wal = baseWal * (1 - (cpr / 100) * 0.3);
    // Debt tranches: Yield = SOFR + spread (contractual)
    // Equity (NR): No contractual yield - use null, show IRR/MOIC instead
    const isEquity = tranche.rating === 'NR';
    const yieldVal = isEquity ? null : (sofrRate + tranche.spread / 100);

    return {
      tranche: tranche.name,
      rating: tranche.rating,
      subordination: tranche.subordination,
      moic: Math.max(0, moic),
      wal: Math.max(0.5, wal),
      yield: yieldVal !== null && principalLoss > 0 ? yieldVal * (1 - principalLoss / 200) : yieldVal,
      irr: null, // Will be populated from waterfall model
      principalLoss: Math.max(0, principalLoss),
      status,
    };
  });
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function DealModelerPage() {
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<string>('equipment');
  // Default to Equipment ABS base case (clean deal, no trigger breaches, positive IRRs)
  // These must match SCENARIO_PRESETS['equipment'].base
  const [cpr, setCpr] = useState(18);
  const [cdr, setCdr] = useState(2); // Start at realistic 2% CDR
  // Severity drives losses: Recovery = 100 - Severity
  // Using severity as the primary input (more intuitive for stress testing)
  const [severity, setSeverity] = useState(15); // 85% recovery for equipment
  const recovery = 100 - severity; // Derived from severity
  const [months, setMonths] = useState(60); // Must be long enough to fully amortize the deal
  const [sofr, setSofr] = useState<number | null>(null); // SOFR from Bloomberg (SOFRRATE INDEX)
  // Excess spread adjustment (bps) - the difference between collateral yield (WAC) and liability costs (tranche coupons)
  // Positive = more cushion for losses/equity distributions. Negative = tighter, stressed economics.
  const [excessSpreadBps, setExcessSpreadBps] = useState(0);
  const [servicingFeeBps, setServicingFeeBps] = useState(DEFAULT_SERVICING_FEE_BPS);
  const [otherFeesBps, setOtherFeesBps] = useState(DEFAULT_OTHER_FEES_BPS);
  const initialTemplateDefaults = getTemplateDefaults(selectedTemplate);
  const getDefaultTranchePrices = (templateId: string) => {
    const defaults = getTemplateDefaults(templateId);
    const template = DEAL_TEMPLATES[templateId];
    const fallback = template?.tranches.map(() => 100) ?? [];
    if (!defaults.tranchePricesPct || defaults.tranchePricesPct.length !== fallback.length) {
      return fallback;
    }
    return defaults.tranchePricesPct;
  };
  const [tranchePricesPct, setTranchePricesPct] = useState<number[]>(
    getDefaultTranchePrices(selectedTemplate)
  );
  const equitySharePct = initialTemplateDefaults.equitySharePct;
  const [hasRun, setHasRun] = useState(false);
  const [compareStructures, setCompareStructures] = useState<string[]>(['auto-abs', 'clo']);
  // Tab navigation - controlled for programmatic switching
  const [activeTab, setActiveTab] = useState('scenario-inputs');
  // Advanced settings toggle - collapsed by default for cleaner UI
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Fetch live SOFR from Bloomberg on mount (SOFRRATE INDEX)
  const fetchSOFR = useCallback(async () => {
    const liveRate = await getBloombergSOFR();
    setSofr(liveRate ?? 3.66); // Fallback to O/N SOFR close (Dec 13, 2024) if Bloomberg unavailable
  }, []);

  useEffect(() => {
    fetchSOFR();
  }, [fetchSOFR]);

  // Effective SOFR for calculations (use fetched value or fallback while loading)
  const effectiveSofr = sofr ?? 3.66;

  // Editable collateral parameters (allow deal replication)
  const [customWac, setCustomWac] = useState<number | null>(null);
  const [customCollateral, setCustomCollateral] = useState<number | null>(null);
  const [customWam, setCustomWam] = useState<number | null>(null);

  const baseTemplate = DEAL_TEMPLATES[selectedTemplate];

  // Create modified template with user overrides
  const template: DealTemplate = useMemo(() => ({
    ...baseTemplate,
    wac: customWac ?? baseTemplate.wac,
    collateralBalance: customCollateral ?? baseTemplate.collateralBalance,
    wam: customWam ?? baseTemplate.wam,
  }), [baseTemplate, customWac, customCollateral, customWam]);

  // Reset to base case when template changes (keeps all tabs in sync)
  const handleTemplateChange = (newTemplate: string) => {
    setSelectedTemplate(newTemplate);
    setCustomWac(null);
    setCustomCollateral(null);
    setCustomWam(null);
    setHasRun(false);
    // Apply the new template's base case preset to keep scenario assumptions synced
    const preset = SCENARIO_PRESETS[newTemplate]?.base || SCENARIO_PRESETS['equipment'].base;
    setCpr(preset.cpr);
    setCdr(preset.cdr);
    setSeverity(100 - preset.recovery);
    setMonths(preset.months);
    setExcessSpreadBps(0);
    setServicingFeeBps(DEFAULT_SERVICING_FEE_BPS);
    setOtherFeesBps(DEFAULT_OTHER_FEES_BPS);
    setTranchePricesPct(getDefaultTranchePrices(newTemplate));
  };

  // Full waterfall calculation - always run to get accurate IRR for both tabs
  // Severity drives loss calculation: effectiveRecovery = 100 - severity
  // This ensures all sliders (CPR, CDR, Severity, Months, SOFR, Extra Spread) affect IRR
  const waterfallResults = useMemo(() => {
    const effectiveRecovery = 100 - severity;
    return calculateWaterfall(
      template,
      cpr,
      cdr,
      effectiveRecovery,
      months,
      effectiveSofr,
      excessSpreadBps,
      servicingFeeBps,
      otherFeesBps,
      equitySharePct,
      tranchePricesPct
    );
  }, [template, cpr, cdr, severity, months, effectiveSofr, excessSpreadBps, servicingFeeBps, otherFeesBps, tranchePricesPct]);

  // Scenario results - now fully driven by waterfall model for accuracy
  const scenarioResults = useMemo(() => {
    return template.tranches.map((tranche, idx) => {
      const waterfallTranche = waterfallResults?.trancheSummary[idx];

      // Calculate principal loss percent from waterfall model
      const principalLossPercent = waterfallTranche && waterfallTranche.originalBalance > 0
        ? (waterfallTranche.principalLoss / waterfallTranche.originalBalance) * 100
        : 0;

      // Determine status based on modeled cash flows
      let status: 'safe' | 'impaired' | 'loss' = 'safe';
      if (principalLossPercent > 50) {
        status = 'loss';
      } else if (principalLossPercent > 0 || (waterfallTranche?.interestShortfall ?? 0) > 0) {
        status = 'impaired';
      }

      // Debt tranches: Yield = SOFR + spread (contractual)
      // Equity (NR): No contractual yield
      const isEquity = tranche.rating === 'NR';
      const yieldVal = isEquity ? null : (effectiveSofr + tranche.spread / 100);

      return {
        tranche: tranche.name,
        rating: tranche.rating,
        subordination: tranche.subordination,
        moic: waterfallTranche?.moic ?? 0,
        wal: waterfallTranche?.wal ?? 0,
        yield: yieldVal,
        irr: waterfallTranche?.irr ?? null,
        principalLoss: principalLossPercent,
        status,
      };
    });
  }, [template, effectiveSofr, waterfallResults]);

  const totalLoss = (cdr / 100) * (severity / 100) * 100;
  const breachMonths = waterfallResults?.cashFlows.filter((cf) => cf.triggerStatus === 'Fail').length ?? 0;
  const firstBreachMonth = waterfallResults?.cashFlows.find((cf) => cf.triggerStatus === 'Fail')?.period ?? null;
  const allPositiveIrr = waterfallResults?.trancheSummary.every((ts) => ts.irr !== null && ts.irr >= 0) ?? false;

  const handleRun = () => setHasRun(true);
  const handleReset = () => {
    setHasRun(false);
    // Reset to base case for current template
    const preset = SCENARIO_PRESETS[selectedTemplate]?.base || SCENARIO_PRESETS['auto-abs'].base;
    setCpr(preset.cpr);
    setCdr(preset.cdr);
    setSeverity(100 - preset.recovery);
    setMonths(preset.months);
    setExcessSpreadBps(0);
    setServicingFeeBps(DEFAULT_SERVICING_FEE_BPS);
    setOtherFeesBps(DEFAULT_OTHER_FEES_BPS);
    setTranchePricesPct(getDefaultTranchePrices(selectedTemplate));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return 'bg-green-100 text-green-800';
      case 'impaired':
        return 'bg-yellow-100 text-yellow-800';
      case 'loss':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleExportCSV = () => {
    if (!waterfallResults) return;
    const headers = ['Period', 'Collateral Start', 'Sched Prin', 'Prepays', 'Defaults', 'Losses', 'CNL %', 'OC %', 'Status', 'ARD Active', 'Turbo'];
    const rows = waterfallResults.cashFlows.map((cf) => [
      cf.period,
      cf.collateralStart.toFixed(2),
      cf.scheduledPrincipal.toFixed(2),
      cf.prepayments.toFixed(2),
      cf.defaults.toFixed(2),
      cf.losses.toFixed(2),
      cf.cnlPercent.toFixed(2),
      cf.ocPercent.toFixed(2),
      cf.triggerStatus,
      cf.ardActive ? 'Yes' : 'No',
      cf.turboPayment.toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waterfall_${selectedTemplate}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Deal Modeler</h1>
        <p className="text-gray-600">
          Compare capital structures, stress test scenarios, and model cash flow waterfalls
        </p>
      </div>

      {/* Simplified Model Disclaimer */}
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Simplified Model Assumptions</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Constant CPR/CDR vectors (no seasoning curves), instant recovery (no lag), servicing fee applied via inputs,
              bond pricing applied to IRR, no reinvestment. Pro-rata principal when triggers pass; sequential post-breach or post-ARD. Interest
              paid senior-first, capped by available collections (shortfalls tracked). Excess spread to equity when
              performing, turbos to seniors when sequential. OC = Collateral / Rated Notes. For relative value only.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="scenario-inputs" className="gap-2 text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Scenario Inputs</span>
            <span className="sm:hidden">Inputs</span>
            <span className="text-[10px] text-green-600 font-medium hidden lg:inline">(Start Here)</span>
          </TabsTrigger>
          <TabsTrigger value="tranche-analysis" className="gap-2 text-xs sm:text-sm">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Tranche Analysis</span>
            <span className="sm:hidden">Returns</span>
          </TabsTrigger>
          <TabsTrigger value="cashflows" className="gap-2 text-xs sm:text-sm">
            <TableIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Cash Flow Visualization</span>
            <span className="sm:hidden">Cash Flows</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-2 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Compare Structures</span>
            <span className="sm:hidden">Compare</span>
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* COMPARE TAB */}
        {/* ================================================================ */}
        <TabsContent value="compare" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Asset Classes to Compare</CardTitle>
              <CardDescription>Choose 2-3 structures to see side-by-side comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {DEAL_TEMPLATE_KEYS.map((key) => {
                  const structure = DEAL_TEMPLATES[key];
                  return (
                    <Button
                      key={key}
                      variant={compareStructures.includes(key) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (compareStructures.includes(key)) {
                          if (compareStructures.length > 1) {
                            setCompareStructures(compareStructures.filter((s) => s !== key));
                          }
                        } else if (compareStructures.length < 3) {
                          setCompareStructures([...compareStructures, key]);
                        }
                      }}
                      className={compareStructures.includes(key) ? 'bg-[#1E3A5F]' : ''}
                    >
                      {structure.name}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Side-by-Side Comparison */}
          <div
            className={`grid gap-6 ${
              compareStructures.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
            }`}
          >
            {compareStructures.map((structureKey) => {
              const structure = DEAL_TEMPLATES[structureKey];
              const totalSize = structure.tranches.reduce((sum, t) => sum + t.balance, 0);
              const ardTrigger = structure.triggers.find((t) => t.type === 'ARD');
              const infoTrigger = structure.triggers.find((t) => t.type === 'INFO');
              const timingTrigger = ardTrigger || infoTrigger;
              return (
                <Card key={structureKey}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-[#1E3A5F]">{structure.name}</CardTitle>
                    <CardDescription className="text-xs">{structure.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Visual Stack */}
                    <div className="space-y-1">
                      {structure.tranches.map((tranche) => {
                        const heightPercent = (tranche.balance / totalSize) * 100;
                        return (
                          <div
                            key={tranche.name}
                            className="relative rounded overflow-hidden"
                            style={{ height: `${Math.max(24, heightPercent * 1.5)}px` }}
                          >
                            <div className={`absolute inset-0 ${getRatingColorClass(tranche.rating)} opacity-90`} />
                            <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
                              <span className="font-medium text-white">{tranche.name}</span>
                              <span className="text-white/90">
                                {tranche.rating} | {tranche.spread > 0 ? `+${tranche.spread}bps` : 'Equity'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                      <div>
                        <span className="text-gray-500">Collateral:</span>
                        <p className="font-medium">{structure.collateralType}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Typical WAL:</span>
                        <p className="font-medium">{structure.typicalWAL}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">AAA Subordination:</span>
                        <p className="font-medium">{structure.tranches[0]?.subordination || 0}%</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Deal Size:</span>
                        <p className="font-medium">${totalSize}M</p>
                      </div>
                    </div>

                    {/* Timing Trigger (ARD or INFO) */}
                    {timingTrigger && (
                      <div className="text-xs pt-2 border-t">
                        <div className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-3 w-3" />
                          <span className="font-medium">
                            {ardTrigger ? 'ARD' : timingTrigger.name}: Month {timingTrigger.threshold}
                          </span>
                        </div>
                        <p className="text-gray-500 mt-1">{timingTrigger.consequence}</p>
                      </div>
                    )}

                    {/* Typical Spreads */}
                    <div className="text-xs pt-2 border-t">
                      <span className="text-gray-500">Typical Spreads:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {structure.typicalSpreads.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {s.rating}: {s.spread}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Key Risks */}
                    <div className="text-xs pt-2 border-t">
                      <span className="text-gray-500">Key Risks:</span>
                      <ul className="mt-1 space-y-0.5">
                        {structure.keyRisks.map((risk, i) => (
                          <li key={i} className="text-gray-700">
                            - {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Structure Comparison Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-gray-600">Metric</th>
                      {compareStructures.map((key) => (
                        <th key={key} className="text-center py-2 font-medium text-[#1E3A5F]">
                          {DEAL_TEMPLATES[key].name.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">AAA Subordination</td>
                      {compareStructures.map((key) => (
                        <td key={key} className="text-center py-2 font-medium">
                          {DEAL_TEMPLATES[key].tranches[0]?.subordination || 0}%
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">AAA Spread</td>
                      {compareStructures.map((key) => (
                        <td key={key} className="text-center py-2 font-medium">
                          +{DEAL_TEMPLATES[key].tranches[0]?.spread || 0}bps
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">Typical WAL</td>
                      {compareStructures.map((key) => (
                        <td key={key} className="text-center py-2 font-medium">
                          {DEAL_TEMPLATES[key].typicalWAL}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">Timing Marker</td>
                      {compareStructures.map((key) => {
                        const ard = DEAL_TEMPLATES[key].triggers.find((t) => t.type === 'ARD');
                        const info = DEAL_TEMPLATES[key].triggers.find((t) => t.type === 'INFO');
                        const trigger = ard || info;
                        return (
                          <td key={key} className="text-center py-2 font-medium">
                            {trigger ? `M${trigger.threshold}${info ? '*' : ''}` : '--'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-600">Equity/Residual %</td>
                      {compareStructures.map((key) => {
                        const structure = DEAL_TEMPLATES[key];
                        const totalSize = structure.tranches.reduce((sum, t) => sum + t.balance, 0);
                        const equity = structure.tranches.find((t) => t.rating === 'NR');
                        const pct = equity ? ((equity.balance / totalSize) * 100).toFixed(1) : '0';
                        return (
                          <td key={key} className="text-center py-2 font-medium">
                            {pct}%
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* SCENARIO ANALYSIS (Inputs) TAB */}
        {/* ================================================================ */}
        <TabsContent value="scenario-inputs" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scenario Inputs */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Scenario Assumptions</CardTitle>
                <CardDescription>Adjust to stress test the deal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Excess Spread breakdown */}
                {(() => {
                  // Calculate weighted average coupon (SOFR + spread) for rated tranches
                  const ratedTranches = template.tranches.filter(t => t.rating !== 'NR');
                  const totalRatedBalance = ratedTranches.reduce((sum, t) => sum + t.balance, 0);
                  const weightedCoupon = totalRatedBalance > 0
                    ? ratedTranches.reduce((sum, t) => sum + (effectiveSofr + t.spread / 100) * (t.balance / totalRatedBalance), 0)
                    : 0;
                  const servicingFeePct = servicingFeeBps / 100;
                  const otherFeesPct = otherFeesBps / 100;
                  const baseExcessSpread = template.wac - weightedCoupon - servicingFeePct - otherFeesPct;
                  const effectiveExcessSpread = baseExcessSpread + excessSpreadBps / 100;
                  return (
                    <div className="p-3 bg-[#1C2156]/5 rounded-lg border border-[#1C2156]/10 space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deal Economics</p>

                      {/* Asset Yield */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Asset Yield (WAC)</span>
                        <span className="font-mono font-medium text-[#1E3A5F]">{template.wac.toFixed(2)}%</span>
                      </div>

                      {/* Liability Cost */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Liability Cost (Wtd Avg Cpn)</span>
                        <span className="font-mono font-medium text-[#1E3A5F]">{weightedCoupon.toFixed(2)}%</span>
                      </div>

                      {/* Servicing Fee */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Servicing Fee</span>
                        <span className="font-mono font-medium text-[#1E3A5F]">{servicingFeePct.toFixed(2)}%</span>
                      </div>

                      {/* Other Fees hidden from UI but applied in model */}

                      {/* Pricing */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Avg Price</span>
                        <span className="font-mono font-medium text-[#1E3A5F]">
                          {(() => {
                            const total = template.tranches.reduce((sum, t) => sum + t.balance, 0);
                            const weighted = template.tranches.reduce(
                              (sum, t, idx) => sum + t.balance * (tranchePricesPct[idx] ?? 100),
                              0
                            );
                            const avg = total > 0 ? weighted / total : 100;
                            return `${avg.toFixed(1)}%`;
                          })()}
                        </span>
                      </div>

                      {/* Excess Spread */}
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-[#1C2156]/20">
                        <span className="text-gray-700 font-medium">Excess Spread (net)</span>
                        <span className="font-mono font-semibold text-[#1E3A5F]">{(baseExcessSpread * 100).toFixed(0)} bps</span>
                      </div>

                      {/* Effective if adjusted */}
                      {excessSpreadBps !== 0 && (
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-[#1C2156]/20">
                          <span className="text-gray-600">
                            Adjusted ({excessSpreadBps >= 0 ? '+' : ''}{excessSpreadBps} bps)
                          </span>
                          <span className={`font-mono font-semibold ${effectiveExcessSpread >= 0 ? 'text-[#1E3A5F]' : 'text-red-600'}`}>
                            {(effectiveExcessSpread * 100).toFixed(0)} bps
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <Label>Deal Type</Label>
                  <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_TEMPLATE_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {DEAL_TEMPLATES[key].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="flex items-center">
                      CPR (Prepayment Rate)
                      <Tip text="Annualized constant prepayment rate. Static vector (no seasoning ramp)." />
                    </Label>
                    <span className="text-sm font-mono text-[#1E3A5F]">{cpr}%</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="50"
                    value={cpr}
                    onChange={(e) => setCpr(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="flex items-center">
                      CDR (Default Rate)
                      <Tip text="Annualized constant default rate. Losses = defaults x (1 - recovery). No seasoning ramp." />
                    </Label>
                    <span className="text-sm font-mono text-[#1E3A5F]">{cdr}%</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="30"
                    value={cdr}
                    onChange={(e) => setCdr(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="flex items-center">
                      Loss Severity
                      <Tip text="LGD = 1 - Recovery. Independent assumption; not linked to Recovery slider in Waterfall tab." />
                    </Label>
                    <span className="text-sm font-mono text-[#1E3A5F]">{severity}%</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="flex items-center">
                      Excess Spread Adj.
                      <Tip text="Excess spread = WAC minus weighted-average tranche coupon minus fees. Adjust to model richer (positive) or tighter (negative) deal economics. Flows to equity as cash distributions." />
                    </Label>
                    <span className="text-sm font-mono text-[#1E3A5F]">
                      {excessSpreadBps >= 0 ? '+' : ''}{excessSpreadBps} bps
                    </span>
                  </div>
                  <Input
                    type="range"
                    min="-300"
                    max="300"
                    step="25"
                    value={excessSpreadBps}
                    onChange={(e) => setExcessSpreadBps(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Tight</span>
                    <span>Base</span>
                    <span>Rich</span>
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showAdvancedSettings ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span>Advanced Settings</span>
                    {!showAdvancedSettings && (
                      <span className="text-xs text-gray-400">(Fees, Pricing)</span>
                    )}
                  </button>
                </div>

                {/* Advanced Settings - Collapsible */}
                {showAdvancedSettings && (
                  <div className="space-y-4 pt-2 pl-2 border-l-2 border-gray-200">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="flex items-center text-sm">
                          Servicing Fee
                          <Tip text="Annual servicing/trustee fee applied to collateral balance. Reduces net excess spread." />
                        </Label>
                        <span className="text-sm font-mono text-[#1E3A5F]">{servicingFeeBps} bps</span>
                      </div>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={servicingFeeBps}
                        onChange={(e) => setServicingFeeBps(Number(e.target.value))}
                      />
                    </div>

                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <Label className="text-xs text-gray-500">
                    Scenario Presets
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SCENARIO_PRESETS[selectedTemplate] || SCENARIO_PRESETS['auto-abs']).map(
                      ([key, preset]) => (
                        <Button
                          key={key}
                          variant={key === 'base' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setCpr(preset.cpr);
                            setCdr(preset.cdr);
                            setSeverity(100 - preset.recovery); // Severity drives recovery
                            setMonths(preset.months);
                            setExcessSpreadBps(0); // Reset excess spread adjustment
                            setServicingFeeBps(DEFAULT_SERVICING_FEE_BPS);
                            setOtherFeesBps(DEFAULT_OTHER_FEES_BPS);
                            setTranchePricesPct(getDefaultTranchePrices(selectedTemplate));
                          }}
                          className={
                            key === 'base'
                              ? 'bg-[#1C2156] hover:bg-[#1E3278] text-white'
                              : key === 'stress'
                              ? 'border-amber-500 text-amber-700 hover:bg-amber-50'
                              : key === 'extension'
                              ? 'border-orange-500 text-orange-700 hover:bg-orange-50'
                              : ''
                          }
                        >
                          {key === 'base' ? '* Base Case' : preset.name}
                        </Button>
                      )
                    )}
                  </div>
                  <div className="mt-2 text-xs">
                    <span className={breachMonths === 0 && allPositiveIrr ? 'text-green-700' : 'text-amber-700'}>
                      Base case check: {breachMonths === 0 && allPositiveIrr ? 'Clean (no breaches, non-negative IRR)' : 'Review (breach or negative IRR)'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded">
                    <strong>Base Case:</strong> Clean deal, no trigger breaches. CPR {SCENARIO_PRESETS[selectedTemplate]?.base.cpr}% | CDR {SCENARIO_PRESETS[selectedTemplate]?.base.cdr}% | Recovery {SCENARIO_PRESETS[selectedTemplate]?.base.recovery}%
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Modeled Tranche Performance</span>
                  {breachMonths > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-400">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {breachMonths} Breach Month{breachMonths > 1 ? 's' : ''}{firstBreachMonth ? ` (M${firstBreachMonth})` : ''}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Results from {months}-month waterfall model
                  {waterfallResults?.ardTriggered && (
                    <span className="text-amber-600 ml-2">| ARD triggered month {waterfallResults.ardMonth}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* CNL Penetration Visualization (simplified view) */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700">CNL Penetration (Simplified)</p>
                    <span className="text-xs text-gray-500">
                      CNL: {totalLoss.toFixed(1)}% | Final CNL: {waterfallResults?.finalCNL.toFixed(1) ?? '--'}%
                    </span>
                  </div>
                  <div className="relative">
                    {/* Stack visualization - heights scaled by balance */}
                    <div className="space-y-0.5">
                      {template.tranches.map((tranche, idx) => {
                        const totalSize = template.tranches.reduce((sum, t) => sum + t.balance, 0);
                        const tranchePercent = (tranche.balance / totalSize) * 100;
                        const isImpaired = totalLoss > tranche.subordination;
                        const lossInTranche = Math.max(0, Math.min(
                          totalLoss - tranche.subordination,
                          tranchePercent
                        ));
                        const lossPercent = (lossInTranche / tranchePercent) * 100;
                        // Scale height by balance: min 20px, max 48px, proportional to % of stack
                        const barHeight = Math.max(20, Math.min(48, tranchePercent * 1.2));

                        return (
                          <div key={tranche.name} className="flex items-center gap-2 group">
                            <span className="text-xs w-20 text-gray-600 font-medium">{tranche.name}</span>
                            <div
                              className="flex-1 relative rounded overflow-hidden bg-gray-100 border border-gray-200 cursor-default"
                              style={{ height: `${barHeight}px` }}
                              title={`${tranche.name}: $${tranche.balance}M (${tranchePercent.toFixed(1)}%) | ${tranche.rating} | Sub: ${tranche.subordination.toFixed(1)}%`}
                            >
                              {/* Tranche fill */}
                              <div
                                className={`absolute inset-y-0 left-0 ${getRatingColorClass(tranche.rating)}`}
                                style={{ width: `${100 - lossPercent}%` }}
                              />
                              {/* Loss portion */}
                              {lossPercent > 0 && (
                                <div
                                  className="absolute inset-y-0 right-0 bg-red-700"
                                  style={{ width: `${lossPercent}%` }}
                                />
                              )}
                              {/* Label */}
                              <div className="absolute inset-0 flex items-center justify-between px-2">
                                <span className="text-xs font-medium text-white drop-shadow-sm">
                                  {tranche.rating} . {tranchePercent.toFixed(0)}%
                                </span>
                                {isImpaired && (
                                  <span className="text-xs text-white font-semibold drop-shadow-sm">
                                    {lossPercent.toFixed(0)}% loss
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Loss line indicator */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-0.5 flex-1 bg-red-500" />
                      <span className="text-xs text-red-600 font-medium">
                        {totalLoss.toFixed(1)}% CNL penetrates {
                          template.tranches.filter(t => totalLoss > t.subordination).length
                        } tranche(s)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {scenarioResults.map((result, idx) => {
                    const tranche = template.tranches.find((t) => t.name === result.tranche)!;
                    return (
                      <div key={result.tranche} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-[#1E3A5F]">{result.tranche}</span>
                            <Badge variant="outline">{tranche.rating}</Badge>
                            <Badge className={getStatusColor(result.status)}>
                              {result.status === 'safe'
                                ? 'Protected'
                                : result.status === 'impaired'
                                ? 'At Risk'
                                : 'Loss'}
                            </Badge>
                          </div>
                          <span className="text-sm text-gray-500">
                            ${tranche.balance}M | {tranche.subordination.toFixed(1)}% subordination
                          </span>
                        </div>

                        {/* Progress bar showing subordination vs loss */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Subordination Buffer</span>
                            <span>{tranche.subordination.toFixed(1)}% vs {totalLoss.toFixed(1)}% loss</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
                            {/* Subordination (green) */}
                            <div
                              className="absolute h-full bg-green-500 rounded-l-full"
                              style={{ width: `${Math.min(100, (tranche.subordination / 50) * 100)}%` }}
                            />
                            {/* Loss line (red) */}
                            <div
                              className="absolute h-full w-0.5 bg-red-600"
                              style={{ left: `${Math.min(100, (totalLoss / 50) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Metrics - CF IRR prominently displayed */}
                        <div className="grid grid-cols-5 gap-3 text-center">
                          <div className="bg-[#1E3A5F]/5 rounded-lg p-2 border border-[#1E3A5F]/20">
                            <p className="text-xs text-[#1E3A5F] font-medium">CF IRR</p>
                            <p className="font-bold text-lg text-[#1E3A5F]">
                              {result.irr == null ? '--' : `${(result.irr * 100).toFixed(1)}%`}
                            </p>
                            <div className="mt-1 flex items-center justify-center gap-2">
                              <span className="text-[10px] text-gray-500">Price</span>
                              <Input
                                type="number"
                                min="50"
                                max="120"
                                step="1"
                                value={tranchePricesPct[idx] ?? 100}
                                onChange={(e) => {
                                  const next = Number(e.target.value);
                                  setTranchePricesPct((prev) => prev.map((p, i) => (i === idx ? next : p)));
                                }}
                                className="h-6 w-16 text-right text-xs"
                                title="Price % of par used for IRR/MOIC"
                              />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Scenario changes cash flows; price is an input</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">MOIC</p>
                            <p
                              className={`font-semibold ${
                                result.moic >= 1 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {result.moic.toFixed(2)}x
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">WAL</p>
                            <p className="font-semibold text-[#1E3A5F]">{result.wal.toFixed(1)}yr</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Coupon (SOFR + spread)</p>
                            <p className="font-semibold text-gray-600">
                              {result.yield !== null ? `${result.yield.toFixed(2)}%` : '--'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Prin. Loss</p>
                            <p
                              className={`font-semibold ${
                                result.principalLoss > 0 ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {result.principalLoss.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Concepts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Understanding the Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <h4 className="font-semibold text-[#1E3A5F] mb-2">Subordination</h4>
                  <p className="text-sm text-gray-600">
                    The percentage of the deal below a tranche that absorbs losses first. Higher
                    subordination = more protection.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A5F] mb-2">OC Test</h4>
                  <p className="text-sm text-gray-600">
                    Overcollateralization test compares collateral value to note balance. If
                    breached, cash redirects to senior notes.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A5F] mb-2">Sequential Pay</h4>
                  <p className="text-sm text-gray-600">
                    When triggers breach, deals switch from pro-rata to sequential pay, prioritizing
                    senior tranches.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A5F] mb-2">ARD Trigger</h4>
                  <p className="text-sm text-gray-600">
                    Anticipated Repayment Date: If deal extends past ARD, excess cash flow diverts
                    to accelerate senior amortization.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* TRANCHE ANALYSIS TAB (Bond Returns) - Read Only */}
        {/* ================================================================ */}
        <TabsContent value="tranche-analysis" className="space-y-6">
          {/* Current Assumptions Summary (Read-Only) */}
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="text-gray-500 text-sm font-normal">Deal Type (from Scenario Inputs):</span>
                    <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                      <SelectTrigger className="w-48 h-8 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_TEMPLATE_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {DEAL_TEMPLATES[key].name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardTitle>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="text-[#1E3A5F] hover:text-[#2E5A8F] p-0 h-auto"
                  onClick={() => setActiveTab('scenario-inputs')}
                >
                  Edit Assumptions &rarr;
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Key Assumptions - Always Visible */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-gray-500 mb-1">CPR</p>
                  <p className="font-mono font-semibold text-[#1E3A5F]">{cpr}%</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-gray-500 mb-1">CDR</p>
                  <p className="font-mono font-semibold text-[#1E3A5F]">{cdr}%</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-gray-500 mb-1">Loss Severity</p>
                  <p className="font-mono font-semibold text-[#1E3A5F]">{severity}%</p>
                  <p className="text-[10px] text-gray-400">Recovery: {recovery}%</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-gray-500 mb-1">Excess Spread Adj.</p>
                  <p className="font-mono font-semibold text-[#1E3A5F]">
                    {excessSpreadBps >= 0 ? '+' : ''}{excessSpreadBps} bps
                  </p>
                </div>
              </div>

              {/* Advanced Assumptions - Collapsible */}
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {showAdvancedSettings ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span>{showAdvancedSettings ? 'Hide' : 'Show'} additional assumptions</span>
              </button>

              {showAdvancedSettings && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <p className="text-[10px] text-gray-500 mb-0.5">Projection</p>
                      <p className="font-mono text-sm font-semibold text-[#1E3A5F]">{months} mo</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <p className="text-[10px] text-gray-500 mb-0.5">SOFR</p>
                      <p className="font-mono text-sm font-semibold text-[#1E3A5F]">{effectiveSofr.toFixed(2)}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <p className="text-[10px] text-gray-500 mb-0.5">WAC</p>
                      <p className="font-mono text-sm font-semibold text-[#1E3A5F]">{template.wac.toFixed(1)}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <p className="text-[10px] text-gray-500 mb-0.5">Servicing Fee</p>
                      <p className="font-mono text-sm font-semibold text-[#1E3A5F]">{servicingFeeBps} bps</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <p className="text-[10px] text-gray-500 mb-0.5">Avg Price</p>
                      <p className="font-mono text-sm font-semibold text-[#1E3A5F]">
                        {(() => {
                          const total = template.tranches.reduce((sum, t) => sum + t.balance, 0);
                          const weighted = template.tranches.reduce(
                            (sum, t, idx) => sum + t.balance * (tranchePricesPct[idx] ?? 100),
                            0
                          );
                          const avg = total > 0 ? weighted / total : 100;
                          return `${avg.toFixed(1)}%`;
                        })()}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <p className="text-[10px] text-gray-500 mb-0.5">Collateral</p>
                      <p className="font-mono text-sm font-semibold text-[#1E3A5F]">${template.collateralBalance}M</p>
                    </div>
                  </div>
                  {/* Deal Triggers - Compact view in advanced settings */}
                  <div className="text-xs text-gray-500">
                    <span className="font-medium">Triggers:</span>{' '}
                    {template.triggers.map((t, idx) => {
                      let display = '';
                      if (t.type === 'OC') display = `OC ≥ ${t.threshold}%`;
                      else if (t.type === 'CNL') display = `CNL > ${t.threshold}%`;
                      else if (t.type === 'ARD') display = `ARD M${t.threshold}`;
                      else if (t.type === 'INFO') display = `${t.name} M${t.threshold}`;
                      return display;
                    }).filter(Boolean).join(' | ')}
                    <span className="text-gray-400 ml-1">(see Structural Protections below)</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Summary */}
          {waterfallResults && (
            <div className="space-y-6">
              {/* Structural Protections - Prominent Trigger Display */}
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Structural Protections
                  </CardTitle>
                  <CardDescription>
                    Built-in safeguards that protect senior tranches when performance deteriorates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-white rounded-lg p-4 border border-amber-200">
                    <div className="space-y-4">
                      {template.triggers.map((trigger) => (
                        <div key={trigger.name} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-800">{trigger.name}</span>
                            <span className="font-mono font-semibold text-[#1E3A5F]">
                              {trigger.type === 'OC' && `OC must stay ≥ ${trigger.threshold}%`}
                              {trigger.type === 'CNL' && `Breach if CNL > ${trigger.threshold}%`}
                              {trigger.type === 'ARD' && `Month ${trigger.threshold}`}
                              {trigger.type === 'INFO' && `Month ${trigger.threshold}`}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{trigger.consequence}</p>
                        </div>
                      ))}
                      {template.triggers.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No triggers defined for this structure</p>
                      )}
                    </div>
                  </div>

                  {/* Current Status */}
                  <div className="mt-4 pt-3 border-t border-amber-200 flex items-center gap-4 text-sm">
                    <span className="text-gray-600">Current Status:</span>
                    {breachMonths === 0 ? (
                      <Badge className="bg-green-100 text-green-800">All Triggers Passing</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">
                        {breachMonths} Month{breachMonths > 1 ? 's' : ''} with Breach
                        {firstBreachMonth && ` (first: M${firstBreachMonth})`}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500 flex items-center">
                      Final CNL
                      <Tip text="Cumulative Net Loss / Original Collateral at deal end." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {waterfallResults.finalCNL.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500 flex items-center">
                      Final OC Ratio
                      <Tip text="Collateral / Rated Notes (equity excluded)." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {waterfallResults.finalOC >= 900 ? '--' : `${waterfallResults.finalOC.toFixed(1)}%`}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Breach Months</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {breachMonths}
                    </p>
                    {firstBreachMonth && (
                      <p className="text-xs text-gray-500 mt-1">First breach: M{firstBreachMonth}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Periods Modeled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {waterfallResults.cashFlows.length}
                    </p>
                  </CardContent>
                </Card>
                {/* Only show ARD status for deals with true ARD triggers (not INFO) */}
                {template.triggers.some(t => t.type === 'ARD') ? (
                  <Card className={waterfallResults.ardTriggered ? 'border-amber-400 bg-amber-50' : ''}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> ARD Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`text-xl font-bold ${
                          waterfallResults.ardTriggered ? 'text-amber-600' : 'text-green-600'
                        }`}
                      >
                        {waterfallResults.ardTriggered
                          ? `Active (M${waterfallResults.ardMonth})`
                          : 'Not Triggered'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Timing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const infoTrigger = template.triggers.find(t => t.type === 'INFO');
                        return infoTrigger ? (
                          <p className="text-lg font-bold text-[#1E3A5F]" title={infoTrigger.consequence}>
                            {infoTrigger.name}
                            <span className="text-sm font-normal text-gray-500 ml-1">M{infoTrigger.threshold}</span>
                          </p>
                        ) : (
                          <p className="text-xl font-bold text-gray-400">--</p>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Bond Returns by Tranche - HERO SECTION */}
              <Card className="border-2 border-[#1E3A5F] shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#1C2156] to-[#1E3A5F] text-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 rounded-full p-2">
                        <Calculator className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold tracking-tight">Bond Returns by Tranche</h2>
                        <p className="text-white/80 text-sm">IRR calculated from cash flows at input prices</p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-white/60 text-xs uppercase tracking-wide">Key Metric</p>
                        <p className="font-bold text-lg">CF IRR</p>
                      </div>
                      <div className="h-10 w-px bg-white/20" />
                      <div className="text-right">
                        <p className="text-white/60 text-xs uppercase tracking-wide">Tranches</p>
                        <p className="font-bold text-lg">{template.tranches.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <CardHeader className="pt-4 pb-2">
                  <CardDescription className="text-gray-600">
                    Returns calculated from period-by-period cash flows under current scenario assumptions. Price inputs affect IRR/MOIC only; cash-flow routing is unchanged.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tranche</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="text-right" title="Purchase price ($M) - affects IRR/MOIC">Price</TableHead>
                        <TableHead className="text-right">Original</TableHead>
                        <TableHead className="text-right" title="Interest received from waterfall">Interest</TableHead>
                        <TableHead className="text-right" title="Cumulative interest shortfall (unpaid coupons)">Int. S/F</TableHead>
                        <TableHead className="text-right" title="Principal received from waterfall">Principal</TableHead>
                        <TableHead className="text-right" title="Principal not recovered">Loss</TableHead>
                        <TableHead className="text-right" title="(Principal + Interest) / Purchase Price">MOIC</TableHead>
                        <TableHead className="text-right bg-[#1E3A5F]/10 font-bold" title="Cash-flow IRR: annualized return based on modeled cash flows at purchase price">CF IRR</TableHead>
                        <TableHead className="text-right" title="Weighted average life from principal timing">WAL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterfallResults.trancheSummary.map((ts, idx) => {
                        const lossPercent = ts.originalBalance > 0 ? (ts.principalLoss / ts.originalBalance) * 100 : 0;
                        return (
                          <TableRow key={ts.name}>
                            <TableCell className="font-medium">{ts.name}</TableCell>
                            <TableCell>
                              <Badge className={getRatingColorClass(ts.rating)}>{ts.rating}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              ${((tranchePricesPct[idx] ?? 100) / 100 * ts.originalBalance).toFixed(1)}M
                            </TableCell>
                            <TableCell className="text-right">${ts.originalBalance.toFixed(1)}M</TableCell>
                            <TableCell className="text-right">${ts.totalInterest.toFixed(1)}M</TableCell>
                            <TableCell className={`text-right ${ts.interestShortfall > 0.01 ? 'text-amber-600 font-medium' : ''}`}>
                              {ts.interestShortfall > 0.01 ? `$${ts.interestShortfall.toFixed(1)}M` : '--'}
                            </TableCell>
                            <TableCell className="text-right">${ts.totalPrincipal.toFixed(1)}M</TableCell>
                            <TableCell className={`text-right ${lossPercent > 0 ? 'text-red-600 font-medium' : ''}`}>
                              {lossPercent > 0 ? `${lossPercent.toFixed(0)}%` : '--'}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${ts.moic >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                              {ts.moic.toFixed(2)}x
                            </TableCell>
                            <TableCell className="text-right bg-[#1E3A5F]/5 font-bold text-[#1E3A5F]">
                              {ts.irr == null ? '--' : `${(ts.irr * 100).toFixed(1)}%`}
                            </TableCell>
                            <TableCell className="text-right">{ts.wal.toFixed(1)}yr</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Loss Allocation by Tranche */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    Loss Allocation by Tranche
                    <Tip text="Losses hit junior tranches first before reaching seniors." />
                  </CardTitle>
                  <CardDescription>
                    Capital structure with loss allocation (senior at top, equity at bottom)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const totalLoss = waterfallResults.trancheSummary.reduce((sum, ts) => sum + ts.principalLoss, 0);
                    const totalOriginal = waterfallResults.trancheSummary.reduce((sum, ts) => sum + ts.originalBalance, 0);
                    const lossPercent = (totalLoss / totalOriginal) * 100;

                    // Senior at top, equity at bottom (original order)
                    const tranches = waterfallResults.trancheSummary;

                    return (
                      <div className="flex gap-6">
                        {/* Vertical Stacked Bar */}
                        <div className="flex flex-col w-32">
                          <div className="text-xs text-gray-500 mb-2 text-center">Capital Structure</div>
                          <div className="flex flex-col rounded overflow-hidden border border-gray-200" style={{ height: '280px' }}>
                            {tranches.map((ts) => {
                              const heightPercent = (ts.originalBalance / totalOriginal) * 100;
                              const lossRatio = ts.originalBalance > 0 ? ts.principalLoss / ts.originalBalance : 0;

                              return (
                                <div
                                  key={ts.name}
                                  className="relative border-b border-white/30 last:border-b-0 flex"
                                  style={{ height: `${heightPercent}%`, minHeight: '20px' }}
                                  title={`${ts.name}: $${ts.originalBalance}M original, $${ts.principalLoss.toFixed(1)}M loss`}
                                >
                                  {/* Remaining (not lost) portion */}
                                  <div
                                    className={`${getRatingColorClass(ts.rating)}`}
                                    style={{ width: `${(1 - lossRatio) * 100}%` }}
                                  />
                                  {/* Loss portion in red */}
                                  {ts.principalLoss > 0 && (
                                    <div
                                      className="bg-red-500"
                                      style={{ width: `${lossRatio * 100}%` }}
                                    />
                                  )}
                                  {/* Label overlay */}
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-medium text-white drop-shadow-sm">
                                      {ts.rating}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Loss Details Table */}
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-2">Loss Breakdown</div>
                          <div className="space-y-1.5">
                            {tranches.map((ts) => {
                              const lossRatio = ts.originalBalance > 0 ? (ts.principalLoss / ts.originalBalance) * 100 : 0;
                              return (
                                <div
                                  key={ts.name}
                                  className="flex items-center gap-3 text-sm"
                                >
                                  <div className={`w-3 h-3 rounded-sm ${getRatingColorClass(ts.rating)}`} />
                                  <span className="w-20 font-medium text-gray-700">{ts.name}</span>
                                  <span className="w-12 text-gray-500 text-xs">{ts.rating}</span>
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    {lossRatio > 0 && (
                                      <div
                                        className="h-full bg-red-500 rounded-full"
                                        style={{ width: `${Math.min(lossRatio, 100)}%` }}
                                      />
                                    )}
                                  </div>
                                  <span className={`w-16 text-right text-xs font-medium ${
                                    lossRatio > 50 ? 'text-red-600' : lossRatio > 0 ? 'text-amber-600' : 'text-green-600'
                                  }`}>
                                    {lossRatio > 0 ? `${lossRatio.toFixed(0)}% loss` : 'No loss'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Total Summary */}
                          <div className="mt-4 pt-3 border-t flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total Principal Loss</span>
                            <div className="text-right">
                              <span className="text-lg font-bold text-red-600">${totalLoss.toFixed(1)}M</span>
                              <span className="text-sm text-gray-500 ml-2">({lossPercent.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* CASH FLOWS TAB */}
        {/* ================================================================ */}
        <TabsContent value="cashflows">
          {waterfallResults && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Monthly Cash Flows</CardTitle>
                  <CardDescription>
                    {waterfallResults.ardTriggered && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ARD triggered at Month {waterfallResults.ardMonth} - Excess cash diverts to
                        accelerate senior paydown
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Collateral Start</TableHead>
                        <TableHead className="text-right">Sched Prin</TableHead>
                        <TableHead className="text-right">Prepays</TableHead>
                        <TableHead className="text-right">Defaults</TableHead>
                        <TableHead className="text-right">Losses</TableHead>
                        <TableHead className="text-right">CNL %</TableHead>
                        <TableHead className="text-right">OC %</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>ARD</TableHead>
                        <TableHead className="text-right">Turbo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterfallResults.cashFlows.map((cf) => (
                        <TableRow
                          key={cf.period}
                          className={cf.ardActive ? 'bg-amber-50' : ''}
                        >
                          <TableCell>{cf.period}</TableCell>
                          <TableCell className="text-right">${cf.collateralStart.toFixed(1)}M</TableCell>
                          <TableCell className="text-right">
                            ${cf.scheduledPrincipal.toFixed(2)}M
                          </TableCell>
                          <TableCell className="text-right">${cf.prepayments.toFixed(2)}M</TableCell>
                          <TableCell className="text-right">${cf.defaults.toFixed(2)}M</TableCell>
                          <TableCell className="text-right text-red-600">
                            ${cf.losses.toFixed(2)}M
                          </TableCell>
                          <TableCell className="text-right">{cf.cnlPercent.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{cf.ocPercent.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                cf.triggerStatus === 'Pass'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {cf.triggerStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {cf.ardActive && (
                              <Badge className="bg-amber-100 text-amber-800">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {cf.turboPayment > 0 ? `$${cf.turboPayment.toFixed(2)}M` : '--'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* NotePad */}
      <NotePad storageKey="deal-modeler-notes" />

      {/* Footer */}
      <div className="border-t pt-4 mt-6">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Illustrative Model - Not for Investment Decisions</span>
          <span className="font-medium text-[#1E3A5F]">
            Bain Capital Credit | For Consideration by Brett Wilzbach
          </span>
        </div>
      </div>
    </div>
  );
}
