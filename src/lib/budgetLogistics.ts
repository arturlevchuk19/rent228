import type { BudgetItem } from './events';

export function calculateBudgetLogistics(items: Pick<BudgetItem, 'item_type' | 'quantity' | 'equipment'>[]) {
  return items.reduce((total, item) => {
    if (item.item_type !== 'equipment' || !item.equipment) return total;
    const quantity = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
    total.netWeight += (item.equipment.weight_kg ?? 0) * quantity;
    total.grossWeight += (item.equipment.gross_weight_kg ?? 0) * quantity;
    total.volume += (item.equipment.volume_m3 ?? 0) * quantity;
    return total;
  }, { netWeight: 0, grossWeight: 0, volume: 0 });
}
