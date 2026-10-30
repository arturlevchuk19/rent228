import { contentRowKey, type SpecificationContents } from './specificationContents';
import type { BudgetItem } from './events';

export const specificationIsEditable = (status?: string) => status === 'Подтверждено' || status === 'Выполнено';
export const isBudgetSpecificationItem = (item: BudgetItem, extraCategories: Set<string>) => item.item_type === 'equipment' || !!(item.category_id && extraCategories.has(item.category_id));
export const budgetSpecificationPreview = (items: BudgetItem[]) => items.map(item => ({ ...item, source_budget_item_id: item.id, picked: false, return_picked: false }));
export interface SpecificationDifference { sourceId: string; name: string; kind: 'add' | 'update' | 'remove'; source?: BudgetItem; saved?: BudgetItem; requiresManual?: boolean; }
export function getSpecificationDifferences(budget: BudgetItem[], specification: BudgetItem[], contents?: SpecificationContents): SpecificationDifference[] {
  const linked = new Map(specification.flatMap(item => item.source_budget_item_id ? [[item.source_budget_item_id, item] as const] : []));
  const ids = new Set(budget.map(item => item.id));
  const result: SpecificationDifference[] = [];
  for (const source of budget) {
    const saved = linked.get(source.id);
    const name = source.name || source.equipment?.name || source.work_item?.name || 'Позиция';
    if (!saved) result.push({ sourceId: source.id, name, kind: 'add', source });
    else if (['quantity','equipment_id','modification_id','category_id','location_id','name'].some(key => (saved[key as keyof BudgetItem] ?? null) !== (source[key as keyof BudgetItem] ?? null))) result.push({ sourceId: source.id, name, kind: 'update', source, saved });
  }
  for (const [sourceId, saved] of linked) if (!ids.has(sourceId)) result.push({ sourceId, name: saved.name || saved.equipment?.name || saved.work_item?.name || 'Позиция', kind: 'remove', saved });
  if (!contents) return result;
  const totals = (side: 'budget' | 'specification', rows: BudgetItem[]) => {
    const map = new Map<string, number>();
    for (const row of rows) for (const part of contents.get(contentRowKey(side, row.id)) || []) map.set(part.key, (map.get(part.key) || 0) + part.quantity);
    return map;
  };
  const expected = totals('budget', budget), actual = totals('specification', specification);
  const balance = new Map([...new Set([...expected.keys(), ...actual.keys()])].map(key => [key, (expected.get(key) || 0) - (actual.get(key) || 0)]));
  const epsilon = 1e-8;
  const unresolvedCase = [...actual.keys()].some(key => key.includes('unknown:specification:'));
  if ([...balance.values()].every(value => Math.abs(value) < epsilon)) return [];
  const filtered: SpecificationDifference[] = [];
  for (const change of [...result].sort((a, b) => (a.kind === 'update' ? 0 : 1) - (b.kind === 'update' ? 0 : 1))) {
    const delta = new Map<string, number>();
    if (change.source) for (const part of contents.get(contentRowKey('budget', change.source.id)) || []) delta.set(part.key, (delta.get(part.key) || 0) + part.quantity);
    if (change.saved) for (const part of contents.get(contentRowKey('specification', change.saved.id)) || []) delta.set(part.key, (delta.get(part.key) || 0) - part.quantity);
    if (![...delta].some(([key, value]) => Math.abs(value) > epsilon && value * (balance.get(key) || 0) > epsilon)) continue;
    // Partly covered kits must be adjusted manually, never re-added in full.
    const safe = !unresolvedCase && [...delta].every(([key, value]) => Math.abs(value) < epsilon || (value * (balance.get(key) || 0) > 0 && Math.abs(value) <= Math.abs(balance.get(key) || 0) + epsilon));
    filtered.push({ ...change, requiresManual: !safe });
    if (safe) for (const [key, value] of delta) balance.set(key, (balance.get(key) || 0) - value);
  }
  for (const row of specification) {
    if (filtered.some(change => change.saved?.id === row.id)) continue;
    const parts = contents.get(contentRowKey('specification', row.id)) || [];
    if (parts.some(part => (balance.get(part.key) || 0) < -epsilon)) filtered.push({ sourceId: `content:${row.id}`, name: row.name || row.equipment?.name || 'Комплект', kind: 'update', saved: row, requiresManual: true });
  }
  return filtered;
}
export const specificationDiffersFromBudget = (budget: BudgetItem[], specification: BudgetItem[]) => getSpecificationDifferences(budget, specification).length > 0;
