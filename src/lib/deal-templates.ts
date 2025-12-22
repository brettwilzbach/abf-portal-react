/**
 * Deal Templates for ABF Portal
 * Unified templates for Deal Modeler - combines Waterfall + Analyzer structures
 */

import { DealTemplate } from '@/types/waterfall';

export const DEAL_TEMPLATES: Record<string, DealTemplate> = {
  'auto-abs': {
    id: 'auto-abs',
    name: 'Auto ABS (Subprime)',
    description: 'Asset-backed securities collateralized by subprime auto loans',
    collateralType: 'Subprime Auto Loans',
    collateralBalance: 300,
    wac: 17.5, // Typical subprime auto WAC per S&P/KBRA 2025 data (~17-18%)
    wam: 54,
    typicalWAL: '1.5-2.5 years',
    tranches: [
      // Subordination based on subprime auto benchmarks (GLS, ACA deals ~45-55% AAA CE)
      // Spreads updated to 2025 market levels
      { name: 'Class A', balance: 165, couponType: 'Floating', spread: 110, rating: 'AAA', subordination: 45.0 },
      { name: 'Class B', balance: 40, couponType: 'Floating', spread: 175, rating: 'AA', subordination: 31.7 },
      { name: 'Class C', balance: 35, couponType: 'Floating', spread: 250, rating: 'A', subordination: 20.0 },
      { name: 'Class D', balance: 25, couponType: 'Floating', spread: 375, rating: 'BBB', subordination: 11.7 },
      { name: 'Class E', balance: 20, couponType: 'Floating', spread: 625, rating: 'BB', subordination: 5.0 },
      { name: 'Residual', balance: 15, couponType: 'Fixed', spread: 0, rating: 'NR', subordination: 0 },
    ],
    triggers: [
      { name: 'OC Test', type: 'OC', threshold: 104, consequence: 'Sequential pay + cash trapping' },
      { name: 'CNL Trigger', type: 'CNL', threshold: 15, consequence: 'Sequential pay + accelerated amortization' },
      { name: 'ARD', type: 'ARD', threshold: 36, consequence: 'Excess cash diverts to senior paydown' },
    ],
    keyRisks: ['Default rates', 'Depreciation risk', 'Economic sensitivity', 'Prepayment risk'],
    typicalSpreads: [
      { rating: 'AAA', spread: '75-110 bps' },
      { rating: 'BBB', spread: '180-250 bps' },
    ],
  },
  'clo': {
    id: 'clo',
    name: 'CLO (Collateralized Loan Obligation)',
    description: 'Pool of leveraged loans to corporate borrowers',
    collateralType: 'Broadly Syndicated Loans',
    collateralBalance: 500,
    wac: 9.5,
    wam: 60,
    typicalWAL: '4-6 years',
    tranches: [
      // CLO 2.0+ subordination levels per NAIC/APSEC research
      { name: 'Class A', balance: 310, couponType: 'Floating', spread: 135, rating: 'AAA', subordination: 38.0 },
      { name: 'Class B', balance: 50, couponType: 'Floating', spread: 180, rating: 'AA', subordination: 28.0 },
      { name: 'Class C', balance: 35, couponType: 'Floating', spread: 235, rating: 'A', subordination: 21.0 },
      { name: 'Class D', balance: 30, couponType: 'Floating', spread: 360, rating: 'BBB', subordination: 15.0 },
      { name: 'Class E', balance: 25, couponType: 'Floating', spread: 700, rating: 'BB', subordination: 10.0 },
      { name: 'Equity', balance: 50, couponType: 'Fixed', spread: 0, rating: 'NR', subordination: 0 },
    ],
    triggers: [
      { name: 'OC Test', type: 'OC', threshold: 104, consequence: 'Sequential pay + cash trapping' },
      { name: 'Non-Call End', type: 'INFO', threshold: 24, consequence: 'Deal callable; optional redemption (informational only)' },
    ],
    keyRisks: ['Corporate credit risk', 'Reinvestment risk', 'Manager selection', 'CCC bucket'],
    typicalSpreads: [
      { rating: 'AAA', spread: '125-145 bps' },
      { rating: 'BBB', spread: '320-400 bps' },
    ],
  },
  'consumer': {
    id: 'consumer',
    name: 'Consumer ABS',
    description: 'Unsecured consumer loans (personal loans, credit cards)',
    collateralType: 'Unsecured Consumer Debt',
    collateralBalance: 250,
    wac: 14.5,
    wam: 36,
    typicalWAL: '1.5-3.0 years',
    tranches: [
      // Consumer ABS per KBRA: AAA CE 60-70% for subprime, lower for prime
      { name: 'Class A', balance: 150, couponType: 'Floating', spread: 95, rating: 'AAA', subordination: 40.0 },
      { name: 'Class B', balance: 35, couponType: 'Floating', spread: 155, rating: 'AA', subordination: 26.0 },
      { name: 'Class C', balance: 30, couponType: 'Floating', spread: 215, rating: 'A', subordination: 14.0 },
      { name: 'Class D', balance: 20, couponType: 'Floating', spread: 325, rating: 'BBB', subordination: 6.0 },
      { name: 'Residual', balance: 15, couponType: 'Fixed', spread: 0, rating: 'NR', subordination: 0 },
    ],
    triggers: [
      { name: 'OC Test', type: 'OC', threshold: 104, consequence: 'Sequential pay + cash trapping' },
      { name: 'CNL Trigger', type: 'CNL', threshold: 12, consequence: 'Sequential pay + accelerated amortization' },
      { name: 'ARD', type: 'ARD', threshold: 24, consequence: 'Excess cash diverts to senior paydown' },
    ],
    keyRisks: ['No collateral recovery', 'Regulatory changes', 'Consumer behavior', 'Charge-off timing'],
    typicalSpreads: [
      { rating: 'AAA', spread: '85-120 bps' },
      { rating: 'BBB', spread: '280-375 bps' },
    ],
  },
  'equipment': {
    id: 'equipment',
    name: 'Equipment ABS',
    description: 'Loans/leases for business equipment (railcar, aircraft, construction)',
    collateralType: 'Commercial Equipment',
    collateralBalance: 300,
    wac: 8.5, // Equipment leases typically lower yield than consumer
    wam: 48,
    typicalWAL: '2.5-4.0 years',
    tranches: [
      // 4-tranche structure: A, B, C, Equity
      { name: 'Class A', balance: 240, couponType: 'Floating', spread: 65, rating: 'AAA', subordination: 20.0 },
      { name: 'Class B', balance: 30, couponType: 'Floating', spread: 150, rating: 'A', subordination: 10.0 },
      { name: 'Class C', balance: 15, couponType: 'Floating', spread: 275, rating: 'BBB', subordination: 5.0 },
      { name: 'Equity', balance: 15, couponType: 'Fixed', spread: 0, rating: 'NR', subordination: 0 },
    ],
    triggers: [
      { name: 'OC Test', type: 'OC', threshold: 104, consequence: 'Sequential pay + cash trapping' },
      { name: 'CNL Trigger', type: 'CNL', threshold: 5, consequence: 'Sequential pay + accelerated amortization' },
      { name: 'ARD', type: 'ARD', threshold: 48, consequence: 'Excess cash diverts to senior paydown' },
    ],
    keyRisks: ['Residual value risk', 'Obligor concentration', 'Equipment obsolescence', 'Technology risk'],
    typicalSpreads: [
      { rating: 'AAA', spread: '50-80 bps' },
      { rating: 'A', spread: '120-175 bps' },
    ],
  },
};

