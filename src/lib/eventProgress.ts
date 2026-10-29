export function eventProgress(status: string, budgetCount: number) {
  return {
    progress_budget_done: budgetCount > 0,
    progress_equipment_reserved: status === 'Подтверждено' || status === 'Выполнено',
    progress_project_completed: status === 'Выполнено',
  };
}
