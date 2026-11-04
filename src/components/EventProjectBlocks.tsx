import { getEventBudgets, type EventBudget } from '../lib/eventBudgets';
import { getBudgetItems, type BudgetItem } from '../lib/events';
import { documentPeopleWorks } from '../lib/eventPeople';
import { EventPeoplePanel } from './EventPeoplePanel';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Truck } from 'lucide-react';
import { getPersonnel, getWorkItems, type Personnel, type WorkItem } from '../lib/personnel';
import { supabase } from '../lib/supabase';
import { newProjectId, type EventProjectDetails } from '../lib/eventProject';
import { dayNumber } from '../lib/calendar';
import { ProjectSection } from './ProjectSection';
import { ProjectText } from './ProjectText';

const input = 'w-full min-w-0 rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-500';
const addClass = 'inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs text-cyan-400 hover:bg-gray-800';
export function EventProjectBlocks({ value, onChange, editable, eventId, eventDate, refreshSignal = 0 }: {
  value: EventProjectDetails; onChange: (value: EventProjectDetails) => void; editable: boolean;
  eventId?: string; eventDate: string; refreshSignal?: number;
}) {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [catalogWorks, setCatalogWorks] = useState<WorkItem[]>([]);
  const [peopleBudgets, setPeopleBudgets] = useState<EventBudget[]>([]);
  const [peopleBudgetItems, setPeopleBudgetItems] = useState<BudgetItem[]>([]);
  const [budgetWorksError, setBudgetWorksError] = useState('');
  const [loadingBudgetWorks, setLoadingBudgetWorks] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [assigned, setAssigned] = useState<Personnel[]>([]);
  const [peopleError, setPeopleError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([getPersonnel(), getWorkItems()]).then(([people, jobs]) => { if (active) { setPersonnel(people); setCatalogWorks(jobs); setDirectoryError(''); } }).catch(() => { if (active) setDirectoryError('Не удалось загрузить справочники сотрудников и работ. Обновите страницу.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    supabase.from('budget_item_personnel').select('personnel:personnel_id(*), budget_item:budget_item_id!inner(event_id)').eq('budget_item.event_id', eventId).then(({ data, error }) => {
      if (!active) return;
      if (error) { setPeopleError('Не удалось загрузить назначения из сметы.'); return; }
      setPeopleError('');
      const rows = (data || []) as unknown as { personnel: Personnel | null }[];
      const unique = new Map(rows.flatMap(row => row.personnel ? [[row.personnel.id, row.personnel] as const] : []));
      setAssigned([...unique.values()]);
    });
    return () => { active = false; };
  }, [eventId, refreshSignal]);
  useEffect(() => {
    let active = true;
    setPeopleBudgets([]); setPeopleBudgetItems([]); setBudgetWorksError('');
    if (!eventId) return;
    setLoadingBudgetWorks(true);
    Promise.all([getEventBudgets(eventId), getBudgetItems(eventId)]).then(([documents, items]) => {
      if (active) { setPeopleBudgets(documents); setPeopleBudgetItems(items); }
    }).catch(() => { if (active) setBudgetWorksError('Не удалось загрузить работы и суммы из сметы.'); })
      .finally(() => { if (active) setLoadingBudgetWorks(false); });
    return () => { active = false; };
  }, [eventId, refreshSignal]);
  const peopleBudget = peopleBudgets.find(budget => budget.id === value.people_budget_id) || peopleBudgets.find(budget => budget.is_primary) || peopleBudgets[0];
  const works = peopleBudget ? documentPeopleWorks(peopleBudgetItems, peopleBudget) : [];
  const update = <K extends keyof EventProjectDetails>(key: K, data: EventProjectDetails[K]) => onChange({ ...value, [key]: data });
  const textEditor = (key: 'description' | 'sound' | 'light' | 'media' | 'io') => <div className="space-y-2"><textarea aria-label={key === 'description' ? 'Описание мероприятия' : `Заметки: ${key}`} rows={8} maxLength={30000} value={value[key]} onChange={event => update(key, event.target.value)} className={`${input} resize-y`} /><p className="text-xs text-gray-500"># Заголовок · **жирный текст** · - список · ==выделение==. Изменения сохраняются кнопкой «Сохранить».</p></div>;
  const days = [...new Set(value.schedule.map(row => row.date))].sort();
  return <div className="space-y-4">
    <ProjectSection title="Тайминг" count={value.schedule.length} defaultOpen editable={editable} editor={<div className="space-y-3">{value.schedule.map((row, index) => <div key={row.id} className="min-w-0 space-y-2 rounded-xl border border-gray-800 p-3"><div className="flex items-center gap-2"><input aria-label={`Дата пункта ${index + 1}`} type="date" value={row.date} onChange={event => update('schedule', value.schedule.map(item => item.id === row.id ? { ...item, date: event.target.value } : item))} className={input} /><button type="button" aria-label={`Удалить пункт ${index + 1}`} onClick={() => update('schedule', value.schedule.filter(item => item.id !== row.id))} className="shrink-0 p-2 text-red-400"><Trash2 className="h-4 w-4" /></button></div><input aria-label={`Название пункта ${index + 1}`} placeholder="Монтаж, программа, демонтаж..." value={row.title} onChange={event => update('schedule', value.schedule.map(item => item.id === row.id ? { ...item, title: event.target.value } : item))} className={input} /><div className="grid min-w-0 grid-cols-1 min-[400px]:grid-cols-2 gap-3"><label className="block min-w-0 space-y-1 text-xs text-gray-400">Начало<input type="time" value={row.start} onChange={event => update('schedule', value.schedule.map(item => item.id === row.id ? { ...item, start: event.target.value } : item))} className={`${input} block max-w-full appearance-none`} /></label><label className="block min-w-0 space-y-1 text-xs text-gray-400">Окончание<input type="time" value={row.end} onChange={event => update('schedule', value.schedule.map(item => item.id === row.id ? { ...item, end: event.target.value } : item))} className={`${input} block max-w-full appearance-none`} /></label></div></div>)}<button type="button" onClick={() => update('schedule', [...value.schedule, { id: newProjectId(), date: dayNumber(eventDate) === null ? '' : eventDate, title: '', start: '', end: '' }])} className={addClass}><Plus className="h-4 w-4" />Добавить пункт</button></div>}>
      {!days.length ? <p className="text-sm text-gray-500">Добавьте расписание по дням мероприятия.</p> : <div className="space-y-5">{days.map(date => {
        const stamp = dayNumber(date);
        return <div key={date}><h4 className="border-b border-gray-800 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{stamp === null ? 'Дата не указана' : new Date(stamp * 86400000).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</h4>{value.schedule.filter(row => row.date === date).sort((a, b) => a.start.localeCompare(b.start)).map(row => <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-800/70 py-3 text-sm"><span className="min-w-0 [overflow-wrap:anywhere] text-gray-200">{row.title || 'Без названия'}</span><span className="ml-auto shrink-0 font-medium text-gray-400">{row.start}{row.end ? `–${row.end}` : ''}</span></div>)}</div>;
      })}</div>}
    </ProjectSection>
    <ProjectSection title="Описание" defaultOpen editable={editable} editor={textEditor('description')}><ProjectText text={value.description} empty="Описание мероприятия пока не добавлено." /></ProjectSection>
    <EventPeoplePanel people={value.people} personnel={personnel} assigned={assigned} works={works} catalogWorks={catalogWorks} editable={editable} error={peopleError || directoryError || budgetWorksError} onChange={people => update('people', people)} budgets={peopleBudgets} selectedBudgetId={peopleBudget?.id || ''} onBudgetChange={id => update('people_budget_id', id)} customWorks={value.people_works || []} onCustomWorksChange={rows => update('people_works', rows)} loadingWorks={loadingBudgetWorks} />
    <ProjectSection title="Транспорт" count={value.transport.length} editable={editable} editor={<div className="space-y-3">{value.transport.map((row, index) => <div key={row.id} className="min-w-0 space-y-2 rounded-xl border border-gray-800 p-3"><div className="flex gap-2"><input aria-label={`Транспорт ${index + 1}`} value={row.vehicle} placeholder="Автомобиль, номер" onChange={event => update('transport', value.transport.map(item => item.id === row.id ? { ...item, vehicle: event.target.value } : item))} className={input} /><button type="button" aria-label={`Удалить транспорт ${index + 1}`} onClick={() => update('transport', value.transport.filter(item => item.id !== row.id))} className="p-2 text-red-400"><Trash2 className="h-4 w-4" /></button></div><input aria-label={`Водитель ${index + 1}`} value={row.driver} placeholder="Водитель" onChange={event => update('transport', value.transport.map(item => item.id === row.id ? { ...item, driver: event.target.value } : item))} className={input} /><textarea aria-label={`Примечания к транспорту ${index + 1}`} value={row.notes} placeholder="Маршрут, время подачи, примечания" onChange={event => update('transport', value.transport.map(item => item.id === row.id ? { ...item, notes: event.target.value } : item))} className={input} /></div>)}<button type="button" onClick={() => update('transport', [...value.transport, { id: newProjectId(), vehicle: '', driver: '', notes: '' }])} className={addClass}><Plus className="h-4 w-4" />Добавить транспорт</button></div>}>
      {!value.transport.length ? <p className="text-sm text-gray-500">Транспорт пока не указан.</p> : <div className="space-y-3">{value.transport.map(row => <div key={row.id} className="flex gap-3 text-sm"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" /><div className="min-w-0"><p className="break-words text-gray-200">{row.vehicle}</p>{row.driver && <p className="text-xs text-gray-400">{row.driver}</p>}{row.notes && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-500">{row.notes}</p>}</div></div>)}</div>}
    </ProjectSection>
    {([['sound', 'Звук', 'Райдеры / сцены'], ['light', 'Свет', 'Отрисовки / планы / адреса'], ['media', 'Медиа', 'Контент / патч'], ['io', 'Input / Output', 'Входы и выходы']] as const).map(([key, title, subtitle]) => <ProjectSection key={key} title={title} subtitle={subtitle} editable={editable} editor={textEditor(key)}><ProjectText text={value[key]} /></ProjectSection>)}
  </div>;
}
