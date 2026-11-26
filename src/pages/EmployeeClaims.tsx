import { AccountingEventEditor } from '../components/AccountingEventEditor';
import { accountingMonth, AccountingExpenseGroups } from '../components/AccountingExpenseGroups';
import { AccountingWorkCorrections, PersonalAccountingWork } from '../components/AccountingWorkCorrections';
import { TripFields } from '../components/TripFields';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Receipt, X, Trash2, History, Settings, ChevronDown, Warehouse } from 'lucide-react';
import { useAuth } from '../contexts/authContext';
import { canAccess } from '../lib/roles';
import { getErrorMessage } from '../lib/errors';
import { MobileHeaderContent } from '../components/MobileHeaderContent';
import { claimBootstrap,claimWorks,listClaims,findClaimById,saveClaim,submitClaimCorrection,reviewClaim,claimHistory,saveClaimRates,uploadClaimReceipt,openClaimReceipt,minskToday,minskInput,lineEstimate,claimLineError,sumClaimAmounts,CLAIM_STATES,type EmployeeClaim,type ClaimBootstrap,type ClaimLine,type ClaimKind,type ClaimRates,type ClaimAssignment,type ClaimPerson } from '../lib/employeeClaims';
import Payments from './Payments';
import { ClaimPersonPicker } from '../components/ClaimPersonPicker';
import { personWorkAmount, personWorkHours } from '../lib/eventPeople';
import { dayNumber } from '../lib/calendar';
import { searchInputProps } from '../lib/searchInput';
const input='min-h-11 w-full min-w-0 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:border-accent-500';
const primary='min-h-11 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-40';
const secondary='min-h-11 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40';
const money=(value:number)=>value.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
const date=(value:string)=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Minsk'});
const eventLabel = (venue: string | null | undefined, name: string, eventDate: string) =>
  [venue?.trim() || name, dayNumber(eventDate) === null ? '' : eventDate.split('-').reverse().join('/')].filter(Boolean).join(' ');
const lineNames:Record<ClaimKind,string>={warehouse:'Работа на складе',time:'Рабочее время',trip:'Поездка (водитель)',expense:'Хозрасход с чеком',allowance:'Расходы / другие выплаты'};
type ClaimDraftLine = ClaimLine & { employeeReceipts?: Record<string, string> };
type AccountingWork = ClaimAssignment & { warehouse?: boolean; note?: string };

