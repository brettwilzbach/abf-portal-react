'use client';

import { useState, useMemo } from 'react';
import { Play, RotateCcw, Download, ChevronRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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

interface DealTemplate {
  name: string;
  collateralType: string;
  collateralBalance: number;
  wac: number;
  wam: number;
  tranches: TrancheConfig[];
  triggers: TriggerConfig[];
}

interface TrancheConfig {
  name: string;
  balance: number;
  couponType: 'Fixed' | 'Floating';
  spread: number;
  rating: string;
}

interface TriggerConfig {
  name: string;
  type: 'OC' | 'IC' | 'CNL' | 'DSCR';
  threshold: number;
  consequence: string;
}

interface CashFlowResult {
  period: number;
  collateralStart: number;
  collateralEnd: number;
  scheduledPrincipal: number;
  prepayments: number;
  defaults: number;
  recoveries: number;
  losses: number;
  interestIncome: number;
  cnlPercent: number;
  ocPercent: number;
  triggerStatus: 'Pass' | 'Fail';
}

interface TrancheSummary {
  name: string;
  originalBalance: number;
  finalBalance: number;
  totalInterest: number;
  totalPrincipal: number;
  principalLoss: number;
  moic: number;
  wal: number;
}

const DEAL_TEMPLATES: Record<string, DealTemplate> = {
  'subprime-auto': {
    name: 'Subprime Auto ABS',
    collateralType: 'Auto - Subprime',
    collateralBalance: 260,
    wac: 18.5,
    wam: 60,
    tranches: [
      { name: 'Class A', balance: 150, couponType: 'Floating', spread: 95, rating: 'AAA' },
      { name: 'Class B', balance: 35, couponType: 'Floating', spread: 145, rating: 'AA' },
      { name: 'Class C', balance: 25, couponType: 'Floating', spread: 195, rating: 'A' },
      { name: 'Class D', balance: 20, couponType: 'Floating', spread: 295, rating: 'BBB' },
      { name: 'Class E', balance: 15, couponType: 'Floating', spread: 550, rating: 'BB' },
      { name: 'Residual', balance: 15, couponType: 'Fixed', spread: 0, rating: 'NR' },
    ],
    triggers: [
      { name: 'OC Test', type: 'OC', threshold: 105, consequence: 'Sequential Pay' },
      { name: 'CNL Trigger', type: 'CNL', threshold: 15, consequence: 'Turbo Senior' },
    ],
  },
  'prime-auto': {
    name: 'Prime Auto ABS',
    collateralType: 'Auto - Prime',
    collateralBalance: 500,
    wac: 6.5,
    wam: 48,
    tranches: [
      { name: 'Class A-1', balance: 200, couponType: 'Fixed', spread: 35, rating: 'AAA' },
      { name: 'Class A-2', balance: 200, couponType: 'Floating', spread: 45, rating: 'AAA' },
      { name: 'Class B', balance: 50, couponType: 'Floating', spread: 85, rating: 'AA' },
      { name: 'Class C', balance: 35, couponType: 'Floating', spread: 125, rating: 'A' },
      { name: 'Residual', balance: 15, couponType: 'Fixed', spread: 0, rating: 'NR' },
    ],
    triggers: [
      { name: 'OC Test', type: 'OC', threshold: 102, consequence: 'Sequential Pay' },
    ],
  },
  'clo': {
    name: 'CLO',
    collateralType: 'Broadly Syndicated Loans',
    collateralBalance: 500,
    wac: 9.5,
    wam: 60,
    tranches: [
      { name: 'Class A', balance: 310, couponType: 'Floating', spread: 140, rating: 'AAA' },
      { name: 'Class B', balance: 50, couponType: 'Floating', spread: 185, rating: 'AA' },
      { name: 'Class C', balance: 35, couponType: 'Floating', spread: 240, rating: 'A' },
      { name: 'Class D', balance: 30, couponType: 'Floating', spread: 380, rating: 'BBB' },
      { name: 'Class E', balance: 25, couponType: 'Floating', spread: 750, rating: 'BB' },
      { name: 'Equity', balance: 50, couponType: 'Fixed', spread: 0, rating: 'NR' },
    ],
    triggers: [
      { name: 'OC Test (AAA)', type: 'OC', threshold: 125, consequence: 'Divert to Senior' },
      { name: 'OC Test (BBB)', type: 'OC', threshold: 108, consequence: 'Divert to Senior' },
      { name: 'IC Test', type: 'IC', threshold: 120, consequence: 'Divert to Senior' },
    ],
  },
};

function calculateWaterfall(
  template: DealTemplate,
  cpr: number,
  cdr: number,
  recovery: number,
  months: number
): { cashFlows: CashFlowResult[]; trancheSummary: TrancheSummary[] } {
  const cashFlows: CashFlowResult[] = [];
  let collateralBalance = template.collateralBalance;
  let cumulativeLoss = 0;
  const monthlyPaymentRate = 1 / template.wam;

  for (let period = 1; period <= months && collateralBalance > 0.1; period++) {
    const startBalance = collateralBalance;
    const scheduledPrincipal = startBalance * monthlyPaymentRate;
    const prepayments = startBalance * (cpr / 100 / 12);
    const defaults = startBalance * (cdr / 100 / 12);
    const recoveries = defaults * (recovery / 100);
    const losses = defaults - recoveries;
    const interestIncome = startBalance * (template.wac / 100 / 12);

    cumulativeLoss += losses;
    collateralBalance = startBalance - scheduledPrincipal - prepayments - defaults;

    const cnlPercent = (cumulativeLoss / template.collateralBalance) * 100;
    const totalNotes = template.tranches.reduce((sum, t) => sum + t.balance, 0);
    const ocPercent = (collateralBalance / totalNotes) * 100;

    const ocTrigger = template.triggers.find(t => t.type === 'OC');
    const cnlTrigger = template.triggers.find(t => t.type === 'CNL');
    const triggerStatus = (ocTrigger && ocPercent < ocTrigger.threshold) ||
                          (cnlTrigger && cnlPercent > cnlTrigger.threshold) ? 'Fail' : 'Pass';

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
      cnlPercent,
      ocPercent,
      triggerStatus,
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
    const totalInterest = tranche.balance * (5 + tranche.spread / 100) / 100 * avgLife;
    const totalPrincipal = tranche.balance - trancheLoss;
    const moic = (totalPrincipal + totalInterest) / tranche.balance;

    return {
      name: tranche.name,
      originalBalance: tranche.balance,
      finalBalance: Math.max(0, tranche.balance - trancheLoss),
      totalInterest,
      totalPrincipal,
      principalLoss: trancheLoss,
      moic: Math.max(0, moic),
      wal: avgLife,
    };
  });

  return { cashFlows, trancheSummary };
}

