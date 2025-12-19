'use client';

import { useState } from 'react';
import { Search, Download, Filter, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useMarketData } from '@/hooks/useMarketData';
import { COLLATERAL_TYPES, RATINGS, CollateralType, Rating } from '@/types/market';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}M`;
}

function formatSpread(value: number): string {
  return `+${value}bps`;
}

function getRatingColor(rating: Rating): string {
  const colors: Record<Rating, string> = {
    AAA: 'bg-[#1E3A5F] text-white',
    AA: 'bg-[#2E5A8F] text-white',
    A: 'bg-[#4A7AB0] text-white',
    BBB: 'bg-amber-500 text-white',
    BB: 'bg-orange-600 text-white',
    B: 'bg-red-600 text-white',
    NR: 'bg-gray-400 text-white',
  };
  return colors[rating] || 'bg-gray-400 text-white';
}

export default function MarketTrackerPage() {
  const { deals, filters, stats, updateFilter, resetFilters, isLoading, dataSource, refresh } = useMarketData();
  const [showFilters, setShowFilters] = useState(true);

  const handleExportCSV = () => {
    const headers = ['Deal Name', 'Issuer', 'Collateral', 'Size ($M)', 'Rating', 'Spread (bps)', 'WAL', 'CE %', 'Pricing Date'];
    const rows = deals.map((d) => [
      d.dealName,
      d.issuer,
      d.collateralType,
      d.dealSize,
      d.rating,
      d.spread,
      d.wal,
      d.creditEnhancement,
      d.pricingDate,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'market_tracker_deals.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1E3A5F] mb-2">Market Tracker</h1>
            <p className="text-gray-600">Track new issuance and deal flow across structured credit sectors</p>
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
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#1E3A5F]">{stats.totalDeals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#1E3A5F]">{formatCurrency(stats.totalVolume)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Avg Spread</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#1E3A5F]">{formatSpread(Math.round(stats.avgSpread))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm text-gray-500 mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search deals or issuers..."
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Collateral Type */}
              <div className="w-[180px]">
                <label className="text-sm text-gray-500 mb-1 block">Collateral Type</label>
                <Select
                  value={filters.collateralType}
                  onValueChange={(val) => updateFilter('collateralType', val as CollateralType | 'All')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {COLLATERAL_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rating */}
              <div className="w-[140px]">
                <label className="text-sm text-gray-500 mb-1 block">Rating</label>
                <Select
                  value={filters.rating}
                  onValueChange={(val) => updateFilter('rating', val as Rating | 'All')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Ratings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Ratings</SelectItem>
                    {RATINGS.map((rating) => (
                      <SelectItem key={rating} value={rating}>
                        {rating}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset & Export */}
              <Button variant="outline" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={handleExportCSV} className="bg-[#1E3A5F] hover:bg-[#2E5A8F]">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Deals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deals</CardTitle>
        </CardHeader>
        <CardContent>
          {deals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No deals match your filters. Try adjusting your search criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal Name</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Collateral</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                  <TableHead className="text-right">WAL</TableHead>
                  <TableHead className="text-right">CE</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-medium">{deal.dealName}</TableCell>
                    <TableCell>{deal.issuer}</TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">{deal.collateralType}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(deal.dealSize)}</TableCell>
                    <TableCell>
                      <Badge className={getRatingColor(deal.rating)}>{deal.rating}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatSpread(deal.spread)}</TableCell>
                    <TableCell className="text-right">{deal.wal.toFixed(1)}yr</TableCell>
                    <TableCell className="text-right">{deal.creditEnhancement.toFixed(1)}%</TableCell>
                    <TableCell>{deal.pricingDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
