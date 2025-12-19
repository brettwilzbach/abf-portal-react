'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { isBloombergAvailable } from '@/lib/bloomberg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [dataSource, setDataSource] = useState<'mock' | 'bloomberg'>('mock');
  const [isLoading, setIsLoading] = useState(false);

  const checkBloomberg = useCallback(async () => {
    setIsLoading(true);
    const available = await isBloombergAvailable();
    setDataSource(available ? 'bloomberg' : 'mock');
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
            {/* Data Source Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              dataSource === 'bloomberg'
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-amber-100 text-amber-700 border border-amber-300'
            }`}>
              {dataSource === 'bloomberg' ? (
                <>
                  <Wifi className="h-4 w-4" />
                  <span>Bloomberg Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>Demo Data</span>
                </>
              )}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">CLO AAA vs IG Corps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#1E3A5F]">+50bps</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Attractive pickup
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">CLO BB vs HY Corps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#1E3A5F]">+430bps</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Wide to historicals
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Auto ABS vs IG Corps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#1E3A5F]">-35bps</p>
            <p className="text-xs text-yellow-600 flex items-center gap-1">
              <Minus className="h-3 w-3" /> Fair value
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Market Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">Tightening</p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Spreads narrowing YTD
            </p>
          </CardContent>
        </Card>
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

      {/* Footer */}
      <div className="border-t pt-4 mt-6">
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>
            Data Source: {dataSource === 'bloomberg' ? 'Bloomberg Terminal (Live)' : 'Demo Data'}
            {dataSource === 'mock' && ' • Start Bloomberg MCP server for live data'}
          </span>
          <span className="font-medium text-[#1E3A5F]">Bain Capital Credit | For Consideration by Brett Wilzbach</span>
        </div>
      </div>
    </div>
  );
}
