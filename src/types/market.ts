/**
 * Market Data Types for ABF Portal
 */

// =============================================================================
// DEAL TYPES (Market Tracker)
// =============================================================================

export interface Deal {
  id: string;
  dealName: string;
  issuer: string;
  collateralType: CollateralType;
  dealSize: number; // in millions
  pricingDate: string; // ISO date string
  rating: Rating;
  spread: number; // bps
  wal: number; // weighted average life in years
  creditEnhancement: number; // percentage
  format: DealFormat;
}

export type CollateralType =
  | 'Auto - Prime'
  | 'Auto - Subprime'
  | 'Consumer'
  | 'Equipment'
  | 'CLO'
  | 'Esoteric'
  | 'RMBS'
  | 'Credit Card';

export type Rating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'NR';

// Rating filter options (includes groups)
export type RatingFilter = Rating | 'All' | 'Non-AAA' | 'IG' | 'Sub-IG';

export type DealFormat = '144A' | 'Reg S' | 'Private';

export interface MarketFilters {
  collateralType: CollateralType | 'All';
  rating: RatingFilter;
  search: string;
}

// Rating group definitions
export const RATING_GROUPS = {
  'Non-AAA': ['AA', 'A', 'BBB', 'BB', 'B', 'NR'] as Rating[],
  'IG': ['AAA', 'AA', 'A', 'BBB'] as Rating[],
  'Sub-IG': ['BB', 'B'] as Rating[],
} as const;

export interface MarketStats {
  totalDeals: number;
  totalVolume: number; // in millions
  avgSpread: number; // bps
}

export const COLLATERAL_TYPES: CollateralType[] = [
  'Auto - Prime',
  'Auto - Subprime',
  'Consumer',
  'Equipment',
  'CLO',
  'Esoteric',
  'RMBS',
  'Credit Card',
];

export const RATINGS: Rating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'NR'];

// =============================================================================
// SPREAD TYPES (Spread Monitor)
// =============================================================================

export interface SpreadData {
  sector: string;
  currentSpread: number;
  benchmark: string;
  ytdChange: number;
  zScore: number;
  oneYearAvg: number;
  oneYearMin: number;
  oneYearMax: number;
}

export interface MarketMetrics {
  sofr: number;
  igSpread: number;
  hySpread: number;
  bbbSpread: number;
  treasury5Y: number;
}

export interface TreasuryCurve {
  '1M': number;
  '3M': number;
  '6M': number;
  '1Y': number;
  '2Y': number;
  '5Y': number;
  '10Y': number;
  '30Y': number;
}

export interface CreditIndex {
  name: string;
  value: number;
  change: number;
}

export interface CLOSpread {
  rating: string;
  spread: number;
  change: number;
}

export interface MarketDataSource {
  name: string;
  isLive: boolean;
  lastUpdated: string;
}

// Sector groupings
export const SECTOR_GROUPS = {
  CLO: ['CLO AAA', 'CLO AA', 'CLO A', 'CLO BBB', 'CLO BB'],
  'Prime Auto': ['Prime Auto AAA', 'Prime Auto AA', 'Prime Auto A'],
  'Subprime Auto': ['Subprime Auto AAA', 'Subprime Auto AA', 'Subprime Auto A', 'Subprime Auto BBB'],
  Consumer: ['Consumer ABS AAA', 'Consumer ABS A'],
  Equipment: ['Equipment ABS AAA', 'Equipment ABS A'],
} as const;

export type SectorGroup = keyof typeof SECTOR_GROUPS;

// Rating colors for visualizations
export const RATING_COLORS: Record<string, string> = {
  AAA: '#1E3A5F',
  Aaa: '#1E3A5F',
  AA: '#2E5A8F',
  Aa: '#2E5A8F',
  A: '#4A7AB0',
  BBB: '#FF9800',
  Baa: '#FF9800',
  BB: '#E65100',
  Ba: '#E65100',
  B: '#C62828',
  NR: '#9E9E9E',
};

// Z-score thresholds for relative value
export const Z_SCORE_THRESHOLDS = {
  ATTRACTIVE: 0.5,
  FAIR_LOW: -0.5,
  FAIR_HIGH: 0.5,
  RICH: -0.5,
} as const;

export function getZScoreAssessment(zScore: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (zScore > Z_SCORE_THRESHOLDS.ATTRACTIVE) {
    return { label: 'Attractive', color: '#2E7D32', icon: '🟢' };
  }
  if (zScore > Z_SCORE_THRESHOLDS.RICH && zScore <= Z_SCORE_THRESHOLDS.FAIR_HIGH) {
    return { label: 'Fair', color: '#FF9800', icon: '🟡' };
  }
  if (zScore > -1 && zScore <= Z_SCORE_THRESHOLDS.RICH) {
    return { label: 'Neutral', color: '#FF9800', icon: '🟠' };
  }
  return { label: 'Rich', color: '#C62828', icon: '🔴' };
}
