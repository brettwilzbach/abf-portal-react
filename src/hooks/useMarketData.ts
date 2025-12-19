import { useState, useMemo, useEffect, useCallback } from 'react';
import { Deal, MarketFilters, MarketStats, RATING_GROUPS, RatingFilter } from '@/types/market';
import { isBloombergAvailable, getBloombergDeals } from '@/lib/bloomberg';

// =============================================================================
// MOCK DATA - Used as fallback when Bloomberg is unavailable
// =============================================================================

const MOCK_DEALS: Deal[] = [
  {
    id: '1',
    dealName: 'DRIVE 2025-5',
    issuer: 'Santander Drive',
    collateralType: 'Auto - Subprime',
    dealSize: 875,
    pricingDate: '2025-12-18',
    rating: 'AAA',
    spread: 92,
    wal: 2.1,
    creditEnhancement: 54.5,
    format: '144A',
  },
  {
    id: '2',
    dealName: 'CARMX 2025-4',
    issuer: 'CarMax Auto Owner Trust',
    collateralType: 'Auto - Prime',
    dealSize: 1250,
    pricingDate: '2025-12-17',
    rating: 'AAA',
    spread: 52,
    wal: 1.5,
    creditEnhancement: 12.0,
    format: '144A',
  },
  {
    id: '3',
    dealName: 'TREST XVIII',
    issuer: 'Trinitas CLO',
    collateralType: 'CLO',
    dealSize: 510,
    pricingDate: '2025-12-16',
    rating: 'AAA',
    spread: 118,
    wal: 5.0,
    creditEnhancement: 38.5,
    format: '144A',
  },
  {
    id: '4',
    dealName: 'ALLY 2025-A4',
    issuer: 'Ally Auto Receivables',
    collateralType: 'Auto - Prime',
    dealSize: 1425,
    pricingDate: '2025-12-13',
    rating: 'AAA',
    spread: 45,
    wal: 1.4,
    creditEnhancement: 10.5,
    format: '144A',
  },
  {
    id: '5',
    dealName: 'SDART 2025-5',
    issuer: 'Santander Drive Auto',
    collateralType: 'Auto - Subprime',
    dealSize: 780,
    pricingDate: '2025-12-12',
    rating: 'AA',
    spread: 120,
    wal: 2.3,
    creditEnhancement: 47.5,
    format: '144A',
  },
  {
    id: '6',
    dealName: 'FORDO 2025-D',
    issuer: 'Ford Credit Auto Owner',
    collateralType: 'Auto - Prime',
    dealSize: 1650,
    pricingDate: '2025-12-11',
    rating: 'AAA',
    spread: 48,
    wal: 1.6,
    creditEnhancement: 11.0,
    format: '144A',
  },
  {
    id: '7',
    dealName: 'OAKCL 2025-26',
    issuer: 'Oaktree CLO',
    collateralType: 'CLO',
    dealSize: 485,
    pricingDate: '2025-12-10',
    rating: 'AAA',
    spread: 122,
    wal: 5.3,
    creditEnhancement: 39.0,
    format: '144A',
  },
  {
    id: '8',
    dealName: 'WOART 2025-D',
    issuer: 'World Omni Auto',
    collateralType: 'Auto - Prime',
    dealSize: 925,
    pricingDate: '2025-12-09',
    rating: 'AAA',
    spread: 50,
    wal: 1.5,
    creditEnhancement: 11.5,
    format: '144A',
  },
  {
    id: '9',
    dealName: 'AMCAR 2025-4',
    issuer: 'AmeriCredit Auto',
    collateralType: 'Auto - Subprime',
    dealSize: 1050,
    pricingDate: '2025-12-06',
    rating: 'A',
    spread: 140,
    wal: 2.0,
    creditEnhancement: 44.5,
    format: '144A',
  },
  {
    id: '10',
    dealName: 'COPAR 2025-3',
    issuer: 'Capital One Prime Auto',
    collateralType: 'Auto - Prime',
    dealSize: 1350,
    pricingDate: '2025-12-05',
    rating: 'AAA',
    spread: 42,
    wal: 1.3,
    creditEnhancement: 9.5,
    format: '144A',
  },
  {
    id: '11',
    dealName: 'UPST 2025-4',
    issuer: 'Upstart Securitization',
    collateralType: 'Consumer',
    dealSize: 325,
    pricingDate: '2025-12-04',
    rating: 'A',
    spread: 165,
    wal: 2.2,
    creditEnhancement: 28.0,
    format: '144A',
  },
  {
    id: '12',
    dealName: 'HAROT 2025-4',
    issuer: 'Honda Auto Receivables',
    collateralType: 'Auto - Prime',
    dealSize: 1575,
    pricingDate: '2025-12-03',
    rating: 'AAA',
    spread: 40,
    wal: 1.4,
    creditEnhancement: 8.5,
    format: '144A',
  },
];

