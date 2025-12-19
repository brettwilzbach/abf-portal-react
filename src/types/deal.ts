/**
 * Deal and Tranche Types for ABF Portal
 */

export type CollateralType =
  | 'prime_auto'
  | 'subprime_auto'
  | 'credit_card'
  | 'equipment'
  | 'consumer'
  | 'student_loan'
  | 'clo'
  | 'esoteric';

export type RatingAgency = 'SP' | 'Moodys' | 'Fitch' | 'KBRA' | 'DBRS';

export interface Rating {
  agency: RatingAgency;
  rating: string;
}

export interface Tranche {
  name: string;
  original_balance: number;
  current_balance: number;
  coupon_type: 'fixed' | 'floating';
  coupon?: number;
  spread?: number;
  ratings: Rating[];
}

export interface CollateralPool {
  original_balance: number;
  current_balance: number;
  collateral_type: CollateralType;
  weighted_average_coupon: number;
  weighted_average_maturity: number;
  weighted_average_life: number;
}

export interface TriggerTest {
  name: string;
  test_type: 'oc' | 'ic' | 'cnl' | 'dscr';
  threshold: number;
  comparison: '>=' | '<=' | '>' | '<';
  consequence: string;
}

export interface Fee {
  name: string;
  rate: number;
  basis: 'collateral' | 'tranches' | 'fixed';
  priority: number;
}

export interface ReserveAccount {
  name: string;
  initial_balance: number;
  target_balance: number;
  target_type: 'fixed' | 'percentage';
}

export interface DealStructure {
  deal_name: string;
  issuer?: string;
  bookrunner?: string;
  pricing_date?: string;
  closing_date?: string;
  format?: string;
  collateral: CollateralPool;
  tranches: Tranche[];
  triggers: TriggerTest[];
  fees: Fee[];
  reserves: ReserveAccount[];
}

// Simplified versions for forms
export interface SimpleTranche {
  name: string;
  original_balance: number;
  coupon: number;
  oc_target: number;
  is_equity: boolean;
}

export interface SimplePool {
  balance: number;
  wac: number;
  wam: number;
}

// Metrics and results
export interface TrancheMetrics {
  name: string;
  original_balance: number;
  total_interest: number;
  total_principal: number;
  final_balance: number;
  principal_loss: number;
  moic: number;
  wal: number;
  simple_yield: number;
  oc_fail_months: number;
}

export interface PoolMetrics {
  final_cnl: number;
  total_losses: number;
  final_balance: number;
}

export interface ScenarioResult {
  name: string;
  cpr: number;
  cdr: number;
  severity: number;
  pool_cnl: number;
  tranche_moics: Record<string, number>;
}
