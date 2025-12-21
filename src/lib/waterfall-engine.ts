import type { DealTemplate, WaterfallOutput } from '@/types/waterfall';

export function calculateIRR(cashFlows: number[], guess = 0.01): number | null {
  if (cashFlows.length < 2) return null;
  const hasPositive = cashFlows.some((cf) => cf > 0);
  const hasNegative = cashFlows.some((cf) => cf < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = guess;
  for (let i = 0; i < 50; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const cf = cashFlows[t];
      const denom = Math.pow(1 + rate, t);
      npv += cf / denom;
      if (t > 0) {
        dnpv -= (t * cf) / Math.pow(1 + rate, t + 1);
      }
    }
    if (Math.abs(npv) < 1e-7) return rate;
    if (dnpv == 0) break;
    rate = rate - npv / dnpv;
    if (rate <= -0.99) rate = -0.99;
  }
  return null;
}

export function calculateWaterfall(
  template: DealTemplate,
  cpr: number,
  cdr: number,
  recovery: number,
  months: number,
  sofrRate: number = 3.69, // SOFR base rate assumption
  excessSpreadBps: number = 0, // Additional spread on collateral (bps)
  servicingFeeBps: number = 0, // Annual servicing/trustee fee on collateral (bps)
  otherFeesBps: number = 0, // Additional admin/backup/insurance fees (bps)
  equitySharePct: number = 100, // % of excess spread distributed to equity in pro-rata mode
  tranchePricesPct?: number[]
): WaterfallOutput {
  const cashFlows: WaterfallOutput['cashFlows'] = [];
  let collateralBalance = template.collateralBalance;
  let cumulativeLoss = 0;
  const monthlyPaymentRate = 1 / template.wam;

  // Find ARD trigger - only type='ARD' causes turbo; type='INFO' is informational only (e.g., CLO non-call)
  const ardTrigger = template.triggers.find((t) => t.type === 'ARD');
  const ardMonth = ardTrigger ? ardTrigger.threshold : Infinity;
  let ardTriggered = false;
  let ardActivationMonth: number | null = null;

  // Track tranche balances and principal receipts
  const trancheBalances = template.tranches.map((t) => t.balance);
  const tranchePrincipalReceived = template.tranches.map(() => 0);
  const trancheInterestReceived = template.tranches.map(() => 0);
  const trancheInterestShortfall = template.tranches.map(() => 0);
  const trancheCashFlows = template.tranches.map(() => [] as number[]);

  // Track if we're in sequential mode (triggered by OC/CNL breach)
  let isSequentialMode = false;

  // Run until collateral is paid off OR we hit the max months cap
  const maxMonths = Math.max(months, template.wam * 2);
  for (let period = 1; period <= maxMonths && collateralBalance > 0.1; period++) {
    const startBalance = collateralBalance;
    const scheduledPrincipal = startBalance * monthlyPaymentRate;
    const prepayments = startBalance * (cpr / 100 / 12);
    const defaults = startBalance * (cdr / 100 / 12);
    const recoveries = defaults * (recovery / 100);
    const losses = defaults - recoveries;
    const servicingFeePct = servicingFeeBps / 100;
    const otherFeesPct = otherFeesBps / 100;
    const effectiveWac = Math.max(
      0,
      template.wac + excessSpreadBps / 100 - servicingFeePct - otherFeesPct
    );
    const interestIncome = startBalance * (effectiveWac / 100 / 12);

    let availableInterest = interestIncome;
    const periodInterestPaid = template.tranches.map(() => 0);
    const periodPrincipalPaid = template.tranches.map(() => 0);

    // Pay interest to tranches in priority order (senior first)
    for (let i = 0; i < template.tranches.length; i++) {
      const t = template.tranches[i];
      if (trancheBalances[i] > 0 && t.spread > 0) {
        const couponDue = trancheBalances[i] * ((sofrRate + t.spread / 100) / 100 / 12);
        const couponPaid = Math.min(couponDue, availableInterest);
        const shortfall = couponDue - couponPaid;
        trancheInterestReceived[i] += couponPaid;
        periodInterestPaid[i] += couponPaid;
        trancheInterestShortfall[i] += shortfall;
        availableInterest -= couponPaid;
      }
    }
    const excessSpread = Math.max(0, availableInterest);

    cumulativeLoss += losses;
    collateralBalance = startBalance - scheduledPrincipal - prepayments - defaults;

    const cnlPercent = (cumulativeLoss / template.collateralBalance) * 100;
    const cnlTrigger = template.triggers.find((t) => t.type === 'CNL');
    const cnlBreached = cnlTrigger && cnlPercent > cnlTrigger.threshold;

    const isPostARD = period > ardMonth && collateralBalance > 0.1;
    if (isPostARD && !ardTriggered) {
      ardTriggered = true;
      ardActivationMonth = period;
    }

    let availablePrincipal = scheduledPrincipal + prepayments + recoveries;
    let turboPayment = 0;
    let excessSpreadToEquity = 0;

    const useSequential = isSequentialMode || isPostARD;

    if (useSequential) {
      turboPayment = excessSpread;
      availablePrincipal += excessSpread;
    } else {
      const equityShare = Math.max(0, Math.min(1, equitySharePct / 100));
      excessSpreadToEquity = excessSpread * equityShare;
      const retainedExcess = excessSpread - excessSpreadToEquity;
      // Treat retained excess as OC build (turbo to seniors) even in pro-rata mode
      if (retainedExcess > 0) {
        turboPayment = retainedExcess;
        availablePrincipal += retainedExcess;
      }
    }

    const ratedTranchesInfo = template.tranches
      .map((t, idx) => ({ idx, balance: trancheBalances[idx], rating: t.rating }))
      .filter((t) => t.rating !== 'NR' && t.balance > 0);

    if (useSequential) {
      for (let i = 0; i < trancheBalances.length && availablePrincipal > 0; i++) {
        if (trancheBalances[i] > 0 && template.tranches[i].rating !== 'NR') {
          const paydown = Math.min(availablePrincipal, trancheBalances[i]);
          trancheBalances[i] -= paydown;
          tranchePrincipalReceived[i] += paydown;
          periodPrincipalPaid[i] += paydown;
          availablePrincipal -= paydown;
        }
      }
    } else {
      const totalRatedBalance = ratedTranchesInfo.reduce((sum, t) => sum + t.balance, 0);
      if (totalRatedBalance > 0) {
        const principalToDistribute = Math.min(availablePrincipal, totalRatedBalance);
        for (const t of ratedTranchesInfo) {
          const share = t.balance / totalRatedBalance;
          const paydown = Math.min(principalToDistribute * share, trancheBalances[t.idx]);
          trancheBalances[t.idx] -= paydown;
          tranchePrincipalReceived[t.idx] += paydown;
          periodPrincipalPaid[t.idx] += paydown;
          availablePrincipal -= paydown;
        }
      }
    }

    for (let i = 0; i < trancheBalances.length && availablePrincipal > 0; i++) {
      if (trancheBalances[i] > 0 && template.tranches[i].rating === 'NR') {
        const paydown = Math.min(availablePrincipal, trancheBalances[i]);
        trancheBalances[i] -= paydown;
        tranchePrincipalReceived[i] += paydown;
        availablePrincipal -= paydown;
      }
    }

    const equityIdx = template.tranches.findIndex((t) => t.rating === 'NR');
    if (equityIdx >= 0 && excessSpreadToEquity > 0) {
      trancheInterestReceived[equityIdx] += excessSpreadToEquity;
      periodInterestPaid[equityIdx] += excessSpreadToEquity;
    }

    for (let i = 0; i < trancheCashFlows.length; i++) {
      trancheCashFlows[i].push(periodInterestPaid[i] + periodPrincipalPaid[i]);
    }

    const ratedNoteBalances = template.tranches
      .map((t, idx) => (t.rating !== 'NR' ? trancheBalances[idx] : 0))
      .reduce((sum, b) => sum + b, 0);
    const ocPercent = ratedNoteBalances > 0 ? (collateralBalance / ratedNoteBalances) * 100 : 999;
    const ocTrigger = template.triggers.find((t) => t.type === 'OC');
    const ocBreached = ocTrigger && ratedNoteBalances > 0 && ocPercent < ocTrigger.threshold;

    if (ocBreached || cnlBreached) {
      isSequentialMode = true;
    }

    const triggerStatus = (ocBreached || cnlBreached) ? 'Fail' : 'Pass';

    cashFlows.push({
      period,
      collateralStart: startBalance,
      collateralEnd: Math.max(0, collateralBalance),
      scheduledPrincipal,
      prepayments,
      defaults,
      recoveries,
      losses,
      interestIncome,
      excessSpread,
      cnlPercent,
      ocPercent,
      triggerStatus,
      ardActive: isPostARD,
      turboPayment: (isPostARD || isSequentialMode) ? turboPayment : 0,
    });
  }

  const trancheSummary = template.tranches.map((tranche, idx) => {
    const finalBalance = trancheBalances[idx];
    const principalReceived = tranchePrincipalReceived[idx];
    const interestReceived = trancheInterestReceived[idx];
    const interestShortfall = trancheInterestShortfall[idx];
    const principalLoss = Math.max(0, tranche.balance - principalReceived - finalBalance);

    const avgPeriod = cashFlows.length > 0 ? (cashFlows.length / 2) : 1;
    const wal = principalReceived > 0 ? (avgPeriod / 12) : 0;

    const totalCashReceived = principalReceived + interestReceived;
    const pricePct = tranchePricesPct?.[idx] ?? 100;
    const investedCapital = tranche.balance > 0 ? tranche.balance * (pricePct / 100) : 0;
    const moic = investedCapital > 0 ? totalCashReceived / investedCapital : 0;

    const initialOutflow = tranche.balance > 0 ? -(tranche.balance * (pricePct / 100)) : 0;
    const cashFlowSeries = tranche.balance > 0
      ? [initialOutflow, ...trancheCashFlows[idx]]
      : [];
    const monthlyIrr = cashFlowSeries.length > 0 ? calculateIRR(cashFlowSeries) : null;
    const irr = monthlyIrr == null ? null : Math.pow(1 + monthlyIrr, 12) - 1;

    return {
      name: tranche.name,
      rating: tranche.rating,
      originalBalance: tranche.balance,
      finalBalance: Math.max(0, finalBalance),
      totalInterest: interestReceived,
      totalPrincipal: principalReceived,
      principalLoss,
      interestShortfall,
      moic: Math.max(0, moic),
      irr: irr == null ? null : Math.max(-0.99, irr),
      wal: Math.max(0.1, wal),
    };
  });

  const lastCf = cashFlows[cashFlows.length - 1];
  return {
    cashFlows,
    trancheSummary,
    triggerBreaches: cashFlows.filter((cf) => cf.triggerStatus === 'Fail').length,
    finalCNL: lastCf?.cnlPercent || 0,
    finalOC: lastCf?.ocPercent || 0,
    ardTriggered,
    ardMonth: ardActivationMonth,
  };
}

