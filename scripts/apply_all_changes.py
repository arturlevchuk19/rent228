import re

# ============================================================
# 1. BUDGET EDITOR
# ============================================================
with open('/home/engine/project/src/components/BudgetEditor.tsx', 'r') as f:
    content = f.read()

original = content

# 1a. Update import to add ExtraServicesDialog
content = content.replace(
    '  ContractDialog\n} from \'./dialogs\';',
    '  ContractDialog,\n  ExtraServicesDialog\n} from \'./dialogs\';'
)

# 1b. Update isExtraServiceCategory to handle JSON format
old_is_extra = '''  const isExtraServiceCategory = (categoryId: string | null | undefined) => {
    if (!categoryId) return false;
    const category = categories.find((item) => item.id === categoryId);
    return category?.description === EXTRA_SERVICE_DESCRIPTION_FLAG;
  };'''

new_is_extra = '''  const isExtraServiceCategory = (categoryId: string | null | undefined) => {
    if (!categoryId) return false;
    const category = categories.find((item) => item.id === categoryId);
    if (!category?.description) return false;
    if (category.description === EXTRA_SERVICE_DESCRIPTION_FLAG) return true;
    try {
      const parsed = JSON.parse(category.description);
      return parsed.isExtra === true;
    } catch {
      return false;
    }
  };'''

content = content.replace(old_is_extra, new_is_extra)

# 1c. Add showExtraServicesDialog state
content = content.replace(
    '  const [showContractDialog, setShowContractDialog] = useState(false);',
    '  const [showContractDialog, setShowContractDialog] = useState(false);\n  const [showExtraServicesDialog, setShowExtraServicesDialog] = useState(false);'
)

# 1d. Replace handleCreateExtraServiceCategory
old_handler = '''  const handleCreateExtraServiceCategory = async () => {
    const baseName = 'Доп услуги';
    const existingNames = categories.map((item) => item.name.trim().toLowerCase());
    let nextName = baseName;
    let index = 2;
    while (existingNames.includes(nextName.toLowerCase())) {
      nextName = `${baseName} ${index}`;
      index += 1;
    }

    try {
      const category = await createCategory(nextName, EXTRA_SERVICE_DESCRIPTION_FLAG, false, eventId);
      const groupId = buildCategoryGroupId(category.id);
      setCategories((prev) => [...prev, category]);
      setActiveCategoryIds((prev) => {
        const next = new Set(prev);
        next.add(groupId);
        return next;
      });
      setExpandedCategories((prev) => ({ ...prev, [groupId]: true }));
      setSelectedCategoryId(groupId);
    } catch (error) {
      console.error('Error creating extra service category:', error);
      alert('Ошибка создания категории "Доп услуги"');
    }
  };'''

new_handler = '''  const handleCreateExtraServiceCategory = async () => {
    setShowExtraServicesDialog(true);
  };

  const getCategoryShowTotal = (categoryId: string | null | undefined): boolean => {
    if (!categoryId) return true;
    const category = categories.find((item) => item.id === categoryId);
    if (!category?.description) return true;
    if (category.description === EXTRA_SERVICE_DESCRIPTION_FLAG) return true;
    try {
      const parsed = JSON.parse(category.description);
      return parsed.showTotal !== false;
    } catch {
      return true;
    }
  };

  const handleExtraServicesConfirm = async ({ name, showTotal }: { name: string; showTotal: boolean }) => {
    const description = JSON.stringify({ isExtra: true, showTotal });
    try {
      const category = await createCategory(name.trim(), description, false, eventId);
      const groupId = buildCategoryGroupId(category.id);
      setCategories((prev) => [...prev, category]);
      setActiveCategoryIds((prev) => {
        const next = new Set(prev);
        next.add(groupId);
        return next;
      });
      setExpandedCategories((prev) => ({ ...prev, [groupId]: true }));
      setSelectedCategoryId(groupId);
    } catch (error) {
      console.error('Error creating extra service category:', error);
      alert('Ошибка создания категории "Доп услуги"');
    }
  };'''

content = content.replace(old_handler, new_handler)

# 1e. Add showTotal to location-based CategoryBlock (the one inside categories.filter mapping)
content = content.replace(
    "onTouchItemDrop={handleTouchItemDrop}\n                                    dragOverItemId={dragOverItemId}\n                                  />\n                                </div>\n                              );\n                            })}\n\n                            {(groupedItems",
    "onTouchItemDrop={handleTouchItemDrop}\n                                    dragOverItemId={dragOverItemId}\n                                    showTotal={getCategoryShowTotal(category.id)}\n                                  />\n                                </div>\n                              );\n                            })}\n\n                            {(groupedItems"
)

# 1f. Add ExtraServicesDialog in the modals section (after ContractDialog)
content = content.replace(
    "        onClose={() => setShowContractDialog(false)}\n        onConfirm={handleContractConfirm}\n      />",
    "        onClose={() => setShowContractDialog(false)}\n        onConfirm={handleContractConfirm}\n      />\n      <ExtraServicesDialog\n        isOpen={showExtraServicesDialog}\n        existingNames={categories.map((c) => c.name)}\n        onClose={() => setShowExtraServicesDialog(false)}\n        onConfirm={handleExtraServicesConfirm}\n      />"
)

