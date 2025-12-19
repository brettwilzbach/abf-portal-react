'use client';

import { useState, useMemo } from 'react';
import { Info, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const results = useMemo(() => {
    return calculateScenarioResults(cpr, cdr, severity, SAMPLE_TRANCHES);
  }, [cpr, cdr, severity]);

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Deal Analyzer</h1>
        <p className="text-gray-600">Interactive tool to understand how ABS structures protect investors</p>
      </div>

      {/* Info Banner */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
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
                const tranche = SAMPLE_TRANCHES.find(t => t.name === result.tranche)!;
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
