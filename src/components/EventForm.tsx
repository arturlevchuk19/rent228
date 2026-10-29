import { BudgetDocumentDialog } from './BudgetDocumentDialog';
import { EventBudgetsPanel } from './EventBudgetsPanel';
import { getBudgetEvent, getEventBudgets, type EventBudget } from '../lib/eventBudgets';
import { eventProgress } from '../lib/eventProgress';
import { EventDatesDialog } from './EventDatesDialog';
import { eventDateLabel, normalizeProjectDetails, validateProjectDetails } from '../lib/eventProject';
import { getErrorMessage } from '../lib/errors';
import { EventInlineField } from './EventInlineField';
import { ProjectSection } from './ProjectSection';
import { EventProjectBlocks } from './EventProjectBlocks';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import React, { useState, useEffect, useRef } from 'react';
import { X, Calculator, Copy, Check, FileText, FileSignature, ArrowLeft, CalendarDays, UserRoundCheck, Building2, MapPin, Trash2 } from 'lucide-react';
import { BudgetEditor } from './BudgetEditor';
import { CopyBudgetDialog } from './dialogs/CopyBudgetDialog';
import { ContractDialog } from './dialogs/ContractDialog';
import { generateContractDocx } from '../lib/contractGenerator';
import { calcGrandTotals } from '../lib/budgetPricing';
import { getLocationsForEvent } from '../lib/locations';
import { getCategoriesForEvent, getCategories } from '../lib/categories';
import { getActiveUsers } from '../lib/auth';
import type { User } from '../lib/supabase';
import {
  createEvent,
  deleteEvent,
  updateEvent,
  Event,
  getEvent,
  getClients,
  getVenues,
  getEventTypes,
  getBudgetItems,
  Client,
  Venue,
  EVENT_TYPES,
  EVENT_STATUSES
} from '../lib/events';

interface EventFormProps {
  presentation?: 'modal' | 'page';
  onDirtyChange?: (dirty: boolean) => void;
  onDeleted?: () => void;
  event?: Event;
  onClose: (eventId?: string) => void;
  onSave: (eventId?: string) => void;
  onSpecificationOpen?: (eventId: string, budgetId?: string) => void;
}

interface DateParts {
  day: string;
  month: string;
  year: string;
}

function parseEventDate(dateString: string): DateParts {
  if (!dateString) return { day: '', month: '', year: '' };
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return {
      year: parts[0],
      month: parts[1],
      day: parts[2]
    };
  }
  return { day: '', month: '', year: '' };
}

function formatEventDate(day: string, month: string, year: string): string {
  const d = day.padStart(2, '0');
  const m = month.padStart(2, '0');
  const y = year.padStart(4, '0');
  if (y === '0000') return '';
  return `${y}-${m}-${d}`;
}

function isValidDate(day: string, month: string, year: string): boolean {
  if (!year || year === '0000') return false;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(y) || y < 1000 || y > 9999) return false;
  // Разрешаем 00-99 для дня и месяца (для приблизительных дат)
  if (isNaN(m) || m < 0 || m > 99) return false;
  if (isNaN(d) || d < 0 || d > 99) return false;
  return true;
}

