import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, ArrowLeft } from 'lucide-react';
import type { Personnel, WorkItem } from '../lib/personnel';
import { newProjectId, type ProjectPerson } from '../lib/eventProject';
import { addWorkPeople, orderedPeopleWorks, peopleWorkRate, type PeopleWork } from '../lib/eventPeople';
import { ProjectSection } from './ProjectSection';

const input = 'w-full min-w-0 rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500';
export function EventPeoplePanel({ people, personnel, assigned, works, editable, error, onChange }: {
  people: ProjectPerson[]; personnel: Personnel[]; assigned: Personnel[]; works: WorkItem[];
  editable: boolean; error: string; onChange: (people: ProjectPerson[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [work, setWork] = useState<PeopleWork | null>(null);
  const [tab, setTab] = useState<'staff' | 'freelance'>('staff');
  const [selected, setSelected] = useState(new Set<string>());
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set<string>());
  const workOptions = orderedPeopleWorks(works);
  const groups = new Map<string, { name: string; rows: ProjectPerson[] }>();
  for (const person of people) {
    const key = person.work_id || person.work_name || 'legacy';
    const group = groups.get(key) || { name: person.work_name || 'Ранее добавленные участники', rows: [] };
    group.rows.push(person); groups.set(key, group);
  }
  const orderedGroups = [...groups].sort((a, b) => {
    const priority = (name: string) => name.toLowerCase() === 'монтаж' ? 0 : name.toLowerCase() === 'демонтаж' ? 1 : 2;
    return priority(a[1].name) - priority(b[1].name) || a[1].name.localeCompare(b[1].name, 'ru');
  });
  const automatic = assigned.filter(person => !people.some(row => row.personnel_id === person.id));
  const patch = (id: string, updates: Partial<ProjectPerson>) => onChange(people.map(person => person.id === id ? { ...person, ...updates } : person));
  const open = () => { setWork(null); setTab('staff'); setSelected(new Set()); setSearch(''); setAdding(true); };
  const addSelected = () => {
    if (!work || !selected.size || !editable) return;
    onChange(addWorkPeople(people, personnel.filter(person => selected.has(person.id)), work, newProjectId));
    setExpanded(current => new Set(current).add(work.id)); setAdding(false);
  };
  return <ProjectSection title="Люди" count={people.length + automatic.length} defaultOpen titleActions={editable && <button type="button" onClick={open} className="inline-flex items-center gap-1 rounded-lg p-2 text-xs text-cyan-400 hover:bg-gray-800"><Plus className="h-4 w-4" />Добавить</button>}>
    {error && <p role="alert" className="mb-3 text-xs text-amber-400">{error}</p>}
    <div className="space-y-3">{orderedGroups.map(([key, group]) => <div key={key} className="overflow-hidden rounded-xl border border-gray-800"><button type="button" aria-expanded={expanded.has(key)} onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })} className="flex w-full items-center justify-between gap-2 bg-gray-800/60 px-3 py-3 text-left text-sm font-semibold text-gray-200"><span>{group.name} · {group.rows.length}</span><span aria-hidden="true">{expanded.has(key) ? '▴' : '▾'}</span></button>{expanded.has(key) && <div className="space-y-3 p-3">{group.rows.map(person => <div key={person.id} className="grid gap-3 rounded-lg border border-gray-800 p-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"><label className="min-w-0 space-y-1 text-xs text-gray-400">ФИО{person.personnel_id ? <select disabled={!editable} value={person.personnel_id} onChange={event => { const next = personnel.find(row => row.id === event.target.value); if (!next) return; patch(person.id, { personnel_id: next.id, name: next.full_name, group: next.employment_type === 'freelance' ? 'freelance' : 'team', rate: peopleWorkRate(next, person.work_name || '') }); }} className={input}>{!personnel.some(row => row.id === person.personnel_id) && <option value={person.personnel_id}>{person.name}</option>}{personnel.filter(row => row.id === person.personnel_id || !group.rows.some(existing => existing.personnel_id === row.id)).map(row => <option key={row.id} value={row.id}>{row.full_name} — {row.employment_type === 'freelance' ? 'Фриланс' : 'Штат'}</option>)}</select> : <input disabled={!editable} value={person.name} onChange={event => patch(person.id, { name: event.target.value })} className={input} />}</label><label className="space-y-1 text-xs text-gray-400">Ставка, BYN/час<input type="number" inputMode="decimal" min="0" step="0.01" disabled={!editable} value={person.rate} onChange={event => patch(person.id, { rate: event.target.value })} className={input} /></label><label className="space-y-1 text-xs text-gray-400">Количество часов<input type="number" inputMode="decimal" min="0" step="0.25" disabled={!editable} value={person.hours || ''} onChange={event => patch(person.id, { hours: event.target.value })} className={input} /></label>{editable && <button type="button" aria-label={`Удалить ${person.name} из работы ${group.name}`} onClick={() => onChange(people.filter(row => row.id !== person.id))} className="self-end p-2 text-red-400"><Trash2 className="h-4 w-4" /></button>}</div>)}</div>}</div>)}</div>
    {!people.length && !automatic.length && <p className="text-sm text-gray-500">Участников пока нет. Добавьте работу и выберите людей.</p>}
    {!!automatic.length && <div className="mt-4 space-y-2"><h4 className="text-xs text-gray-500">Назначения из сметы</h4>{automatic.map(person => <p key={person.id} className="text-sm text-gray-300">{person.full_name} <span className="text-xs text-gray-500">{person.employment_type === 'freelance' ? 'Фриланс' : 'Штат'}</span></p>)}</div>}
    {editable && adding && <PeoplePicker onClose={() => setAdding(false)} title={work ? work.name : 'Выберите работу'}>
      {work ? <><button type="button" onClick={() => { setWork(null); setSelected(new Set()); setSearch(''); }} className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-400"><ArrowLeft className="h-4 w-4" />К списку работ</button><div role="tablist" aria-label="Тип сотрудников" className="mb-3 flex gap-2">{(['staff', 'freelance'] as const).map(type => <button type="button" key={type} role="tab" aria-selected={tab === type} onClick={() => setTab(type)} className={`rounded-lg px-4 py-2 text-sm ${tab === type ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-400'}`}>{type === 'staff' ? 'Штат' : 'Фриланс'}</button>)}</div><input aria-label="Поиск сотрудника" placeholder="Поиск по ФИО" value={search} onChange={event => setSearch(event.target.value)} className={`${input} mb-3`} /><div className="max-h-[40dvh] overflow-y-auto">{personnel.filter(person => (person.employment_type || 'staff') === tab && person.full_name.toLowerCase().includes(search.toLowerCase())).map(person => { const exists = people.some(row => row.personnel_id === person.id && (row.work_id === work.id || row.work_name === work.name)); return <label key={person.id} className="flex min-h-12 items-center gap-3 border-b border-gray-800 py-3 text-sm text-gray-200"><input type="checkbox" disabled={exists} checked={exists || selected.has(person.id)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(person.id); else next.delete(person.id); return next; })} className="h-4 w-4 accent-cyan-500" /><span className="min-w-0 flex-1 break-words">{person.full_name}</span><span className="shrink-0 text-xs text-gray-500">{exists ? 'Добавлен' : `${peopleWorkRate(person, work.name)} BYN/час`}</span></label>; })}{!personnel.some(person => (person.employment_type || 'staff') === tab && person.full_name.toLowerCase().includes(search.toLowerCase())) && <p className="py-6 text-center text-sm text-gray-500">Сотрудники не найдены</p>}</div><button type="button" disabled={!selected.size} onClick={addSelected} className="mt-4 w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Добавить выбранных ({selected.size})</button></> : <div className="space-y-2">{workOptions.map(row => <button type="button" key={row.id} onClick={() => { setWork(row); setSelected(new Set()); }} className="w-full rounded-xl border border-gray-700 px-4 py-3 text-left text-sm text-gray-200 hover:border-cyan-600">{row.name}</button>)}</div>}
    </PeoplePicker>}
  </ProjectSection>;
}
function PeoplePicker({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; const previous = document.activeElement as HTMLElement | null; element?.showModal(); return () => { element?.close(); previous?.focus(); }; }, []);
  return createPortal(<dialog ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-lg overflow-y-auto rounded-2xl border border-gray-700 bg-gray-900 p-4 text-gray-200 backdrop:bg-black/70"><header className="mb-4 flex items-center justify-between gap-2"><h3 className="text-lg font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Закрыть выбор людей" className="p-2 text-gray-400"><X className="h-5 w-5" /></button></header>{children}</dialog>, document.body);
}
