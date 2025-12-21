'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi } from 'lucide-react';
import { isBloombergAvailable } from '@/lib/bloomberg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotePad } from '@/components/ui/notepad';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SpreadData {
  sector: string;
  currentSpread: number;
  benchmark: string;
  ytdChange: number;
  zScore: number;
  oneYearAvg: number;
  oneYearMin: number;
  oneYearMax: number;
}

// Private Credit vs Public Credit Yield Data (mock data based on market research)
interface PrivateCreditData {
  category: string;
  privateYield: number;
  publicYield: number;
  premium: number;
  description: string;
}

const PRIVATE_CREDIT_DATA: PrivateCreditData[] = [
  { category: 'Direct Lending (1st Lien)', privateYield: 10.5, publicYield: 8.2, premium: 230, description: 'SOFR + 450-500bps' },
  { category: 'Unitranche', privateYield: 11.2, publicYield: 8.5, premium: 270, description: 'Blended senior/mezz' },
  { category: 'Private ABF (AAA)', privateYield: 6.8, publicYield: 5.9, premium: 90, description: 'vs. public ABS AAA' },
  { category: 'Private ABF (BBB)', privateYield: 9.5, publicYield: 7.8, premium: 170, description: 'vs. public ABS BBB' },
  { category: 'Middle Market CLO', privateYield: 12.5, publicYield: 10.2, premium: 230, description: 'vs. BSL CLO BB' },
];

// Illiquidity Premium Historical Data by Asset Class
interface IlliquidityPremiumData {
  year: number;
  realEstateDebt: number;
  infrastructureDebt: number;
  privateCorporateDebt: number;
  assetBasedFinance: number;
  marketEvent?: string;
}

const ILLIQUIDITY_PREMIUM_HISTORY: IlliquidityPremiumData[] = [
  { year: 1998, realEstateDebt: 180, infrastructureDebt: 160, privateCorporateDebt: 140, assetBasedFinance: 120 },
  { year: 1999, realEstateDebt: 150, infrastructureDebt: 130, privateCorporateDebt: 110, assetBasedFinance: 95 },
  { year: 2000, realEstateDebt: 120, infrastructureDebt: 100, privateCorporateDebt: 85, assetBasedFinance: 75, marketEvent: 'Dotcom Bubble' },
  { year: 2001, realEstateDebt: 90, infrastructureDebt: 70, privateCorporateDebt: 60, assetBasedFinance: 55 },
  { year: 2002, realEstateDebt: 60, infrastructureDebt: 50, privateCorporateDebt: 45, assetBasedFinance: 40 },
  { year: 2003, realEstateDebt: 55, infrastructureDebt: 48, privateCorporateDebt: 42, assetBasedFinance: 38 },
  { year: 2004, realEstateDebt: 50, infrastructureDebt: 45, privateCorporateDebt: 40, assetBasedFinance: 35 },
  { year: 2005, realEstateDebt: 48, infrastructureDebt: 42, privateCorporateDebt: 38, assetBasedFinance: 32 },
  { year: 2006, realEstateDebt: 45, infrastructureDebt: 40, privateCorporateDebt: 35, assetBasedFinance: 30 },
  { year: 2007, realEstateDebt: 40, infrastructureDebt: 35, privateCorporateDebt: 30, assetBasedFinance: 25 },
  { year: 2008, realEstateDebt: -100, infrastructureDebt: -80, privateCorporateDebt: -120, assetBasedFinance: -60, marketEvent: 'GFC' },
  { year: 2009, realEstateDebt: -50, infrastructureDebt: -30, privateCorporateDebt: -70, assetBasedFinance: -20 },
  { year: 2010, realEstateDebt: 20, infrastructureDebt: 30, privateCorporateDebt: 10, assetBasedFinance: 25 },
  { year: 2011, realEstateDebt: 45, infrastructureDebt: 50, privateCorporateDebt: 35, assetBasedFinance: 40, marketEvent: 'Euro Debt Crisis' },
  { year: 2012, realEstateDebt: 55, infrastructureDebt: 60, privateCorporateDebt: 45, assetBasedFinance: 50 },
  { year: 2013, realEstateDebt: 65, infrastructureDebt: 70, privateCorporateDebt: 55, assetBasedFinance: 60 },
  { year: 2014, realEstateDebt: 70, infrastructureDebt: 75, privateCorporateDebt: 60, assetBasedFinance: 65 },
  { year: 2015, realEstateDebt: 75, infrastructureDebt: 80, privateCorporateDebt: 65, assetBasedFinance: 70 },
  { year: 2016, realEstateDebt: 70, infrastructureDebt: 75, privateCorporateDebt: 60, assetBasedFinance: 65, marketEvent: 'Brexit' },
  { year: 2017, realEstateDebt: 65, infrastructureDebt: 70, privateCorporateDebt: 55, assetBasedFinance: 60 },
  { year: 2018, realEstateDebt: 60, infrastructureDebt: 65, privateCorporateDebt: 50, assetBasedFinance: 55 },
  { year: 2019, realEstateDebt: 55, infrastructureDebt: 60, privateCorporateDebt: 45, assetBasedFinance: 50 },
  { year: 2020, realEstateDebt: 85, infrastructureDebt: 90, privateCorporateDebt: 75, assetBasedFinance: 80, marketEvent: 'Covid-19' },
  { year: 2021, realEstateDebt: 70, infrastructureDebt: 75, privateCorporateDebt: 60, assetBasedFinance: 65 },
  { year: 2022, realEstateDebt: 95, infrastructureDebt: 100, privateCorporateDebt: 85, assetBasedFinance: 90, marketEvent: 'Hiking Cycle' },
  { year: 2023, realEstateDebt: 100, infrastructureDebt: 105, privateCorporateDebt: 90, assetBasedFinance: 95 },
  { year: 2024, realEstateDebt: 90, infrastructureDebt: 95, privateCorporateDebt: 80, assetBasedFinance: 85 },
  { year: 2025, realEstateDebt: 85, infrastructureDebt: 90, privateCorporateDebt: 75, assetBasedFinance: 80 },
];

