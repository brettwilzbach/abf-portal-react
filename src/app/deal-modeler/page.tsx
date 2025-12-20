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
  CashFlowResult,
  TrancheSummary,
  WaterfallOutput,
  ScenarioResult,
} from '@/types/waterfall';

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


function calculateIRR(cashFlows: number[], guess = 0.01): number | null {
  if (cashFlows.length < 2) return null;
  const hasPositive = cashFlows.some((cf) => cf > 0);
  const hasNegative = cashFlows.some((cf) => cf < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = guess;
  for (let i = 0; i < 50; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const cf = cashFlows[t];
      const denom = Math.pow(1 + rate, t);
      npv += cf / denom;
      if (t > 0) {
        dnpv -= (t * cf) / Math.pow(1 + rate, t + 1);
      }
    }
    if (Math.abs(npv) < 1e-7) return rate;
    if (dnpv == 0) break;
    rate = rate - npv / dnpv;
    if (rate <= -0.99) rate = -0.99;
  }
  return null;
}

// =============================================================================
// ASSET-CLASS SPECIFIC SCENARIO PRESETS
// Based on industry benchmarks for each asset type
// =============================================================================

interface ScenarioPreset {
  name: string;
  cpr: number;
  cdr: number;
  recovery: number;
  months: number;
}

const SCENARIO_PRESETS: Record<string, Record<string, ScenarioPreset>> = {
  'auto-abs': {
    base: { name: 'Base', cpr: 18, cdr: 5, recovery: 45, months: 60 },
    stress: { name: 'Stress', cpr: 6, cdr: 12, recovery: 35, months: 72 },
    extension: { name: 'Extension', cpr: 3, cdr: 6, recovery: 40, months: 84 },
  },
  'consumer': {
    base: { name: 'Base', cpr: 20, cdr: 7, recovery: 20, months: 48 },
    stress: { name: 'Stress', cpr: 8, cdr: 15, recovery: 10, months: 60 },
    extension: { name: 'Extension', cpr: 4, cdr: 9, recovery: 15, months: 72 },
  },
  'equipment': {
    base: { name: 'Base', cpr: 8, cdr: 3, recovery: 60, months: 60 },
    stress: { name: 'Stress', cpr: 4, cdr: 7, recovery: 45, months: 72 },
    extension: { name: 'Extension', cpr: 2, cdr: 4, recovery: 50, months: 84 },
  },
  'clo': {
    base: { name: 'Base', cpr: 12, cdr: 3, recovery: 60, months: 120 },
    stress: { name: 'Stress', cpr: 6, cdr: 8, recovery: 45, months: 120 },
    extension: { name: 'Extension', cpr: 4, cdr: 4, recovery: 55, months: 120 },
  },
};

// =============================================================================
// BREAKEVEN CDR CALCULATION
// Binary search to find CDR at which a tranche first takes principal loss
// =============================================================================

function calculateBreakevenCDR(
  template: DealTemplate,
  cpr: number,
  recovery: number,
  months: number,
  trancheIndex: number
): number | null {
  let low = 0;
  let high = 50; // Max CDR to search
  const tolerance = 0.1;

  // Check if already losing at CDR=0
  const atZero = calculateWaterfall(template, cpr, 0, recovery, months);
  if (atZero.trancheSummary[trancheIndex]?.principalLoss > 0.01) {
    return 0;
  }

  // Check if still safe at max CDR
  const atMax = calculateWaterfall(template, cpr, high, recovery, months);
  if (atMax.trancheSummary[trancheIndex]?.principalLoss <= 0.01) {
    return null; // Breakeven above 50% CDR (effectively infinite protection)
  }

  // Binary search
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const result = calculateWaterfall(template, cpr, mid, recovery, months);
    const hasLoss = result.trancheSummary[trancheIndex]?.principalLoss > 0.01;

    if (hasLoss) {
      high = mid;
    } else {
      low = mid;
    }

    if (high - low < tolerance) break;
  }

  return (low + high) / 2;
}

// =============================================================================
// WATERFALL CALCULATION ENGINE (with ARD trigger)
// =============================================================================

