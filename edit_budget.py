import re

with open('/home/engine/project/src/components/BudgetEditor.tsx', 'r') as f:
    content = f.read()

# Remove the first duplicate getExtraServiceShowSectionTotal (the one without null checks)
old = '''  const getExtraServiceShowSectionTotal = (categoryId: string | null | undefined): boolean => {
    const category = categories.find((item) => item.id === categoryId);
    // Parse: __extra_service__ or __extra_service__|show_total=0
    if (category.description === EXTRA_SERVICE_DESCRIPTION_FLAG) return true;
    if (category.description.startsWith(EXTRA_SERVICE_DESCRIPTION_FLAG + '|')) {
      const params = category.description.split('|')[1];
      if (params === 'show_total=0') return false;
    }
    return true;
  };

  const getExtraServiceShowSectionTotal = (categoryId: string | null | undefined): boolean => {'''

new = '''  const getExtraServiceShowSectionTotal = (categoryId: string | null | undefined): boolean => {'''

content = content.replace(old, new)
with open('/home/engine/project/src/components/BudgetEditor.tsx', 'w') as f:
    f.write(content)
print('Done')