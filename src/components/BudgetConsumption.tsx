import type { BudgetItem } from '../lib/events';
import { calculateBudgetConsumption, formatConsumption } from '../lib/budgetConsumption';

export function BudgetConsumption({ items, showNominal, showMaximum }: {
  items: BudgetItem[]; showNominal: boolean; showMaximum: boolean;
}) {
  if (!showNominal && !showMaximum) return null;
  const total = calculateBudgetConsumption(items);
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300" aria-label="Потребление оборудования">
    {showNominal && <span>Ном. потребление: <strong className="text-amber-200">{formatConsumption(total.nominal)}</strong></span>}
    {showMaximum && <span>Макс. потребление: <strong className="text-amber-200">{formatConsumption(total.maximum)}</strong></span>}
  </div>;
}
