// Keep the catalog name for calculator routing; omit the repeated lifting
// description when displaying the configured construction in a budget or PDF.
export const budgetEquipmentDisplayName = (name?: string): string | undefined =>
  name?.replace(
    /^(П-образная фермовая конструкция) с системой подъ[её]ма(?=\s|$)/i,
    '$1'
  );