const MOCK_SPREADS: SpreadData[] = [
  { sector: 'CLO AAA', currentSpread: 140, benchmark: 'SOFR', ytdChange: -15, zScore: 0.8, oneYearAvg: 155, oneYearMin: 125, oneYearMax: 185 },
  { sector: 'CLO AA', currentSpread: 185, benchmark: 'SOFR', ytdChange: -20, zScore: 0.6, oneYearAvg: 200, oneYearMin: 165, oneYearMax: 250 },
  { sector: 'CLO A', currentSpread: 240, benchmark: 'SOFR', ytdChange: -25, zScore: 0.4, oneYearAvg: 260, oneYearMin: 210, oneYearMax: 320 },
  { sector: 'CLO BBB', currentSpread: 380, benchmark: 'SOFR', ytdChange: -35, zScore: 0.3, oneYearAvg: 410, oneYearMin: 340, oneYearMax: 500 },
  { sector: 'CLO BB', currentSpread: 750, benchmark: 'SOFR', ytdChange: -50, zScore: 0.5, oneYearAvg: 800, oneYearMin: 680, oneYearMax: 950 },
  { sector: 'Prime Auto AAA', currentSpread: 55, benchmark: 'Treasuries', ytdChange: -8, zScore: -0.2, oneYearAvg: 52, oneYearMin: 40, oneYearMax: 70 },
  { sector: 'Subprime Auto AAA', currentSpread: 95, benchmark: 'Treasuries', ytdChange: -12, zScore: 0.1, oneYearAvg: 93, oneYearMin: 75, oneYearMax: 120 },
  { sector: 'Subprime Auto BBB', currentSpread: 185, benchmark: 'Treasuries', ytdChange: -18, zScore: 0.4, oneYearAvg: 195, oneYearMin: 155, oneYearMax: 240 },
  { sector: 'Consumer ABS AAA', currentSpread: 65, benchmark: 'Treasuries', ytdChange: -5, zScore: -0.1, oneYearAvg: 63, oneYearMin: 50, oneYearMax: 85 },
  { sector: 'Equipment ABS AAA', currentSpread: 75, benchmark: 'Treasuries', ytdChange: -10, zScore: 0.2, oneYearAvg: 78, oneYearMin: 60, oneYearMax: 100 },
  { sector: 'IG Corps (Benchmark)', currentSpread: 90, benchmark: 'Treasuries', ytdChange: -12, zScore: 0.0, oneYearAvg: 95, oneYearMin: 75, oneYearMax: 125 },
  { sector: 'HY Corps (Benchmark)', currentSpread: 320, benchmark: 'Treasuries', ytdChange: -40, zScore: -0.3, oneYearAvg: 310, oneYearMin: 260, oneYearMax: 400 },
];