print(f"BudgetEditor changes: {content != original}")

with open('/home/engine/project/src/components/BudgetEditor.tsx', 'w') as f:
    f.write(content)

# Verify
print(f"showTotal count: {content.count('showTotal')}")
print(f"ExtraServicesDialog count: {content.count('ExtraServicesDialog')}")

# ============================================================
# 2. CATEGORY BLOCK
# ============================================================
with open('/home/engine/project/src/components/CategoryBlock.tsx', 'r') as f:
    content2 = f.read()

orig2 = content2

# 2a. Add showTotal prop to CategoryBlockProps (optional boolean)
content2 = content2.replace(
    '  onTouchItemDragStart?: (itemId: string) => void;\n  onTouchItemDrop?: (targetItemId: string | null, targetGroup: BudgetDragTarget | null) => void;\n  categoryRef?: (el: HTMLDivElement | null) => void;',
    '  onTouchItemDragStart?: (itemId: string) => void;\n  onTouchItemDrop?: (targetItemId: string | null, targetGroup: BudgetDragTarget | null) => void;\n  categoryRef?: (el: HTMLDivElement | null) => void;\n  showTotal?: boolean;'
)

# 2b. Add showTotal to destructured props
content2 = content2.replace(
    '  onTouchItemDragStart,\n  onTouchItemDrop,\n  categoryRef,\n  headerStyle,\n  headerClassName',
    '  onTouchItemDragStart,\n  onTouchItemDrop,\n  categoryRef,\n  headerStyle,\n  headerClassName,\n  showTotal = true'
)

# 2c. Wrap section total display in showTotal check
content2 = content2.replace(
    '        <div className="text-[10px] font-medium text-cyan-400 ml-0.5 text-right leading-tight" onClick={(e) => e.stopPropagation()}>',
    '        {showTotal && (\n        <div className="text-[10px] font-medium text-cyan-400 ml-0.5 text-right leading-tight" onClick={(e) => e.stopPropagation()}>'
)

content2 = content2.replace(
    '          <div>\n            {budgetDays}д: {formatSectionTotal(sectionCombinedTotal)}\n          </div>\n        </div>',
    '          <div>\n            {budgetDays}д: {formatSectionTotal(sectionCombinedTotal)}\n          </div>\n        </div>\n        )}'
)

print(f"CategoryBlock changes: {content2 != orig2}")

with open('/home/engine/project/src/components/CategoryBlock.tsx', 'w') as f:
    f.write(content2)

# ============================================================
# 3. PDF GENERATOR
# ============================================================
with open('/home/engine/project/src/lib/pdfGenerator.ts', 'r') as f:
    content3 = f.read()

orig3 = content3

# In the extraServicesHtml section, parse category description and conditionally show total
# Replace the extra services category rendering
content3 = content3.replace(
    "    const extraCategoriesHtml = Object.entries(extraGrouped).map(([categoryId, items]) => {\n      const category = data.categories.find((c) => c.id === categoryId);\n      const categoryName = category?.name || 'Дополнительные услуги';",
    "    const extraCategoriesHtml = Object.entries(extraGrouped).map(([categoryId, items]) => {\n      const category = data.categories.find((c) => c.id === categoryId);\n      const categoryName = category?.name || 'Дополнительные услуги';\n      const getShowTotal = (cat: Category | undefined): boolean => {\n        if (!cat?.description) return true;\n        if (cat.description === '__extra_service__') return true;\n        try {\n          const parsed = JSON.parse(cat.description);\n          return parsed.showTotal !== false;\n        } catch {\n          return true;\n        }\n      };\n      const showCategoryTotal = getShowTotal(category);"
)

# Now make the ИТОГО ПО РАЗДЕЛУ row conditional
# The pattern is the fixed row with ИТОГО ПО РАЗДЕЛУ for extra services
content3 = content3.replace(
    "              ${rows}\n              <tr style=\"border-bottom: 1px solid #000000;\">\n                <td colspan=\"3\" style=\"padding: 0px 8px 8px 10px ; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;\">ИТОГО ПО РАЗДЕЛУ:</td>\n                <td style=\"padding: 0px 8px 8px 10px; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;\">${formatMoney(categoryTotal)}${currencySuffix}</td>\n              </tr>\n            </tbody>\n          </table>\n        </div>",
    "              ${rows}\n              ${showCategoryTotal ? `\n              <tr style=\"border-bottom: 1px solid #000000;\">\n                <td colspan=\"3\" style=\"padding: 0px 8px 8px 10px ; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;\">ИТОГО ПО РАЗДЕЛУ:</td>\n                <td style=\"padding: 0px 8px 8px 10px; text-align: right; font-size: 18px; font-weight: 700; color: #000000; white-space: nowrap;\">${formatMoney(categoryTotal)}${currencySuffix}</td>\n              </tr>\n              ` : ''}\n            </tbody>\n          </table>\n        </div>"
)

print(f"PDF Generator changes: {content3 != orig3}")

with open('/home/engine/project/src/lib/pdfGenerator.ts', 'w') as f:
    f.write(content3)

print("\n=== ALL CHANGES COMPLETE ===")
