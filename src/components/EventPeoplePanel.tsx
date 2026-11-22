import { searchInputProps } from '../lib/searchInput';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, ArrowLeft, Copy, ChevronDown } from 'lucide-react';
import { isAssignablePersonnel, type Personnel } from '../lib/personnel';
import type { EventBudget } from '../lib/eventBudgets';
import { newProjectId, type ProjectPerson } from '../lib/eventProject';
import { addWorkPeople, peopleWorkRate, personWorkAmount, personWorkHours, peopleWorkBalance, rateForWorkAmount, copyPeopleToWork, withLoadingWorks, peopleWorkPriority, type BudgetPeopleWork, type PeopleWork, type PeopleDirectoryEntry } from '../lib/eventPeople';
import { dayNumber } from '../lib/calendar';
import { ProjectSection } from './ProjectSection';

const input = 'min-h-11 w-full min-w-0 rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-accent-500';
const emptyPeriod = { starts_at: '', ends_at: '' };
const insetInput = `${input} block min-h-14 pt-6 pb-1.5`;
const insetLabel = 'pointer-events-none absolute inset-x-3 top-1.5 truncate text-xs text-gray-400';
const money = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('ru-RU') === b.trim().toLocaleLowerCase('ru-RU');
export function EventPeoplePanel({ people, personnel, assigned, works, editable, error, onChange, budgets = [], selectedBudgetId = '', onBudgetChange, customWorks = [], onCustomWorksChange, loadingWorks = false, catalogWorks = [], showPrices = true, eventDate = '' }: {
  people: ProjectPerson[]; personnel: PeopleDirectoryEntry[]; assigned: Pick<Personnel, 'id' | 'full_name' | 'employment_type'>[]; works: BudgetPeopleWork[];
  catalogWorks?: PeopleWork[];
  showPrices?: boolean;
  eventDate?: string;
  editable: boolean; error: string; onChange: (people: ProjectPerson[]) => void;
  budgets?: EventBudget[]; selectedBudgetId?: string; onBudgetChange?: (id: string) => void;
  customWorks?: PeopleWork[]; onCustomWorksChange?: (works: PeopleWork[]) => void; loadingWorks?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [work, setWork] = useState<PeopleWork | null>(null);
  const [tab, setTab] = useState<'staff' | 'freelance'>('staff');
  const [selected, setSelected] = useState(new Set<string>());
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [newWorkId, setNewWorkId] = useState('');
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [copySource, setCopySource] = useState<string | null>(null);
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [period, setPeriod] = useState(emptyPeriod);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const suggestedDate = dayNumber(eventDate) === null ? '' : `${eventDate}T00:00`;
  const dateField = (id: string, caption: string, accessibleLabel: string, value: string, onChange: (value: string) => void, required = false) => {
    const suggestion = activeDate === id && !value ? suggestedDate : '';
    return <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-gray-700 bg-gray-950/50 px-2.5 focus-within:border-accent-500">
      <span className="w-6 shrink-0 text-xs text-gray-400">{caption}</span>
      <input aria-label={accessibleLabel} type="datetime-local" required={required} disabled={!editable}
        value={value || suggestion}
        onPointerDown={() => setActiveDate(id)}
        onFocus={() => setActiveDate(id)}
        onBlur={() => setActiveDate(current => current === id ? null : current)}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && suggestion) {
            event.preventDefault();
            onChange(suggestion);
          }
        }}
        className="block min-h-11 w-full min-w-0 flex-1 appearance-none bg-transparent py-1.5 text-sm text-gray-200 outline-none [color-scheme:dark] [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left" />
    </label>;
  };
  const validPeriod = personWorkHours(period) > 0;
  const workOptions = withLoadingWorks([...works, ...customWorks.filter(custom => !works.some(row => sameName(row.name, custom.name))).map(row => ({ ...row, budgetAmount: 0 }))]);
  const groups = new Map<string, { name: string; rows: ProjectPerson[]; budgetAmount: number; inBudget: boolean }>();
  for (const option of workOptions) groups.set(option.id, { name: option.name, rows: [], budgetAmount: option.budgetAmount || 0, inBudget: works.some(row => row.id === option.id) });
  for (const person of people) {
    const option = workOptions.find(row => row.id === person.work_id || sameName(row.name, person.work_name || ''));
    const key = option?.id || person.work_id || person.work_name || 'legacy';
    const group = groups.get(key) || { name: person.work_name || 'Ранее добавленные участники', rows: [], budgetAmount: 0, inBudget: false };
    group.rows.push(person); groups.set(key, group);
  }
  const orderedGroups = [...groups].sort((a, b) => {
    return peopleWorkPriority(a[1].name) - peopleWorkPriority(b[1].name) || a[1].name.localeCompare(b[1].name, 'ru');
  });
  const automatic = assigned.filter(person => !people.some(row => row.personnel_id === person.id));
  const patch = (id: string, updates: Partial<ProjectPerson>) => onChange(people.map(person => person.id === id ? { ...person, ...updates } : person));
  const open = (selectedWork: PeopleWork | null = null) => { setWork(selectedWork); setTab('staff'); setSelected(new Set()); setSearch(''); setNewWorkId(''); setPeriod(emptyPeriod); setActiveDate(null); setEditingPeriod(false); setAdding(true); };
  const addSelected = () => {
    if (!work || !selected.size || !editable || !validPeriod) return;
    onChange(addWorkPeople(people, personnel.filter(person => selected.has(person.id)), work, newProjectId, period));
    setExpanded(current => new Set(current).add(work.id)); setAdding(false);
  };
  const createCustomWork = () => {
    const chosen = catalogWorks.find(row => row.id === newWorkId);
    if (!chosen || !onCustomWorksChange || !editable) return;
    const existing = workOptions.find(row => row.id === chosen.id || sameName(row.name, chosen.name));
    const next = existing || { id: chosen.id, name: chosen.name };
    if (!existing) onCustomWorksChange([...customWorks, next]);
    setWork(next); setSelected(new Set()); setNewWorkId('');
  };
  return <ProjectSection title="Люди" count={people.length + automatic.length} defaultOpen titleActions={editable && <button type="button" onClick={() => open()} className="inline-flex min-h-11 items-center gap-1 rounded-lg p-2 text-sm text-accent-400 hover:bg-gray-800"><Plus className="h-4 w-4" />Добавить</button>}>
    {budgets.length > 1 && <label className="mb-4 block space-y-1 text-xs text-gray-400">{showPrices ? 'Смета для сравнения' : 'Смета для списка работ'}<select aria-label="Смета для сравнения работ" disabled={!editable || loadingWorks} value={selectedBudgetId} onChange={event => onBudgetChange?.(event.target.value)} className={input}>{budgets.map(budget => <option key={budget.id} value={budget.id}>{budget.name}</option>)}</select></label>}
    {error && <p role="alert" className="mb-3 text-xs text-amber-400">{error}</p>}
    {loadingWorks && <p role="status" className="mb-3 text-xs text-gray-500">Загрузка работ из сметы…</p>}
    {showPrices && <p className="mb-3 text-xs text-gray-500">В заголовке: сумма по людям / сумма в смете (остаток). Все суммы в BYN.</p>}
    <div className="space-y-3">{orderedGroups.map(([key, group]) => {
      const totals = showPrices ? peopleWorkBalance(group.rows, group.budgetAmount) : null;
      return <div key={key} className="overflow-hidden rounded-xl border border-gray-800">
        <div className="flex items-stretch bg-gray-800/60">
        <button type="button" aria-expanded={expanded.has(key)} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold text-gray-200">
          <span className="min-w-0">{group.name} · {group.rows.length}{showPrices && !group.inBudget && <span className="ml-2 text-xs font-normal text-gray-500">Вне выбранной сметы</span>}</span>
          <span className="ml-auto flex flex-wrap items-center justify-end gap-1 text-xs tabular-nums">{totals && <span>{money(totals.amount)} / {loadingWorks ? '…' : money(totals.budgetAmount)} BYN</span>}{totals && !loadingWorks && <span className={totals.difference > 0 ? 'text-emerald-400' : totals.difference < 0 ? 'text-red-400' : 'text-gray-400'}>({totals.difference > 0 ? '+' : ''}{money(totals.difference)})</span>}<ChevronDown aria-hidden="true" className={`ml-1 h-4 w-4 shrink-0 transition-transform ${expanded.has(key) ? 'rotate-180' : ''}`} /></span>
        </button>
        {editable && <button type="button" aria-label={`Скопировать людей из работы ${group.name}`} title="Скопировать людей в другую работу" disabled={!group.rows.length || orderedGroups.length < 2} onClick={() => setCopySource(key)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-3 text-gray-300 hover:bg-gray-700/50 disabled:opacity-30"><Copy className="h-4 w-4" /></button>}
        </div>
        {expanded.has(key) && <div className="space-y-3 p-3">{group.rows.map(person => {
          const hours = personWorkHours(person);
          return <div key={person.id} className="space-y-2 rounded-lg border border-gray-800 p-3">
          <div className="flex items-start gap-2">
          {editable ? <div className="min-w-0 flex-1 space-y-2"><label className="relative block">
            <select aria-label="Сотрудник" value={person.personnel_id} onChange={event => {
              const next = personnel.find(row => row.id === event.target.value);
              if (!next) { patch(person.id, { personnel_id: '' }); return; }
              patch(person.id, { personnel_id: next.id, name: next.full_name, group: next.employment_type === 'freelance' ? 'freelance' : 'team', rate: peopleWorkRate(next, person.work_name || '') });
            }} className={`${input} block`}><option value="">Указать вручную</option>{person.personnel_id && !personnel.some(row => row.id === person.personnel_id) && <option value={person.personnel_id}>{person.name}</option>}{personnel.filter(row => row.id === person.personnel_id || (isAssignablePersonnel(row) && !group.rows.some(existing => existing.personnel_id === row.id))).map(row => <option key={row.id} value={row.id}>{row.full_name} — {row.employment_type === 'freelance' ? 'Фриланс' : 'Штат'}</option>)}</select>
          </label>{!person.personnel_id && <input aria-label="ФИО вручную" placeholder="ФИО вручную" value={person.name} onChange={event => patch(person.id, { name: event.target.value })} className={input} />}</div> : <p className="text-sm text-gray-200">{person.name}</p>}
          {editable && <button type="button" aria-label={`Удалить ${person.name} из работы ${group.name}`} onClick={() => onChange(people.filter(row => row.id !== person.id))} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-red-400 hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>}
          </div>
          <div className="grid grid-cols-1 gap-2 min-[540px]:grid-cols-2">
            {dateField(`${person.id}:start`, 'С', 'С — начало работы', person.starts_at || '', starts_at => patch(person.id, { starts_at, hours: undefined }))}
            {dateField(`${person.id}:end`, 'По', 'По — окончание работы', person.ends_at || '', ends_at => patch(person.id, { ends_at, hours: undefined }))}
          </div>
          {showPrices && <div className="grid grid-cols-2 gap-2">
            <label className="relative block min-w-0"><span className={insetLabel}>Ставка, BYN/час</span><input type="number" inputMode="decimal" min="0" step="any" disabled={!editable} value={person.rate} onChange={event => patch(person.id, { rate: event.target.value })} className={insetInput} /></label>
            <label className="relative block min-w-0"><span className={insetLabel}>Сумма, BYN</span><input
              aria-label={`Сумма: ${person.name || 'новый участник'}`}
              type="number" inputMode="numeric" min="0" step="1"
              disabled={!editable || hours <= 0}
              value={amountDrafts[person.id] ?? String(Math.round(personWorkAmount(person)))}
              onChange={event => {
                const raw = event.target.value;
                const value = raw === '' ? '' : String(Math.round(Number(raw)));
                setAmountDrafts(current => ({ ...current, [person.id]: value }));
                const rate = value.trim() ? rateForWorkAmount(Number(value), String(hours)) : null;
                if (rate !== null) patch(person.id, { rate });
              }}
              onBlur={() => setAmountDrafts(current => { const next = { ...current }; delete next[person.id]; return next; })}
              className={`${insetInput} text-gray-100 tabular-nums disabled:opacity-50`}
            /></label>
          </div>}
        </div>})}{editable && <div className="flex flex-wrap gap-3"><button type="button" onClick={() => open({ id: key, name: group.name })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs text-accent-400"><Plus className="h-4 w-4" />Добавить людей</button><button type="button" onClick={() => { onChange([...people, { id: newProjectId(), personnel_id: '', name: '', group: 'external', rate: '', hours: '', work_id: key, work_name: group.name }]); }} className="min-h-11 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800">Добавить строку</button></div>}</div>}
      </div>;
    })}</div>
    {!orderedGroups.length && !automatic.length && !loadingWorks && <p className="text-sm text-gray-500">{editable ? 'В смете нет работ. Добавьте свою работу через кнопку «Добавить».' : 'Назначенных работ пока нет.'}</p>}
    {!!automatic.length && <div className="mt-4 space-y-2"><h4 className="text-xs text-gray-500">Назначения из сметы</h4>{automatic.map(person => <p key={person.id} className="text-sm text-gray-300">{person.full_name} <span className="text-xs text-gray-500">{person.employment_type === 'freelance' ? 'Фриланс' : 'Штат'}</span></p>)}</div>}
    {editable && copySource && groups.has(copySource) && <PeoplePicker title={`Копировать людей: ${groups.get(copySource)!.name}`} onClose={() => setCopySource(null)}>
      <p className="mb-4 text-sm text-gray-400">Выберите работу, куда скопировать людей. {showPrices ? 'Ставки и время работы копируются вместе с ФИО.' : 'Время работы копируется вместе с ФИО.'} Уже добавленные участники не дублируются.</p>
      <div className="space-y-2">{orderedGroups.filter(([key]) => key !== copySource).map(([key, group]) => <button type="button" key={key} onClick={() => {
        onChange(copyPeopleToWork(people, groups.get(copySource)!.rows.filter(row => !row.personnel_id || personnel.find(person => person.id === row.personnel_id)?.show_in_budgets !== false), { id: key, name: group.name }, newProjectId));
        setExpanded(current => new Set(current).add(key)); setCopySource(null);
      }} className="flex w-full items-center gap-2 rounded-xl border border-gray-700 px-4 py-3 text-left text-sm text-gray-200 hover:border-accent-600"><Copy className="h-4 w-4 text-accent-400" />{group.name}</button>)}</div>
    </PeoplePicker>}
    {editable && adding && <PeoplePicker onClose={() => setAdding(false)} title={editingPeriod ? 'Время работы' : work ? work.name : 'Выберите работу'}>
      {work && editingPeriod ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); event.stopPropagation(); addSelected(); }}>
        <button type="button" onClick={() => setEditingPeriod(false)} className="inline-flex min-h-11 items-center gap-2 text-sm text-accent-400"><ArrowLeft className="h-4 w-4" />К выбору сотрудников</button>
        <p className="text-sm text-gray-300">{work.name} · Выбрано сотрудников: {selected.size}</p>
        {dateField('shared:start', 'С', 'С — общее начало работы', period.starts_at, starts_at => setPeriod(current => ({ ...current, starts_at })), true)}
        {dateField('shared:end', 'По', 'По — общее окончание работы', period.ends_at, ends_at => setPeriod(current => ({ ...current, ends_at })), true)}
        {period.starts_at && period.ends_at && !validPeriod && <p role="alert" className="text-sm text-red-300">Окончание должно быть позже начала. Для ночной смены укажите следующую дату.</p>}
        <button type="submit" disabled={!validPeriod} className="w-full min-h-11 rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40">Добавить выбранных ({selected.size})</button>
      </form> : work ? <>
        <button type="button" onClick={() => { setWork(null); setSelected(new Set()); setSearch(''); }} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-accent-400"><ArrowLeft className="h-4 w-4" />К списку работ</button>
        <div role="tablist" aria-label="Тип сотрудников" className="mb-3 flex gap-2">{(['staff', 'freelance'] as const).map(type => <button type="button" key={type} role="tab" aria-selected={tab === type} onClick={() => setTab(type)} className={`min-h-11 rounded-lg px-4 py-2 text-sm ${tab === type ? 'bg-accent-500 text-gray-950' : 'bg-gray-800 text-gray-400'}`}>{type === 'staff' ? 'Штат' : 'Фриланс'}</button>)}</div>
        <input aria-label="Поиск сотрудника" placeholder="Поиск по ФИО" {...searchInputProps} value={search} onChange={event => setSearch(event.target.value)} className={`${input} mb-3`} />
        <div className="max-h-[40dvh] overflow-y-auto">{personnel.filter(person => isAssignablePersonnel(person) && (person.employment_type || 'staff') === tab && person.full_name.toLowerCase().includes(search.toLowerCase())).map(person => { const exists = people.some(row => row.personnel_id === person.id && (row.work_id === work.id || sameName(row.work_name || '', work.name))); return <label key={person.id} className="flex min-h-12 items-center gap-3 border-b border-gray-800 py-3 text-sm text-gray-200"><input type="checkbox" disabled={exists} checked={exists || selected.has(person.id)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(person.id); else next.delete(person.id); return next; })} className="h-4 w-4 accent-accent-500" /><span className="min-w-0 flex-1 break-words">{person.full_name}</span>{(exists || showPrices) && <span className="shrink-0 text-xs text-gray-500">{exists ? 'Добавлен' : `${peopleWorkRate(person, work.name)} BYN/час`}</span>}</label>; })}{!personnel.some(person => isAssignablePersonnel(person) && (person.employment_type || 'staff') === tab && person.full_name.toLowerCase().includes(search.toLowerCase())) && <p className="py-6 text-center text-sm text-gray-500">Сотрудники не найдены</p>}</div>
        <button type="button" disabled={!selected.size} onClick={() => setEditingPeriod(true)} className="mt-4 w-full min-h-11 rounded-lg bg-accent-500 px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40">Далее ({selected.size})</button>
      </> : <div className="space-y-3">
        {loadingWorks ? <p className="text-sm text-gray-400">Загрузка работ…</p> : workOptions.map(row => <button type="button" key={row.id} onClick={() => { setWork(row); setSelected(new Set()); }} className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-700 px-4 py-3 text-left text-sm text-gray-200 hover:border-accent-600"><span>{row.name}</span>{showPrices && <span className="text-xs text-gray-500">{money(row.budgetAmount || 0)} BYN</span>}</button>)}
        {!workOptions.length && !loadingWorks && <p className="text-sm text-gray-500">В выбранной смете нет работ.</p>}
        {onCustomWorksChange && <div className="space-y-2 border-t border-gray-700 pt-3"><label className="block space-y-1 text-xs text-gray-400">Добавить работу из справочника<select aria-label="Работа из справочника" value={newWorkId} onChange={event => setNewWorkId(event.target.value)} className={input}><option value="">Выберите работу</option>{catalogWorks.filter(row => !workOptions.some(existing => existing.id === row.id || sameName(existing.name, row.name))).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button type="button" disabled={!newWorkId} onClick={createCustomWork} className="min-h-11 rounded-lg bg-gray-800 px-3 py-2 text-sm text-accent-400 disabled:opacity-40">Добавить работу</button></div>}
      </div>}
    </PeoplePicker>}
  </ProjectSection>;
}
function PeoplePicker({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); previous?.focus(); }; }, []);
  return createPortal(<dialog ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-lg overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-4 text-gray-200 backdrop:bg-black/70"><header className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Закрыть выбор людей" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-gray-800"><X className="h-5 w-5" /></button></header>{children}</dialog>, document.body);
}
