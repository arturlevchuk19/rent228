// Keep the catalog name for calculator routing; omit the repeated lifting
// description when displaying the configured construction in a budget or PDF.
export const budgetEquipmentDisplayName = (name?: string): string | undefined =>
  name?.replace(
    /^(П-образная фермовая конструкция) с системой подъ[её]ма(?=\s|$)/i,
    '$1'
  );

// Strip the previously generated technical suffix from saved construction notes.
export const budgetDisplayNotes = (name: string, notes?: string): string | undefined =>
  /^П-образная фермовая конструкция/i.test(name)
    ? notes?.replace(/, верхняя ферма K4-(?:290|390)\b/g, '')
    : notes;
