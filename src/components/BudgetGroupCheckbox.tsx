export interface BudgetGroupSelection {
  state: (ids: readonly string[]) => { checked: boolean; mixed: boolean; disabled: boolean };
  toggle: (ids: readonly string[]) => void;
  selectItem: (id: string, range: boolean) => void;
}

export function BudgetGroupCheckbox({ selection, ids, label, itemId }: {
  selection: BudgetGroupSelection;
  ids: readonly string[];
  label: string;
  itemId?: string;
}) {
  const { checked, mixed, disabled } = selection.state(ids);
  return <label className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded hover:bg-white/10 has-[:disabled]:cursor-not-allowed"
    onClick={event => event.stopPropagation()}>
    <input
      type="checkbox"
      aria-label={label}
      ref={input => { if (input) input.indeterminate = mixed; }}
      checked={checked}
      disabled={disabled}
      className="h-4 w-4 accent-accent-500 disabled:opacity-40"
      onChange={event => {
        if (itemId) selection.selectItem(itemId, event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey);
        else selection.toggle(ids);
      }}
    />
  </label>;
}
