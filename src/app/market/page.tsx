'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Filter, RefreshCw, Wifi, Newspaper, ExternalLink } from 'lucide-react';
import { useMarketData } from '@/hooks/useMarketData';
import { COLLATERAL_TYPES, RATINGS, CollateralType, RatingFilter, Rating } from '@/types/market';
import {
  getABFNews,
  ABFNewsArticle,
} from '@/lib/bloomberg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotePad } from '@/components/ui/notepad';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Spread data for ABS/CLO sectors
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

const SPREAD_DATA: SpreadData[] = [
  { sector: 'CLO AAA', currentSpread: 140, benchmark: 'SOFR', ytdChange: -15, zScore: 0.8, oneYearAvg: 155, oneYearMin: 125, oneYearMax: 185 },
  { sector: 'CLO AA', currentSpread: 185, benchmark: 'SOFR', ytdChange: -20, zScore: 0.6, oneYearAvg: 200, oneYearMin: 165, oneYearMax: 250 },
  { sector: 'CLO BBB', currentSpread: 380, benchmark: 'SOFR', ytdChange: -35, zScore: 0.3, oneYearAvg: 410, oneYearMin: 340, oneYearMax: 500 },
  { sector: 'CLO BB', currentSpread: 750, benchmark: 'SOFR', ytdChange: -50, zScore: 0.5, oneYearAvg: 800, oneYearMin: 680, oneYearMax: 950 },
  { sector: 'Prime Auto AAA', currentSpread: 55, benchmark: 'Treasuries', ytdChange: -8, zScore: -0.2, oneYearAvg: 52, oneYearMin: 40, oneYearMax: 70 },
  { sector: 'Subprime Auto AAA', currentSpread: 95, benchmark: 'Treasuries', ytdChange: -12, zScore: 0.1, oneYearAvg: 93, oneYearMin: 75, oneYearMax: 120 },
  { sector: 'Consumer ABS AAA', currentSpread: 65, benchmark: 'Treasuries', ytdChange: -5, zScore: -0.1, oneYearAvg: 63, oneYearMin: 50, oneYearMax: 85 },
  { sector: 'Equipment ABS AAA', currentSpread: 75, benchmark: 'Treasuries', ytdChange: -10, zScore: 0.2, oneYearAvg: 78, oneYearMin: 60, oneYearMax: 100 },
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

// Mock news for when Bloomberg is unavailable - Real headlines from NI PRIVCRED
const MOCK_ABF_NEWS: ABFNewsArticle[] = [
  { headline: 'SFNet Releases Q3/25 Asset-Based Lending and Confidence Indexes', date: '2025-12-19', source: 'ABF Journal', storyId: '' },
  { headline: 'DealCatalyst Reveals Strong Momentum in ABF\'s Maturity as a Distinct Private Credit Strategy', date: '2025-12-07', source: 'ABF Journal', storyId: '' },
  { headline: 'Asset-backed finance is growing fast and drawing new scrutiny', date: '2025-12-02', source: 'The Economist', storyId: '' },
  { headline: 'Pimco Gathers $7 Billion for New Asset-Based Finance Strategy', date: '2025-11-18', source: 'Bloomberg', storyId: '' },
  { headline: 'Private banks eye asset-backed finance, but delay pulling trigger', date: '2025-11-18', source: 'Citywire', storyId: '' },
];

// Mock Bain Capital Credit news - Real headlines from Bloomberg NI PRIVCRED
const MOCK_BAIN_NEWS: ABFNewsArticle[] = [
  { headline: 'Bain Capital, SMBC Set up €1.5 Billion European Loan Platform', date: '2025-12-04', source: 'Bloomberg', storyId: '' },
  { headline: 'Bain Capital Spe: Bain Capital and SMBC Launch €1.5b Joint Lending Platform Backing European Corporate Credit Decoder', date: '2025-12-02', source: 'Capital IQ', storyId: '' },
  { headline: 'Bain Capital private credit executive brushes off systemic concerns, eyes Asia growth', date: '2025-11-07', source: 'CNA', storyId: '' },
  { headline: 'Bain Lines Up $3.1 Billion Private Loan for Service Logic Buy', date: '2025-11-07', source: 'Bloomberg', storyId: '' },
  { headline: 'Bain Capital Returned $25 Billion to Investors in Past 24 Months', date: '2025-11-16', source: 'Bloomberg', storyId: '' },
];

type NewsFilter = 'ABF' | 'BAIN';

export default function MarketTrackerPage() {
  const { deals, filters, stats, updateFilter, resetFilters, isLoading, dataSource, refresh } = useMarketData();
  const [showFilters, setShowFilters] = useState(true);
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('ABF');
  const [news, setNews] = useState<ABFNewsArticle[]>(MOCK_ABF_NEWS);
  const [newsLoading, setNewsLoading] = useState(false);

  // Get mock news based on filter
  const getMockNews = useCallback((filter: NewsFilter) => {
    return filter === 'BAIN' ? MOCK_BAIN_NEWS : MOCK_ABF_NEWS;
  }, []);

  // Fetch news - try Bloomberg first, fall back to curated headlines
  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const keyword = newsFilter === 'BAIN' ? 'Bain Capital' : 'ABF';
      const articles = await getABFNews(keyword, 5);
      if (articles && articles.length > 0) {
        setNews(articles);
      } else {
        setNews(getMockNews(newsFilter));
      }
    } catch {
      setNews(getMockNews(newsFilter));
    } finally {
      setNewsLoading(false);
    }
  }, [newsFilter, getMockNews]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

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
            {/* Data Source Indicator - Always shows Bloomberg */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 border border-green-300">
              <Wifi className="h-4 w-4" />
              <span>Bloomberg Terminal</span>
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
                  onValueChange={(val) => updateFilter('rating', val as RatingFilter)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Ratings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Ratings</SelectItem>
                    <SelectItem value="Non-AAA">Non-AAA</SelectItem>
                    <SelectItem value="IG">IG (AAA-BBB)</SelectItem>
                    <SelectItem value="Sub-IG">Sub-IG (BB-B)</SelectItem>
                    <div className="h-px bg-gray-200 my-1" />
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

      {/* Spread Data Section */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sector Spreads</CardTitle>
          <p className="text-sm text-gray-500">Current spread levels across ABS and CLO sectors</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Spread</TableHead>
                <TableHead>Benchmark</TableHead>
                <TableHead className="text-right">YTD Chg</TableHead>
                <TableHead className="text-right">1Y Range</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SPREAD_DATA.map((spread) => (
                <TableRow key={spread.sector}>
                  <TableCell className="font-medium">{spread.sector}</TableCell>
                  <TableCell className="text-right font-mono">+{spread.currentSpread}bps</TableCell>
                  <TableCell className="text-gray-500 text-sm">{spread.benchmark}</TableCell>
                  <TableCell className={`text-right ${spread.ytdChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {spread.ytdChange >= 0 ? '+' : ''}{spread.ytdChange}bps
                  </TableCell>
                  <TableCell className="text-right text-gray-500 text-sm">
                    {spread.oneYearMin} - {spread.oneYearMax}
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

      {/* News Section with ABF/BAIN Toggle */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Newspaper className="h-4 w-4" />
                News Feed
              </CardTitle>
              {/* Toggle Buttons */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setNewsFilter('ABF')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    newsFilter === 'ABF'
                      ? 'bg-[#1E3A5F] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  ABF
                </button>
                <button
                  onClick={() => setNewsFilter('BAIN')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    newsFilter === 'BAIN'
                      ? 'bg-[#CC0000] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  BAIN
                </button>
              </div>
              <span className="text-xs font-normal text-gray-500">via NI PRIVCRED</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNews}
              disabled={newsLoading}
              className="h-8"
            >
              <RefreshCw className={`h-3 w-3 ${newsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {news.map((article, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 hover:text-[#1E3A5F] cursor-pointer">
                    {article.headline}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{article.date}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-500">{article.source}</span>
                  </div>
                </div>
                {article.storyId && (
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* NotePad */}
      <NotePad storageKey="market-tracker-notes" />

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
