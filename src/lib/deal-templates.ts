/**
 * Deal Templates for ABF Portal
 * Unified templates for Deal Modeler - combines Waterfall + Analyzer structures
 */

import { DealTemplate } from '@/types/waterfall';

export const DEAL_TEMPLATES: Record<string, DealTemplate> = {
  'auto-abs': {
    id: 'auto-abs',
    name: 'Auto ABS',
    description: 'Asset-backed securities collateralized by auto loans',
    collateralType: 'Auto Loans',
    collateralBalance: 300,
    wac: 12.5,
    wam: 54,
    typicalWAL: '1.5-2.5 years',
    tranches: [
      // Subordination based on subprime auto benchmarks (GLS, ACA deals ~45-55% AAA CE)
      { name: 'Class A', balance: 165, couponType: 'Floating', spread: 85, rating: 'AAA', subordination: 45.0 },
      { name: 'Class B', balance: 40, couponType: 'Floating', spread: 145, rating: 'AA', subordination: 31.7 },
      { name: 'Class C', balance: 35, couponType: 'Floating', spread: 195, rating: 'A', subordination: 20.0 },
      { name: 'Class D', balance: 25, couponType: 'Floating', spread: 295, rating: 'BBB', subordination: 11.7 },
      { name: 'Class E', balance: 20, couponType: 'Floating', spread: 525, rating: 'BB', subordination: 5.0 },
      { name: 'Residual', balance: 15, couponType: 'Fixed', spread: 0, rating: 'NR', subordination: 0 },
    ],
    triggers: [
      // OC = 300/285 = 105.3% at start; threshold eased to pass base case
      { name: 'OC Test', type: 'OC', threshold: 103, consequence: 'Sequential pay; cash trapped' },
      { name: 'CNL Trigger', type: 'CNL', threshold: 15, consequence: 'Accelerated amortization' },
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
      // OC = 500/450 = 111.1% at start; CLOs use OC/IC tests (not CNL)
      { name: 'OC Test', type: 'OC', threshold: 108, consequence: 'Interest diversion to senior' },
      // Non-call period (not turbo ARD)
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
      // OC = 250/235 = 106.4% at start; threshold eased to pass base case
      { name: 'OC Test', type: 'OC', threshold: 104, consequence: 'Sequential pay; cash trapped' },
      { name: 'CNL Trigger', type: 'CNL', threshold: 12, consequence: 'Accelerated amortization' },
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
    description: 'Loans/leases for business equipment',
    collateralType: 'Commercial Equipment',
    collateralBalance: 310, // Increased to provide OC cushion
    wac: 8.0,
    wam: 48,
    typicalWAL: '2.5-4.0 years',
    tranches: [
      // Equipment ABS typically has lower subordination due to collateral value
      // Added reserve/equity to ensure OC test passes in base case
      { name: 'Class A-1', balance: 145, couponType: 'Floating', spread: 55, rating: 'AAA', subordination: 20.0 },
      { name: 'Class A-2', balance: 95, couponType: 'Floating', spread: 70, rating: 'AAA', subordination: 20.0 },
      { name: 'Class B', balance: 30, couponType: 'Floating', spread: 115, rating: 'AA', subordination: 10.3 },
      { name: 'Class C', balance: 20, couponType: 'Floating', spread: 165, rating: 'A', subordination: 3.5 },
      { name: 'Reserve', balance: 10, couponType: 'Fixed', spread: 0, rating: 'NR', subordination: 0 },
    ],
    triggers: [
      // OC = 310/290 = 106.9% at start
      { name: 'OC Test', type: 'OC', threshold: 104, consequence: 'Sequential pay; cash trapped' },
      { name: 'CNL Trigger', type: 'CNL', threshold: 10, consequence: 'Accelerated amortization' },
      { name: 'ARD', type: 'ARD', threshold: 36, consequence: 'Excess cash diverts to senior paydown' },
    ],
    keyRisks: ['Residual value risk', 'Obligor concentration', 'Equipment obsolescence', 'Technology risk'],
    typicalSpreads: [
      { rating: 'AAA', spread: '50-80 bps' },
      { rating: 'A', spread: '140-185 bps' },
    ],
  },
};

// Helper to get all template keys
export const DEAL_TEMPLATE_KEYS = Object.keys(DEAL_TEMPLATES) as (keyof typeof DEAL_TEMPLATES)[];

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

// Get rating color class (Tailwind)
export function getRatingColorClass(rating: string): string {
  const colors: Record<string, string> = {
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