export function Accounting({ refreshSignal }: { refreshSignal?: number }){const [tab,setTab]=useState<'claims'|'payments'>('claims');return <div className="space-y-4"><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={tab==='claims'} className={tab==='claims'?primary:secondary} onClick={()=>setTab('claims')}>Учёт мероприятий и заявки</button><button type="button" aria-pressed={tab==='payments'} className={tab==='payments'?primary:secondary} onClick={()=>setTab('payments')}>Ранее созданные выплаты</button></div>{tab==='claims'?<EmployeeClaims review refreshSignal={refreshSignal} />:<Payments/>}</div>;}
export function EmployeeClaims({review=false, refreshSignal}:{review?:boolean; refreshSignal?: number}){
 const {user}=useAuth();const manager=review&&canAccess(user,'payments',2);
 const [boot,setBoot]=useState<ClaimBootstrap|null>(null),[rows,setRows]=useState<EmployeeClaim[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[filter,setFilter]=useState('all'),[search,setSearch]=useState('');
 const [tab, setTab] = useState<'events' | 'requests' | 'moderation' | 'archive'>('events');
 const [refresh, setRefresh] = useState(0);
 const [editor,setEditor]=useState<{claim:EmployeeClaim|null;kind?:ClaimKind}|null>(null),[ratesOpen,setRatesOpen]=useState(false);
 const load=useCallback(async()=>{setLoading(true);try{const [context,claims]=await Promise.all([claimBootstrap(),listClaims(review?undefined:user?.id)]);setBoot(context);setRows(claims);setError('');}catch(caught){setError(getErrorMessage(caught));}finally{setLoading(false);}},[review,user?.id]);
 useEffect(()=>{void load();},[load, refreshSignal]);
 const visible=rows.filter(row =>
   (tab === 'archive' ? row.state === 'rejected' || row.state === 'paid' :
     row.state === 'submitted' || row.state === 'draft') &&
   (filter==='all'||row.state===filter) &&
   `${row.employee_name} ${row.event_name}`.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU')));
 const canCreate = Boolean(boot && (manager ? boot.people.length || boot.personnel : boot.personnel));
 const addClaimLabel = review ? 'Добавить заявку' : 'Подать данные';
 const warehouseWork: AccountingWork[] = review ? rows.flatMap(claim => !claim.event_id && ['approved','paid'].includes(claim.state)
   ? claim.lines.flatMap((line, index) => {
     if (line.kind !== 'warehouse') return [];
     const start = minskInput(line.starts_at || '');
     const end = minskInput(line.ends_at || '');
     const workDate = start.slice(0, 10);
     if (!workDate || !`${claim.employee_name} Склад ${line.description || ''}`.toLocaleLowerCase('ru-RU').includes(search.toLocaleLowerCase('ru-RU'))) return [];
     return [{ id: `${claim.id}:${index}`, event_id: `warehouse:${workDate}`, event_name: 'Склад',
       event_date: workDate, venue: null, work_name: 'Работа на складе', note: line.description?.trim(),
       hours: null, starts_at: start, ends_at: end, rate: line.rate == null ? null : String(line.rate),
       employee_name: claim.employee_name, warehouse: true }];
   }) : []) : [];
 const buttons = <>
   <button type="button" aria-label={addClaimLabel} title={addClaimLabel} disabled={!canCreate}
     className={primary} onClick={() => setEditor({ claim: null })}>
     <Plus className="mr-1 inline h-4 w-4" /><span className={review ? '' : 'hidden md:inline'}>{addClaimLabel}</span>
   </button>
   {manager && <button type="button" disabled={!canCreate} className={secondary}
     onClick={() => setEditor({ claim: null, kind: 'warehouse' })}>
     <Warehouse className="mr-1 inline h-4 w-4" />Работа на складе
   </button>}
   {(['allowance', 'expense'] as const).map(kind => <button key={kind} type="button" aria-label={kind === 'expense' ? 'Хозрасходы' : 'Расходы'} disabled={!canCreate}
     className={secondary} onClick={() => setEditor({ claim: null, kind })}>
     <Receipt className="mr-1 inline h-4 w-4" />{kind === 'expense' ? 'Хозрасходы' : 'Расходы'}
   </button>)}
 </>;
 return <div className="space-y-4">
  {!review && <MobileHeaderContent>{buttons}</MobileHeaderContent>}
  <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="max-w-2xl text-sm text-gray-400">{review?'Проверка времени, поездок и расходов. Утверждение и отметка выплаты — отдельные действия.':'Подайте работу на складе без мероприятия или выберите мероприятие и укажите время до конца третьего дня после его окончания.'}</p>
    {manager&&<button type="button" className={secondary} onClick={()=>setRatesOpen(true)}><Settings className="mr-1 inline h-4 w-4"/>Тарифы поездок</button>}
  </div>
  {review && <div className="flex flex-wrap gap-2">{buttons}</div>}
  {manager && boot && !canCreate && <p className="text-sm text-gray-400">Для внесения заявки добавьте сотрудника в разделе «Персонал».</p>}
  {!loading&&!manager&&!boot?.personnel&&<p role="alert" className="rounded-xl border border-accent-700 p-4 text-sm text-accent-200">Учётная запись пока не связана с персоналом. Администратор может выбрать сотрудника при редактировании пользователя.</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-900 p-3 text-sm text-red-300">{error}<button type="button" className="ml-3 underline" onClick={()=>void load()}>Повторить</button></p>}
  <nav aria-label="Разделы расчётов" className="flex flex-wrap gap-2">
    {([['events', review ? 'Мероприятия' : 'Мои начисления'], ['requests', review ? 'Заявки сотрудников' : 'Мои заявки'],
      ['moderation', 'Модерация'], ['archive', 'Архив']] as const).map(([key, label]) =>
      <button type="button" key={key} aria-pressed={tab === key} className={tab === key ? primary : secondary}
        onClick={() => { setTab(key); setFilter('all'); }}>{label}</button>)}
  </nav>
  <div hidden={tab !== 'events'}>{review
    ? <AccountingEventWork events={boot?.events ?? []} claims={rows} warehouse={warehouseWork}
      loading={loading} editable={manager} refreshSignal={refresh + (refreshSignal ?? 0)} onOpenClaim={claim => setEditor({claim})} />
    : <><PersonalAccountingWork refresh={refresh} claims={rows} events={boot?.events ?? []} onOpenClaim={claim => setEditor({claim})} />
      <AccountingExpenseGroups claims={rows.filter(row => !row.event_id)} onOpen={claim => setEditor({claim})} /></>}</div>
  {(tab === 'moderation' || tab === 'archive') && <AccountingWorkCorrections review={review} canReview={manager}
    archived={tab === 'archive'} onChanged={() => { setRefresh(value => value + 1); void load(); }} />}
  {(tab === 'requests' || tab === 'archive') && <>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
      <input {...searchInputProps} aria-label="Поиск заявок" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Сотрудник или мероприятие…" className={input}/>
      <select aria-label="Статус заявки" value={filter} onChange={event=>setFilter(event.target.value)} className={input}>
        <option value="all">Все статусы раздела</option>{Object.entries(CLAIM_STATES).filter(([key]) => tab === 'archive' ? ['rejected','paid'].includes(key) : ['submitted','draft'].includes(key))
          .map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
    </div>
  {loading?<p role="status" className="py-10 text-center text-gray-400">Загрузка заявок…</p>:<div className="space-y-2">{visible.map(row=><button type="button" key={row.id} onClick={()=>setEditor({claim:row})} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left hover:border-accent-700"><span className="min-w-0"><span className="block break-words font-semibold text-gray-100">{row.event_name}</span>{review&&<span className="block text-sm text-gray-300">{row.employee_name}</span>}<span className="mt-1 block text-xs text-gray-400">{CLAIM_STATES[row.state]} · {date(row.updated_at)}</span></span><span className="text-right tabular-nums"><span className="block font-semibold text-gray-100">{money(row.total)} BYN</span><span className="block text-xs text-gray-400">Работы {money(row.work_amount)} · расходы {money(row.expense_amount)}</span></span></button>)}{!visible.length&&<p className="rounded-xl bg-gray-900 p-8 text-center text-sm text-gray-400">В этом разделе заявок нет.</p>}</div>}
  </>}
  {editor&&boot&&<ClaimEditor claim={editor.claim} initialKind={editor.kind} boot={boot} manager={manager} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setRefresh(value => value + 1);void load();}}/>}
  {ratesOpen&&boot&&<RatesDialog rates={boot.settings} onClose={()=>setRatesOpen(false)} onSaved={()=>{setRatesOpen(false);void load();}}/>}
 </div>;
}
function AccountingEventWork({ events, claims, warehouse, loading, editable, refreshSignal, onOpenClaim }: {
  events: ClaimBootstrap['events']; claims: EmployeeClaim[]; warehouse: AccountingWork[];
  loading: boolean; editable: boolean; refreshSignal: number; onOpenClaim: (claim: EmployeeClaim) => void;
}) {
  const [month, setMonth] = useState('');
  const [expenseMonth, setExpenseMonth] = useState(() => minskToday().slice(0, 7));
  const [search, setSearch] = useState('');
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const visible = new Set(events.filter(row => (!month || row.event_date?.startsWith(month)) &&
    `${row.name} ${row.venue ?? ''}`.toLocaleLowerCase('ru-RU').includes(search.trim().toLocaleLowerCase('ru-RU'))).map(row => row.id));
  if (loading && !events.length) return <p role="status" className="text-sm text-gray-400">Загрузка мероприятий…</p>;
  return <section className="space-y-3">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 basis-40 text-sm">Поиск мероприятия
        <input {...searchInputProps} className={input} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="text-sm">Месяц мероприятия
        <input type="month" className={input} value={month} onChange={event => setMonth(event.target.value)} /></label>
      {month && <button type="button" className={secondary} onClick={() => setMonth('')}>Все месяцы</button>}
    </div>
    {events.filter(event => visible.has(event.id) || opened.has(event.id)).map(event => <details key={event.id} hidden={!visible.has(event.id)} className="group rounded-xl border border-gray-800 bg-gray-900"
      onToggle={toggle => { if (toggle.currentTarget.open) setOpened(current => current.has(event.id) ? current : new Set(current).add(event.id)); }}>
      <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 -rotate-90 text-gray-400 group-open:rotate-0" />
        <span className="min-w-0 flex-1 break-words font-semibold">{event.name}{event.venue && event.venue !== event.name && <span className="block text-xs font-normal text-gray-400">{event.venue}</span>}</span>
        <time className="text-xs text-gray-300" dateTime={event.event_date}>{event.event_date?.split('-').reverse().join('.')}</time>
      </summary>
      {opened.has(event.id) && <div className="space-y-3 border-t border-gray-800 p-3">
        <AccountingEventEditor key={event.id} event={event} editable={editable} refreshSignal={refreshSignal} />
        <AccountingExpenseGroups claims={claims.filter(row => row.event_id === event.id)} onOpen={onOpenClaim} />
      </div>}
    </details>)}
    {!visible.size && <p className="text-sm text-gray-400">Мероприятий по этому запросу нет.</p>}
    <section className="space-y-2 rounded-xl border border-gray-800 p-3">
      <h2 className="font-semibold">Без мероприятия</h2>
      <label className="block max-w-xs text-sm">Месяц операций
        <input type="month" className={input} value={expenseMonth} onChange={event => setExpenseMonth(event.target.value)} /></label>
      <AccountingExpenseGroups claims={claims.filter(row => !row.event_id && (!expenseMonth || accountingMonth(row.approved_at ?? row.submitted_at ?? row.created_at) === expenseMonth))} onOpen={onOpenClaim} />
      {warehouse.some(row => !expenseMonth || row.event_date.startsWith(expenseMonth)) && <details className="rounded-lg border border-gray-800 p-3">
        <summary className="cursor-pointer text-sm font-medium">Склад</summary>
        <AssignmentRows assignments={warehouse.filter(row => !expenseMonth || row.event_date.startsWith(expenseMonth))} showEmployee />
      </details>}
    </section>
  </section>;
}

function AssignmentRows({ assignments, showEmployee = false }: {
  assignments: AccountingWork[];
  showEmployee?: boolean;
}) {
  return <ul className="divide-y divide-gray-800">{assignments.map((row, index) => {
    const period = { starts_at: row.starts_at ?? undefined, ends_at: row.ends_at ?? undefined, hours: row.hours ?? undefined };
    const minutes = Math.round(personWorkHours(period) * 60);
    return <li key={`${row.event_id}:${row.id}:${index}`} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
      <div className="min-w-0 break-words">
        <p className="text-gray-100">{showEmployee ? row.employee_name || 'Сотрудник не указан' : row.work_name}</p>
        {row.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-gray-400">{row.note}</p>}
        {!showEmployee && <p className="text-xs text-gray-400">{eventLabel(row.venue, row.event_name, row.event_date)}</p>}
      </div>
      <div className="text-xs text-gray-300">
        {row.starts_at && <p>С {row.starts_at.replace('T', ' ')}</p>}
        {row.ends_at && <p>По {row.ends_at.replace('T', ' ')}</p>}
        {minutes > 0 && <p>{Math.floor(minutes / 60)} ч {minutes % 60} мин</p>}
        {row.rate && <p>{money(Number(row.rate.replace(',', '.')))} BYN/час · <strong>{money(personWorkAmount({ ...period, rate: row.rate }))} BYN</strong></p>}
      </div>
    </li>;
  })}</ul>;
}

function ClaimEditor({claim,initialKind,boot,manager,onClose,onSaved}:{claim:EmployeeClaim|null;initialKind?:ClaimKind;boot:ClaimBootstrap;manager:boolean;onClose:()=>void;onSaved:()=>void;}){
 const {user}=useAuth();const dialog=useRef<HTMLDialogElement>(null);const requestIds = useRef(new Map<string, string>());
 const savedPeople = useRef(new Set<string>());
 const batchSubmit = useRef<boolean | null>(null);
 const [eventId,setEventId]=useState(claim?.event_id||''),[personIds,setPersonIds]=useState(() => { const id = claim?.personnel_id || (manager && initialKind ? '' : boot.personnel?.id); return id ? [id] : []; }),[works,setWorks]=useState<string[]>([]),[fixedRates,setFixedRates]=useState<Record<string,number>>({}),[loadingWorks,setLoadingWorks]=useState(false);
 const [lines,setLines]=useState<ClaimDraftLine[]>(()=>claim?claim.lines.map(line=>({...line,starts_at:line.starts_at?minskInput(line.starts_at):undefined,ends_at:line.ends_at?minskInput(line.ends_at):undefined})):initialKind?[{kind:initialKind,work_name:initialKind==='warehouse'?'Работа на складе':undefined,description:'',amount:'',receipt_path:''}]:[]);
 const [note,setNote]=useState(claim?.review_note||''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[history,setHistory]=useState<Awaited<ReturnType<typeof claimHistory>>|null>(null),[receiptPreview,setReceiptPreview]=useState('');
 const [personPickerOpen, setPersonPickerOpen] = useState(false);
 const personId = personIds[0] || '';
 const person=boot.people.find(row=>row.id===personId)||(boot.personnel?.id===personId?boot.personnel:null)||(manager&&claim?{id:claim.personnel_id,full_name:claim.employee_name,installation_rate:0,warehouse_rate:0}:null);
 const people = boot.personnel && !boot.people.some(row => row.id === boot.personnel?.id)
   ? [...boot.people, boot.personnel] : boot.people;
 const selectedPeople = people.filter(candidate => personIds.includes(candidate.id));
 const isBatch = manager && !claim && selectedPeople.length > 1;
 const [savedCount, setSavedCount] = useState(0);
 const changePerson = (ids: string[]) => {
   setPersonIds(ids);
   setDirty(true);
   setLines(current => current.map(line => ({
     ...line, rate: line.kind === 'warehouse' ? undefined : line.rate,
   })));
 };
 const selectedEvent=boot.events.find(row=>row.id===eventId);
 const today = minskToday();
 const currentDay = dayNumber(today);
 const eventOptions = claim ? (selectedEvent ? [selectedEvent] : []) : boot.events.filter(row => {
   if (manager || row.id === eventId) return true;
   const eventDay = dayNumber(row.event_date);
   return currentDay !== null && eventDay !== null && Math.abs(eventDay - currentDay) <= 5;
 });
 const expired=Boolean(eventId&&(!selectedEvent?.deadline||today>selectedEvent.deadline));
 const ownClaim=!claim||claim.user_id===user?.id;
 const [proposing, setProposing] = useState(false);
 const mayPropose = !manager && ownClaim && claim?.state === 'approved';
 const editable=proposing || claim?.state!=='paid'&&(manager||(ownClaim&&!expired&&(!claim||claim.state==='draft'||claim.state==='rejected')));
 const close=()=>{if(busy)return;if(!dirty||window.confirm('Закрыть без сохранения оставшихся изменений?')){if(savedPeople.current.size)onSaved();else onClose();}};
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>{node?.close();};},[]);
 useEffect(()=>{if(!eventId){setWorks([]);setFixedRates({});return;}let active=true;setLoadingWorks(true);claimWorks(eventId).then(data=>{if(active){setWorks(data.works);setFixedRates(data.fixed_rates);}}).catch(caught=>{if(active)setError(getErrorMessage(caught));}).finally(()=>{if(active)setLoadingWorks(false);});return()=>{active=false;};},[eventId]);
 const patch=(index:number,updates:Partial<ClaimDraftLine>)=>{setDirty(true);setLines(current=>current.map((line,i)=>i===index?{...line,...updates}:line));};
 const add=(kind:ClaimKind)=>{setDirty(true);setLines(current=>[...current,{kind,work_name:kind==='warehouse'?'Работа на складе':kind==='trip'?works.find(name=>/доставк/i.test(name)):kind==='time'?works.find(name=>!/доставк/i.test(name)):undefined,break_minutes:0,kilometers:'',description:'',amount:''}]);};
 const isFixed=(line:ClaimLine)=>line.kind==='time'&&!/^(монтаж|демонтаж|загрузка|разгрузка)$|склад/i.test((line.work_name||'').trim());
 const estimate=(line:ClaimLine, employee = person)=>{const calculated=lineEstimate(line,employee,boot.settings,!editable||((manager||proposing)&&(isFixed(line)?line.calculation==='fixed':line.rate!==undefined)),fixedRates);return !editable&&line.amount!==undefined?{...calculated,amount:Number(line.amount),minutes:line.minutes??calculated.minutes}:calculated;};
 const recipients = manager && !claim ? selectedPeople : [person];
 const workTotal = sumClaimAmounts(recipients.flatMap(employee => lines.filter(line => ['time','trip','warehouse'].includes(line.kind)).map(line => estimate(line, employee).amount)));
 const expenseTotal = sumClaimAmounts(recipients.flatMap(employee => lines.filter(line => ['expense','allowance'].includes(line.kind)).map(line => estimate(line, employee).amount)));
 const perform=async(action:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await action();onSaved();}catch(caught){setError(getErrorMessage(caught));}finally{setBusy(false);}};
 const save = (submit: boolean) => void perform(async () => {
   if (proposing && claim) {
     for (const line of lines) {
       const invalid = claimLineError(line);
       if (invalid) throw Error(invalid);
     }
     await submitClaimCorrection(claim, lines);
     return;
   }
   if (batchSubmit.current !== null && batchSubmit.current !== submit) throw Error('Завершите сохранение оставшихся заявок в том же режиме.');
   if (!person || !recipients.length) throw Error('Выберите сотрудника');
   if (!lines.length) throw Error('Добавьте работу, поездку или расход');
   const payloads = recipients.flatMap(employee => {
     const id = employee?.id ?? '';
     if (savedPeople.current.has(id)) return [];
     const employeeLines = lines.map(({ employeeReceipts, ...line }) => ({
       ...line, receipt_path: manager && !claim ? employeeReceipts?.[id] : line.receipt_path,
     }));
     for (const line of employeeLines) {
       const invalid = claimLineError(line);
       if (invalid) throw Error(isBatch && employee ? `${employee.full_name}: ${invalid}` : invalid);
       if (isFixed(line) && fixedRates[line.work_name || ''] === undefined && !(manager && line.calculation === 'fixed')) {
         throw Error(`В основной смете нет однозначной цены для работы «${line.work_name}». Обратитесь к администратору.`);
       }
     }
     return [{ employee, id, employeeLines }];
   });
   for (const { employee, id, employeeLines } of payloads) {
     const requestId = requestIds.current.get(id) ?? crypto.randomUUID();
     requestIds.current.set(id, requestId);
     try {
       await saveClaim(claim, eventId, employeeLines, submit, manager ? id : undefined, note, requestId);
     } catch (caught) {
       const saved = claim ? null : await findClaimById(requestId).catch(() => null);
       if (!saved || saved.personnel_id !== id || saved.state !== (submit ? 'submitted' : 'draft')) {
         throw Error(isBatch && employee ? `${employee.full_name}: ${getErrorMessage(caught)}` : getErrorMessage(caught));
       }
     }
     if (isBatch) {
       batchSubmit.current = submit;
       savedPeople.current.add(id);
       setSavedCount(savedPeople.current.size);
     }
   }
 });
 const receipt = async (index: number, file: File, employee?: ClaimPerson) => {
   if (busy) return;
   setBusy(true); setError('');
   try {
     const owner = claim ? claim.user_id ?? `personnel/${claim.personnel_id}`
       : employee ? employee.account_user_id ?? `personnel/${employee.id}`
       : user?.id;
     if (!owner) throw Error('Не выбран сотрудник');
     const path = await uploadClaimReceipt(file, owner);
     if (manager && !claim && employee) {
       patch(index, { employeeReceipts: { ...lines[index].employeeReceipts, [employee.id]: path } });
     } else patch(index, { receipt_path: path });
   } catch (caught) { setError(getErrorMessage(caught)); }
   finally { setBusy(false); }
 };
 const receiptField = (line: ClaimDraftLine, index: number, employee?: ClaimPerson) => {
   const path = employee ? line.employeeReceipts?.[employee.id] : line.receipt_path;
   const label = `Фото чека позиции ${index + 1}${isBatch && employee ? ` — ${employee.full_name}` : ''}`;
   return <div key={employee?.id ?? 'receipt'} className="space-y-1">
     {!proposing && editable && <label className="block space-y-1 text-xs text-gray-400">{isBatch && employee ? `Фото чека — ${employee.full_name}` : 'Фото чека'}
       <input aria-label={label} disabled={manager && !claim && !employee} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
         onChange={event => { const file = event.target.files?.[0]; if (file) void receipt(index, file, employee); event.target.value = ''; }}
         className={`${input} text-xs`} />
     </label>}
     {path && <button type="button" className={secondary} disabled={busy}
       onClick={() => { void openClaimReceipt(path).then(setReceiptPreview).catch(caught => setError(getErrorMessage(caught))); }}>
       Чек позиции {index + 1}
     </button>}
   </div>;
 };
 return createPortal(<dialog ref={dialog} aria-labelledby="claim-title" onCancel={event=>{event.preventDefault();if(receiptPreview)setReceiptPreview('');else close();}} className="m-auto max-h-[94dvh] w-[calc(100%_-_1rem)] max-w-4xl overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 p-0 text-gray-100 backdrop:bg-black/70"><div className="flex max-h-[94dvh] flex-col">
  <header className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-800 p-4"><div><h2 id="claim-title" className="text-lg font-semibold">{claim?`Заявка · ${CLAIM_STATES[claim.state]}`:manager&&initialKind==='warehouse'?'Внести работу на складе':manager&&initialKind==='expense'?'Внести расходы':'Подать данные'}</h2><p className="text-xs text-gray-400">Расчёт в BYN. Время — по Минску.</p></div><button type="button" disabled={busy} aria-label="Закрыть заявку" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-800"><X className="h-5 w-5"/></button></header>
  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
   {savedCount > 0 && <p role="status" className="text-sm text-gray-300">Сохранено заявок: {savedCount} из {selectedPeople.length}. При повторном сохранении будут отправлены оставшиеся.</p>}
   {error&&<p role="alert" className="rounded-lg border border-red-900 p-3 text-sm text-red-300">{error}</p>}
   <fieldset disabled={busy||Boolean(claim&&!editable)} className="space-y-4">
    {manager && <div className="space-y-1 text-sm text-gray-300">
      <span className="block">Сотрудник</span>
      {claim ? <p className="min-h-11 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">{person?.full_name}</p>
        : <button type="button" aria-label={person ? 'Сменить сотрудников' : 'Выберите сотрудников'} disabled={savedCount > 0}
          aria-haspopup="dialog" onClick={() => setPersonPickerOpen(true)} className={`${input} flex items-center justify-between gap-2 text-left`}>
          <span className="min-w-0 break-words">{selectedPeople.map(employee => employee.full_name).join(', ') || 'Выберите сотрудников'}</span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
        </button>}
    </div>}
    <label className="block space-y-1 text-sm text-gray-300">Мероприятие<select aria-label="Мероприятие" disabled={Boolean(claim)||lines.some(line=>line.kind==='warehouse')} value={eventId} onChange={event=>{if(lines.some(line=>line.kind==='time'||line.kind==='trip')&&!window.confirm('При смене мероприятия строки работ будут удалены. Продолжить?'))return;setEventId(event.target.value);setLines(current=>current.filter(line=>line.kind==='expense'||line.kind==='allowance'));setDirty(true);}} className={input}><option value="">Без мероприятия — склад и расходы</option>{claim?.event_id && !selectedEvent && <option value={claim.event_id}>{claim.event_name}</option>}{eventOptions.map(row => <option key={row.id} value={row.id}>{eventLabel(row.venue, row.name, row.event_date)}</option>)}</select></label>
   </fieldset>
   {isBatch && <p className="text-xs text-gray-400">Для каждого выбранного сотрудника будет создана отдельная заявка с указанными данными.</p>}
   {lines.some(line=>line.kind==='warehouse')&&<p className="text-xs text-gray-400">Работа на складе подаётся отдельно от мероприятий. Укажите время и выполненную работу; сумма рассчитывается по ставке сотрудника за работу на складе.</p>}
   {eventId&&<p className={`text-sm ${expired?'text-accent-300':'text-gray-400'}`}>{selectedEvent?.deadline?`Подать до ${selectedEvent.deadline.split('-').reverse().join('.')} включительно, до 23:59 по Минску.`:'У мероприятия не указана корректная дата окончания.'}{expired&&!manager&&' Срок истёк. Исправления может внести бухгалтер.'}</p>}
   {loadingWorks&&<p role="status" className="text-xs text-gray-400">Загрузка работ мероприятия…</p>}
   <div className="space-y-3">{lines.map((line,index)=>{const calc=estimate(line);return <fieldset key={index} disabled={!editable||busy} className="min-w-0 space-y-3 rounded-xl border border-gray-700 p-3">
    <div className="flex items-center justify-between"><h3 className="font-semibold">{index+1}. {lineNames[line.kind]}</h3>{editable&&!proposing&&<button type="button" aria-label={`Удалить позицию ${index+1}`} onClick={()=>{setLines(current=>current.filter((_,i)=>i!==index));setDirty(true);}} className="flex h-11 w-11 items-center justify-center rounded-lg text-red-400 hover:bg-red-900/20"><Trash2 className="h-4 w-4"/></button>}</div>
    {(line.kind==='time'||line.kind==='trip')&&<label className="block space-y-1 text-xs text-gray-400">Работа<select aria-label={`Работа позиции ${index+1}`} disabled={proposing} value={line.work_name||''} onChange={event=>patch(index,{work_name:event.target.value,kind:/доставк/i.test(event.target.value)?'trip':'time',rate:undefined,amount:undefined,calculation:undefined})} className={input}><option value="">Выберите работу</option>{line.work_name&&!works.includes(line.work_name)&&<option>{line.work_name}</option>}{works.map(name=><option key={name}>{name}</option>)}</select></label>}
    {(line.kind==='time'||line.kind==='warehouse')&&<><div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="block min-w-0 space-y-1 text-xs text-gray-400">С<input aria-label={`Начало работы ${index+1}`} type="datetime-local" value={line.starts_at||''} onChange={event=>patch(index,{starts_at:event.target.value})} className={input}/></label><label className="block min-w-0 space-y-1 text-xs text-gray-400">По<input aria-label={`Окончание работы ${index+1}`} type="datetime-local" value={line.ends_at||''} onChange={event=>patch(index,{ends_at:event.target.value})} className={input}/></label></div></>}
    {line.kind==='warehouse'&&<label className="block space-y-1 text-xs text-gray-400">Выполненная работа<textarea aria-label={`Выполненная работа на складе ${index+1}`} required maxLength={2000} value={line.description||''} onChange={event=>patch(index,{description:event.target.value})} className={input}/></label>}
    {line.kind==='trip'&&proposing&&<label className="block text-xs text-gray-400">Километраж, км<input className={input} type="number" min="0.01" step="any" value={line.kilometers??''} onChange={event=>patch(index,{kilometers:event.target.value})} /></label>}
    {line.kind==='trip'&&!proposing&&<TripFields value={line} kilometersLabel={`Километраж позиции ${index+1}`} inputClass={input} onChange={updates=>patch(index,{...updates,...('kilometers' in updates?{}:{rate:undefined})})}/>}
    {(line.kind==='expense'||line.kind==='allowance')&&<><label className="block space-y-1 text-xs text-gray-400">Назначение<textarea aria-label={`Назначение расхода ${index+1}`} value={line.description||''} onChange={event=>patch(index,{description:event.target.value})} className={input}/></label><label className="block space-y-1 text-xs text-gray-400">Сумма, BYN<input aria-label={`Сумма расхода ${index+1}`} type="number" min="0" step="0.01" value={line.amount??''} onChange={event=>patch(index,{amount:event.target.value})} className={input}/></label>{manager && !claim && selectedPeople.length
      ? selectedPeople.filter(employee => !savedPeople.current.has(employee.id)).map(employee => receiptField(line, index, employee))
      : receiptField(line, index)}</>}
    {(manager||proposing)&&isFixed(line)&&<label className="block space-y-1 text-xs text-gray-400">Сумма за работу, BYN<input type="number" min="0" step="0.01" value={line.calculation==='fixed'?line.amount??'':calc.amount} onChange={event=>patch(index,{amount:event.target.value,calculation:'fixed'})} className={input}/></label>}
    {editable&&isFixed(line)&&fixedRates[line.work_name||'']===undefined&&!(manager&&line.calculation==='fixed')&&<p role="alert" className="text-xs text-accent-300">В основной смете нет однозначной цены за эту работу. Администратор должен указать её в смете или бухгалтерии.</p>}
    {(manager||proposing)&&!isFixed(line)&&(line.kind==='time'||line.kind==='trip'||line.kind==='warehouse')&&<label className="block space-y-1 text-xs text-gray-400">Ставка {line.kind==='trip'?'BYN/км':'BYN/час'}<input type="number" min="0" step="0.01" value={line.rate??calc.rate} onChange={event=>patch(index,{rate:event.target.value})} className={input}/></label>}
    {isBatch ? <ul className="space-y-1 text-sm tabular-nums text-gray-300">
      {selectedPeople.map(employee => <li key={employee.id} className="flex justify-between gap-2">
        <span>{employee.full_name}</span><strong>{money(estimate(line, employee).amount)} BYN</strong>
      </li>)}
    </ul> : <p className="text-right text-sm tabular-nums text-gray-100">{(line.kind==='time'||line.kind==='warehouse')?`${Math.floor(Math.max(0,calc.minutes)/60)} ч ${Math.round(Math.max(0,calc.minutes)%60)} мин${isFixed(line)?(manager?` · ${money(calc.rate)} BYN/час · фиксированно `:' · за работу '):` × ${money(calc.rate)} BYN/час = `}`:line.kind==='trip'?manager?`${line.kilometers||0} км × ${money(calc.rate)} BYN/км = `:`${line.kilometers||0} км · Итого `:''}<strong>{money(calc.amount)} BYN</strong></p>}
   </fieldset>;})}</div>
   {editable&&!proposing&&initialKind!=='expense'&&initialKind!=='allowance'&&<div className="flex flex-wrap gap-2"><button type="button" disabled={busy||Boolean(eventId)} title={eventId?'Склад подаётся без мероприятия':undefined} className={secondary} onClick={()=>add('warehouse')}>Склад</button><button type="button" disabled={busy||!eventId||loadingWorks} className={secondary} onClick={()=>add('time')}>+ Работа</button><button type="button" disabled={busy||!eventId||!works.some(name=>/доставк/i.test(name))} className={secondary} onClick={()=>add('trip')}>+ Поездка</button></div>}
   {(manager||claim?.review_note)&&<label className="block space-y-1 text-sm text-gray-300">Комментарий бухгалтера<textarea aria-label="Комментарий бухгалтера" disabled={!manager||busy||claim?.state==='paid'} value={note} onChange={event=>setNote(event.target.value)} placeholder="Причина исправления, отклонения или подтверждение проведённой выплаты" className={input}/></label>}
   {claim&&<><button type="button" className={secondary} onClick={()=>{void claimHistory(claim.id).then(setHistory).catch(caught=>setError(getErrorMessage(caught)));}}><History className="mr-1 inline h-4 w-4"/>История изменений</button>{history&&<ol className="space-y-2 text-xs text-gray-400">{history.map(row=><li key={row.id}>{date(row.created_at)} · {({save:'Сохранение',approve:'Утверждение',pay:'Отметка выплаты',reject:'Отклонение',return:'Возврат',withdraw:'Возврат в черновик'} as Record<string,string>)[row.action]||row.action}{row.after_value?.total!==undefined&&` · ${money(row.after_value.total)} BYN`}{row.after_value?.review_note&&` · ${row.after_value.review_note}`}</li>)}</ol>}</>}
  </div>
  <footer className="shrink-0 space-y-3 border-t border-gray-800 bg-gray-900 p-4"><div className="flex flex-wrap justify-between gap-2 text-sm tabular-nums"><span>Работы {money(workTotal)} · расходы {money(expenseTotal)}</span><strong>{editable?'Предварительно':'Итого'}: {money(sumClaimAmounts([workTotal,expenseTotal]))} BYN</strong></div><div className="flex flex-wrap justify-end gap-2">
   <button type="button" disabled={busy} className={secondary} onClick={close}>Закрыть</button>
   {mayPropose && !proposing && <button type="button" className={primary} onClick={() => setProposing(true)}>Предложить правку</button>}
   {proposing && <button type="button" disabled={busy || !dirty} className={primary} onClick={() => save(true)}>Отправить правку на проверку</button>}
   {editable&&!proposing&&<><button type="button" disabled={busy || (manager && !person) || batchSubmit.current === true} className={secondary} onClick={()=>save(false)}>Сохранить черновик</button><button type="button" disabled={busy || (manager && !person) || batchSubmit.current === false} className={primary} onClick={()=>save(true)}>{manager&&claim?'Сохранить исправления':lines.some(line=>line.kind==='warehouse')?'Сохранить работу':'Отправить на проверку'}</button></>}
   {!manager&&ownClaim&&claim&&['submitted','rejected'].includes(claim.state)&&!expired&&<button type="button" className={secondary} disabled={busy} onClick={()=>void perform(()=>reviewClaim(claim,'withdraw'))}>Вернуть в черновик</button>}
   {manager&&claim&&<>{claim.state==='submitted'&&<button type="button" disabled={busy||dirty} className={primary} onClick={()=>void perform(()=>reviewClaim(claim,'approve',note))}>Утвердить</button>}{['submitted','approved'].includes(claim.state)&&<><button type="button" disabled={busy||dirty} className={secondary} onClick={()=>void perform(()=>reviewClaim(claim,'return',note))}>На исправление</button><button type="button" disabled={busy||dirty} className={secondary} onClick={()=>void perform(()=>reviewClaim(claim,'reject',note))}>Отклонить</button></>}{claim.state==='approved'&&<button type="button" disabled={busy||dirty} className={primary} onClick={()=>void perform(()=>reviewClaim(claim,'pay',note.trim() || 'Выплата подтверждена бухгалтером'))}>Отметить выплату</button>}</>}
  </div></footer>
  {personPickerOpen && <ClaimPersonPicker people={people} currentIds={personIds} onSelect={changePerson} onClose={() => setPersonPickerOpen(false)} />}
  {receiptPreview&&<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gray-950/95 p-4"><button type="button" autoFocus className={secondary} onClick={()=>setReceiptPreview('')}>Закрыть фото чека</button><img src={receiptPreview} alt="Фото чека" className="max-h-[75dvh] max-w-full object-contain"/></div>}
 </div></dialog>,document.body);
}
function RatesDialog({rates,onClose,onSaved}:{rates:ClaimRates;onClose:()=>void;onSaved:()=>void;}){
 const dialog=useRef<HTMLDialogElement>(null);const [draft,setDraft]=useState({driver_rate:String(rates.driver_rate),car_rate:String(rates.car_rate),fuel_rate:String(rates.fuel_rate)}),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>{const node=dialog.current;node?.showModal();return()=>{node?.close();};},[]);
 return createPortal(<dialog ref={dialog} aria-label="Тарифы поездок" onCancel={onClose} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 text-gray-100 backdrop:bg-black/70"><h2 className="mb-4 text-lg font-semibold">Тарифы будущих поездок</h2><p className="mb-4 text-sm text-gray-400">Утверждённые заявки сохраняют свои тарифы.</p>{error&&<p role="alert" className="text-sm text-red-300">{error}</p>}{([['driver_rate','Водитель'],['car_rate','Своя машина'],['fuel_rate','Своё топливо']] as const).map(([key,label])=><label key={key} className="mb-3 block space-y-1 text-sm text-gray-300">{label}, BYN/км<input type="number" min="0" step="0.01" value={draft[key]} onChange={event=>setDraft({...draft,[key]:event.target.value})} className={input}/></label>)}<div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} className={secondary} onClick={onClose}>Отмена</button><button type="button" disabled={busy} className={primary} onClick={()=>{setBusy(true);setError('');void (async()=>{const parse=(value:string)=>{const parsed=Number(value.replace(',','.'));if(!value.trim()||!Number.isFinite(parsed)||parsed<0||parsed>100)throw Error('Укажите тарифы от 0 до 100 BYN/км');return parsed;};await saveClaimRates({driver_rate:parse(draft.driver_rate),car_rate:parse(draft.car_rate),fuel_rate:parse(draft.fuel_rate)});onSaved();})().catch(caught=>setError(getErrorMessage(caught))).finally(()=>setBusy(false));}}>Сохранить</button></div></dialog>,document.body);
}