function calculateWaterfall(
  template: DealTemplate,
  cpr: number,
  cdr: number,
  recovery: number,
  months: number,
  sofrRate: number = 3.69 // SOFR base rate assumption
): WaterfallOutput {
  const cashFlows: CashFlowResult[] = [];
  let collateralBalance = template.collateralBalance;
  let cumulativeLoss = 0;
  const monthlyPaymentRate = 1 / template.wam;

  // Find ARD trigger - only type='ARD' causes turbo; type='INFO' is informational only (e.g., CLO non-call)
  const ardTrigger = template.triggers.find((t) => t.type === 'ARD');
  const ardMonth = ardTrigger ? ardTrigger.threshold : Infinity;
  let ardTriggered = false;
  let ardActivationMonth: number | null = null;

  // Track tranche balances and principal receipts
  const trancheBalances = template.tranches.map((t) => t.balance);
  const tranchePrincipalReceived = template.tranches.map(() => 0);
  const trancheInterestReceived = template.tranches.map(() => 0);
  const trancheInterestShortfall = template.tranches.map(() => 0); // Cumulative unpaid interest
  const trancheCashFlows = template.tranches.map(() => [] as number[]);

  // Track if we're in sequential mode (triggered by OC/CNL breach)
  let isSequentialMode = false;

  for (let period = 1; period <= months && collateralBalance > 0.1; period++) {
    const startBalance = collateralBalance;
    const scheduledPrincipal = startBalance * monthlyPaymentRate;
    const prepayments = startBalance * (cpr / 100 / 12);
    const defaults = startBalance * (cdr / 100 / 12);
    const recoveries = defaults * (recovery / 100);
    const losses = defaults - recoveries;
    const interestIncome = startBalance * (template.wac / 100 / 12);

    // Interest Waterfall: Pay tranches in priority order, capped by available interest
    // Available interest = interest income from collateral
    let availableInterest = interestIncome;
    let totalInterestPaid = 0;
    const periodInterestPaid = template.tranches.map(() => 0);
    const periodPrincipalPaid = template.tranches.map(() => 0);

    // Pay interest to tranches in priority order (senior first)
    for (let i = 0; i < template.tranches.length; i++) {
      const t = template.tranches[i];
      if (trancheBalances[i] > 0 && t.spread > 0) {
        // Coupon = SOFR + spread on outstanding balance
        const couponDue = trancheBalances[i] * ((sofrRate + t.spread / 100) / 100 / 12);
        const couponPaid = Math.min(couponDue, availableInterest);
        const shortfall = couponDue - couponPaid;
        trancheInterestReceived[i] += couponPaid;
        periodInterestPaid[i] += couponPaid;
        trancheInterestShortfall[i] += shortfall; // Track cumulative shortfall
        availableInterest -= couponPaid;
        totalInterestPaid += couponPaid;
      }
    }
    const excessSpread = Math.max(0, availableInterest); // Remaining after all interest paid

    cumulativeLoss += losses;
    collateralBalance = startBalance - scheduledPrincipal - prepayments - defaults;

    const cnlPercent = (cumulativeLoss / template.collateralBalance) * 100;
    // OC calculation excludes equity/residual (NR rated) per industry standard
    const ratedNoteBalances = template.tranches
      .map((t, idx) => (t.rating !== 'NR' ? trancheBalances[idx] : 0))
      .reduce((sum, b) => sum + b, 0);
    const ocPercent = ratedNoteBalances > 0 ? (collateralBalance / ratedNoteBalances) * 100 : 100;

    // Check triggers for sequential mode switch
    const ocTrigger = template.triggers.find((t) => t.type === 'OC');
    const cnlTrigger = template.triggers.find((t) => t.type === 'CNL');
    const ocBreached = ocTrigger && ocPercent < ocTrigger.threshold;
    const cnlBreached = cnlTrigger && cnlPercent > cnlTrigger.threshold;

    // Once triggered, stay in sequential mode (cash trapped)
    if (ocBreached || cnlBreached) {
      isSequentialMode = true;
    }

    const triggerStatus = (ocBreached || cnlBreached) ? 'Fail' : 'Pass';

    // Check ARD trigger: if post-ARD and deal balance > 0
    const isPostARD = period > ardMonth && collateralBalance > 0.1;
    if (isPostARD && !ardTriggered) {
      ardTriggered = true;
      ardActivationMonth = period;
    }

    // Distribute principal to tranches
    let availablePrincipal = scheduledPrincipal + prepayments + recoveries;
    let turboPayment = 0;
    let excessSpreadToEquity = 0;

    // Principal distribution: Pro-rata when triggers pass, Sequential when breached/post-ARD
    const useSequential = isSequentialMode || isPostARD;

    // If post-ARD or in sequential mode, excess spread turbos to senior paydown
    // Otherwise, excess spread flows to equity as cash distribution
    if (useSequential) {
      turboPayment = excessSpread;
      availablePrincipal += excessSpread;
    } else {
      // Excess spread goes to equity in pro-rata mode (cash distribution, not principal paydown)
      excessSpreadToEquity = excessSpread;
    }

    // Get rated tranches (exclude NR/equity for pro-rata calculation)
    const ratedTranchesInfo = template.tranches
      .map((t, idx) => ({ idx, balance: trancheBalances[idx], rating: t.rating }))
      .filter(t => t.rating !== 'NR' && t.balance > 0);

    if (useSequential) {
      // Sequential pay: pay senior tranches first (most senior = lowest index)
      for (let i = 0; i < trancheBalances.length && availablePrincipal > 0; i++) {
        if (trancheBalances[i] > 0 && template.tranches[i].rating !== 'NR') {
          const paydown = Math.min(availablePrincipal, trancheBalances[i]);
          trancheBalances[i] -= paydown;
          tranchePrincipalReceived[i] += paydown;
          periodPrincipalPaid[i] += paydown;
          availablePrincipal -= paydown;
        }
      }
    } else {
      // Pro-rata: distribute proportionally to all rated tranches based on outstanding balance
      const totalRatedBalance = ratedTranchesInfo.reduce((sum, t) => sum + t.balance, 0);
      if (totalRatedBalance > 0) {
        const principalToDistribute = Math.min(availablePrincipal, totalRatedBalance);
        for (const t of ratedTranchesInfo) {
          const share = t.balance / totalRatedBalance;
          const paydown = Math.min(principalToDistribute * share, trancheBalances[t.idx]);
          trancheBalances[t.idx] -= paydown;
          tranchePrincipalReceived[t.idx] += paydown;
          periodPrincipalPaid[t.idx] += paydown;
          availablePrincipal -= paydown;
        }
      }
    }

    // Any remaining principal goes to equity/residual (NR rated)
    for (let i = 0; i < trancheBalances.length && availablePrincipal > 0; i++) {
      if (trancheBalances[i] > 0 && template.tranches[i].rating === 'NR') {
        const paydown = Math.min(availablePrincipal, trancheBalances[i]);
        trancheBalances[i] -= paydown;
        tranchePrincipalReceived[i] += paydown;
        availablePrincipal -= paydown;
      }
    }

    // Excess spread to equity (cash distribution in pro-rata mode)
    // This is income to equity, tracked separately from principal
    const equityIdx = template.tranches.findIndex(t => t.rating === 'NR');
    if (equityIdx >= 0 && excessSpreadToEquity > 0) {
      trancheInterestReceived[equityIdx] += excessSpreadToEquity;
      periodInterestPaid[equityIdx] += excessSpreadToEquity;
    }

    for (let i = 0; i < trancheCashFlows.length; i++) {
      trancheCashFlows[i].push(periodInterestPaid[i] + periodPrincipalPaid[i]);
    }

    cashFlows.push({
      period,
      collateralStart: startBalance,
      collateralEnd: Math.max(0, collateralBalance),
      scheduledPrincipal,
      prepayments,
      defaults,
      recoveries,
      losses,
      interestIncome,
      excessSpread,
      cnlPercent,
      ocPercent,
      triggerStatus,
      ardActive: isPostARD,
      turboPayment: (isPostARD || isSequentialMode) ? turboPayment : 0,
    });
  }

  // Calculate tranche summaries using actual modeled cash flows
  const trancheSummary: TrancheSummary[] = template.tranches.map((tranche, idx) => {
    const finalBalance = trancheBalances[idx];
    const principalReceived = tranchePrincipalReceived[idx];
    const interestReceived = trancheInterestReceived[idx];
    const interestShortfall = trancheInterestShortfall[idx];
    const principalLoss = Math.max(0, tranche.balance - principalReceived - finalBalance);

    // Simplified WAL: use average of periods weighted by principal (approximation)
    // In a full model, we'd track period-by-period principal for each tranche
    const avgPeriod = cashFlows.length > 0 ? (cashFlows.length / 2) : 1;
    const wal = principalReceived > 0 ? (avgPeriod / 12) : 0;

    const totalCashReceived = principalReceived + interestReceived;
    const moic = tranche.balance > 0 ? totalCashReceived / tranche.balance : 0;

    const cashFlowSeries = tranche.balance > 0
      ? [-tranche.balance, ...trancheCashFlows[idx]]
      : [];
    const monthlyIrr = cashFlowSeries.length > 0 ? calculateIRR(cashFlowSeries) : null;
    const irr = monthlyIrr == null ? null : Math.pow(1 + monthlyIrr, 12) - 1;

    return {
      name: tranche.name,
      rating: tranche.rating,
      originalBalance: tranche.balance,
      finalBalance: Math.max(0, finalBalance),
      totalInterest: interestReceived,
      totalPrincipal: principalReceived,
      principalLoss,
      interestShortfall,
      moic: Math.max(0, moic),
      irr: irr == null ? null : Math.max(-0.99, irr),
      wal: Math.max(0.1, wal),
    };
  });

  const lastCf = cashFlows[cashFlows.length - 1];
  return {
    cashFlows,
    trancheSummary,
    triggerBreaches: cashFlows.filter((cf) => cf.triggerStatus === 'Fail').length,
    finalCNL: lastCf?.cnlPercent || 0,
    finalOC: lastCf?.ocPercent || 0,
    ardTriggered,
    ardMonth: ardActivationMonth,
  };
}

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('auto-abs');
  const [cpr, setCpr] = useState(15);
  const [cdr, setCdr] = useState(5);
  // Severity drives losses: Recovery = 100 - Severity
  // Using severity as the primary input (more intuitive for stress testing)
  const [severity, setSeverity] = useState(55);
  const recovery = 100 - severity; // Derived from severity
  const [months, setMonths] = useState(60);
  const [sofr, setSofr] = useState<number | null>(null); // SOFR from Bloomberg (SOFRRATE INDEX)
  const [hasRun, setHasRun] = useState(false);
  const [compareStructures, setCompareStructures] = useState<string[]>(['auto-abs', 'clo']);

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

  // Reset custom values when template changes
  const handleTemplateChange = (newTemplate: string) => {
    setSelectedTemplate(newTemplate);
    setCustomWac(null);
    setCustomCollateral(null);
    setCustomWam(null);
    setHasRun(false);
  };

  // Full waterfall calculation - always run to get accurate IRR for both tabs
  // Severity drives loss calculation: effectiveRecovery = 100 - severity
  // This ensures all sliders (CPR, CDR, Severity, Months, SOFR) affect IRR
  const waterfallResults = useMemo(() => {
    const effectiveRecovery = 100 - severity;
    return calculateWaterfall(template, cpr, cdr, effectiveRecovery, months, effectiveSofr);
  }, [template, cpr, cdr, severity, months, effectiveSofr]);

  // Breakeven CDR for equity (last tranche) - CDR at which equity first takes loss
  const equityBreakevenCDR = useMemo(() => {
    const effectiveRecovery = 100 - severity;
    const equityIdx = template.tranches.length - 1; // Equity is last
    return calculateBreakevenCDR(template, cpr, effectiveRecovery, months, equityIdx);
  }, [template, cpr, severity, months]);

  // Quick scenario results (for scenario tab) - now enriched with IRR from waterfall
  const scenarioResults = useMemo(() => {
    const baseResults = calculateScenarioResults(cpr, cdr, severity, template, effectiveSofr);
    // Merge IRR from waterfall results
    return baseResults.map((result, idx) => {
      const waterfallTranche = waterfallResults?.trancheSummary[idx];
      return {
        ...result,
        irr: waterfallTranche?.irr ?? null,
      };
    });
  }, [cpr, cdr, severity, template, effectiveSofr, waterfallResults]);

  const totalLoss = (cdr / 100) * (severity / 100) * 100;
  const ocRatio = 100 / (100 - totalLoss) * 100;
  const ocBreached = ocRatio < 105;

  const handleRun = () => setHasRun(true);
  const handleReset = () => {
    setHasRun(false);
    setCpr(15);
    setCdr(5);
    setSeverity(55); // Recovery = 45%
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
              Constant CPR/CDR vectors (no seasoning curves), instant recovery (no lag), no servicing/trustee fees,
              no reinvestment. Pro-rata principal when triggers pass; sequential post-breach or post-ARD. Interest
              paid senior-first, capped by available collections (shortfalls tracked). Excess spread to equity when
              performing, turbos to seniors when sequential. OC = Collateral / Rated Notes. For relative value only.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="compare" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="compare" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="scenario" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Scenario
          </TabsTrigger>
          <TabsTrigger value="waterfall" className="gap-2">
            <Calculator className="h-4 w-4" />
            Waterfall
          </TabsTrigger>
          <TabsTrigger value="cashflows" className="gap-2" disabled={!hasRun}>
            <TableIcon className="h-4 w-4" />
            Cash Flows
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
                            {trigger ? `M${trigger.threshold}${info ? '*' : ''}` : '—'}
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
        {/* SCENARIO TAB */}
        {/* ================================================================ */}
        <TabsContent value="scenario" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scenario Inputs */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Scenario Assumptions</CardTitle>
                <CardDescription>Adjust to stress test the deal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Deal Type</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
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

                <div className="pt-4 border-t space-y-2">
                  <Label className="text-xs text-gray-500">
                    Asset-Class Presets ({DEAL_TEMPLATES[selectedTemplate].name})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SCENARIO_PRESETS[selectedTemplate] || SCENARIO_PRESETS['auto-abs']).map(
                      ([key, preset]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCpr(preset.cpr);
                            setCdr(preset.cdr);
                            setSeverity(100 - preset.recovery); // Severity drives recovery
                            setMonths(preset.months);
                          }}
                          className={key === 'stress' ? 'border-amber-400 hover:bg-amber-50' : key === 'extension' ? 'border-orange-400 hover:bg-orange-50' : ''}
                        >
                          {preset.name}
                        </Button>
                      )
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    CPR: {SCENARIO_PRESETS[selectedTemplate]?.base.cpr || 18}% base |
                    CDR: {SCENARIO_PRESETS[selectedTemplate]?.base.cdr || 5}% base |
                    Recovery: {SCENARIO_PRESETS[selectedTemplate]?.base.recovery || 45}% base
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Loss Penetration & Tranche Protection</CardTitle>
                <CardDescription>
                  Cumulative Net Loss: {totalLoss.toFixed(1)}% | OC Ratio: {ocRatio.toFixed(1)}%
                  {ocBreached && (
                    <span className="text-red-600 ml-2 flex items-center gap-1 inline-flex">
                      <AlertTriangle className="h-3 w-3" /> OC Trigger Breached
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Loss Penetration Visualization */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-3">Capital Stack - Loss Penetration</p>
                  <div className="relative">
                    {/* Stack visualization */}
                    <div className="space-y-1">
                      {template.tranches.map((tranche, idx) => {
                        const totalSize = template.tranches.reduce((sum, t) => sum + t.balance, 0);
                        const tranchePercent = (tranche.balance / totalSize) * 100;
                        const isImpaired = totalLoss > tranche.subordination;
                        const lossInTranche = Math.max(0, Math.min(
                          totalLoss - tranche.subordination,
                          tranchePercent
                        ));
                        const lossPercent = (lossInTranche / tranchePercent) * 100;

                        return (
                          <div key={tranche.name} className="flex items-center gap-2">
                            <span className="text-xs w-16 text-gray-600">{tranche.name}</span>
                            <div className="flex-1 relative h-6 rounded overflow-hidden bg-gray-200">
                              {/* Tranche fill */}
                              <div
                                className={`absolute inset-y-0 left-0 ${getRatingColorClass(tranche.rating)}`}
                                style={{ width: `${100 - lossPercent}%` }}
                              />
                              {/* Loss portion */}
                              {lossPercent > 0 && (
                                <div
                                  className="absolute inset-y-0 right-0 bg-red-500"
                                  style={{ width: `${lossPercent}%` }}
                                />
                              )}
                              {/* Label */}
                              <div className="absolute inset-0 flex items-center justify-between px-2">
                                <span className="text-xs font-medium text-white drop-shadow">
                                  {tranche.rating} ({tranchePercent.toFixed(0)}%)
                                </span>
                                {isImpaired && (
                                  <span className="text-xs text-white font-bold">
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
                  {scenarioResults.map((result) => {
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
                            <p className="text-xs text-gray-500">
                              {result.rating === 'NR' ? 'Coupon' : 'Yield'}
                            </p>
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
        {/* WATERFALL TAB */}
        {/* ================================================================ */}
        <TabsContent value="waterfall" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal Template</CardTitle>
                <CardDescription>Select and customize collateral parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="space-y-3 pt-4 border-t">
                  <p className="text-xs text-gray-500">Customize to replicate a specific deal</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm">Collateral ($M)</Label>
                      <Input
                        type="number"
                        value={customCollateral ?? baseTemplate.collateralBalance}
                        onChange={(e) => setCustomCollateral(Number(e.target.value) || null)}
                        className="w-24 h-8 text-right"
                        min={50}
                        max={1000}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm">WAC (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={customWac ?? baseTemplate.wac}
                        onChange={(e) => setCustomWac(Number(e.target.value) || null)}
                        className="w-24 h-8 text-right"
                        min={1}
                        max={25}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm">WAM (months)</Label>
                      <Input
                        type="number"
                        value={customWam ?? baseTemplate.wam}
                        onChange={(e) => setCustomWam(Number(e.target.value) || null)}
                        className="w-24 h-8 text-right"
                        min={12}
                        max={360}
                      />
                    </div>
                  </div>
                  {(customWac || customCollateral || customWam) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomWac(null);
                        setCustomCollateral(null);
                        setCustomWam(null);
                      }}
                      className="text-xs text-gray-500"
                    >
                      Reset to defaults
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scenario Inputs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scenario Assumptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="flex items-center">
                      CPR
                      <Tip text="Annualized constant prepayment rate. No seasoning ramp." />
                    </Label>
                    <span className="text-sm font-mono">{cpr}%</span>
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
                      CDR
                      <Tip text="Annualized constant default rate. No seasoning ramp." />
                    </Label>
                    <span className="text-sm font-mono">{cdr}%</span>
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
                      Recovery Rate
                      <Tip text="Linked to Severity: Recovery = 100 - Severity. Changes here update Severity in Scenario tab." />
                    </Label>
                    <span className="text-sm font-mono">{recovery}%</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={recovery}
                    onChange={(e) => setSeverity(100 - Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-400">Severity: {severity}% (synced with Scenario tab)</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center">
                    Projection (Months)
                    <Tip text="Static pool projection period." />
                  </Label>
                  <Input
                    type="number"
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    min={12}
                    max={120}
                  />
                </div>
                <div className="space-y-2 pt-3 border-t">
                  <div className="flex justify-between">
                    <Label className="flex items-center">
                      SOFR (Base Rate)
                      <Tip text="O/N SOFR rate for tranche coupons (SOFR + spread). Fetched from Bloomberg (SOFRRATE INDEX) on load." />
                    </Label>
                    <span className="text-sm font-mono">{effectiveSofr.toFixed(2)}%</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="8"
                    step="0.05"
                    value={effectiveSofr}
                    onChange={(e) => setSofr(Number(e.target.value))}
                  />
                  <p className="text-xs text-gray-400">
                    {sofr === null ? 'Loading from Bloomberg...' : 'Rate shock: adjust to stress interest expense'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tranches & Triggers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Capital Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {template.tranches.map((tranche) => (
                    <div key={tranche.name} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-12 justify-center">
                          {tranche.rating}
                        </Badge>
                        <span className="text-sm">{tranche.name}</span>
                      </div>
                      <span className="text-sm font-mono">${tranche.balance}M</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-2">Triggers</p>
                  {template.triggers.map((trigger) => {
                    // Tooltips per trigger type - plain ASCII for compatibility
                    const tipText = trigger.type === 'OC'
                      ? 'OC = Collateral / Rated Notes. Breach -> sequential mode.'
                      : trigger.type === 'CNL'
                      ? 'CNL = Cumulative Net Loss / Original Collateral. Breach -> sequential mode.'
                      : trigger.type === 'ARD'
                      ? 'Post-ARD: excess spread turbos to senior paydown.'
                      : trigger.type === 'INFO'
                      ? 'Informational timing marker only (no waterfall effect).'
                      : trigger.consequence;
                    const isTimingTrigger = trigger.type === 'ARD' || trigger.type === 'INFO';
                    return (
                      <div key={trigger.name} className="flex items-center gap-2 text-xs py-1" title={tipText}>
                        {isTimingTrigger ? (
                          <Clock className="h-3 w-3 text-amber-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-amber-500" />
                        )}
                        <span>
                          {trigger.name}:{' '}
                          {isTimingTrigger ? `Month ${trigger.threshold}` : `${trigger.threshold}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={handleRun} className="bg-[#1E3A5F] hover:bg-[#2E5A8F]">
              <Play className="h-4 w-4 mr-2" /> Run Model
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>

          {/* Results Summary */}
          {waterfallResults && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <Card className="bg-[#1E3A5F]/5 border-[#1E3A5F]/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-[#1E3A5F] font-medium flex items-center">
                      Equity Breakeven CDR
                      <Tip text="CDR at which equity first takes principal loss. Higher = more cushion." />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {equityBreakevenCDR === null ? '>50%' : `${equityBreakevenCDR.toFixed(1)}%`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Current: {cdr}% CDR
                    </p>
                  </CardContent>
                </Card>
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
                      {waterfallResults.finalOC.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Trigger Breaches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {waterfallResults.triggerBreaches}
                    </p>
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
                          <p className="text-xl font-bold text-gray-400">—</p>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* OC & CNL Time Series Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">OC Ratio & CNL Time Series</CardTitle>
                  <CardDescription>
                    Track trigger metrics over deal life. Red zones indicate breaches.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const ocTrigger = template.triggers.find((t) => t.type === 'OC');
                    const cnlTrigger = template.triggers.find((t) => t.type === 'CNL');
                    const ocThreshold = ocTrigger?.threshold || 100;
                    const cnlThreshold = cnlTrigger?.threshold || 100;
                    const maxOC = Math.max(...waterfallResults.cashFlows.map((cf) => cf.ocPercent), ocThreshold + 10);
                    const maxCNL = Math.max(...waterfallResults.cashFlows.map((cf) => cf.cnlPercent), cnlThreshold + 5);

                    // Sample every Nth point for readability (max 24 points)
                    const sampleRate = Math.max(1, Math.floor(waterfallResults.cashFlows.length / 24));
                    const sampledFlows = waterfallResults.cashFlows.filter((_, i) => i % sampleRate === 0 || i === waterfallResults.cashFlows.length - 1);

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* OC Ratio Chart */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">OC Ratio</span>
                            <span className="text-xs text-gray-500">Threshold: {ocThreshold}%</span>
                          </div>
                          <div className="relative h-40 bg-gray-50 rounded border">
                            {/* Threshold line */}
                            <div
                              className="absolute left-0 right-0 border-t-2 border-dashed border-red-400"
                              style={{ bottom: `${((ocThreshold - 90) / (maxOC - 90)) * 100}%` }}
                            />
                            {/* Breach zone */}
                            <div
                              className="absolute left-0 right-0 bottom-0 bg-red-100/50"
                              style={{ height: `${((ocThreshold - 90) / (maxOC - 90)) * 100}%` }}
                            />
                            {/* OC line */}
                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                              <polyline
                                fill="none"
                                stroke="#1E3A5F"
                                strokeWidth="2"
                                points={sampledFlows.map((cf, i) => {
                                  const x = (i / (sampledFlows.length - 1)) * 100;
                                  const y = 100 - ((cf.ocPercent - 90) / (maxOC - 90)) * 100;
                                  return `${x}%,${y}%`;
                                }).join(' ')}
                              />
                              {/* Breach markers */}
                              {sampledFlows.map((cf, i) => {
                                if (cf.triggerStatus === 'Fail' && cf.ocPercent < ocThreshold) {
                                  const x = (i / (sampledFlows.length - 1)) * 100;
                                  const y = 100 - ((cf.ocPercent - 90) / (maxOC - 90)) * 100;
                                  return (
                                    <circle
                                      key={i}
                                      cx={`${x}%`}
                                      cy={`${y}%`}
                                      r="4"
                                      fill="#DC2626"
                                    />
                                  );
                                }
                                return null;
                              })}
                            </svg>
                            {/* Y-axis labels */}
                            <div className="absolute -left-1 top-0 text-xs text-gray-400">{maxOC.toFixed(0)}%</div>
                            <div className="absolute -left-1 bottom-0 text-xs text-gray-400">90%</div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>M1</span>
                            <span>M{waterfallResults.cashFlows.length}</span>
                          </div>
                        </div>

                        {/* CNL Chart */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">Cumulative Net Loss</span>
                            <span className="text-xs text-gray-500">
                              {cnlTrigger ? `Threshold: ${cnlThreshold}%` : 'No CNL trigger'}
                            </span>
                          </div>
                          <div className="relative h-40 bg-gray-50 rounded border">
                            {/* Threshold line (if exists) */}
                            {cnlTrigger && (
                              <>
                                <div
                                  className="absolute left-0 right-0 border-t-2 border-dashed border-red-400"
                                  style={{ bottom: `${100 - (cnlThreshold / maxCNL) * 100}%` }}
                                />
                                {/* Breach zone */}
                                <div
                                  className="absolute left-0 right-0 top-0 bg-red-100/50"
                                  style={{ height: `${(cnlThreshold / maxCNL) * 100}%` }}
                                />
                              </>
                            )}
                            {/* CNL line */}
                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                              <polyline
                                fill="none"
                                stroke="#E65100"
                                strokeWidth="2"
                                points={sampledFlows.map((cf, i) => {
                                  const x = (i / (sampledFlows.length - 1)) * 100;
                                  const y = 100 - (cf.cnlPercent / maxCNL) * 100;
                                  return `${x}%,${y}%`;
                                }).join(' ')}
                              />
                              {/* Breach markers */}
                              {cnlTrigger && sampledFlows.map((cf, i) => {
                                if (cf.cnlPercent > cnlThreshold) {
                                  const x = (i / (sampledFlows.length - 1)) * 100;
                                  const y = 100 - (cf.cnlPercent / maxCNL) * 100;
                                  return (
                                    <circle
                                      key={i}
                                      cx={`${x}%`}
                                      cy={`${y}%`}
                                      r="4"
                                      fill="#DC2626"
                                    />
                                  );
                                }
                                return null;
                              })}
                            </svg>
                            {/* Y-axis labels */}
                            <div className="absolute -left-1 top-0 text-xs text-gray-400">{maxCNL.toFixed(0)}%</div>
                            <div className="absolute -left-1 bottom-0 text-xs text-gray-400">0%</div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>M1</span>
                            <span>M{waterfallResults.cashFlows.length}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Legend */}
                  <div className="flex gap-4 mt-4 pt-4 border-t text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-[#1E3A5F]" />
                      <span className="text-gray-600">OC Ratio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-0.5 bg-[#E65100]" />
                      <span className="text-gray-600">CNL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600" />
                      <span className="text-gray-600">Breach</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-3 bg-red-100 border border-red-200" />
                      <span className="text-gray-600">Breach Zone</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tranche Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tranche Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tranche</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead className="text-right">Original</TableHead>
                        <TableHead className="text-right">Final</TableHead>
                        <TableHead className="text-right" title="Interest paid (senior-first, capped by available)">Interest</TableHead>
                        <TableHead className="text-right" title="Cumulative interest shortfall (unpaid coupons)">Int. S/F</TableHead>
                        <TableHead className="text-right" title="Principal received (pro-rata or sequential)">Principal</TableHead>
                        <TableHead className="text-right" title="Principal not recovered">Prin. Loss</TableHead>
                        <TableHead className="text-right" title="(Principal + Interest) / Original Balance. Fees excluded.">MOIC</TableHead>
                        <TableHead className="text-right bg-[#1E3A5F]/10 font-bold" title="Cash-flow IRR: annualized return based on modeled cash flows (at par).">CF IRR</TableHead>
                        <TableHead className="text-right" title="Approximate WAL from modeled principal timing.">WAL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterfallResults.trancheSummary.map((ts) => (
                        <TableRow key={ts.name}>
                          <TableCell className="font-medium">{ts.name}</TableCell>
                          <TableCell>
                            <Badge className={getRatingColorClass(ts.rating)}>{ts.rating}</Badge>
                          </TableCell>
                          <TableCell className="text-right">${ts.originalBalance.toFixed(1)}M</TableCell>
                          <TableCell className="text-right">${ts.finalBalance.toFixed(1)}M</TableCell>
                          <TableCell className="text-right">${ts.totalInterest.toFixed(1)}M</TableCell>
                          <TableCell
                            className={`text-right ${ts.interestShortfall > 0.01 ? 'text-amber-600' : ''}`}
                            title="Cumulative interest shortfall (unpaid coupons)"
                          >
                            {ts.interestShortfall > 0.01 ? `$${ts.interestShortfall.toFixed(1)}M` : '—'}
                          </TableCell>
                          <TableCell className="text-right">${ts.totalPrincipal.toFixed(1)}M</TableCell>
                          <TableCell
                            className={`text-right ${ts.principalLoss > 0 ? 'text-red-600' : ''}`}
                          >
                            ${ts.principalLoss.toFixed(1)}M
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              ts.moic >= 1 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {ts.moic.toFixed(2)}x
                          </TableCell>
                          <TableCell className="text-right bg-[#1E3A5F]/5 font-bold text-[#1E3A5F]">
                            {ts.irr == null ? '--' : `${(ts.irr * 100).toFixed(1)}%`}
                          </TableCell>
                          <TableCell className="text-right">{ts.wal.toFixed(1)}yr</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Loss Allocation by Tranche */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    Loss Allocation by Tranche
                    <Tip text="Reverse waterfall: losses hit junior tranches first before reaching seniors." />
                  </CardTitle>
                  <CardDescription>
                    Visual breakdown of how losses cascade through the capital structure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const totalLoss = waterfallResults.trancheSummary.reduce((sum, ts) => sum + ts.principalLoss, 0);
                    const totalOriginal = waterfallResults.trancheSummary.reduce((sum, ts) => sum + ts.originalBalance, 0);
                    const lossPercent = (totalLoss / totalOriginal) * 100;

                    // Calculate loss allocation (losses hit junior tranches first)
                    const reversedTranches = [...waterfallResults.trancheSummary].reverse();

                    return (
                      <div className="space-y-4">
                        {/* Total Loss Summary */}
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <span className="text-sm text-gray-600">Total Principal Loss</span>
                            <p className="text-lg font-bold text-red-600">${totalLoss.toFixed(1)}M</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-gray-600">% of Deal</span>
                            <p className="text-lg font-bold text-red-600">{lossPercent.toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* Stacked Bar Visualization */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Loss Allocation (Junior to Senior)</span>
                            <span>Total: ${totalOriginal.toFixed(0)}M</span>
                          </div>

                          {/* Full stack bar */}
                          <div className="relative h-12 rounded overflow-hidden flex">
                            {reversedTranches.map((ts, idx) => {
                              const widthPercent = (ts.originalBalance / totalOriginal) * 100;
                              const lossInTranche = ts.principalLoss;
                              const lossRatio = lossInTranche / ts.originalBalance;

                              return (
                                <div
                                  key={ts.name}
                                  className="relative h-full border-r border-white/20 last:border-r-0"
                                  style={{ width: `${widthPercent}%` }}
                                  title={`${ts.name}: $${ts.originalBalance}M original, $${lossInTranche.toFixed(1)}M loss`}
                                >
                                  {/* Full tranche background */}
                                  <div className={`absolute inset-0 ${getRatingColorClass(ts.rating)} opacity-30`} />
                                  {/* Remaining (not lost) portion */}
                                  <div
                                    className={`absolute inset-0 ${getRatingColorClass(ts.rating)}`}
                                    style={{ width: `${(1 - lossRatio) * 100}%` }}
                                  />
                                  {/* Loss portion */}
                                  {lossInTranche > 0 && (
                                    <div
                                      className="absolute top-0 bottom-0 right-0 bg-red-500"
                                      style={{ width: `${lossRatio * 100}%` }}
                                    />
                                  )}
                                  {/* Label */}
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-medium text-white drop-shadow truncate px-1">
                                      {ts.name}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Detailed Breakdown */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-2">
                          {reversedTranches.map((ts) => {
                            const lossRatio = ts.originalBalance > 0 ? (ts.principalLoss / ts.originalBalance) * 100 : 0;
                            return (
                              <div
                                key={ts.name}
                                className={`p-2 rounded border ${
                                  lossRatio > 50
                                    ? 'bg-red-50 border-red-200'
                                    : lossRatio > 0
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-green-50 border-green-200'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium">{ts.name}</span>
                                  <Badge variant="outline" className="text-xs h-4">
                                    {ts.rating}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-600">
                                  Loss: ${ts.principalLoss.toFixed(1)}M
                                </div>
                                <div
                                  className={`text-sm font-bold ${
                                    lossRatio > 50 ? 'text-red-600' : lossRatio > 0 ? 'text-amber-600' : 'text-green-600'
                                  }`}
                                >
                                  {lossRatio.toFixed(0)}%
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="flex gap-4 pt-2 border-t text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
                            <span className="text-gray-600">No Loss</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded" />
                            <span className="text-gray-600">Partial Loss</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
                            <span className="text-gray-600">&gt;50% Loss</span>
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
                            {cf.turboPayment > 0 ? `$${cf.turboPayment.toFixed(2)}M` : '—'}
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
