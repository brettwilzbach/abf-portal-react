import { useState, useMemo, useEffect, useCallback } from 'react';
import { Deal, MarketFilters, MarketStats } from '@/types/market';
import { getBloombergDeals, isBloombergAvailable } from '@/lib/bloomberg';

// =============================================================================
// MOCK DATA - Used as fallback when Bloomberg is unavailable
// =============================================================================

const MOCK_DEALS: Deal[] = [
  {
    id: '1',
    dealName: 'ACMAT 2025-1',
    issuer: "America's Car-Mart",
    collateralType: 'Auto - Subprime',
    dealSize: 200,
    pricingDate: '2025-01-15',
    rating: 'BBB',
    spread: 185,
    wal: 1.8,
    creditEnhancement: 42.5,
    format: '144A',
  },
  {
    id: '2',
    dealName: 'DRIVE 2025-1',
    issuer: 'Santander Drive',
    collateralType: 'Auto - Subprime',
    dealSize: 850,
    pricingDate: '2025-01-10',
    rating: 'AAA',
    spread: 95,
    wal: 2.1,
    creditEnhancement: 55.0,
    format: '144A',
  },
  {
    id: '3',
    dealName: 'CARMX 2025-1',
    issuer: 'CarMax',
    collateralType: 'Auto - Prime',
    dealSize: 1200,
    pricingDate: '2025-01-08',
    rating: 'AAA',
    spread: 55,
    wal: 1.5,
    creditEnhancement: 12.5,
    format: '144A',
  },
  {
    id: '4',
    dealName: 'TREST 2025-1',
    issuer: 'Trinitas Capital',
    collateralType: 'CLO',
    dealSize: 500,
    pricingDate: '2025-01-05',
    rating: 'AAA',
    spread: 140,
    wal: 5.2,
    creditEnhancement: 38.0,
    format: '144A',
  },
  {
    id: '5',
    dealName: 'ALLY 2024-4',
    issuer: 'Ally Financial',
    collateralType: 'Auto - Prime',
    dealSize: 1500,
    pricingDate: '2024-12-15',
    rating: 'AAA',
    spread: 48,
    wal: 1.4,
    creditEnhancement: 10.5,
    format: '144A',
  },
  {
    id: '6',
    dealName: 'SDART 2024-4',
    issuer: 'Santander Drive',
    collateralType: 'Auto - Subprime',
    dealSize: 750,
    pricingDate: '2024-12-10',
    rating: 'AA',
    spread: 115,
    wal: 2.3,
    creditEnhancement: 48.0,
    format: '144A',
  },
  {
    id: '7',
    dealName: 'FORDO 2024-C',
    issuer: 'Ford Credit',
    collateralType: 'Auto - Prime',
    dealSize: 1800,
    pricingDate: '2024-12-05',
    rating: 'AAA',
    spread: 52,
    wal: 1.6,
    creditEnhancement: 11.0,
    format: '144A',
  },
  {
    id: '8',
    dealName: 'OAKCL 2024-2',
    issuer: 'Oaktree Capital',
    collateralType: 'CLO',
    dealSize: 450,
    pricingDate: '2024-11-20',
    rating: 'AAA',
    spread: 145,
    wal: 5.5,
    creditEnhancement: 40.0,
    format: '144A',
  },
  {
    id: '9',
    dealName: 'WOART 2024-D',
    issuer: 'World Omni',
    collateralType: 'Auto - Prime',
    dealSize: 900,
    pricingDate: '2024-11-15',
    rating: 'AAA',
    spread: 50,
    wal: 1.5,
    creditEnhancement: 11.5,
    format: '144A',
  },
  {
    id: '10',
    dealName: 'AMCAR 2024-3',
    issuer: 'AmeriCredit',
    collateralType: 'Auto - Subprime',
    dealSize: 1100,
    pricingDate: '2024-11-10',
    rating: 'A',
    spread: 135,
    wal: 2.0,
    creditEnhancement: 45.0,
    format: '144A',
  },
  {
    id: '11',
    dealName: 'COPAR 2024-2',
    issuer: 'Capital One',
    collateralType: 'Auto - Prime',
    dealSize: 1400,
    pricingDate: '2024-10-25',
    rating: 'AAA',
    spread: 45,
    wal: 1.3,
    creditEnhancement: 9.5,
    format: '144A',
  },
  {
    id: '12',
    dealName: 'EQPMT 2024-1',
    issuer: 'Great Elm Capital',
    collateralType: 'Equipment',
    dealSize: 350,
    pricingDate: '2024-10-15',
    rating: 'A',
    spread: 125,
    wal: 3.2,
    creditEnhancement: 22.0,
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

  // Fetch data from Bloomberg if available
  const fetchBloombergData = useCallback(async () => {
    setIsLoading(true);
    try {
      const available = await isBloombergAvailable();
      if (!available) {
        setDeals(MOCK_DEALS);
        setDataSource('mock');
        return;
      }

      const bloombergDeals = await getBloombergDeals(90);
      if (bloombergDeals && bloombergDeals.length > 0) {
        // Transform Bloomberg data to our Deal format
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
          creditEnhancement: 0, // Not always available from Bloomberg
          format: '144A',
        }));
        setDeals(transformedDeals);
        setDataSource('bloomberg');
      } else {
        setDeals(MOCK_DEALS);
        setDataSource('mock');
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
      if (filters.rating !== 'All' && deal.rating !== filters.rating) {
        return false;
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
