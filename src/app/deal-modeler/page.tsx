'use client';

import { useState, useMemo } from 'react';
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
import type {
  DealTemplate,
  CashFlowResult,
  TrancheSummary,
  WaterfallOutput,
  ScenarioResult,
} from '@/types/waterfall';

// =============================================================================
// WATERFALL CALCULATION ENGINE (with ARD trigger)
// =============================================================================

function calculateWaterfall(
  template: DealTemplate,
  cpr: number,
  cdr: number,
  recovery: number,
  months: number
): WaterfallOutput {
  const cashFlows: CashFlowResult[] = [];
  let collateralBalance = template.collateralBalance;
  let cumulativeLoss = 0;
  const monthlyPaymentRate = 1 / template.wam;

  // Find ARD trigger
  const ardTrigger = template.triggers.find((t) => t.type === 'ARD');
  const ardMonth = ardTrigger?.threshold || Infinity;
  let ardTriggered = false;
  let ardActivationMonth: number | null = null;

  // Track tranche balances for turbo payments
  const trancheBalances = template.tranches.map((t) => t.balance);

  for (let period = 1; period <= months && collateralBalance > 0.1; period++) {
    const startBalance = collateralBalance;
    const scheduledPrincipal = startBalance * monthlyPaymentRate;
    const prepayments = startBalance * (cpr / 100 / 12);
    const defaults = startBalance * (cdr / 100 / 12);
    const recoveries = defaults * (recovery / 100);
    const losses = defaults - recoveries;
    const interestIncome = startBalance * (template.wac / 100 / 12);

    // Calculate excess spread (simplified: interest income - note coupons)
    const totalNoteCoupons = template.tranches.reduce((sum, t, idx) => {
      if (trancheBalances[idx] > 0 && t.spread > 0) {
        return sum + trancheBalances[idx] * ((5 + t.spread / 100) / 100 / 12);
      }
      return sum;
    }, 0);
    const excessSpread = Math.max(0, interestIncome - totalNoteCoupons);

    cumulativeLoss += losses;
    collateralBalance = startBalance - scheduledPrincipal - prepayments - defaults;

    const cnlPercent = (cumulativeLoss / template.collateralBalance) * 100;
    const totalNotes = trancheBalances.reduce((sum, b) => sum + b, 0);
    const ocPercent = totalNotes > 0 ? (collateralBalance / totalNotes) * 100 : 100;

    // Check ARD trigger: if post-ARD and deal balance > 0
    const isPostARD = period > ardMonth && collateralBalance > 0.1;
    if (isPostARD && !ardTriggered) {
      ardTriggered = true;
      ardActivationMonth = period;
    }

    // Calculate turbo payment if post-ARD
    let turboPayment = 0;
    if (isPostARD) {
      // Junior tranches excess spread is cut off and turboed to seniors
      turboPayment = excessSpread;

      // Apply turbo to most senior outstanding tranche
      for (let i = 0; i < trancheBalances.length; i++) {
        if (trancheBalances[i] > 0 && template.tranches[i].rating !== 'NR') {
          const paydown = Math.min(turboPayment, trancheBalances[i]);
          trancheBalances[i] -= paydown;
          turboPayment -= paydown;
          if (turboPayment <= 0) break;
        }
      }
    }

    // Check other triggers
    const ocTrigger = template.triggers.find((t) => t.type === 'OC');
    const cnlTrigger = template.triggers.find((t) => t.type === 'CNL');
    const triggerStatus =
      (ocTrigger && ocPercent < ocTrigger.threshold) ||
      (cnlTrigger && cnlPercent > cnlTrigger.threshold)
        ? 'Fail'
        : 'Pass';

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
      turboPayment: isPostARD ? excessSpread : 0,
    });
  }

  // Calculate tranche summaries
  const totalLoss = cumulativeLoss;
  let remainingLoss = totalLoss;
  const trancheSummary: TrancheSummary[] = template.tranches.map((tranche, idx) => {
    const subordination = template.tranches.slice(idx + 1).reduce((sum, t) => sum + t.balance, 0);
    const trancheLoss = Math.max(0, Math.min(remainingLoss - subordination, tranche.balance));
    remainingLoss = Math.max(0, remainingLoss - trancheLoss);

    const avgLife = months * (0.3 + idx * 0.15) / 12;
    const totalInterest = tranche.balance * ((5 + tranche.spread / 100) / 100) * avgLife;
    const totalPrincipal = tranche.balance - trancheLoss;
    const moic = (totalPrincipal + totalInterest) / tranche.balance;

    return {
      name: tranche.name,
      rating: tranche.rating,
      originalBalance: tranche.balance,
      finalBalance: Math.max(0, tranche.balance - trancheLoss),
      totalInterest,
      totalPrincipal,
      principalLoss: trancheLoss,
      moic: Math.max(0, moic),
      wal: avgLife,
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
  template: DealTemplate
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
    const yieldVal = tranche.spread > 0 ? 5.0 + tranche.spread / 100 : 12.0;

    return {
      tranche: tranche.name,
      rating: tranche.rating,
      subordination: tranche.subordination,
      moic: Math.max(0, moic),
      wal: Math.max(0.5, wal),
      yield: principalLoss > 0 ? yieldVal * (1 - principalLoss / 200) : yieldVal,
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
  const [recovery, setRecovery] = useState(45);
  const [severity, setSeverity] = useState(55);
  const [months, setMonths] = useState(60);
  const [hasRun, setHasRun] = useState(false);
  const [compareStructures, setCompareStructures] = useState<string[]>(['auto-abs', 'clo']);

  const template = DEAL_TEMPLATES[selectedTemplate];

  // Full waterfall calculation
  const waterfallResults = useMemo(() => {
    if (!hasRun) return null;
    return calculateWaterfall(template, cpr, cdr, recovery, months);
  }, [template, cpr, cdr, recovery, months, hasRun]);

  // Quick scenario results (for scenario tab)
  const scenarioResults = useMemo(() => {
    return calculateScenarioResults(cpr, cdr, severity, template);
  }, [cpr, cdr, severity, template]);

  const totalLoss = (cdr / 100) * (severity / 100) * 100;
  const ocRatio = 100 / (100 - totalLoss) * 100;
  const ocBreached = ocRatio < 105;

  const handleRun = () => setHasRun(true);
  const handleReset = () => {
    setHasRun(false);
    setCpr(15);
    setCdr(5);
    setRecovery(45);
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

                    {/* ARD Info */}
                    {ardTrigger && (
                      <div className="text-xs pt-2 border-t">
                        <div className="flex items-center gap-1 text-amber-600">
                          <Clock className="h-3 w-3" />
                          <span className="font-medium">ARD: Month {ardTrigger.threshold}</span>
                        </div>
                        <p className="text-gray-500 mt-1">{ardTrigger.consequence}</p>
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
                            • {risk}
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
                      <td className="py-2 text-gray-600">ARD Month</td>
                      {compareStructures.map((key) => {
                        const ard = DEAL_TEMPLATES[key].triggers.find((t) => t.type === 'ARD');
                        return (
                          <td key={key} className="text-center py-2 font-medium">
                            {ard ? `Month ${ard.threshold}` : '—'}
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
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">Educational Tool</p>
                  <p className="text-sm text-blue-700">
                    Adjust the scenario sliders to see how different default and prepayment
                    assumptions impact each tranche. Higher subordination = more protection.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                    <Label>CPR (Prepayment Rate)</Label>
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
                    <Label>CDR (Default Rate)</Label>
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
                    <Label>Loss Severity</Label>
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
                  <Label className="text-xs text-gray-500">Quick Scenarios</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCpr(15);
                        setCdr(3);
                        setSeverity(45);
                      }}
                    >
                      Base Case
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCpr(10);
                        setCdr(8);
                        setSeverity(55);
                      }}
                    >
                      Stress
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCpr(5);
                        setCdr(15);
                        setSeverity(65);
                      }}
                    >
                      Severe
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Tranche Performance</CardTitle>
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

                        {/* Progress bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Credit Enhancement</span>
                            <span>{tranche.subordination.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                totalLoss > tranche.subordination ? 'bg-red-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, (tranche.subordination / 50) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-4 gap-4 text-center">
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
                            <p className="text-xs text-gray-500">Yield</p>
                            <p className="font-semibold text-[#1E3A5F]">{result.yield.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Principal Loss</p>
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
                <CardDescription>Select a pre-built deal structure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="space-y-2 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Collateral</span>
                    <span className="font-medium">${template.collateralBalance}M</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">WAC</span>
                    <span className="font-medium">{template.wac}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">WAM</span>
                    <span className="font-medium">{template.wam} months</span>
                  </div>
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
                    <Label>CPR</Label>
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
                    <Label>CDR</Label>
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
                    <Label>Recovery Rate</Label>
                    <span className="text-sm font-mono">{recovery}%</span>
                  </div>
                  <Input
                    type="range"
                    min="0"
                    max="100"
                    value={recovery}
                    onChange={(e) => setRecovery(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Projection (Months)</Label>
                  <Input
                    type="number"
                    value={months}
                    onChange={(e) => setMonths(Number(e.target.value))}
                    min={12}
                    max={120}
                  />
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
                  {template.triggers.map((trigger) => (
                    <div key={trigger.name} className="flex items-center gap-2 text-xs py-1">
                      {trigger.type === 'ARD' ? (
                        <Clock className="h-3 w-3 text-amber-500" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-amber-500" />
                      )}
                      <span>
                        {trigger.name}:{' '}
                        {trigger.type === 'ARD' ? `Month ${trigger.threshold}` : `${trigger.threshold}%`}
                      </span>
                    </div>
                  ))}
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Final CNL</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {waterfallResults.finalCNL.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Final OC Ratio</CardTitle>
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
              </div>

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
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Loss</TableHead>
                        <TableHead className="text-right">MOIC</TableHead>
                        <TableHead className="text-right">WAL</TableHead>
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
                          <TableCell className="text-right">{ts.wal.toFixed(1)}yr</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
