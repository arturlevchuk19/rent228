import { useRef, useState } from 'react';
import { Highlighter, Pencil, Plus, ListChecks, Trash2 } from 'lucide-react';
import { BUDGET_MARKER_COLORS, type BudgetCoefficientGroup } from '../lib/budgetCoefficientGroups';
import { budgetEquipmentDisplayName } from '../lib/budgetDisplayName';
import type { BudgetItem } from '../lib/events';

interface Props {
  items: BudgetItem[];
  groups: BudgetCoefficientGroup[];
  categoryNames: Map<string, string>;
  locationNames: Map<string, string>;
  groupsByItem: Map<string, BudgetCoefficientGroup>;
  onSave: (group: BudgetCoefficientGroup) => void;
  onDelete: (id: string) => void;
}

export function BudgetCoefficientGroups({ items, groups, categoryNames, locationNames, groupsByItem, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<BudgetCoefficientGroup | null>(null);
  const [coefficient, setCoefficient] = useState('0');
  const [showPalette, setShowPalette] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [focusName, setFocusName] = useState(false);
  const stroke = useRef<{ index: number; checked: boolean } | null>(null);
  const itemIds = new Set(items.map(item => item.id));
  const selected = new Set(draft?.itemIds);
  const rate = Number(coefficient.replace(',', '.'));
  const validRate = coefficient.trim() !== '' && Number.isFinite(rate) && rate >= 0;

  function start(group: BudgetCoefficientGroup, field: 'name' | 'items') {
    stroke.current = null;
    setDraft({ ...group, itemIds: group.itemIds.filter(id => itemIds.has(id)) });
    setCoefficient(String(group.coefficient));
    setShowItems(field === 'items');
    setFocusName(field === 'name');
    setShowPalette(false);
  }

  function create() {
    let index = 1;
    const names = new Set(groups.map(group => group.name.toLocaleLowerCase()));
    while (names.has(`группа ${index}`)) index++;
    start({ id: crypto.randomUUID(), name: `Группа ${index}`, coefficient: 0, color: null, itemIds: [] }, 'items');
  }

  function setItems(ids: string[], checked: boolean) {
    setDraft(current => {
      if (!current) return current;
      const updated = new Set(current.itemIds);
      for (const id of ids) {
        const owner = groupsByItem.get(id);
        if (owner && owner.id !== current.id) continue;
        if (checked) updated.add(id);
        else updated.delete(id);
      }
      return { ...current, itemIds: [...updated] };
    });
  }

  if (draft) return (
    <form className="space-y-4 p-3 sm:p-4" onSubmit={event => {
      event.preventDefault();
      if (draft.name.trim() && validRate) {
        onSave({ ...draft, name: draft.name.trim(), coefficient: rate });
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
      </div>}
      <div>
        <button type="button" aria-expanded={showItems} onClick={() => setShowItems(!showItems)}
          className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-gray-800 px-3 text-left text-sm font-medium text-gray-100">
          <ListChecks className="h-4 w-4 text-accent-400" /> Позиции группы <span className="ml-auto tabular-nums text-gray-400">{selected.size}</span>
        </button>
        {showItems && <div className="mt-2">
          <p className="mb-2 text-xs text-gray-400">Нажмите на позицию или проведите по строкам, удерживая Shift и кнопку мыши.</p>
          {items.length === 0 && <p className="py-3 text-sm text-gray-400">В смете пока нет позиций.</p>}
          <ul className="divide-y divide-gray-800" onPointerUp={() => { stroke.current = null; }} onPointerCancel={() => { stroke.current = null; }}>
            {items.map((item, index) => {
              const owner = groupsByItem.get(item.id);
              const blocked = Boolean(owner && owner.id !== draft.id);
              const name = budgetEquipmentDisplayName(item.equipment?.name) || item.work_item?.name || item.name || 'Позиция';
              const context = [
                item.location_id ? locationNames.get(item.location_id) : undefined,
                item.category_id ? categoryNames.get(item.category_id) : undefined,
                blocked ? owner?.name : undefined,
              ].filter(Boolean).join(' · ');
              return <li key={item.id} onPointerEnter={event => {
                const previous = stroke.current;
                if (!previous || !event.shiftKey || !(event.buttons & 1)) { stroke.current = null; return; }
                const from = Math.min(previous.index, index);
                const to = Math.max(previous.index, index);
                setItems(items.slice(from, to + 1).map(row => row.id), previous.checked);
                previous.index = index;
              }}>
                <button type="button" disabled={blocked} aria-pressed={selected.has(item.id)}
                  onPointerDown={event => {
                    stroke.current = null;
                    if (!event.shiftKey || event.button !== 0 || event.pointerType !== 'mouse') return;
                    event.preventDefault();
                    stroke.current = { index, checked: !selected.has(item.id) };
                    setItems([item.id], stroke.current.checked);
                  }}
                  onClick={event => {
                    if (!event.shiftKey || event.detail === 0) setItems([item.id], !selected.has(item.id));
                  }}
                  className="flex min-h-11 w-full select-none items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 aria-pressed:bg-accent-500/15 disabled:opacity-55">
                  <span aria-hidden="true" className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected.has(item.id) ? 'border-accent-500 bg-accent-600 text-gray-950' : 'border-gray-600'}`}>{selected.has(item.id) ? '✓' : ''}</span>
                  <span className="min-w-0 flex-1 break-words">{name}{context && <span className="block text-xs text-gray-400">{context}</span>}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">× {item.quantity}</span>
                </button>
              </li>;
            })}
          </ul>
        </div>}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-800 bg-gray-900 px-1 py-2">
        <button type="button" onClick={() => setDraft(null)} className="min-h-11 rounded-lg px-3 text-sm text-gray-300 hover:bg-gray-800">Отмена</button>
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
    {groups.length === 0 && <p className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-400">У позиций без группы коэффициент 0.</p>}
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