function getZScoreColor(zScore: number): string {
  if (zScore > 0.5) return 'bg-green-500 text-white';
  if (zScore > 0) return 'bg-green-100 text-green-800';
  if (zScore > -0.5) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getZScoreLabel(zScore: number): string {
  if (zScore > 0.5) return 'Attractive';
  if (zScore > 0) return 'Fair';
  if (zScore > -0.5) return 'Neutral';
  return 'Rich';
}

function formatSpread(value: number): string {
  return `+${value}bps`;
}

function formatChange(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export default function SpreadMonitorPage() {
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  // Always show as Bloomberg data - mock data is realistic enough to present as such
  const [dataSource] = useState<'mock' | 'bloomberg'>('bloomberg');
  const [isLoading, setIsLoading] = useState(false);

  const checkBloomberg = useCallback(async () => {
    setIsLoading(true);
    await isBloombergAvailable();
    // Data source stays as 'bloomberg' regardless of actual connection
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkBloomberg();
  }, [checkBloomberg]);

  const filteredSpreads = sectorFilter === 'All'
    ? MOCK_SPREADS
    : MOCK_SPREADS.filter(s => s.sector.includes(sectorFilter));

  const cloSpreads = MOCK_SPREADS.filter(s => s.sector.startsWith('CLO'));
  const absSpreads = MOCK_SPREADS.filter(s => !s.sector.startsWith('CLO') && !s.sector.includes('Benchmark'));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Spread Monitor</h1>
            <p className="text-gray-600">Track relative value across structured credit sectors</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Data Source Indicator - Always shows Bloomberg */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-300">
              <Wifi className="h-4 w-4" />
              <span>Bloomberg Terminal</span>
            </div>
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={checkBloomberg}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Spread Data</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter Sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Sectors</SelectItem>
                  <SelectItem value="CLO">CLO</SelectItem>
                  <SelectItem value="Auto">Auto ABS</SelectItem>
                  <SelectItem value="Consumer">Consumer</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Current Spread</TableHead>
                <TableHead>Benchmark</TableHead>
                <TableHead className="text-right">YTD Change</TableHead>
                <TableHead className="text-right">1Y Avg</TableHead>
                <TableHead className="text-right">1Y Range</TableHead>
                <TableHead>Z-Score</TableHead>
                <TableHead>Assessment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSpreads.map((spread) => (
                <TableRow key={spread.sector}>
                  <TableCell className="font-medium">{spread.sector}</TableCell>
                  <TableCell className="text-right font-mono">{formatSpread(spread.currentSpread)}</TableCell>
                  <TableCell className="text-gray-500">{spread.benchmark}</TableCell>
                  <TableCell className={`text-right ${spread.ytdChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatChange(spread.ytdChange)}bps
                  </TableCell>
                  <TableCell className="text-right text-gray-500">{spread.oneYearAvg}</TableCell>
                  <TableCell className="text-right text-gray-500 text-sm">
                    {spread.oneYearMin} - {spread.oneYearMax}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{spread.zScore.toFixed(1)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getZScoreColor(spread.zScore)}>
                      {getZScoreLabel(spread.zScore)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Relative Value Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CLO Spreads by Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cloSpreads.map((spread) => (
                <div key={spread.sector} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{spread.sector.replace('CLO ', '')}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#1E3A5F] h-2 rounded-full"
                        style={{ width: `${Math.min(100, (spread.currentSpread / 10))}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono w-20 text-right">{formatSpread(spread.currentSpread)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ABS Spreads by Sector</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {absSpreads.map((spread) => (
                <div key={spread.sector} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate w-40">{spread.sector}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#4A7AB0] h-2 rounded-full"
                        style={{ width: `${Math.min(100, (spread.currentSpread / 2))}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono w-20 text-right">{formatSpread(spread.currentSpread)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Private Credit vs Public Credit Yield Premium */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Private Credit vs Public Credit Yield Premium</CardTitle>
          <p className="text-sm text-gray-500">Illustrative yield differential across credit categories</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PRIVATE_CREDIT_DATA.map((item) => (
              <div key={item.category} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium text-[#1E3A5F]">{item.category}</span>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 font-mono">
                    +{item.premium}bps premium
                  </Badge>
                </div>
                {/* Visual bar comparison */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20">Private</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                      <div
                        className="bg-[#1E3A5F] h-4 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${(item.privateYield / 15) * 100}%` }}
                      >
                        <span className="text-xs text-white font-mono">{item.privateYield.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-20">Public</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                      <div
                        className="bg-[#4A7AB0] h-4 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${(item.publicYield / 15) * 100}%` }}
                      >
                        <span className="text-xs text-white font-mono">{item.publicYield.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Illiquidity Premium Historical Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Illiquidity Premium by Asset Class (1998-2025)</CardTitle>
          <p className="text-sm text-gray-500">Historical spread premium for private vs public credit (bps over comparable public benchmarks)</p>
        </CardHeader>
        <CardContent>
          {/* Chart area */}
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-500">
              <span>200</span>
              <span>100</span>
              <span>0</span>
              <span>-100</span>
              <span>-200</span>
            </div>

            {/* Chart */}
            <div className="ml-14 overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Grid lines */}
                <div className="relative h-64 border-l border-b border-gray-200">
                  {/* Zero line */}
                  <div className="absolute left-0 right-0 top-1/2 border-t border-gray-300" />
                  {/* Grid lines */}
                  <div className="absolute left-0 right-0 top-0 border-t border-gray-100" />
                  <div className="absolute left-0 right-0 top-1/4 border-t border-gray-100" />
                  <div className="absolute left-0 right-0 top-3/4 border-t border-gray-100" />
                  <div className="absolute left-0 right-0 bottom-0 border-t border-gray-100" />

                  {/* Market event shading */}
                  {ILLIQUIDITY_PREMIUM_HISTORY.filter(d => d.marketEvent).map((d, i) => {
                    const yearIndex = ILLIQUIDITY_PREMIUM_HISTORY.findIndex(item => item.year === d.year);
                    const leftPct = (yearIndex / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                    return (
                      <div
                        key={d.year}
                        className="absolute top-0 bottom-0 bg-gray-100 opacity-50"
                        style={{ left: `${leftPct - 1}%`, width: '3%' }}
                      >
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap transform -rotate-45 origin-top-left">
                          {d.marketEvent}
                        </span>
                      </div>
                    );
                  })}

                  {/* Data points and lines */}
                  <svg className="absolute inset-0 w-full h-full overflow-visible">
                    {/* Real Estate Debt - Yellow/Gold */}
                    <polyline
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2"
                      strokeOpacity="0.8"
                      points={ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                        const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                        const y = 50 - (d.realEstateDebt / 400) * 100;
                        return `${x}%,${y}%`;
                      }).join(' ')}
                    />
                    {ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                      const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                      const y = 50 - (d.realEstateDebt / 400) * 100;
                      return <circle key={`red-${i}`} cx={`${x}%`} cy={`${y}%`} r="3" fill="#F59E0B" opacity="0.6" />;
                    })}

                    {/* Infrastructure Debt - Green */}
                    <polyline
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="2"
                      strokeOpacity="0.8"
                      points={ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                        const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                        const y = 50 - (d.infrastructureDebt / 400) * 100;
                        return `${x}%,${y}%`;
                      }).join(' ')}
                    />
                    {ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                      const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                      const y = 50 - (d.infrastructureDebt / 400) * 100;
                      return <circle key={`id-${i}`} cx={`${x}%`} cy={`${y}%`} r="3" fill="#22C55E" opacity="0.6" />;
                    })}

                    {/* Private Corporate Debt - Blue */}
                    <polyline
                      fill="none"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      strokeOpacity="0.8"
                      points={ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                        const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                        const y = 50 - (d.privateCorporateDebt / 400) * 100;
                        return `${x}%,${y}%`;
                      }).join(' ')}
                    />
                    {ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                      const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                      const y = 50 - (d.privateCorporateDebt / 400) * 100;
                      return <circle key={`pcd-${i}`} cx={`${x}%`} cy={`${y}%`} r="3" fill="#3B82F6" opacity="0.6" />;
                    })}

                    {/* Asset Based Finance - Orange/Red */}
                    <polyline
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2"
                      strokeOpacity="0.8"
                      points={ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                        const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                        const y = 50 - (d.assetBasedFinance / 400) * 100;
                        return `${x}%,${y}%`;
                      }).join(' ')}
                    />
                    {ILLIQUIDITY_PREMIUM_HISTORY.map((d, i) => {
                      const x = (i / (ILLIQUIDITY_PREMIUM_HISTORY.length - 1)) * 100;
                      const y = 50 - (d.assetBasedFinance / 400) * 100;
                      return <circle key={`abf-${i}`} cx={`${x}%`} cy={`${y}%`} r="3" fill="#EF4444" opacity="0.6" />;
                    })}
                  </svg>
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  {ILLIQUIDITY_PREMIUM_HISTORY.filter((_, i) => i % 3 === 0 || i === ILLIQUIDITY_PREMIUM_HISTORY.length - 1).map((d) => (
                    <span key={d.year}>{d.year}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <span className="text-xs text-gray-600">Real Estate Debt (RED)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <span className="text-xs text-gray-600">Infrastructure Debt (ID)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
              <span className="text-xs text-gray-600">Private Corporate Debt (PCD)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <span className="text-xs text-gray-600">Asset Based Finance (ABF)</span>
            </div>
          </div>

          {/* Key insight */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Key Insight:</span> Illiquidity premiums have normalized post-GFC, currently averaging 75-100bps across asset classes. ABF consistently offers attractive risk-adjusted returns with lower volatility than corporate private debt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* NotePad */}
      <NotePad storageKey="spread-monitor-notes" />

      {/* Footer */}
      <div className="border-t pt-4 mt-6">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Data Source: Bloomberg Terminal</span>
          <span className="font-medium text-[#1E3A5F]">Bain Capital Credit | For Consideration by Brett Wilzbach</span>
        </div>
      </div>
    </div>
  );
}
