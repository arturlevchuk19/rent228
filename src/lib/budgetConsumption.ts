import type { BudgetItem } from './events';

// Consumption fields are stored as text for compatibility with the equipment directory.
export function parseConsumption(value: string | null | undefined): number {
  const normalized = (value || '').trim().replace(',', '.').replace(/\s*(кВт|kw)$/i, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

export function calculateBudgetConsumption(items: Pick<BudgetItem, 'item_type' | 'quantity' | 'equipment'>[]) {
  return items.reduce((total, item) => {
    if (item.item_type !== 'equipment' || !item.equipment) return total;
    const quantity = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
    const nominal = parseConsumption(item.equipment.power);
    const peak = item.equipment.peak_power?.trim();
    total.nominal += nominal * quantity;
    total.maximum += (peak ? parseConsumption(peak) : nominal) * quantity;
    return total;
  }, { nominal: 0, maximum: 0 });
}

export const formatConsumption = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кВт`;

export function validateConsumptionInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '0';
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed) || !Number.isFinite(Number(trimmed.replace(',', '.')))) {
    throw new Error('Потребление должно быть неотрицательным числом в кВт');
  }
  return trimmed;
}