export default function WaterfallModelerPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('subprime-auto');
  const [cpr, setCpr] = useState(15);
  const [cdr, setCdr] = useState(5);
  const [recovery, setRecovery] = useState(45);
  const [months, setMonths] = useState(60);
  const [hasRun, setHasRun] = useState(false);

  const template = DEAL_TEMPLATES[selectedTemplate];

  const results = useMemo(() => {
    if (!hasRun) return null;
    return calculateWaterfall(template, cpr, cdr, recovery, months);
  }, [template, cpr, cdr, recovery, months, hasRun]);

  const handleRun = () => setHasRun(true);
  const handleReset = () => {
    setHasRun(false);
    setCpr(15);
    setCdr(5);
    setRecovery(45);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Waterfall Modeler</h1>
        <p className="text-gray-600">Model cash flow waterfalls, triggers, and run scenario analysis</p>
      </div>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList>
          <TabsTrigger value="setup">Deal Setup</TabsTrigger>
          <TabsTrigger value="results" disabled={!hasRun}>Results</TabsTrigger>
          <TabsTrigger value="cashflows" disabled={!hasRun}>Cash Flows</TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup">
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
                    <SelectItem value="subprime-auto">Subprime Auto ABS</SelectItem>
                    <SelectItem value="prime-auto">Prime Auto ABS</SelectItem>
                    <SelectItem value="clo">CLO</SelectItem>
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
                  <Input type="range" min="0" max="50" value={cpr} onChange={(e) => setCpr(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>CDR</Label>
                    <span className="text-sm font-mono">{cdr}%</span>
                  </div>
                  <Input type="range" min="0" max="30" value={cdr} onChange={(e) => setCdr(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Recovery Rate</Label>
                    <span className="text-sm font-mono">{recovery}%</span>
                  </div>
                  <Input type="range" min="0" max="100" value={recovery} onChange={(e) => setRecovery(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Projection (Months)</Label>
                  <Input type="number" value={months} onChange={(e) => setMonths(Number(e.target.value))} min={12} max={120} />
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
                        <Badge variant="outline" className="w-12 justify-center">{tranche.rating}</Badge>
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
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      <span>{trigger.name}: {trigger.threshold}{trigger.type === 'OC' || trigger.type === 'IC' ? '%' : '%'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <Button onClick={handleRun} className="bg-[#1E3A5F] hover:bg-[#2E5A8F]">
              <Play className="h-4 w-4 mr-2" /> Run Model
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          {results && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Final CNL</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {results.cashFlows[results.cashFlows.length - 1]?.cnlPercent.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Final OC Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {results.cashFlows[results.cashFlows.length - 1]?.ocPercent.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Trigger Breaches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">
                      {results.cashFlows.filter(cf => cf.triggerStatus === 'Fail').length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Periods Modeled</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#1E3A5F]">{results.cashFlows.length}</p>
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
                      {results.trancheSummary.map((ts) => (
                        <TableRow key={ts.name}>
                          <TableCell className="font-medium">{ts.name}</TableCell>
                          <TableCell className="text-right">${ts.originalBalance.toFixed(1)}M</TableCell>
                          <TableCell className="text-right">${ts.finalBalance.toFixed(1)}M</TableCell>
                          <TableCell className="text-right">${ts.totalInterest.toFixed(1)}M</TableCell>
                          <TableCell className="text-right">${ts.totalPrincipal.toFixed(1)}M</TableCell>
                          <TableCell className={`text-right ${ts.principalLoss > 0 ? 'text-red-600' : ''}`}>
                            ${ts.principalLoss.toFixed(1)}M
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${ts.moic >= 1 ? 'text-green-600' : 'text-red-600'}`}>
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

        {/* Cash Flows Tab */}
        <TabsContent value="cashflows">
          {results && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Monthly Cash Flows</CardTitle>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" /> Export
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.cashFlows.map((cf) => (
                        <TableRow key={cf.period}>
                          <TableCell>{cf.period}</TableCell>
                          <TableCell className="text-right">${cf.collateralStart.toFixed(1)}M</TableCell>
                          <TableCell className="text-right">${cf.scheduledPrincipal.toFixed(2)}M</TableCell>
                          <TableCell className="text-right">${cf.prepayments.toFixed(2)}M</TableCell>
                          <TableCell className="text-right">${cf.defaults.toFixed(2)}M</TableCell>
                          <TableCell className="text-right text-red-600">${cf.losses.toFixed(2)}M</TableCell>
                          <TableCell className="text-right">{cf.cnlPercent.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{cf.ocPercent.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge className={cf.triggerStatus === 'Pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {cf.triggerStatus}
                            </Badge>
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

      {/* Footer */}
      <div className="border-t pt-4 mt-6">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Illustrative Model - Not for Investment Decisions</span>
          <span className="font-medium text-[#1E3A5F]">Bain Capital Credit | For Consideration by Brett Wilzbach</span>
        </div>
      </div>
    </div>
  );
}
