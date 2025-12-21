export interface ScenarioPreset {
  name: string;
  cpr: number;
  cdr: number;
  recovery: number;
  months: number;
}

// Default presets calibrated so base case has:
// 1. Zero trigger breaches (clean new deal)
// 2. All positive IRRs (including equity)
// Base = performing deal with realistic but benign assumptions.
// CDR 1-2% is realistic for performing deals. Stress/Extension will show deterioration.
// IMPORTANT: Projection months must be long enough for deal to fully amortize!
// IRR calculation needs full principal paydown to show correct returns.
export const SCENARIO_PRESETS: Record<string, Record<string, ScenarioPreset>> = {
  'auto-abs': {
    // Auto ABS (Subprime): CNL trigger at 15%, OC at 103%
    // Base: realistic performing deal, run to full amortization
    base: { name: 'Base', cpr: 22, cdr: 2, recovery: 65, months: 60 },
    stress: { name: 'Stress', cpr: 6, cdr: 10, recovery: 35, months: 72 },
    extension: { name: 'Extension', cpr: 3, cdr: 5, recovery: 45, months: 84 },
  },
  'consumer': {
    // Consumer ABS: CNL trigger at 12%, OC at 104%
    // Higher excess spread compensates for higher defaults
    base: { name: 'Base', cpr: 28, cdr: 2, recovery: 45, months: 48 },
    stress: { name: 'Stress', cpr: 8, cdr: 12, recovery: 15, months: 60 },
    extension: { name: 'Extension', cpr: 4, cdr: 7, recovery: 20, months: 72 },
  },
  'equipment': {
    // Equipment ABS: CNL trigger at 10%, OC at 104%
    // Equipment has strong recovery values, WAM is 48 months
    base: { name: 'Base', cpr: 18, cdr: 2, recovery: 85, months: 60 },
    stress: { name: 'Stress', cpr: 4, cdr: 6, recovery: 50, months: 72 },
    extension: { name: 'Extension', cpr: 2, cdr: 3, recovery: 55, months: 84 },
  },
  'clo': {
    // CLO: OC at 108%, no CNL trigger
    // Loan recoveries historically ~60-70%
    base: { name: 'Base', cpr: 20, cdr: 1.5, recovery: 75, months: 72 },
    stress: { name: 'Stress', cpr: 6, cdr: 6, recovery: 50, months: 120 },
    extension: { name: 'Extension', cpr: 4, cdr: 3, recovery: 60, months: 120 },
  },
};
