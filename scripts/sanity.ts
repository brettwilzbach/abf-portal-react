import { DEAL_TEMPLATES } from '@/lib/deal-templates';
import { calculateWaterfall } from '@/lib/waterfall-engine';
import { SCENARIO_PRESETS } from '@/lib/scenario-presets';
import {
  DEFAULT_SERVICING_FEE_BPS,
  DEFAULT_OTHER_FEES_BPS,
  getTemplateDefaults,
} from '@/lib/model-defaults';

type Scenario = {
  name: string;
  cpr: number;
  cdr: number;
  recovery: number;
  months: number;
  excessSpreadBps: number;
  servicingFeeBps: number;
  otherFeesBps: number;
  equitySharePct: number;
  tranchePricesPct: number[];
};

const templateKey = process.argv[2] || 'equipment';
const template = DEAL_TEMPLATES[templateKey as keyof typeof DEAL_TEMPLATES];

if (!template) {
  console.error(`Unknown template: ${templateKey}`);
  process.exit(1);
}

const basePreset = SCENARIO_PRESETS[templateKey]?.base ?? SCENARIO_PRESETS['equipment'].base;
const templateDefaults = getTemplateDefaults(templateKey);
const defaultTranchePrices = (
  templateDefaults.tranchePricesPct.length === template.tranches.length
    ? templateDefaults.tranchePricesPct
    : template.tranches.map(() => 100)
);
const scenarios: Scenario[] = [
  {
    name: 'base',
    cpr: basePreset.cpr,
    cdr: basePreset.cdr,
    recovery: basePreset.recovery,
    months: basePreset.months,
    excessSpreadBps: 0,
    servicingFeeBps: DEFAULT_SERVICING_FEE_BPS,
    otherFeesBps: DEFAULT_OTHER_FEES_BPS,
    equitySharePct: templateDefaults.equitySharePct,
    tranchePricesPct: defaultTranchePrices,
  },
  {
    name: 'improve',
    cpr: Math.max(0, basePreset.cpr - 8),
    cdr: Math.max(0, basePreset.cdr - 1),
    recovery: Math.min(95, basePreset.recovery + 5),
    months: basePreset.months,
    excessSpreadBps: 100,
    servicingFeeBps: DEFAULT_SERVICING_FEE_BPS,
    otherFeesBps: DEFAULT_OTHER_FEES_BPS,
    equitySharePct: templateDefaults.equitySharePct,
    tranchePricesPct: defaultTranchePrices,
  },
  {
    name: 'nuke',
    cpr: Math.max(1, basePreset.cpr - 12),
    cdr: Math.min(30, basePreset.cdr * 6),
    recovery: Math.max(10, basePreset.recovery - 35),
    months: Math.max(basePreset.months, 72),
    excessSpreadBps: -100,
    servicingFeeBps: DEFAULT_SERVICING_FEE_BPS,
    otherFeesBps: DEFAULT_OTHER_FEES_BPS,
    equitySharePct: templateDefaults.equitySharePct,
    tranchePricesPct: defaultTranchePrices,
  },
];

const formatPct = (val: number | null) =>
  val == null ? '--' : `${(val * 100).toFixed(1)}%`;

console.log(`Template: ${template.name}`);
for (const scenario of scenarios) {
  const result = calculateWaterfall(
    template,
    scenario.cpr,
    scenario.cdr,
    scenario.recovery,
    scenario.months,
    3.66,
    scenario.excessSpreadBps,
    scenario.servicingFeeBps,
    scenario.otherFeesBps,
    scenario.equitySharePct,
    scenario.tranchePricesPct
  );
  const breachMonths = result.cashFlows.filter((cf) => cf.triggerStatus === 'Fail').length;
  const firstBreach = result.cashFlows.find((cf) => cf.triggerStatus === 'Fail')?.period ?? null;
  const equity = result.trancheSummary.find((t) => t.rating === 'NR');
  const minIrr = Math.min(
    ...result.trancheSummary.map((t) => (t.irr == null ? 0 : t.irr))
  );

  console.log(`\n[${scenario.name}]`);
  console.log(`  Breach months: ${breachMonths}${firstBreach ? ` (first M${firstBreach})` : ''}`);
  console.log(`  Equity IRR: ${formatPct(equity?.irr ?? null)}`);
  console.log(`  Min IRR: ${formatPct(minIrr)}`);
}
