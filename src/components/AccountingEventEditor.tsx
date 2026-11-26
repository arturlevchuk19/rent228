import { useEffect, useRef, useState } from 'react';
import { type EventBudget } from '../lib/eventBudgets';
import { normalizeProjectDetails, validateProjectDetails, type EventProjectDetails } from '../lib/eventProject';
import { documentPeopleWorks, type PeopleDirectoryEntry, type PeopleWork } from '../lib/eventPeople';
import { type BudgetItem } from '../lib/events';
import { getErrorMessage } from '../lib/errors';
import type { ClaimEvent } from '../lib/employeeClaims';
import { supabase } from '../lib/supabase';
import { EventPeoplePanel, type StaffTemplate } from './EventPeoplePanel';

interface EventAccountingData { details: unknown; personnel: PeopleDirectoryEntry[]; catalog: PeopleWork[] }

export function AccountingEventEditor({ event, editable, refreshSignal, addCategoryRequest }: { event: ClaimEvent; editable: boolean; refreshSignal?: number; addCategoryRequest?: number }) {
  const changed = useRef(0);
  const [context, setContext] = useState<EventAccountingData>();
  const [project, setProject] = useState<EventProjectDetails>();
  const [budgets, setBudgets] = useState<EventBudget[]>([]);
  const [assigned, setAssigned] = useState<Pick<PeopleDirectoryEntry,'id'|'full_name'|'employment_type'>[]>([]);
  const [templates, setTemplates] = useState<StaffTemplate[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [error, setError] = useState('');
  const [budgetError, setBudgetError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const [budgetLoading, setBudgetLoading] = useState(true);

  useEffect(() => {
    let current = true;
    supabase.rpc('accounting_event_open', { p_event: event.id }).then(({ data, error }) => {
      if (!current) return;
      if (error) { setError(getErrorMessage(error)); return; }
      setContext(data); setProject(normalizeProjectDetails(data.details)); setError('');
    });
    return () => { current = false; };
  }, [event.id, retry]);
  useEffect(() => {
    // Refresh a clean editor after another accountant changes an assignment.
    if (!context || !project || JSON.stringify(project) !== JSON.stringify(normalizeProjectDetails(context.details))) return;
    let active = true;
    const revision = changed.current;
    supabase.rpc('accounting_event_open', { p_event: event.id }).then(({ data, error }) => {
      if (active && !error && changed.current === revision) {
        setContext(data);
        setProject(normalizeProjectDetails(data.details));
      }
    });
    return () => { active = false; };
    // Only external edits trigger refresh. Local drafts are compared against the loaded snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, refreshSignal]);

  useEffect(() => {
    let current = true;
    setBudgetLoading(true);
    supabase.rpc('accounting_event_budget', { p_event: event.id }).then(({ data, error }) => {
      if (!current) return;
      if (error) setBudgetError(getErrorMessage(error));
      else { setBudgets(data.budgets); setItems(data.items); setAssigned(data.assigned); setBudgetError(''); }
      setBudgetLoading(false);
    });
    return () => { current = false; };
  }, [event.id, refreshSignal, retry]);

  useEffect(() => {
    let active = true;
    supabase.from('accounting_staff_templates').select('id,name,personnel_ids').order('name').then(({ data, error }) => {
      if (active && !error) setTemplates(data ?? []);
    });
    return () => { active = false; };
  }, []);

  if (!context || !project) return error
    ? <p role="alert" className="text-sm text-red-300">{error} <button type="button" className="underline" onClick={() => { setError(''); setRetry(count => count + 1); }}>Повторить</button></p>
    : <p role="status" className="text-sm text-gray-400">Загрузка расчёта…</p>;

  const budget = budgets.find(row => row.id === project.people_budget_id) ?? budgets.find(row => row.is_primary) ?? budgets[0];
  const update = <K extends keyof EventProjectDetails>(key: K, value: EventProjectDetails[K]) => {
    changed.current++;
    setProject(current => current && { ...current, [key]: value });
    setSaved(false);
  };
  const dirty = JSON.stringify(project) !== JSON.stringify(normalizeProjectDetails(context.details));
  const save = async () => {
    if (saving || !dirty) return;
    const invalid = validateProjectDetails(project, event.event_date, event.event_end_date || '');
    if (invalid) { setError(invalid); return; }
    changed.current++;
    setSaving(true); setError('');
    try {
      const { data, error } = await supabase.rpc('accounting_event_save', {
        p_event: event.id, p_previous: context.details,
        p_details: { people: project.people, transport: project.transport, people_works: project.people_works ?? [], people_budget_id: project.people_budget_id },
      });
      if (error) throw error;
      setContext({ ...context, details: data }); setProject(normalizeProjectDetails(data)); setSaved(true);
    } catch (caught) { setError(getErrorMessage(caught)); }
    finally { setSaving(false); }
  };

  return <div className="space-y-3">
    <EventPeoplePanel eventDate={event.event_date} people={project.people} personnel={context.personnel} assigned={assigned} templates={templates}
      onSaveTemplate={editable ? async (name, ids) => {
        const { data, error } = await supabase.from('accounting_staff_templates').insert({ name, personnel_ids: ids }).select('id,name,personnel_ids').single();
        if (error) throw error;
        setTemplates(current => [...current, data]);
      } : undefined}
      works={budget ? documentPeopleWorks(items, budget) : []} catalogWorks={context.catalog}
      editable={editable && !saving} error={budgetError} onChange={rows => update('people', rows)} budgets={budgets}
      selectedBudgetId={budget?.id ?? ''} onBudgetChange={id => update('people_budget_id', id)}
      customWorks={project.people_works} onCustomWorksChange={rows => update('people_works', rows)}
      loadingWorks={budgetLoading} transport={project.transport} manualCategoryPrices addCategoryRequest={addCategoryRequest}
      onTransportChange={editable && !saving ? rows => update('transport', rows) : undefined} />
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {editable && <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={saving || !dirty} onClick={() => void save()} className="min-h-11 rounded-lg bg-accent-500 px-4 text-sm font-semibold text-gray-950 disabled:opacity-40">{saving ? 'Сохранение…' : 'Сохранить расчёт'}</button>
      {saved && <span role="status" className="text-sm text-gray-300">Расчёт сохранён</span>}
    </div>}
  </div>;
}
