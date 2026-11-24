export interface BudgetPricingItem {
  price: number;
  quantity: number;
  multi_day_rate_override?: number | null;
  /** Derived from budget groups for pricing. This value is never written to the item. */
  dynamic_coefficient?: number;
}

type TotalsMode = 'combined_only' | 'day1_plus_combined';

/** Do not turn floating-point noise just above a whole BYN into another BYN. */
export const ceilCurrencyUnit = (value: number): number => {
  const nearest = Math.round(value);
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value)) * 8;
  return Math.abs(value - nearest) <= tolerance ? nearest : Math.ceil(value);
};

export const calcDay1UnitPrice = (item: Pick<BudgetPricingItem, 'price' | 'dynamic_coefficient'>, days = 1): number =>
  days <= 1 ? item.price * (item.dynamic_coefficient ?? 1) : item.price;

export const calcDay1Total = (item: BudgetPricingItem, days = 1): number =>
  calcDay1UnitPrice(item, days) * item.quantity;

export const calcBudgetCoefficient = (
  item: Pick<BudgetPricingItem, 'dynamic_coefficient' | 'multi_day_rate_override'>,
  days: number,
  rateOverride?: number | null
): number => item.dynamic_coefficient ?? (1 + Math.max(0, days - 1) * (rateOverride ?? item.multi_day_rate_override ?? 0));

export const calcCombinedTotal = (
  item: BudgetPricingItem,
  days: number,
  rateOverride?: number | null
): number => item.price * calcBudgetCoefficient(item, days, rateOverride) * item.quantity;

export const calcGrandTotals = (
  items: Array<BudgetPricingItem>,
  days: number,
  mode: TotalsMode
) => {
  const day1Total = items.reduce((sum, item) => sum + calcDay1Total(item, days), 0);
  const combinedTotal = items.reduce((sum, item) => sum + calcCombinedTotal(item, days), 0);
  const totalForMode = mode === 'combined_only' ? combinedTotal : day1Total;

  return { day1Total, combinedTotal, totalForMode };
};

/** Monetary price shown to the user, before multiplying by quantity. */
export const roundBudgetPrice = (value: number): number => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
export const budgetLineAmount = (displayedUnitPrice: number, quantity: number): number => roundBudgetPrice(roundBudgetPrice(displayedUnitPrice) * quantity);
/** Keep hidden USD precision until AFTER currency conversion. */
export const calcCombinedUnitPrice = (item: BudgetPricingItem, days: number, rateOverride?: number | null): number => calcCombinedTotal({ ...item, quantity: 1 }, days, rateOverride);
export const calcDisplayedDay1Total = (item: BudgetPricingItem, days = 1): number => budgetLineAmount(calcDay1UnitPrice(item, days), item.quantity);
export const calcDisplayedCombinedTotal = (item: BudgetPricingItem, days: number, rateOverride?: number | null): number => budgetLineAmount(calcCombinedUnitPrice(item, days, rateOverride), item.quantity);
export const calcDisplayedGrandTotals = (items: Array<BudgetPricingItem>, days: number, mode: TotalsMode) => {
  const day1Total = roundBudgetPrice(items.reduce((sum, item) => sum + calcDisplayedDay1Total(item, days), 0));
  const combinedTotal = roundBudgetPrice(items.reduce((sum, item) => sum + calcDisplayedCombinedTotal(item, days), 0));
  return { day1Total, combinedTotal, totalForMode: mode === 'combined_only' ? combinedTotal : day1Total };
};

/** Grand totals are rounded down to the nearest multiple of five. */
export const roundBudgetTotalDown = (value: number): number => Math.floor(roundBudgetPrice(value) / 5) * 5;
