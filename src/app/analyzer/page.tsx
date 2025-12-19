'use client';

import { useState, useMemo } from 'react';
import { Info, AlertTriangle, BarChart3 } from 'lucide-react';
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

interface Tranche {
  name: string;
  rating: string;
  size: number;
  spread: number;
  subordination: number;
}

// =============================================================================
// CAPITAL STRUCTURE TEMPLATES BY ASSET CLASS
// =============================================================================

interface AssetClassStructure {
  name: string;
  description: string;
  collateral: string;
  typicalWAL: string;
  tranches: Tranche[];
  keyRisks: string[];
  typicalSpreads: { rating: string; spread: string }[];
}

const ASSET_CLASS_STRUCTURES: Record<string, AssetClassStructure> = {
  'subprime-auto': {
    name: 'Subprime Auto ABS',
    description: 'Loans to borrowers with lower credit scores (typically <660 FICO)',
    collateral: 'Subprime auto loans',
    typicalWAL: '1.5-2.5 years',
    tranches: [
      { name: 'Class A', rating: 'AAA', size: 150, spread: 95, subordination: 42.5 },
      { name: 'Class B', rating: 'AA', size: 35, spread: 145, subordination: 29.0 },
      { name: 'Class C', rating: 'A', size: 25, spread: 195, subordination: 19.4 },
      { name: 'Class D', rating: 'BBB', size: 20, spread: 295, subordination: 11.7 },
      { name: 'Class E', rating: 'BB', size: 15, spread: 550, subordination: 5.9 },
      { name: 'Residual', rating: 'NR', size: 15, spread: 0, subordination: 0 },
    ],
    keyRisks: ['Higher default rates', 'Depreciation risk', 'Economic sensitivity'],
    typicalSpreads: [
      { rating: 'AAA', spread: '85-110 bps' },
      { rating: 'BBB', spread: '275-325 bps' },
    ],
  },
  'prime-auto': {
    name: 'Prime Auto ABS',
    description: 'Loans to borrowers with strong credit (typically >720 FICO)',
    collateral: 'Prime auto loans',
    typicalWAL: '1.0-1.8 years',
    tranches: [
      { name: 'Class A-1', rating: 'AAA', size: 200, spread: 25, subordination: 10.5 },
      { name: 'Class A-2', rating: 'AAA', size: 180, spread: 45, subordination: 10.5 },
      { name: 'Class A-3', rating: 'AAA', size: 120, spread: 55, subordination: 10.5 },
      { name: 'Class B', rating: 'AA', size: 25, spread: 75, subordination: 5.5 },
      { name: 'Class C', rating: 'A', size: 15, spread: 95, subordination: 2.5 },
      { name: 'Class D', rating: 'BBB', size: 10, spread: 135, subordination: 0.5 },
    ],
    keyRisks: ['Lower yields', 'Prepayment risk', 'Spread compression'],
    typicalSpreads: [
      { rating: 'AAA', spread: '40-60 bps' },
      { rating: 'BBB', spread: '120-160 bps' },
    ],
  },
  'clo': {
    name: 'CLO (Collateralized Loan Obligation)',
    description: 'Pool of leveraged loans to corporate borrowers',
    collateral: 'Senior secured leveraged loans',
    typicalWAL: '4-6 years',
    tranches: [
      { name: 'Class A', rating: 'AAA', size: 310, spread: 135, subordination: 38.0 },
      { name: 'Class B', rating: 'AA', size: 50, spread: 185, subordination: 28.0 },
      { name: 'Class C', rating: 'A', size: 30, spread: 245, subordination: 22.0 },
      { name: 'Class D', rating: 'BBB', size: 30, spread: 375, subordination: 16.0 },
      { name: 'Class E', rating: 'BB', size: 25, spread: 650, subordination: 11.0 },
      { name: 'Equity', rating: 'NR', size: 55, spread: 0, subordination: 0 },
    ],
    keyRisks: ['Corporate credit risk', 'Reinvestment risk', 'Manager selection'],
    typicalSpreads: [
      { rating: 'AAA', spread: '125-150 bps' },
      { rating: 'BBB', spread: '350-425 bps' },
    ],
  },
  'consumer': {
    name: 'Consumer ABS',
    description: 'Unsecured consumer loans (personal loans, credit cards)',
    collateral: 'Unsecured consumer debt',
    typicalWAL: '1.5-3.0 years',
    tranches: [
      { name: 'Class A', rating: 'AAA', size: 175, spread: 85, subordination: 30.0 },
      { name: 'Class B', rating: 'AA', size: 30, spread: 135, subordination: 18.0 },
      { name: 'Class C', rating: 'A', size: 25, spread: 185, subordination: 8.0 },
      { name: 'Class D', rating: 'BBB', size: 20, spread: 285, subordination: 0 },
    ],
    keyRisks: ['No collateral recovery', 'Regulatory changes', 'Consumer behavior'],
    typicalSpreads: [
      { rating: 'AAA', spread: '75-100 bps' },
      { rating: 'BBB', spread: '250-325 bps' },
    ],
  },
  'equipment': {
    name: 'Equipment ABS',
    description: 'Loans/leases for business equipment',
    collateral: 'Commercial equipment',
    typicalWAL: '2.5-4.0 years',
    tranches: [
      { name: 'Class A-1', rating: 'AAA', size: 150, spread: 55, subordination: 15.0 },
      { name: 'Class A-2', rating: 'AAA', size: 100, spread: 70, subordination: 15.0 },
      { name: 'Class B', rating: 'AA', size: 25, spread: 105, subordination: 6.5 },
      { name: 'Class C', rating: 'A', size: 15, spread: 145, subordination: 1.5 },
    ],
    keyRisks: ['Residual value risk', 'Obligor concentration', 'Equipment obsolescence'],
    typicalSpreads: [
      { rating: 'AAA', spread: '50-80 bps' },
      { rating: 'A', spread: '130-170 bps' },
    ],
  },
};