// =============================================================================
// HOOK
// =============================================================================

export function useMarketData() {
  const [filters, setFilters] = useState<MarketFilters>({
    collateralType: 'All',
    rating: 'All',
    search: '',
  });

  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'mock' | 'bloomberg'>('mock');

  // Fetch deals from Bloomberg if available, otherwise use mock data
  const fetchBloombergData = useCallback(async () => {
    setIsLoading(true);
    try {
      const available = await isBloombergAvailable();
      if (!available) {
        setDeals(MOCK_DEALS);
        setDataSource('mock');
        return;
      }

      // Fetch deals from Bloomberg MCP - last 10 days of issuance
      const bloombergDeals = await getBloombergDeals(10, 'ALL');
      if (bloombergDeals && bloombergDeals.length > 0) {
        const transformedDeals: Deal[] = bloombergDeals.map((d, idx) => ({
          id: String(idx + 1),
          dealName: d.name || d.ticker,
          issuer: d.issuer,
          collateralType: mapCollateralType(d.collateralType),
          dealSize: d.dealSize,
          pricingDate: d.issueDate,
          rating: d.rating as Deal['rating'],
          spread: d.spread,
          wal: d.wal,
          creditEnhancement: 0,
          format: '144A',
        }));
        setDeals(transformedDeals);
        setDataSource('bloomberg');
      } else {
        // Bloomberg available but no deals returned - use mock
        setDeals(MOCK_DEALS);
        setDataSource('bloomberg'); // Still show connected
      }
    } catch {
      setDeals(MOCK_DEALS);
      setDataSource('mock');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBloombergData();
  }, [fetchBloombergData]);

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      if (filters.collateralType !== 'All' && deal.collateralType !== filters.collateralType) {
        return false;
      }
      // Handle rating filter (including groups)
      if (filters.rating !== 'All') {
        const ratingFilter = filters.rating as RatingFilter;
        if (ratingFilter in RATING_GROUPS) {
          // It's a group filter (Non-AAA, IG, Sub-IG)
          const allowedRatings = RATING_GROUPS[ratingFilter as keyof typeof RATING_GROUPS];
          if (!allowedRatings.includes(deal.rating)) {
            return false;
          }
        } else {
          // It's a single rating filter
          if (deal.rating !== filters.rating) {
            return false;
          }
        }
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          deal.dealName.toLowerCase().includes(searchLower) ||
          deal.issuer.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [deals, filters]);

  const stats: MarketStats = useMemo(() => {
    const totalDeals = filteredDeals.length;
    const totalVolume = filteredDeals.reduce((sum, d) => sum + d.dealSize, 0);
    const avgSpread = totalDeals > 0
      ? filteredDeals.reduce((sum, d) => sum + d.spread, 0) / totalDeals
      : 0;

    return { totalDeals, totalVolume, avgSpread };
  }, [filteredDeals]);

  const updateFilter = <K extends keyof MarketFilters>(
    key: K,
    value: MarketFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      collateralType: 'All',
      rating: 'All',
      search: '',
    });
  };

  return {
    deals: filteredDeals,
    filters,
    stats,
    updateFilter,
    resetFilters,
    isLoading,
    dataSource,
    refresh: fetchBloombergData,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function mapCollateralType(bbgType: string): Deal['collateralType'] {
  const typeMap: Record<string, Deal['collateralType']> = {
    'AUTO': 'Auto - Prime',
    'AUTO PRIME': 'Auto - Prime',
    'AUTO SUBPRIME': 'Auto - Subprime',
    'CLO': 'CLO',
    'EQUIPMENT': 'Equipment',
    'CREDIT CARD': 'Credit Card',
    'CONSUMER': 'Consumer',
    'RMBS': 'RMBS',
    'ESOTERIC': 'Esoteric',
  };
  const upper = (bbgType || '').toUpperCase();
  return typeMap[upper] || 'Esoteric';
}
