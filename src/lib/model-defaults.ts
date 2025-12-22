export const DEFAULT_SERVICING_FEE_BPS = 50; // 0.50% annual servicing/trustee fee
export const DEFAULT_OTHER_FEES_BPS = 100; // Additional admin/backup/insurance fees
export const DEFAULT_EQUITY_EXCESS_SHARE_PCT = 55; // % of excess spread distributed to equity

export type TemplateDefaults = {
  equitySharePct: number;
  tranchePricesPct: number[];
};

export const TEMPLATE_DEFAULTS: Record<string, TemplateDefaults> = {
  'auto-abs': {
    equitySharePct: 33,
    tranchePricesPct: [100, 100, 100, 100, 100, 96],
  },
  'consumer': {
    equitySharePct: 72,
    tranchePricesPct: [100, 100, 100, 100, 99],
  },
  'equipment': {
    equitySharePct: 100,
    tranchePricesPct: [100, 100, 100, 80], // A, B, C, Equity
  },
  'clo': {
    equitySharePct: 100,
    tranchePricesPct: [100, 100, 100, 100, 100, 58],
  },
};

export function getTemplateDefaults(templateId: string): TemplateDefaults {
  return TEMPLATE_DEFAULTS[templateId] ?? {
    equitySharePct: DEFAULT_EQUITY_EXCESS_SHARE_PCT,
    tranchePricesPct: [],
  };
}
