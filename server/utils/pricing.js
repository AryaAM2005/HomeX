const ANNUAL_MONTHS_CHARGED = 10;

function roundMoney(amount, currency) {
  return currency === 'USD' ? Math.round(amount * 100) / 100 : Math.round(amount);
}

function unitPrice(plan, currency) {
  return currency === 'USD' ? plan.usdPrice : plan.priceInr;
}

export function periodPrice(plan, currency, billingCycle) {
  const months = billingCycle === 'annual' ? ANNUAL_MONTHS_CHARGED : 1;
  return roundMoney(unitPrice(plan, currency) * months, currency);
}

export function planPrices(plan) {
  return {
    INR: { monthly: periodPrice(plan, 'INR', 'monthly'), annual: periodPrice(plan, 'INR', 'annual') },
    USD: { monthly: periodPrice(plan, 'USD', 'monthly'), annual: periodPrice(plan, 'USD', 'annual') },
  };
}

// Credit is held in INR. For USD payers it converts at the plan's own INR to USD ratio.
export function quotePrice({ plan, currency, billingCycle, discountPct = 0, creditInr = 0 }) {
  const base = periodPrice(plan, currency, billingCycle);
  const discount = roundMoney((base * discountPct) / 100, currency);
  const afterDiscount = roundMoney(base - discount, currency);

  const toCurrency = unitPrice(plan, currency) / plan.priceInr;
  const creditApplied = Math.min(roundMoney(creditInr * toCurrency, currency), afterDiscount);
  const creditUsedInr = Math.min(Math.round(creditApplied / toCurrency), creditInr);

  return {
    base,
    discount,
    creditApplied,
    creditUsedInr,
    total: roundMoney(afterDiscount - creditApplied, currency),
  };
}

export function addBillingCycle(date, billingCycle) {
  const next = new Date(date);
  const day = next.getDate();

  next.setDate(1);
  next.setMonth(next.getMonth() + (billingCycle === 'annual' ? 12 : 1));

  // Keeps 31 January from rolling over into March.
  const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDayOfMonth));
  return next;
}
