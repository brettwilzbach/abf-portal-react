/**
 * API Client for ABF Portal Backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generic fetch wrapper with error handling
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// HEALTH & STATUS
// ============================================================================

export interface HealthResponse {
  status: string;
  models_available: boolean;
  version: string;
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>('/api/health');
}

// ============================================================================
// MARKET DATA
// ============================================================================

export interface SOFRResponse {
  rate: number;
  source: string;
}

export interface TreasuryCurveResponse {
  curve: Record<string, number>;
  source: string;
}

export interface CorporateSpreadsResponse {
  spreads: Record<string, number>;
  source: string;
}

export interface SpreadDataPoint {
  sector: string;
  current_spread: number;
  benchmark: string;
  ytd_change: number;
  z_score: number;
  one_year_avg: number;
  one_year_min: number;
  one_year_max: number;
}

export interface StructuredSpreadsResponse {
  spreads: SpreadDataPoint[];
  source: string;
}

export async function getSOFR(): Promise<SOFRResponse> {
  return fetchAPI<SOFRResponse>('/api/market/sofr');
}

export async function getTreasuryCurve(): Promise<TreasuryCurveResponse> {
  return fetchAPI<TreasuryCurveResponse>('/api/market/treasury-curve');
}

export async function getCorporateSpreads(): Promise<CorporateSpreadsResponse> {
  return fetchAPI<CorporateSpreadsResponse>('/api/market/corporate-spreads');
}

export async function getStructuredSpreads(): Promise<StructuredSpreadsResponse> {
  return fetchAPI<StructuredSpreadsResponse>('/api/market/structured-spreads');
}

// ============================================================================
// DEALS & TEMPLATES
// ============================================================================

export interface TemplateListResponse {
  templates: string[];
}

export async function getTemplates(): Promise<TemplateListResponse> {
  return fetchAPI<TemplateListResponse>('/api/deals/templates');
}

export async function getTemplateDeal(templateName: string): Promise<Record<string, unknown>> {
  return fetchAPI<Record<string, unknown>>(`/api/deals/template/${encodeURIComponent(templateName)}`);
}

// ============================================================================
// WATERFALL CALCULATIONS
// ============================================================================

export interface TrancheInput {
  name: string;
  balance: number;
  coupon_type: string;
  spread: number;
  rating: string;
}

export interface CollateralInput {
  balance: number;
  wac: number;
  wam: number;
  collateral_type: string;
}

export interface TriggerInput {
  name: string;
  test_type: string;
  threshold: number;
  comparison: string;
  consequence: string;
}

export interface DealInput {
  deal_name: string;
  collateral: CollateralInput;
  tranches: TrancheInput[];
  triggers: TriggerInput[];
}

export interface ScenarioInput {
  name: string;
  cpr: number;
  cdr: number;
  recovery_rate: number;
  index_rate: number;
  projection_months: number;
}

export interface WaterfallRequest {
  deal: DealInput;
  scenario: ScenarioInput;
}

export interface CashFlowRecord {
  Period: number;
  Collateral_Start: number;
  Collateral_End: number;
  Scheduled_Prin: number;
  Prepayments: number;
  Defaults: number;
  Recoveries: number;
  Losses: number;
  Interest_Income: number;
  CNL_percent: number;
  OC_percent: number;
  IC_x: number;
  [key: string]: number | string;
}

export interface TrancheSummary {
  Tranche: string;
  Original_Balance: number;
  Final_Balance: number;
  Total_Interest: number;
  Total_Principal: number;
  Principal_Loss: number;
  MOIC: number;
  WAL: number;
}

export interface WaterfallResponse {
  deal_name: string;
  scenario: string;
  cash_flows: CashFlowRecord[];
  tranche_summary: TrancheSummary[];
  final_cnl: number;
  total_losses: number;
}

export interface BreakevenResult {
  tranche: string;
  rating: string;
  breakeven_cdr: number;
}

export interface BreakevenResponse {
  breakeven_results: BreakevenResult[];
}

export async function calculateWaterfall(request: WaterfallRequest): Promise<WaterfallResponse> {
  return fetchAPI<WaterfallResponse>('/api/waterfall/calculate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function calculateBreakevenCDR(request: WaterfallRequest): Promise<BreakevenResponse> {
  return fetchAPI<BreakevenResponse>('/api/waterfall/breakeven', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatBps(value: number): string {
  return `${value.toFixed(0)}bps`;
}

export function formatSpread(value: number): string {
  return value >= 0 ? `+${value.toFixed(0)}bps` : `${value.toFixed(0)}bps`;
}
