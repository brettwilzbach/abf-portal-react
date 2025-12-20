/**
 * Waterfall Model Types for ABF Portal
 * Unified types for Deal Modeler (merged Waterfall + Analyzer)
 */

// =============================================================================
// TRANCHE CONFIGURATION
// =============================================================================

export interface TrancheConfig {
  name: string;
  balance: number;
  couponType: 'Fixed' | 'Floating';
  spread: number;
  rating: string;
  subordination: number;
}

// =============================================================================
// TRIGGER CONFIGURATION (includes ARD and INFO)
// =============================================================================

// ARD = Anticipated Repayment Date (turbo to seniors post-trigger)
// INFO = Informational timing marker only (no waterfall effect, e.g., CLO non-call)
export type TriggerType = 'OC' | 'IC' | 'CNL' | 'DSCR' | 'ARD' | 'INFO';

export interface TriggerConfig {
  name: string;
  type: TriggerType;
  threshold: number; // For ARD/INFO: the month number; for others: percentage threshold
  consequence: string;
}

// =============================================================================
// DEAL TEMPLATE (unified structure)
// =============================================================================

export interface DealTemplate {
  id: string;
  name: string;
  description: string;
  collateralType: string;
  collateralBalance: number;
  wac: number; // Weighted Average Coupon
  wam: number; // Weighted Average Maturity (months)
  typicalWAL: string;
  tranches: TrancheConfig[];
  triggers: TriggerConfig[];
  keyRisks: string[];
  typicalSpreads: { rating: string; spread: string }[];
}

// =============================================================================
// CASH FLOW RESULTS
// =============================================================================

export interface CashFlowResult {
  period: number;
  collateralStart: number;
  collateralEnd: number;
  scheduledPrincipal: number;
  prepayments: number;
  defaults: number;
  recoveries: number;
  losses: number;
  interestIncome: number;
  excessSpread: number;
  cnlPercent: number;
  ocPercent: number;
  triggerStatus: 'Pass' | 'Fail';
  ardActive: boolean; // True if post-ARD and deal balance > 0
  turboPayment: number; // Amount turboed to seniors post-ARD
}

export interface TrancheSummary {
  name: string;
  rating: string;
  originalBalance: number;
  finalBalance: number;
  totalInterest: number;
  totalPrincipal: number;
  principalLoss: number;
  interestShortfall: number; // Cumulative interest shortfall (unpaid coupons)
  moic: number;
  irr: number | null; // Annualized IRR based on modeled cash flows (par)
  wal: number;
}

// =============================================================================
// SCENARIO INPUTS
// =============================================================================

export interface ScenarioInputs {
  cpr: number; // Constant Prepayment Rate (annualized %)
  cdr: number; // Constant Default Rate (annualized %)
  recovery: number; // Recovery rate (%)
  months: number; // Projection period (months)
}

// =============================================================================
// SCENARIO RESULT (for quick stress analysis)
// =============================================================================

export interface ScenarioResult {
  tranche: string;
  rating: string;
  subordination: number;
  moic: number;
  wal: number;
  yield: number | null; // Contractual yield (SOFR + spread) for debt; null for equity
  irr: number | null; // Annualized IRR from modeled cash flows
  principalLoss: number;
  status: 'safe' | 'impaired' | 'loss';
}

// =============================================================================
// WATERFALL OUTPUT
// =============================================================================

export interface WaterfallOutput {
  cashFlows: CashFlowResult[];
  trancheSummary: TrancheSummary[];
  triggerBreaches: number;
  finalCNL: number;
  finalOC: number;
  ardTriggered: boolean;
  ardMonth: number | null;
}