interface ScenarioResult {
  tranche: string;
  moic: number;
  wal: number;
  yield: number;
  principalLoss: number;
  status: 'safe' | 'impaired' | 'loss';
}

const SAMPLE_TRANCHES: Tranche[] = [
  { name: 'Class A', rating: 'AAA', size: 150, spread: 95, subordination: 42.5 },
  { name: 'Class B', rating: 'AA', size: 35, spread: 145, subordination: 29.0 },
  { name: 'Class C', rating: 'A', size: 25, spread: 195, subordination: 19.4 },
  { name: 'Class D', rating: 'BBB', size: 20, spread: 295, subordination: 11.7 },
  { name: 'Class E', rating: 'BB', size: 15, spread: 550, subordination: 5.9 },
  { name: 'Residual', rating: 'NR', size: 15, spread: 0, subordination: 0 },
];

function calculateScenarioResults(
  cpr: number,
  cdr: number,
  severity: number,
  tranches: Tranche[]
): ScenarioResult[] {
  const totalLoss = (cdr / 100) * (severity / 100) * 100;

  return tranches.map((tranche) => {
    const lossAbsorbed = Math.max(0, totalLoss - tranche.subordination);
    const trancheLoss = Math.min(lossAbsorbed, (tranche.size / 260) * 100);
    const principalLoss = trancheLoss * (260 / tranche.size);

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

    const baseWal = tranche.name === 'Residual' ? 4.5 : 2.0 + (1 - tranche.subordination / 50) * 2;
    const wal = baseWal * (1 - cpr / 100 * 0.3);

    const yieldVal = tranche.spread > 0 ? 5.0 + tranche.spread / 100 : 12.0;

    return {
      tranche: tranche.name,
      moic: Math.max(0, moic),
      wal: Math.max(0.5, wal),
      yield: principalLoss > 0 ? yieldVal * (1 - principalLoss / 200) : yieldVal,
      principalLoss: Math.max(0, principalLoss),
      status,
    };
  });
}