export function EventForm({ event, onClose, onSave, onSpecificationOpen, presentation = 'modal', onDirtyChange, onDeleted }: EventFormProps) {
  const { user } = useAuth();
  const page = presentation === 'page';
  const initialDate = parseEventDate(event?.event_date || '');

  const [formData, setFormData] = useState<{
    name: string;
    event_date: string;
    event_end_date: string;
    event_type: string;
    venue_id: string | null;
    site_manager_id: string | null;
    client_id: string | null;
    budget: string;
    specification: string;
    status: string;
    progress_budget_done: boolean;
    progress_equipment_reserved: boolean;
    progress_project_completed: boolean;
    progress_paid: boolean;
    notes: string;
  }>({
    name: event?.name || '',
    event_date: event?.event_date || '',
    event_end_date: event?.event_end_date || '',
    event_type: event?.event_type || 'Концерт',
    venue_id: event?.venue_id || null,
    site_manager_id: event?.site_manager_id || null,
    client_id: event?.client_id || null,
    budget: event?.budget || '',
    specification: event?.specification || '',
    status: event?.status || 'Запрос',
    progress_budget_done: event?.progress_budget_done || false,
    progress_equipment_reserved: event?.progress_equipment_reserved || false,
    progress_project_completed: event?.progress_project_completed || false,
    progress_paid: event?.progress_paid || false,
    notes: event?.notes || ''
  });

  const [project, setProject] = useState(() => normalizeProjectDetails(event?.project_details));
  const projectBaseline = useRef(JSON.stringify(project));
  const baseline = useRef(JSON.stringify({ formData, project }));
  const dirty = JSON.stringify({ formData, project }) !== baseline.current;
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [pageError, setPageError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [budgets, setBudgets] = useState<EventBudget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>();
  const [budgetRefresh, setBudgetRefresh] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showDatesDialog, setShowDatesDialog] = useState(false);
  const [documentPicker, setDocumentPicker] = useState<'pdf' | 'contract'>();
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  const [dateParts, setDateParts] = useState<DateParts>(initialDate);
  const [endDateParts, setEndDateParts] = useState<DateParts>(parseEventDate(event?.event_end_date || ''));
  const [clients, setClients] = useState<Client[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [hasBudgetItems, setHasBudgetItems] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [contractOrganizationId, setContractOrganizationId] = useState('');
  const [savedEventId, setSavedEventId] = useState<string | undefined>(undefined);

  // Effective event ID: use savedEventId for newly created events, otherwise use prop
  const effectiveEventId = event?.id || savedEventId;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (effectiveEventId) {
      checkBudgetItems();
    }
  }, [effectiveEventId]);

  useEffect(() => {
    const formatted = formatEventDate(dateParts.day, dateParts.month, dateParts.year);
    setFormData(prev => ({ ...prev, event_date: formatted }));
  }, [dateParts]);

  useEffect(() => {
    const formatted = formatEventDate(endDateParts.day, endDateParts.month, endDateParts.year);
    setFormData(prev => ({ ...prev, event_end_date: formatted }));
  }, [endDateParts]);

  const checkBudgetItems = async () => {
    if (!effectiveEventId || (!canAccess(user, 'budgets') && !canAccess(user, 'specifications'))) return;
    try {
      const [documents, current] = await Promise.all([getEventBudgets(effectiveEventId), getEvent(effectiveEventId)]);
      setBudgets(documents);
      setSelectedBudgetId(previous => documents.some(budget => budget.id === previous) ? previous : documents[0]?.id);
      setHasBudgetItems(documents.length > 0);
      setFormData(previous => {
        const saved = JSON.parse(baseline.current);
        const syncStatus = previous.status === saved.formData.status;
        const status = syncStatus ? current.status : previous.status;
        saved.formData.progress_budget_done = documents.length > 0;
        if (syncStatus) { saved.formData.status = status; Object.assign(saved.formData, eventProgress(status, documents.length)); }
        baseline.current = JSON.stringify(saved);
        return { ...previous, status, ...eventProgress(status, documents.length) };
      });
    } catch (error) {
      setPageError(getErrorMessage(error));
      console.error('Error checking budget items:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [clientsData, venuesData, eventTypesData, usersData] = await Promise.all([
        getClients(),
        getVenues(),
        getEventTypes(),
        getActiveUsers()
      ]);
      setClients(clientsData);
      setVenues(venuesData);
      setUsers(usersData);
      const typesFromDb = eventTypesData.map((item) => item.name).filter(Boolean);
      setEventTypes(typesFromDb.length > 0 ? typesFromDb : [...EVENT_TYPES]);
      
      if (event?.client_id) {
        setContractOrganizationId(event.client_id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAccess(user, 'events', 2)) return;

    if (formData.event_date && !isValidDate(dateParts.day, dateParts.month, dateParts.year)) {
      alert('Укажите корректную дату мероприятия');
      return;
    }

    const endDate = formData.event_end_date;
    if (endDate) {
      if (!isValidDate(endDateParts.day, endDateParts.month, endDateParts.year)) {
        alert('Укажите корректную дату окончания мероприятия');
        return;
      }
      if (endDate < formData.event_date) {
        alert('Дата «по» не может быть раньше даты «с»');
        return;
      }
    }

    try {
      setSaving(true);
      const projectChanged = projectBaseline.current !== JSON.stringify(project);
      const projectError = projectChanged ? validateProjectDetails(project, formData.event_date, formData.event_end_date) : null;
      if (projectError) { setPageError(projectError); return; }
      const payload = {
        ...(projectChanged ? { project_details: project } : {}),
        name: formData.name,
        event_date: formData.event_date,
        event_end_date: formData.event_end_date,
        event_type: formData.event_type,
        venue_id: formData.venue_id || null,
        client_id: formData.client_id || null,
        site_manager_id: formData.site_manager_id || null,
        budget: formData.budget,
        specification: formData.specification,
        status: formData.status,
        progress_budget_done: budgets.length > 0,
        progress_equipment_reserved: ['Подтверждено', 'Выполнено'].includes(formData.status),
        progress_project_completed: formData.status === 'Выполнено',
        progress_paid: formData.progress_paid,
        notes: formData.notes
      };

      let savedEvent: Event;
      if (event || savedEventId) {
          // Update existing event (either passed as prop or just created)
         const eventIdToUpdate = event?.id || savedEventId!;
         savedEvent = await updateEvent(eventIdToUpdate, payload);
        } 
        else {
          savedEvent = await createEvent(payload);
           // Store the new event ID so subsequent saves use update instead of create
          setSavedEventId(savedEvent.id);
        // Also copy the client_id for contract dialog
        if (savedEvent.client_id) {
          setContractOrganizationId(savedEvent.client_id);
        }
      }
      baseline.current = JSON.stringify({ formData, project });
      projectBaseline.current = JSON.stringify(project);
      setPageError('');
      setSaveMessage('Мероприятие сохранено.');
      onDirtyChange?.(false);
      onSave(savedEvent.id);
    } catch (error) {
      console.error('Error saving event:', error);
      const message = getErrorMessage(error);
      const display = message.includes('project_details') ? 'Для новых блоков нужно выполнить миграцию event_project_details в Supabase. Остальные данные не потеряны.' : `Ошибка при сохранении: ${message}`;
      if (page) setPageError(display); else alert(display);
    } finally {
      setSaving(false);
    }
  };

  const handleContractConfirm = async (payload: { date: string; equipmentTypeRP: string; organizationId: string }) => {
    if (!effectiveEventId) return;
    setContractOrganizationId(payload.organizationId);
    setShowContractDialog(false);

    try {
      const fullEvent = selectedBudgetId ? await getBudgetEvent(effectiveEventId, selectedBudgetId) : await getEvent(effectiveEventId);
      const client = clients.find((item) => item.id === payload.organizationId);
      if (!client) {
        alert('Выбранная организация не найдена');
        return;
      }

      const budgetItems = await getBudgetItems(effectiveEventId, selectedBudgetId);
      const totals = calcGrandTotals(budgetItems, fullEvent.budget_days || 1, fullEvent.budget_totals_mode || 'combined_only');
      
      let amount = fullEvent.budget_totals_mode === 'combined_only' ? totals.combinedTotal : totals.day1Total;
      if (fullEvent.discount_enabled && fullEvent.discount_percent) {
        // Simplified discount calculation for contract from EventForm
        // In BudgetEditor it's more complex because of different payment modes
        // Here we just apply the percent to the total
        amount = amount * (1 - fullEvent.discount_percent / 100);
      }

      // Fetch locations and categories so the contract asset list is ordered the
      // same as the estimate (смета) PDF.
      const [locations, eventCategories] = await Promise.all([
        getLocationsForEvent(effectiveEventId, selectedBudgetId),
        getCategoriesForEvent(effectiveEventId, selectedBudgetId)
      ]);
      const categories = eventCategories.length > 0 ? eventCategories : await getCategories().catch(() => []);

      await generateContractDocx({
        event: fullEvent,
        client,
        equipmentTypeRP: payload.equipmentTypeRP,
        contractDate: payload.date,
        amount: amount,
        budgetItems: budgetItems,
        locations,
        categories
      });
    } catch (error) {
      console.error('Error generating contract:', error);
      alert('Ошибка при создании договора');
    }
  };

  const handleDateChange = (field: keyof DateParts, value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setDateParts(prev => ({ ...prev, [field]: numericValue }));
  };

  const handleEndDateChange = (field: keyof DateParts, value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setEndDateParts(prev => ({ ...prev, [field]: numericValue }));
  };

  const handleCopySuccess = (eventData?: Partial<Event>, budgetId?: string) => {
    if (budgetId) setSelectedBudgetId(budgetId);
    setCopySuccess(true);
    checkBudgetItems();

    // Если скопированы данные мероприятия, обновляем форму
    if (eventData) {
      setFormData(prev => ({
        ...prev,
        name: eventData.name || prev.name,
        event_type: eventData.event_type || prev.event_type,
        venue_id: eventData.venue_id ?? prev.venue_id,
        client_id: eventData.client_id ?? prev.client_id,
        budget: eventData.budget || prev.budget,
        specification: eventData.specification || prev.specification,
        notes: eventData.notes || prev.notes
      }));
    }

    setTimeout(() => setCopySuccess(false), 2000);
  };

  const formatEndDateDisplay = () => {
    const d = endDateParts.day.padStart(2, '0');
    const m = endDateParts.month.padStart(2, '0');
    const y = endDateParts.year;
    if (!y) return '';
    return `${d}.${m}.${y}`;
  };

  const handlePagePdf = async (budgetId: string) => {
    if (!effectiveEventId || !canAccess(user, 'specifications')) return;
    if (dirty) { setPageError('Сначала сохраните изменения мероприятия, затем создайте PDF.'); return; }
    setGeneratingPdf(true); setPageError('');
    try {
      const budget = budgets.find(item => item.id === budgetId);
      if (!budget) throw new Error('Спецификация не найдена. Обновите список смет.');
      const [{ loadSpecificationExport }, { saveSpecificationPdf }] = await Promise.all([import('../lib/specificationExport'), import('../lib/specificationPdf')]);
      const initialize = canAccess(user, 'specifications', 2) && (user?.role !== 'foreman' || formData.site_manager_id === user.id);
      const { event: saved, rows } = await loadSpecificationExport(effectiveEventId, budgetId, initialize);
      saveSpecificationPdf({ eventName: saved.name || saved.event_type, budgetName: budget.name, startDate: saved.event_date, endDate: saved.event_end_date, venue: saved.venues?.name, rows });
    } catch (caught) { setPageError(getErrorMessage(caught)); } finally { setGeneratingPdf(false); }
  };

  const selectDocument = (kind: 'pdf' | 'contract', id: string) => {
    setDocumentPicker(undefined); setSelectedBudgetId(id);
    if (kind === 'pdf') void handlePagePdf(id); else setShowContractDialog(true);
  };
  const requestDocument = (kind: 'pdf' | 'contract') => {
    if (kind === 'pdf' && dirty) { setPageError('Сначала сохраните изменения мероприятия, затем создайте PDF.'); return; }
    if (!budgets.length) { setPageError('Сначала добавьте смету.'); return; }
    if (budgets.length === 1) selectDocument(kind, budgets[0].id); else setDocumentPicker(kind);
  };

  const legacyActions = (<div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {effectiveEventId && (
                  <button
                    type="button"
                    disabled={!canAccess(user, 'budgets', 1)}
                    onClick={() => setShowBudgetEditor(true)}
                    className={`flex items-center gap-1.5 px-2 py-1 text-white rounded transition-colors text-left leading-tight ${
                      hasBudgetItems
                        ? 'bg-cyan-600 hover:bg-cyan-700'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    <Calculator className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      {hasBudgetItems ? (
                        <>{canAccess(user, 'budgets', 2) ? 'Редактировать' : 'Просмотреть'}<br />смету</>
                      ) : (
                        <>{canAccess(user, 'budgets', 2) ? 'Составить' : 'Просмотреть'}<br />смету</>
                      )}
                    </span>
                  </button>
                )}
                {effectiveEventId && (
                  <button
                    type="button"
                    disabled={!canAccess(user, 'budgets', 2)}
                    onClick={() => setShowCopyDialog(true)}
                    className="flex items-center gap-1.5 px-2 py-1 text-white bg-violet-600 hover:bg-violet-700 rounded transition-colors text-left leading-tight"
                    title="Скопировать смету из другого мероприятия"
                  >
                    {copySuccess ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="text-[10px] font-medium uppercase tracking-wider">
                      {copySuccess ? 'Скопировано!' : (
                        <>Скопировать<br />смету</>
                      )}
                    </span>
                  </button>
                )}
              </div>

              {effectiveEventId && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canAccess(user, 'budgets', 1)}
                    onClick={() => setShowContractDialog(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 rounded transition-colors border border-gray-700"
                    title="Сформировать договор"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    Договор
                  </button>
                  <button
                    type="button"
                    disabled={!canAccess(user, 'specifications')}
                    onClick={() => onSpecificationOpen?.(effectiveEventId, selectedBudgetId)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 rounded transition-colors border border-gray-700"
                    title="Открыть спецификацию"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Спецификация
                  </button>
                </div>
              )}
            </div>);

  if (loading) {
    return (
      <div className={page ? 'flex min-h-64 items-center justify-center' : 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'}>
        <div className="text-white">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className={page ? 'mx-auto w-full max-w-5xl pb-3' : 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'}>
      <div className={page ? 'w-full' : 'bg-gray-900 rounded-lg border border-gray-800 w-full max-w-3xl max-h-[85vh] flex flex-col'}>
        <div className={page ? 'hidden' : 'flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0'}>
          <h2 className="text-lg font-semibold text-white">
            {effectiveEventId ? (canAccess(user, 'events', 2) ? 'Редактировать мероприятие' : 'Мероприятие') : 'Новое мероприятие'}
          </h2>
          <button
            onClick={() => onClose(effectiveEventId)}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={page ? 'space-y-3' : 'flex-1 overflow-y-auto'}>
      {page && <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => onClose(effectiveEventId)} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Назад</button>
          <div className="ml-auto flex items-center gap-2">
          <button type="button" disabled={!effectiveEventId || !budgets.length || generatingPdf || !canAccess(user, 'specifications')} onClick={() => requestDocument('pdf')} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40"><FileText className="h-4 w-4" />{generatingPdf ? 'Создание PDF...' : 'PDF'}</button>
          <button type="button" disabled={!effectiveEventId || !budgets.length || !canAccess(user, 'budgets')} onClick={() => requestDocument('contract')} aria-label="Договор" title="Договор" className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40"><FileSignature className="h-4 w-4" /><span className="hidden sm:inline">Договор</span></button>
          <button type="button" disabled={!effectiveEventId || !canAccess(user, 'budgets', 2)} onClick={() => setShowCopyDialog(true)} aria-label="Копировать смету из мероприятия" className="rounded-xl border border-gray-700 bg-gray-900 p-2 text-gray-400 hover:text-cyan-400 disabled:opacity-40"><Copy className="h-5 w-5" /></button>
          {canAccess(user, 'events', 3) && effectiveEventId && <button type="button" disabled={saving} onClick={async () => { if (!window.confirm('Удалить это мероприятие и его смету?')) return; try { setSaving(true); await deleteEvent(effectiveEventId); onDirtyChange?.(false); onDeleted?.(); } catch (caught) { setPageError(getErrorMessage(caught)); } finally { setSaving(false); } }} aria-label="Удалить мероприятие" className="rounded-xl border border-red-900 bg-red-950/20 p-2 text-red-400 hover:bg-red-900/30 disabled:opacity-40"><Trash2 className="h-5 w-5" /></button>}
          </div>
        </div>
        <input aria-label="Название мероприятия" placeholder="Название мероприятия" value={formData.name} disabled={!canAccess(user, 'events', 2)} onChange={event => setFormData({ ...formData, name: event.target.value })} className="event-page-title w-full min-w-0 border-0 bg-transparent py-1 text-lg font-semibold text-white outline-none placeholder:text-gray-600 sm:text-xl" />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-label="Изменить даты мероприятия" disabled={!canAccess(user, 'events', 2)} onClick={() => setShowDatesDialog(true)} className="inline-flex items-center gap-2 text-left text-xs sm:text-sm text-gray-200"><CalendarDays className="h-4 w-4 shrink-0 text-gray-500" /><span className="border-b border-dashed border-gray-600 pb-0.5">{eventDateLabel(formData.event_date, formData.event_end_date)}</span></button>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select aria-label="Статус мероприятия" value={formData.status} disabled={!canAccess(user, 'events', 2)} onChange={event => setFormData({ ...formData, status: event.target.value, ...eventProgress(event.target.value, budgets.length) })} className={`max-w-full rounded-full border px-3 py-1.5 text-xs font-semibold outline-none ${formData.status === 'Подтверждено' ? 'border-emerald-800 bg-emerald-900/30 text-emerald-400' : formData.status === 'Отменено' ? 'border-red-900 bg-red-900/20 text-red-400' : formData.status === 'Выполнено' ? 'border-gray-700 bg-gray-800 text-gray-400' : 'border-amber-900 bg-amber-900/20 text-amber-400'}`}>{EVENT_STATUSES.map(status => <option className="bg-gray-900 text-gray-200" key={status}>{status}</option>)}</select>
        <label className="min-w-0 max-w-full"><span className="sr-only">Тип мероприятия</span><select value={formData.event_type} disabled={!canAccess(user, 'events', 2)} onChange={event => setFormData({ ...formData, event_type: event.target.value })} className="max-w-full rounded-full border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-300 outline-none focus:border-cyan-600">{eventTypes.map(type => <option key={type}>{type}</option>)}</select></label>
            </div>
          </div>
          <EventInlineField label="Заказчик мероприятия" icon={Building2} value={formData.client_id} placeholder="Заказчик не выбран" options={clients.map(client => ({ value: client.id, label: client.organization || client.full_name }))} disabled={!canAccess(user, 'events', 2)} onChange={value => setFormData({ ...formData, client_id: value })} />
          <EventInlineField label="Старший на площадке" icon={UserRoundCheck} value={formData.site_manager_id} placeholder="Старший на площадке не назначен" options={users.map(item => ({ value: item.id, label: item.full_name || item.email }))} disabled={!canAccess(user, 'events', 2)} onChange={value => setFormData({ ...formData, site_manager_id: value })} />
          <EventInlineField label="Площадка мероприятия" icon={MapPin} value={formData.venue_id} placeholder="Площадка не выбрана" options={venues.map(venue => ({ value: venue.id, label: venue.name }))} disabled={!canAccess(user, 'events', 2)} onChange={value => setFormData({ ...formData, venue_id: value })} />
        </div>
        <div aria-label="Прогресс проекта" className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs text-gray-300">
          <label className="flex items-center gap-2"><input type="checkbox" checked={budgets.length > 0} disabled className="h-4 w-4 accent-cyan-600" />Смета составлена</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={['Подтверждено', 'Выполнено'].includes(formData.status)} disabled={!canAccess(user, 'events', 2)} onChange={event => { const status = event.target.checked ? 'Подтверждено' : 'Запрос'; setFormData({ ...formData, status, ...eventProgress(status, budgets.length) }); }} className="h-4 w-4 accent-cyan-600" />Смета подтверждена</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.status === 'Выполнено'} disabled={!canAccess(user, 'events', 2)} onChange={event => { const status = event.target.checked ? 'Выполнено' : 'Подтверждено'; setFormData({ ...formData, status, ...eventProgress(status, budgets.length) }); }} className="h-4 w-4 accent-cyan-600" />Проект выполнен</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={formData.progress_paid} disabled={!canAccess(user, 'events', 2)} onChange={event => setFormData({ ...formData, progress_paid: event.target.checked })} className="h-4 w-4 accent-cyan-600" />Оплачен</label>
        </div>
        {pageError && <p role="alert" className="rounded-xl border border-red-900 bg-red-900/20 p-3 text-sm text-red-300">{pageError}</p>}
        {saveMessage && <p role="status" className="text-sm text-emerald-400">{saveMessage}</p>}
      </div>}
          {page && <>
              <EventBudgetsPanel eventId={effectiveEventId} budgets={budgets} onChanged={checkBudgetItems} onOpen={id => { setSelectedBudgetId(id); setShowBudgetEditor(true); }} />
            <ProjectSection title="Спецификации" count={budgets.length}>
              {!budgets.length && <p className="text-sm text-gray-500">Спецификации появятся после добавления смет.</p>}
              {budgets.map(budget => <button key={budget.id} type="button" disabled={!canAccess(user, 'specifications')} onClick={() => { if (effectiveEventId) onSpecificationOpen?.(effectiveEventId, budget.id); }} className="mb-2 flex w-full items-center gap-2 rounded-lg border border-gray-800 p-3 text-left text-sm text-gray-300"><FileText className="h-4 w-4" />{budget.name}</button>)}
            </ProjectSection>
            <EventProjectBlocks value={project} onChange={setProject} editable={canAccess(user, 'events', 2)} eventId={effectiveEventId} eventDate={formData.event_date} refreshSignal={budgetRefresh} />
          </>}

          {!page && <details ref={detailsRef} open={page ? !event : true} className={page ? 'overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/70' : 'contents'}>

          <fieldset disabled={!canAccess(user, 'events', 2)} className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Дата
                  <span className="text-gray-500 font-normal ml-1">(ДД.ММ.ГГГГ, можно 00)</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ДД"
                    maxLength={2}
                    value={dateParts.day}
                    onChange={(e) => handleDateChange('day', e.target.value)}
                    className="w-14 px-2 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-center"
                  />
                  <span className="text-gray-500">.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ММ"
                    maxLength={2}
                    value={dateParts.month}
                    onChange={(e) => handleDateChange('month', e.target.value)}
                    className="w-14 px-2 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-center"
                  />
                  <span className="text-gray-500">.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ГГГГ"
                    maxLength={4}
                    value={dateParts.year}
                    onChange={(e) => handleDateChange('year', e.target.value)}
                    className="w-20 px-2 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-center"
                  />
                </div>
                {formData.event_date && (
                  <div className="text-xs text-cyan-400 mt-1">
                    Сохранится как: {formData.event_date}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Статус <span className="text-red-400/80">*</span>
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  {EVENT_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Дата по
                  <span className="text-gray-500 font-normal ml-1">(ДД.ММ.ГГГГ, можно 00)</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ДД"
                    maxLength={2}
                    value={endDateParts.day}
                    onChange={(e) => handleEndDateChange('day', e.target.value)}
                    className="w-14 px-2 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-center"
                  />
                  <span className="text-gray-500">.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ММ"
                    maxLength={2}
                    value={endDateParts.month}
                    onChange={(e) => handleEndDateChange('month', e.target.value)}
                    className="w-14 px-2 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-center"
                  />
                  <span className="text-gray-500">.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="ГГГГ"
                    maxLength={4}
                    value={endDateParts.year}
                    onChange={(e) => handleEndDateChange('year', e.target.value)}
                    className="w-20 px-2 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-center"
                  />
                </div>
                {formatEndDateDisplay() && (
                  <div className="text-xs text-cyan-400 mt-1">
                    Сохранится как: {formData.event_end_date}
                  </div>
                )}
              </div>

              <div></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Название мероприятия
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                placeholder="Название"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Тип <span className="text-red-400/80">*</span>
                </label>
                <select
                  required
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  {eventTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Заказчик
                </label>
                <select
                  value={formData.client_id || ''}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Не выбран</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.organization}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Площадка
                </label>
                <select
                  value={formData.venue_id || ''}
                  onChange={(e) => setFormData({ ...formData, venue_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Не выбрана</option>
                  {venues.map(venue => (
                    <option key={venue.id} value={venue.id}>{venue.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Старший по площадке
                </label>
                <select
                  value={formData.site_manager_id || ''}
                  onChange={(e) => setFormData({ ...formData, site_manager_id: e.target.value || null })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Не назначен</option>
                  {users.map(item => (
                    <option key={item.id} value={item.id}>{item.full_name || item.email}</option>
                  ))}
                </select>
              </div>

            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Прогресс проекта
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_budget_done}
                    onChange={(e) => setFormData({ ...formData, progress_budget_done: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Смета составлена</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_equipment_reserved}
                    onChange={(e) => setFormData({ ...formData, progress_equipment_reserved: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Смета подтверждена</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_project_completed}
                    onChange={(e) => setFormData({ ...formData, progress_project_completed: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Проект выполнен</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={formData.progress_paid}
                    onChange={(e) => setFormData({ ...formData, progress_paid: e.target.checked })}
                    className="w-4 h-4 bg-gray-800 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500 focus:ring-offset-gray-900"
                  />
                  <span className="text-gray-300 text-sm">Оплачен</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Примечания
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700/50 rounded text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                placeholder="Дополнительная информация..."
              />
            </div>
          </fieldset>
          </details>}

          {page && <ProjectSection title="Примечания"><textarea aria-label="Примечания мероприятия" value={formData.notes} disabled={!canAccess(user, 'events', 2)} onChange={event => setFormData({ ...formData, notes: event.target.value })} rows={3} className="w-full rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-200" /></ProjectSection>}
          <div className="sticky bottom-0 z-10 rounded-xl bg-gray-900/95 px-4 py-3 border border-gray-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-2">
            {!page && legacyActions}
            {page && pageError && <p role="alert" className="min-w-0 flex-1 text-xs text-red-300">{pageError}</p>}

            <div className="flex items-center justify-end gap-2 pt-3 md:ml-auto md:pt-0 border-t md:border-t-0 border-gray-800">
              <button
                type="button"
                onClick={() => onClose(effectiveEventId)}
                className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving || !canAccess(user, 'events', 2)}
                className="px-6 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {documentPicker && <BudgetDocumentDialog budgets={budgets} kind={documentPicker} onClose={() => setDocumentPicker(undefined)} onSelect={id => selectDocument(documentPicker, id)} />}

      {showDatesDialog && canAccess(user, 'events', 2) && <EventDatesDialog
        name={formData.name} start={formData.event_date} end={formData.event_end_date}
        onClose={() => setShowDatesDialog(false)}
        onApply={(start, end) => {
          setDateParts(parseEventDate(start));
          setEndDateParts(parseEventDate(end));
          setFormData(previous => ({ ...previous, event_date: start, event_end_date: end }));
          setSaveMessage('');
        }}
      />}

      {showBudgetEditor && effectiveEventId && (
        <BudgetEditor
          budgetId={selectedBudgetId}
          eventId={effectiveEventId}
          eventName={formData.name || 'Мероприятие'}
          onClose={() => {
            setShowBudgetEditor(false);
            checkBudgetItems();
            setBudgetRefresh(value => value + 1);
          }}
        />
      )}

      {showCopyDialog && effectiveEventId && (
        <CopyBudgetDialog
          currentEventId={effectiveEventId}
          onClose={() => setShowCopyDialog(false)}
          onSuccess={handleCopySuccess}
        />
      )}

      {showContractDialog && effectiveEventId && (
        <ContractDialog
          isOpen={showContractDialog}
          clients={clients.filter((c) => Boolean(c.organization))}
          initialOrganizationId={contractOrganizationId}
          onClose={() => setShowContractDialog(false)}
          onConfirm={handleContractConfirm}
        />
      )}
    </div>
  );
}
