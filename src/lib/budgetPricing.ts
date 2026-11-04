import type { BudgetItem } from './events';

type TotalsMode = 'combined_only' | 'day1_plus_combined';

/** Do not turn floating-point noise just above a whole BYN into another BYN. */
export const ceilCurrencyUnit = (value: number): number => {
  const nearest = Math.round(value);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 8;
  return Math.abs(value - nearest) <= tolerance ? nearest : Math.ceil(value);
};

export const calcDay1Total = (item: Pick<BudgetItem, 'price' | 'quantity'>): number => {
  return item.price * item.quantity;
};

export const calcCombinedTotal = (
  item: Pick<BudgetItem, 'price' | 'quantity' | 'multi_day_rate_override'>,
  days: number,
  rateOverride?: number | null
): number => {
  const normalizedDays = Math.max(1, days);
  const day1Total = calcDay1Total(item);
  const appliedRate = rateOverride ?? item.multi_day_rate_override ?? 0;
  const extraDays = Math.max(0, normalizedDays - 1);
  return day1Total + day1Total * appliedRate * extraDays;
};

export const calcGrandTotals = (
  items: Array<Pick<BudgetItem, 'price' | 'quantity' | 'multi_day_rate_override'>>,
  days: number,
  mode: TotalsMode
) => {
  const day1Total = items.reduce((sum, item) => sum + calcDay1Total(item), 0);
  const combinedTotal = items.reduce((sum, item) => sum + calcCombinedTotal(item, days), 0);
  const totalForMode = mode === 'combined_only' ? combinedTotal : day1Total;

  return { day1Total, combinedTotal, totalForMode };
};

/** Monetary price shown to the user, before multiplying by quantity. */
export const roundBudgetPrice = (value: number): number => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
export const budgetLineAmount = (displayedUnitPrice: number, quantity: number): number => roundBudgetPrice(roundBudgetPrice(displayedUnitPrice) * quantity);
/** Keep hidden USD precision until AFTER currency conversion. */
export const calcCombinedUnitPrice = (item: Pick<BudgetItem, 'price' | 'quantity' | 'multi_day_rate_override'>, days: number, rateOverride?: number | null): number => calcCombinedTotal({ ...item, quantity: 1 }, days, rateOverride);
export const calcDisplayedDay1Total = (item: Pick<BudgetItem, 'price' | 'quantity'>): number => budgetLineAmount(item.price, item.quantity);
export const calcDisplayedCombinedTotal = (item: Pick<BudgetItem, 'price' | 'quantity' | 'multi_day_rate_override'>, days: number, rateOverride?: number | null): number => budgetLineAmount(calcCombinedUnitPrice(item, days, rateOverride), item.quantity);
export const calcDisplayedGrandTotals = (items: Array<Pick<BudgetItem, 'price' | 'quantity' | 'multi_day_rate_override'>>, days: number, mode: TotalsMode) => {
  const day1Total = roundBudgetPrice(items.reduce((sum, item) => sum + calcDisplayedDay1Total(item), 0));
  const combinedTotal = roundBudgetPrice(items.reduce((sum, item) => sum + calcDisplayedCombinedTotal(item, days), 0));
  return { day1Total, combinedTotal, totalForMode: mode === 'combined_only' ? combinedTotal : day1Total };
};

/** Grand totals are rounded down to the nearest multiple of five. */
export const roundBudgetTotalDown = (value: number): number => Math.floor(roundBudgetPrice(value) / 5) * 5;