export default function DealAnalyzerPage() {
  const [cpr, setCpr] = useState(15);
  const [cdr, setCdr] = useState(5);
  const [severity, setSeverity] = useState(50);
  const [dealType, setDealType] = useState('subprime-auto');
  const [compareStructures, setCompareStructures] = useState<string[]>(['subprime-auto', 'clo']);

  const currentStructure = ASSET_CLASS_STRUCTURES[dealType];

  const results = useMemo(() => {
    return calculateScenarioResults(cpr, cdr, severity, currentStructure?.tranches || SAMPLE_TRANCHES);
  }, [cpr, cdr, severity, currentStructure]);

  const totalLoss = (cdr / 100) * (severity / 100) * 100;
  const ocRatio = 100 / (100 - totalLoss) * 100;
  const ocBreached = ocRatio < 105;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return 'bg-green-100 text-green-800';
      case 'impaired': return 'bg-yellow-100 text-yellow-800';
      case 'loss': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingColor = (rating: string) => {
    if (rating === 'AAA' || rating === 'Aaa') return 'bg-[#1E3A5F] text-white';
    if (rating === 'AA' || rating === 'Aa') return 'bg-[#2E5A8F] text-white';
    if (rating === 'A') return 'bg-[#4A7AB0] text-white';
    if (rating === 'BBB' || rating === 'Baa') return 'bg-orange-500 text-white';
    if (rating === 'BB' || rating === 'Ba') return 'bg-orange-600 text-white';
    if (rating === 'B') return 'bg-red-600 text-white';
    return 'bg-gray-400 text-white';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Deal Analyzer</h1>
        <p className="text-gray-600">Compare capital structures and stress test ABS deals</p>
      </div>

      <Tabs defaultValue="compare" className="space-y-6">
        <TabsList>
          <TabsTrigger value="compare" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Compare Structures
          </TabsTrigger>
          <TabsTrigger value="scenario" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Scenario Analysis
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* COMPARE STRUCTURES TAB */}
        {/* ================================================================ */}
        <TabsContent value="compare" className="space-y-6">
          {/* Structure Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Asset Classes to Compare</CardTitle>
              <CardDescription>Choose 2-3 structures to see side-by-side comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ASSET_CLASS_STRUCTURES).map(([key, structure]) => (
                  <Button
                    key={key}
                    variant={compareStructures.includes(key) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (compareStructures.includes(key)) {
                        if (compareStructures.length > 1) {
                          setCompareStructures(compareStructures.filter(s => s !== key));
                        }
                      } else if (compareStructures.length < 3) {
                        setCompareStructures([...compareStructures, key]);
                      }
                    }}
                    className={compareStructures.includes(key) ? 'bg-[#1E3A5F]' : ''}
                  >
                    {structure.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Side-by-Side Comparison */}
          <div className={`grid gap-6 ${compareStructures.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
            {compareStructures.map((structureKey) => {
              const structure = ASSET_CLASS_STRUCTURES[structureKey];
              const totalSize = structure.tranches.reduce((sum, t) => sum + t.size, 0);
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
                        const heightPercent = (tranche.size / totalSize) * 100;
                        return (
                          <div
                            key={tranche.name}
                            className="relative rounded overflow-hidden"
                            style={{ height: `${Math.max(24, heightPercent * 1.5)}px` }}
                          >
                            <div className={`absolute inset-0 ${getRatingColor(tranche.rating)} opacity-90`} />
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
                        <p className="font-medium">{structure.collateral}</p>
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
                          <li key={i} className="text-gray-700">• {risk}</li>
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
                          {ASSET_CLASS_STRUCTURES[key].name.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">AAA Subordination</td>
                      {compareStructures.map((key) => (
                        <td key={key} className="text-center py-2 font-medium">
                          {ASSET_CLASS_STRUCTURES[key].tranches[0]?.subordination || 0}%
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">AAA Spread</td>
                      {compareStructures.map((key) => (
                        <td key={key} className="text-center py-2 font-medium">
                          +{ASSET_CLASS_STRUCTURES[key].tranches[0]?.spread || 0}bps
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600">Typical WAL</td>
                      {compareStructures.map((key) => (
                        <td key={key} className="text-center py-2 font-medium">
                          {ASSET_CLASS_STRUCTURES[key].typicalWAL}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 text-gray-600"># of Tranches</td>
                      {compareStructures.map((key) => (
                        <td key={key} className="text-center py-2 font-medium">
                          {ASSET_CLASS_STRUCTURES[key].tranches.length}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-600">Equity/Residual %</td>
                      {compareStructures.map((key) => {
                        const structure = ASSET_CLASS_STRUCTURES[key];
                        const totalSize = structure.tranches.reduce((sum, t) => sum + t.size, 0);
                        const equity = structure.tranches.find(t => t.rating === 'NR');
                        const pct = equity ? ((equity.size / totalSize) * 100).toFixed(1) : '0';
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
        {/* SCENARIO ANALYSIS TAB */}
        {/* ================================================================ */}
        <TabsContent value="scenario" className="space-y-6">
          {/* Info Banner */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">Educational Tool</p>
                  <p className="text-sm text-blue-700">
                    Adjust the scenario sliders to see how different default and prepayment assumptions
                    impact each tranche. Higher subordination = more protection.
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
            {/* Deal Type */}
            <div className="space-y-2">
              <Label>Deal Type</Label>
              <Select value={dealType} onValueChange={setDealType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subprime-auto">Subprime Auto ABS</SelectItem>
                  <SelectItem value="prime-auto">Prime Auto ABS</SelectItem>
                  <SelectItem value="clo">CLO</SelectItem>
                  <SelectItem value="consumer">Consumer ABS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CPR Slider */}
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
                className="w-full"
              />
              <p className="text-xs text-gray-500">Constant Prepayment Rate (annualized)</p>
            </div>

            {/* CDR Slider */}
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
                className="w-full"
              />
              <p className="text-xs text-gray-500">Constant Default Rate (annualized)</p>
            </div>

            {/* Severity Slider */}
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
                className="w-full"
              />
              <p className="text-xs text-gray-500">Loss given default</p>
            </div>

            {/* Quick Scenarios */}
            <div className="pt-4 border-t space-y-2">
              <Label className="text-xs text-gray-500">Quick Scenarios</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => { setCpr(15); setCdr(3); setSeverity(45); }}>
                  Base Case
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCpr(10); setCdr(8); setSeverity(55); }}>
                  Stress
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCpr(5); setCdr(15); setSeverity(65); }}>
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
              {results.map((result) => {
                const tranche = (currentStructure?.tranches || SAMPLE_TRANCHES).find(t => t.name === result.tranche)!;
                return (
                  <div key={result.tranche} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[#1E3A5F]">{result.tranche}</span>
                        <Badge variant="outline">{tranche.rating}</Badge>
                        <Badge className={getStatusColor(result.status)}>
                          {result.status === 'safe' ? 'Protected' : result.status === 'impaired' ? 'At Risk' : 'Loss'}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        ${tranche.size}M | {tranche.subordination.toFixed(1)}% subordination
                      </span>
                    </div>

                    {/* Progress bar showing subordination */}
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
                        {totalLoss > 0 && (
                          <div
                            className="h-2 bg-red-300 rounded-full -mt-2"
                            style={{ width: `${Math.min(100, (totalLoss / 50) * 100)}%` }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-500">MOIC</p>
                        <p className={`font-semibold ${result.moic >= 1 ? 'text-green-600' : 'text-red-600'}`}>
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
                        <p className={`font-semibold ${result.principalLoss > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Understanding the Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold text-[#1E3A5F] mb-2">Subordination</h4>
                  <p className="text-sm text-gray-600">
                    The percentage of the deal below a tranche that absorbs losses first.
                    Higher subordination = more protection for that tranche.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A5F] mb-2">OC Test</h4>
                  <p className="text-sm text-gray-600">
                    Overcollateralization test compares collateral value to note balance.
                    If breached, cash is redirected to pay down senior notes faster.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1E3A5F] mb-2">Sequential Pay</h4>
                  <p className="text-sm text-gray-600">
                    When triggers are breached, deals switch from pro-rata to sequential pay,
                    prioritizing senior tranches until credit enhancement is restored.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="border-t pt-4 mt-6">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Sample Deal Structure (Illustrative Only)</span>
          <span className="font-medium text-[#1E3A5F]">Bain Capital Credit | For Consideration by Brett Wilzbach</span>
        </div>
      </div>
    </div>
  );
}
