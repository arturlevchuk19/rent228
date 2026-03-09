import { BudgetItem } from './events';
import { getEquipmentCompositions, findCasesForModules, ModuleCase } from './equipmentCompositions';

// This interface matches the one in WarehouseSpecification
export interface ExpandedItem {
  budgetItemId: string;
  categoryId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  category: string;
  notes: string;
  picked: boolean;
  isFromComposition: boolean;
  parentName?: string;
}

/**
 * Adds virtual case rows for LED screens based on their module compositions.
 * Cases are derived from the module compositions and calculated based on module capacity.
 */
export async function addCaseRowsForLedScreen(
  item: BudgetItem,
  items: ExpandedItem[]
): Promise<void> {
  if (!item.equipment_id) return;

  try {
    const compositions = await getEquipmentCompositions(item.equipment_id, true);
    if (compositions.length === 0) return;

    const moduleIds = compositions.map(c => c.child_id);
    const cases = await findCasesForModules(moduleIds);

    // Aggregate cases by case ID to avoid duplicates
    const casesById: Record<string, { caseInfo: ModuleCase, totalModuleQty: number }> = {};

    for (const module of compositions) {
      if (module.quantity <= 0) continue;

      const totalModuleQty = module.quantity * item.quantity;
      const matchingCase = cases.find(c => c.moduleChildId === module.child_id);

      if (matchingCase) {
        if (casesById[matchingCase.id]) {
          // Aggregate quantities for same case
          casesById[matchingCase.id].totalModuleQty += totalModuleQty;
        } else {
          casesById[matchingCase.id] = {
            caseInfo: matchingCase,
            totalModuleQty
          };
        }
      }
    }

    // Add derived case rows
    for (const { caseInfo, totalModuleQty } of Object.values(casesById)) {
      const casesNeeded = Math.ceil(totalModuleQty / caseInfo.moduleCapacity);
      if (casesNeeded > 0) {
        items.push({
          budgetItemId: `${item.id}-case-${caseInfo.id}`,
          categoryId: item.category_id || null,
          name: caseInfo.name,
          sku: caseInfo.sku,
          quantity: casesNeeded,
          unit: 'шт.',
          category: caseInfo.category,
          notes: `Кейс для ${totalModuleQty} шт. модулей`,
          picked: item.picked_in_warehouse || false,
          isFromComposition: true,
          parentName: item.equipment?.name
        });
      }
    }
  } catch (error) {
    console.error('Error loading cases for LED screen:', item.equipment?.name, error);
  }
}
