import { calculateBudgetLogistics } from '../lib/budgetLogistics';
import type { BudgetItem } from '../lib/events';
import { calculateBudgetConsumption, formatConsumption } from '../lib/budgetConsumption';

export function BudgetConsumption({ items, showNominal, showMaximum, showNetWeight, showGrossWeight, showVolume }: {
  items: BudgetItem[];
  showNominal: boolean;
  showMaximum: boolean;
  showNetWeight?: boolean;
  showGrossWeight?: boolean;
  showVolume?: boolean;
}) {
  if (!showNominal && !showMaximum && !showNetWeight && !showGrossWeight && !showVolume) return null;
  const total = calculateBudgetConsumption(items);
  const logistics = calculateBudgetLogistics(items);
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300" aria-label="Характеристики оборудования">
    {showNominal && <span>Ном. потребление: <strong className="text-amber-200">{formatConsumption(total.nominal)}</strong></span>}
    {showMaximum && <span>Макс. потребление: <strong className="text-amber-200">{formatConsumption(total.maximum)}</strong></span>}
    {showNetWeight && <span>Вес (Нетто): <strong className="text-amber-200">{logistics.netWeight.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг</strong></span>}
    {showGrossWeight && <span>Вес (Брутто): <strong className="text-amber-200">{logistics.grossWeight.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг</strong></span>}
    {showVolume && <span>Объём: <strong className="text-amber-200">{logistics.volume.toLocaleString('ru-RU', { maximumFractionDigits: 9 })} м³</strong></span>}
  </div>;
}
