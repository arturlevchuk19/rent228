import type { BudgetItem } from './events';

type TotalsMode = 'combined_only' | 'day1_plus_combined';

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
