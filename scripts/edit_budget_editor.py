import re

with open('/home/engine/project/src/components/BudgetEditor.tsx', 'r') as f:
    content = f.read()

original_content = content

# 1. Update import to add ExtraServicesDialog
content = content.replace(
    '  ContractDialog\n} from \'./dialogs\';',
    '  ContractDialog,\n  ExtraServicesDialog\n} from \'./dialogs\';'
)

# 2. Update isExtraServiceCategory to handle JSON format
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

# 3. Add showExtraServicesDialog state after showContractDialog state
content = content.replace(
    '  const [showContractDialog, setShowContractDialog] = useState(false);',
    '  const [showContractDialog, setShowContractDialog] = useState(false);\n  const [showExtraServicesDialog, setShowExtraServicesDialog] = useState(false);'
)

# 4. Replace handleCreateExtraServiceCategory
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

# 5. In the JSX, add showTotal to CategoryBlock calls
# For location-based CategoryBlock
content = content.replace(
    'onTouchItemDrop={handleTouchItemDrop}\n                                    dragOverItemId={dragOverItemId}\n                                  />\n                                </div>\n                              );\n                            }))\n\n                            {(groupedItems[buildLocationUncategorizedGroupId(location.id)] || []).length > 0 && (\n                              <CategoryBlock\n                                categoryId={buildLocationUncategorizedGroupId(location.id)}\n                                categoryName="Без категории"\n                                locationId={location.id}\n                                items={groupedItems[buildLocationUncategorizedGroupId(location.id)] || []}',
    'onTouchItemDrop={handleTouchItemDrop}\n                                    dragOverItemId={dragOverItemId}\n                                    showTotal={getCategoryShowTotal(category.id)}\n                                  />\n                                </div>\n                              );\n                            }))\n\n                            {(groupedItems[buildLocationUncategorizedGroupId(location.id)] || []).length > 0 && (\n                              <CategoryBlock\n                                categoryId={buildLocationUncategorizedGroupId(location.id)}\n                                categoryName="Без категории"\n                                locationId={location.id}\n                                items={groupedItems[buildLocationUncategorizedGroupId(location.id)] || []}'
)

# For no-location CategoryBlock
content = content.replace(
    'onTouchItemDrop={handleTouchItemDrop}\n                          dragOverItemId={dragOverItemId}\n                          categoryRef={(el) => { categoryRefs.current[category.id] = el; }}\n                        />',
    'onTouchItemDrop={handleTouchItemDrop}\n                          dragOverItemId={dragOverItemId}\n                          categoryRef={(el) => { categoryRefs.current[category.id] = el; }}\n                          showTotal={getCategoryShowTotal(category.id)}\n                        />'
)

# 6. Add ExtraServicesDialog in the modals section
# Find the ContractDialog and add after it
content = content.replace(
    '          onConfirm={handleContractConfirm}\n          />',
    '          onConfirm={handleContractConfirm}\n          />\n          <ExtraServicesDialog\n            isOpen={showExtraServicesDialog}\n            existingNames={categories.map((c) => c.name)}\n            onClose={() => setShowExtraServicesDialog(false)}\n            onConfirm={handleExtraServicesConfirm}\n          />'
)

if content == original_content:
    print("WARNING: No changes were made!")
    # Show what might be wrong
    print("Looking for patterns...")
    if '  ContractDialog\n} from ' in content:
        print("Found ContractDialog import pattern")
    else:
        print("Did NOT find ContractDialog import pattern")

with open('/home/engine/project/src/components/BudgetEditor.tsx', 'w') as f:
    f.write(content)

print("Done - BudgetEditor.tsx updated")

# Count occurrences
import subprocess
result = subprocess.run(['grep', '-c', 'showTotal', '/home/engine/project/src/components/BudgetEditor.tsx'], capture_output=True, text=True)
print(f"'showTotal' occurrences: {result.stdout.strip()}")
result = subprocess.run(['grep', '-c', 'ExtraServicesDialog', '/home/engine/project/src/components/BudgetEditor.tsx'], capture_output=True, text=True)
print(f"'ExtraServicesDialog' occurrences: {result.stdout.strip()}")
result = subprocess.run(['grep', '-c', 'ExtraServices', '/home/engine/project/src/components/BudgetEditor.tsx'], capture_output=True, text=True)
print(f"'ExtraServices' occurrences: {result.stdout.strip()}")
