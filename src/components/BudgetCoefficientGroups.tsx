import { useState } from 'react';
import { Highlighter, Palette, Pencil, Plus, ListChecks, Trash2 } from 'lucide-react';
import { BUDGET_MARKER_COLORS, DEFAULT_DYNAMIC_COEFFICIENT, type BudgetCoefficientGroup } from '../lib/budgetCoefficientGroups';

interface Props {
  itemIds: ReadonlySet<string>;
  selection: { id: string; itemIds: string[] } | null;
  onSelectionChange: (selection: { id: string; itemIds: string[] } | null) => void;
  onShowEstimate: () => void;
  groups: BudgetCoefficientGroup[];
  onSave: (group: BudgetCoefficientGroup) => void;
  onDelete: (id: string) => void;
}

export function BudgetCoefficientGroups({ itemIds, groups, selection, onSelectionChange, onShowEstimate, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<BudgetCoefficientGroup | null>(null);
  const [coefficient, setCoefficient] = useState(String(DEFAULT_DYNAMIC_COEFFICIENT));
  const [showPalette, setShowPalette] = useState(false);
  const [focusName, setFocusName] = useState(false);
  const selectedIds = draft && selection?.id === draft.id ? selection.itemIds : draft?.itemIds ?? [];
  const selectedCount = selectedIds.filter(id => itemIds.has(id)).length;
  const rate = Number(coefficient.replace(',', '.'));
  const validRate = coefficient.trim() !== '' && Number.isFinite(rate) && rate >= 0;

  function start(group: BudgetCoefficientGroup, field: 'name' | 'items') {
    setDraft({ ...group, itemIds: group.itemIds.filter(id => itemIds.has(id)) });
    setCoefficient(String(group.coefficient));
    onSelectionChange(field === 'items' ? { id: group.id, itemIds: group.itemIds.filter(id => itemIds.has(id)) } : null);
    setFocusName(field === 'name');
    setShowPalette(false);
  }

  function create() {
    let index = 1;
    const names = new Set(groups.map(group => group.name.toLocaleLowerCase()));
    while (names.has(`группа ${index}`)) index++;
    start({ id: crypto.randomUUID(), name: `Группа ${index}`, coefficient: DEFAULT_DYNAMIC_COEFFICIENT, color: null, itemIds: [] }, 'items');
  }

  if (draft) return (
    <form className="space-y-4 p-3 sm:p-4" onSubmit={event => {
      event.preventDefault();
      if (draft.name.trim() && validRate) {
        onSave({ ...draft, name: draft.name.trim(), coefficient: rate, itemIds: selectedIds });
        onSelectionChange(null);
        setDraft(null);
      }
    }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-36 flex-1 text-xs font-medium text-gray-300">Название группы
          <input autoFocus={focusName} required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}
            className="mt-1 block min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-base text-white focus:border-accent-500 focus:outline-none" />
        </label>
        <label className="w-24 text-xs font-medium text-gray-300">Коэффициент
          <input required inputMode="decimal" value={coefficient} onChange={event => setCoefficient(event.target.value)} aria-invalid={!validRate}
            className="mt-1 block min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-base tabular-nums text-white focus:border-accent-500 focus:outline-none" />
        </label>
        <button type="button" aria-label="Цвет группы" aria-expanded={showPalette} onClick={() => setShowPalette(!showPalette)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-300" style={{ color: draft.color ?? undefined }}><Highlighter className="h-4 w-4" /></button>
      </div>
      {!validRate && <p className="text-xs text-red-300">Введите коэффициент 0 или больше.</p>}
      {showPalette && <div className="flex flex-wrap items-center gap-1" aria-label="Цвет группы">
        <button type="button" aria-pressed={draft.color === null} onClick={() => { setDraft({ ...draft, color: null }); setShowPalette(false); }}
          className="min-h-11 rounded-lg px-2 text-xs text-gray-300 hover:bg-gray-800">Без цвета</button>
        {BUDGET_MARKER_COLORS.map((color, index) => <button key={color} type="button"
          aria-label={['Жёлтый', 'Оранжевый', 'Красный', 'Зелёный', 'Голубой', 'Фиолетовый'][index]}
          aria-pressed={draft.color === color} onClick={() => { setDraft({ ...draft, color }); setShowPalette(false); }}
          className="grid h-11 w-9 place-items-center rounded-lg hover:bg-gray-800 aria-pressed:bg-gray-800">
          <span className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
        </button>)}
        <label className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-lg bg-gray-800 text-gray-100 focus-within:ring-2 focus-within:ring-accent-400" title="Свой цвет RGB">
          <Palette className="h-5 w-5" aria-hidden="true" />
          <input type="color" aria-label="Свой цвет RGB" value={draft.color ?? '#ffffff'}
            onChange={event => setDraft(current => current && { ...current, color: event.target.value })}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>}
      <div className="rounded-lg border border-gray-800 p-3">
        <div className="flex items-center justify-between gap-2 text-sm text-gray-100">
          <span className="font-medium">Позиции группы</span>
          <span className="tabular-nums text-gray-400" aria-live="polite">{selectedCount}</span>
        </div>
        {selection?.id === draft.id && <p className="mt-1 text-xs text-gray-400">Отметьте позиции, категории или локации прямо в смете.</p>}
        <button type="button" onClick={() => {
          if (selection?.id !== draft.id) onSelectionChange({ id: draft.id, itemIds: selectedIds });
          onShowEstimate();
        }} className={`mt-2 min-h-11 rounded-lg bg-gray-800 px-3 text-sm text-gray-100 hover:bg-gray-700 ${selection?.id === draft.id ? 'md:hidden' : ''}`}>
          Выбрать в смете
        </button>
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-800 bg-gray-900 px-1 py-2">
        <button type="button" onClick={() => { setDraft(null); onSelectionChange(null); }} className="min-h-11 rounded-lg px-3 text-sm text-gray-300 hover:bg-gray-800">Отмена</button>
        <button type="submit" disabled={!draft.name.trim() || !validRate} className="min-h-11 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-gray-950 disabled:opacity-50">Сохранить</button>
      </div>
    </form>
  );

  return <section className="space-y-3 p-3 sm:p-4" aria-label="Группы коэффициентов">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-gray-100">Группы коэффициентов</h2>
      <button type="button" onClick={create} className="flex min-h-11 items-center gap-2 rounded-lg bg-accent-600 px-3 text-sm font-semibold text-gray-950">
        <Plus className="h-4 w-4" /> Добавить группу
      </button>
    </div>
    {groups.length === 0 && <p className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-400">У позиций без группы коэффициент 1.</p>}
    {groups.map(group => <article key={group.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-800 bg-gray-900 p-3" style={{ borderColor: group.color ?? undefined }}>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-sm font-semibold text-gray-100">{group.name}</h3>
        <p className="mt-1 text-xs tabular-nums text-gray-400">Позиций {group.itemIds.filter(id => itemIds.has(id)).length} · Коэф. {group.coefficient}</p>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => start(group, 'name')} title="Редактировать название и коэффициент" aria-label={`Редактировать название и коэффициент — ${group.name}`} className="grid h-11 w-10 place-items-center rounded-lg text-gray-300 hover:bg-gray-800"><Pencil className="h-4 w-4" /></button>
        <button type="button" onClick={() => start(group, 'items')} title="Редактировать позиции" aria-label={`Редактировать позиции — ${group.name}`} className="grid h-11 w-10 place-items-center rounded-lg text-gray-300 hover:bg-gray-800"><ListChecks className="h-4 w-4" /></button>
        <button type="button" onClick={() => { if (window.confirm(`Удалить группу «${group.name}»? Её позиции останутся в смете.`)) onDelete(group.id); }} title="Удалить группу" aria-label={`Удалить — ${group.name}`} className="grid h-11 w-10 place-items-center rounded-lg text-red-300 hover:bg-gray-800"><Trash2 className="h-4 w-4" /></button>
      </div>
    </article>)}
  </section>;
}