// Helper to get all template keys
export const DEAL_TEMPLATE_KEYS = Object.keys(DEAL_TEMPLATES) as (keyof typeof DEAL_TEMPLATES)[];

// Rating colors for visualizations - Bain Capital Credit brand palette
// Must match getRatingColorClass for consistency across all charts
export const RATING_COLORS: Record<string, string> = {
  AAA: '#1C2156',      // Deep navy (brand primary)
  Aaa: '#1C2156',
  AA: '#1E3278',       // Dark blue (brand accent)
  Aa: '#1E3278',
  A: '#0047BB',        // Primary blue
  BBB: '#0779BF',      // Bright blue
  Baa: '#0779BF',
  BB: '#996B1F',       // Gold/bronze (darkened for contrast)
  Ba: '#996B1F',
  B: '#7A5518',        // Darker bronze
  NR: '#4A4A4A',       // Charcoal gray
};

// Get rating color class (Tailwind) - Bain Capital Credit brand palette
// Colors derived from baincapitalcredit.com - WCAG AA contrast compliant
export function getRatingColorClass(rating: string): string {
  const colors: Record<string, string> = {
    // Investment grade: navy spectrum (brand primary #1C2156 → #0047BB)
    AAA: 'bg-[#1C2156] text-white',       // Deep navy (brand primary)
    AA: 'bg-[#1E3278] text-white',        // Dark blue (brand accent)
    A: 'bg-[#0047BB] text-white',         // Primary blue
    BBB: 'bg-[#0779BF] text-white',       // Bright blue
    // High yield: bronze accent from brand
    BB: 'bg-[#996B1F] text-white',        // Gold/bronze (darkened for contrast)
    B: 'bg-[#7A5518] text-white',         // Darker bronze
    // Equity/Residual: neutral
    NR: 'bg-[#4A4A4A] text-white',        // Charcoal gray
  };
  return colors[rating] || 'bg-[#4A4A4A] text-white';
}
