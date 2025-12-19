import { useState, useMemo } from 'react';
import { Deal, MarketFilters, MarketStats, CollateralType, Rating } from '@/types/market';

// =============================================================================
// MOCK DATA - Replace with API calls when backend is ready
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

  const filteredDeals = useMemo(() => {
    return MOCK_DEALS.filter((deal) => {
      // Filter by collateral type
      if (filters.collateralType !== 'All' && deal.collateralType !== filters.collateralType) {
        return false;
      }

      // Filter by rating
      if (filters.rating !== 'All' && deal.rating !== filters.rating) {
        return false;
      }

      // Filter by search term
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          deal.dealName.toLowerCase().includes(searchLower) ||
          deal.issuer.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [filters]);

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
    isLoading: false, // Will be true when fetching from API
  };
}
