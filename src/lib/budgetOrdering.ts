import type { BudgetItem } from './events';
import type { Location } from './locations';
import type { Category } from './categories';

const NO_LOCATION = 'no-location';
const UNCATEGORIZED = 'uncategorized';

/**
 * Returns budget items in the same order the estimate (смета) renders them:
 * grouped by location (in `locations` array order, then by name, no-location last),
 * then by category (in `categories` array order, then by name), preserving the
 * source array order of items within each group.
 *
 * This mirrors the ordering logic in pdfGenerator.generateBudgetPDF so that any
 * document derived from the same items (e.g. the contract/specification table)
 * matches the estimate exactly.
 */
export function orderBudgetItemsForEstimate(
  budgetItems: BudgetItem[],
  locations: Location[] = [],
  categories: Category[] = []
): BudgetItem[] {
  const groupedByLocation: Record<string, Record<string, BudgetItem[]>> = {};
  for (const item of budgetItems) {
    const locationId = item.location_id || NO_LOCATION;
    const categoryId = item.category_id || UNCATEGORIZED;
    if (!groupedByLocation[locationId]) groupedByLocation[locationId] = {};
    if (!groupedByLocation[locationId][categoryId]) groupedByLocation[locationId][categoryId] = [];
    groupedByLocation[locationId][categoryId].push(item);
  }

  const locationOrder = locations.map((location) => location.id);
  const sortedLocationIds = Object.keys(groupedByLocation).sort((a, b) => {
    if (a === NO_LOCATION) return 1;
    if (b === NO_LOCATION) return -1;
    const indexA = locationOrder.indexOf(a);
    const indexB = locationOrder.indexOf(b);
    const normalizedA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
    const normalizedB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
    if (normalizedA !== normalizedB) return normalizedA - normalizedB;
    const nameA = groupedByLocation[a][Object.keys(groupedByLocation[a])[0]]?.[0]?.location?.name ?? '';
    const nameB = groupedByLocation[b][Object.keys(groupedByLocation[b])[0]]?.[0]?.location?.name ?? '';
    return nameA.localeCompare(nameB, 'ru');
  });

  const categoryOrder = categories.map((category) => category.id);
  const result: BudgetItem[] = [];
  for (const locationId of sortedLocationIds) {
    const groupedByCategory = groupedByLocation[locationId];
    const sortedCategoryIds = Object.keys(groupedByCategory).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      const normalizedA = indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA;
      const normalizedB = indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB;
      if (normalizedA !== normalizedB) return normalizedA - normalizedB;
      return a.localeCompare(b, 'ru');
    });
    for (const categoryId of sortedCategoryIds) {
      result.push(...groupedByCategory[categoryId]);
    }
  }
  return result;
}