export function calculateBreakevenCDR(
  template: DealTemplate,
  cpr: number,
  recovery: number,
  months: number,
  trancheIndex: number,
  servicingFeeBps: number = 0,
  otherFeesBps: number = 0,
  equitySharePct: number = 100,
  tranchePricesPct?: number[]
): number | null {
  let low = 0;
  let high = 50;
  const tolerance = 0.1;

  const atZero = calculateWaterfall(
    template,
    cpr,
    0,
    recovery,
    months,
    3.69,
    0,
    servicingFeeBps,
    otherFeesBps,
    equitySharePct,
    tranchePricesPct
  );
  if (atZero.trancheSummary[trancheIndex]?.principalLoss > 0.01) {
    return 0;
  }

  const atMax = calculateWaterfall(
    template,
    cpr,
    high,
    recovery,
    months,
    3.69,
    0,
    servicingFeeBps,
    otherFeesBps,
    equitySharePct,
    tranchePricesPct
  );
  if (atMax.trancheSummary[trancheIndex]?.principalLoss <= 0.01) {
    return null;
  }

  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const result = calculateWaterfall(
      template,
      cpr,
      mid,
      recovery,
      months,
      3.69,
      0,
      servicingFeeBps,
      otherFeesBps,
      equitySharePct,
      tranchePricesPct
    );
    const hasLoss = result.trancheSummary[trancheIndex]?.principalLoss > 0.01;

    if (hasLoss) {
      high = mid;
    } else {
      low = mid;
    }

    if (high - low < tolerance) break;
  }

  return (low + high) / 2;
}
