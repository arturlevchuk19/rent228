import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { PersonnelPaymentsHistory } from '../components/PersonnelPaymentsHistory';
import { useAuth } from '../contexts/authContext';
import { minskToday, sumClaimAmounts } from '../lib/employeeClaimMath';
import { getErrorMessage } from '../lib/errors';
import { buildPersonnelReport, rateForReportAmount, reportWeeks, reportWorkKey, reportBudget, type PayoutRow, type PersonnelReportData, type ReportEvent } from '../lib/personnelPaymentsReport';
import { canAccess } from '../lib/roles';
import { supabase } from '../lib/supabase';

type ReportColumn = { key: string; name: string; date?: string };

const money = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const cell = 'border-r border-gray-800 px-3 py-2 text-left last:border-r-0';
const numericCell = cell + ' text-right tabular-nums whitespace-nowrap';
const control = 'min-h-11 rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500';

function dueTotals(rows: PayoutRow[]) {
  const due = rows.filter(row => !row.paid && !row.direct);
  const cash = sumClaimAmounts(due.filter(row => row.payment === 'cash').map(row => row.amount));
  const bank = sumClaimAmounts(due.filter(row => row.payment === 'bank').map(row => row.amount));
  return { cash, bank, total: sumClaimAmounts([cash, bank]) };
}

export default function PersonnelPaymentsReport() {
  const { user } = useAuth();
  const canEdit = canAccess(user, 'personnel-report', 2) && canAccess(user, 'payments', 2);
  const [month, setMonth] = useState(() => minskToday().slice(0, 7));
  const [week, setWeek] = useState<number | null>(null);
  const [data, setData] = useState<PersonnelReportData>();
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [person, setPerson] = useState('');
  const [editing, setEditing] = useState<{ row: PayoutRow; value: string }>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState('');
  const [history, setHistory] = useState(false);

  useEffect(() => {
    let current = true;
    setData(undefined);
    setError('');
    setEditing(undefined);
    setSaveError('');
    setPerson('');
    void supabase.rpc('personnel_payments_report', { p_month: month + '-01' }).then(({ data, error }) => {
      if (!current) return;
      if (error) setError(getErrorMessage(error));
      else setData(data as PersonnelReportData);
    });
    return () => { current = false; };
  }, [month, reload, user?.id]);

  const weeks = reportWeeks(month);
  const report = data && buildPersonnelReport(data, week === null ? undefined : weeks[week], month);
  const payoutRows = (report?.rows ?? []).filter(row => !row.direct);
  const people = new Map(payoutRows.filter(row => row.personKey).map(row => [row.personKey, row.name]));
  const rows = payoutRows.filter(row => !person || row.personKey === person);
  const totals = dueTotals(rows);
  const byPerson = new Map<string, PayoutRow[]>();
  for (const row of rows) {
    const key = row.personKey || row.name;
    const entries = byPerson.get(key) ?? [];
    entries.push(row);
    byPerson.set(key, entries);
  }
  const warehouseDates = [...new Set(rows.filter(row => row.warehouse && !row.eventId).map(row => row.workDate || row.date))].sort();
  const groups = (report?.events ?? []).map(({ event, metrics }) => {
    const work = new Map(metrics.map(metric => [reportWorkKey(metric.name), metric.name]));
    const eventRows = rows.filter(row => row.eventId === event.id);
    const columns = [...work].flatMap<ReportColumn>(([key, name]) => {
      const matches = eventRows.filter(row => !row.expense && reportWorkKey(row.work) === key);
      const dates = [...new Set(matches.map(row => row.workDate ?? ''))].sort();
      return dates.length > 1 ? dates.map(date => ({ key, name, date })) : [{ key, name, date: undefined }];
    });
    return { event, columns };
  });
  const hasStandalone = rows.some(row => !row.eventId && !row.warehouse);
  const orderedPeople = [...byPerson].sort((a, b) => a[1][0].name.localeCompare(b[1][0].name, 'ru'));
  const totalColumns = ['Расходы', 'Работы', 'Склад', 'Всего', 'Начислено нал.', 'Начислено безнал.', 'Оплачено нал.', 'Оплачено безнал.', 'Остаток нал.', 'Остаток безнал.'];
  const totalColors = ['bg-[#f4cccc]', 'bg-white', 'bg-[#fff2cc]', 'bg-[#ffe599]', 'bg-[#d9ead3]', 'bg-[#cfe2f3]', 'bg-[#d9ead3]', 'bg-[#cfe2f3]', 'bg-[#d9ead3]', 'bg-[#cfe2f3]'];
  const sum = (entries: PayoutRow[]) => sumClaimAmounts(entries.map(row => row.amount));
  const summary = (entries: PayoutRow[]) => {
    const cash = entries.filter(row => row.payment === 'cash');
    const bank = entries.filter(row => row.payment === 'bank');
    return [sum(entries.filter(row => row.expense)), sum(entries.filter(row => !row.expense && !row.warehouse)),
      sum(entries.filter(row => row.warehouse)), sum(entries), sum(cash), sum(bank),
      sum(cash.filter(row => row.paid)), sum(bank.filter(row => row.paid)),
      sum(cash.filter(row => !row.paid)), sum(bank.filter(row => !row.paid))];
  };
  const shortDate = (date: string) => date.slice(5, 10).split('-').reverse().join('.');
  const moneyCell = (value: number) => value ? money.format(value) : '—';

  const save = async () => {
    if (!data || !editing?.row.assignment || savingRef.current || !canEdit) return;
    const raw = editing.value.trim().replace(',', '.');
    const value = /^\d+(?:\.\d{1,2})?$/.test(raw) ? Number(raw) : NaN;
    const rate = rateForReportAmount(editing.row.assignment, value);
    if (rate === null) {
      setSaveError('Укажите сумму в BYN с точностью до копеек. Для расчёта нужны часы работы.');
      return;
    }
    const event = data.events.find(row => row.id === editing.row.eventId);
    if (!event) return;
    const assignmentId = editing.row.assignment.id;
    const original = event.details;
    const people = Array.isArray(original.people) ? original.people as { id: string; rate?: string }[] : [];
    if (people.filter(row => row.id === assignmentId).length !== 1) {
      setSaveError('Назначение изменилось. Обновите отчёт.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const { data: updated, error } = await supabase.rpc('accounting_event_save', {
        p_event: event.id, p_previous: original,
        p_details: {
          ...original,
          people: people.map(row => row.id === assignmentId ? { ...row, rate } : row),
          transport: original.transport ?? [],
          people_works: original.people_works ?? [],
        },
      });
      if (error) throw error;
      setData(current => current && ({
        ...current, events: current.events.map(row => row.id === event.id ? { ...row, details: updated as ReportEvent['details'] } : row),
      }));
      setEditing(undefined);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const renderWork = (entry: PayoutRow) => {
    const isEditing = editing?.row.eventId === entry.eventId && editing?.row.id === entry.id;
    const editable = canEdit && entry.assignment && (entry.hours ?? 0) > 0;
    return <div key={entry.id} className="flex flex-col items-end py-0.5">
      {isEditing ? <div className="inline-flex items-center gap-0.5">
        <input autoFocus inputMode="decimal" aria-label={`Сумма за ${entry.work}, ${entry.name}`} value={editing.value} disabled={saving}
          onChange={event => setEditing({ row: entry, value: event.target.value })}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); void save(); }
            if (event.key === 'Escape' && !saving) { setEditing(undefined); setSaveError(''); }
          }} className="min-h-10 w-20 rounded border border-[#967018] bg-white px-1.5 text-right text-base tabular-nums text-[#202124]" />
        <button type="button" disabled={saving} aria-label="Сохранить сумму" onClick={() => void save()} className="inline-grid h-9 w-8 place-items-center rounded text-[#176338] hover:bg-[#e4efdf]"><Check className="h-4 w-4" /></button>
        <button type="button" disabled={saving} aria-label="Отменить редактирование" onClick={() => { setEditing(undefined); setSaveError(''); }} className="inline-grid h-9 w-8 place-items-center rounded hover:bg-[#efefef]"><X className="h-4 w-4" /></button>
      </div> : editable ? <button type="button" disabled={saving} aria-label={`Изменить сумму за ${entry.work}, ${entry.name}`}
        onClick={() => { setEditing({ row: entry, value: String(entry.amount) }); setSaveError(''); }}
        className="inline-flex min-h-8 items-center gap-1 rounded px-1 font-medium text-[#705000] hover:bg-[#fff2cc]">
        {money.format(entry.amount)}<Pencil aria-hidden="true" className="h-3 w-3" />
      </button> : <span className="font-medium">{money.format(entry.amount)}</span>}
      {entry.hours !== undefined && <span className="text-[11px] text-[#4e5054]">{number.format(entry.hours)} ч × {entry.rate ? number.format(Number(entry.rate.replace(',', '.'))) : '—'}</span>}
    </div>;
  };
  const sheetCell = 'border border-[#c9cbd0] px-2.5 py-1.5';
  const sheetNumber = sheetCell + ' whitespace-nowrap text-right tabular-nums';
  const frozen = sheetCell + ' sticky left-0 z-10 min-w-[8rem] max-w-[11rem] text-left';

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs font-medium text-gray-400">Месяц
        <input type="month" value={month} disabled={saving} onChange={event => {
          if (!/^\d{4}-\d{2}$/.test(event.target.value)) return;
          setWeek(null);
          setMonth(event.target.value);
        }} className={control} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-gray-400">Сотрудник
        <select value={person} disabled={saving} onChange={event => { setPerson(event.target.value); setEditing(undefined); }} className={control}>
          <option value="">Все сотрудники</option>
          {[...people].sort((a, b) => a[1].localeCompare(b[1], 'ru')).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <button type="button" className={control} disabled={saving} onClick={() => setReload(value => value + 1)}>Обновить</button>
    </div>
    <div role="group" aria-label="Период отчёта" className="flex flex-wrap gap-1.5">
      <button type="button" className={`${control} ${week === null ? 'border-accent-600 text-accent-300' : ''}`}
        disabled={saving} aria-pressed={week === null} onClick={() => { setWeek(null); setPerson(''); setEditing(undefined); setSaveError(''); }}>Весь месяц</button>
      {weeks.map(({ start, end }, index) => <button key={start} type="button" className={`${control} ${week === index ? 'border-accent-600 text-accent-300' : ''}`}
        disabled={saving} aria-pressed={week === index} onClick={() => { setWeek(index); setPerson(''); setEditing(undefined); setSaveError(''); }}>
        {index + 1} неделя <span className="text-xs text-gray-400">{start === end ? end : `${start}–${end}`}</span>
      </button>)}
    </div>

    {error ? <p role="alert" className="rounded-lg border border-red-800 bg-gray-900 px-3 py-2 text-sm text-red-300">{error}</p> :
      !report ? <p role="status" className="text-sm text-gray-400">Загрузка отчёта…</p> : <>
        <section aria-labelledby="payouts-summary" className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <h2 id="payouts-summary" className="border-b border-gray-800 px-3 py-2.5 text-base font-semibold">К выплате, BYN</h2>
          <dl className="grid grid-cols-3 divide-x divide-gray-800">
            {([['Наличные', totals.cash], ['Безналичные', totals.bank], ['Всего', totals.total]] as const).map(([label, value]) =>
              <div key={label} className="px-2.5 py-2 sm:px-3"><dt className="text-xs text-gray-400">{label}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-gray-100">{money.format(value)}</dd></div>)}
          </dl>
        </section>
        {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
        <section aria-labelledby="work-report-title" className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <h2 id="work-report-title" className="border-b border-gray-800 px-3 py-2.5 font-semibold">Работы и выплаты, BYN</h2>
          {rows.length ? <div className="overflow-x-auto" role="region" aria-label="Таблица выплат по сотрудникам и мероприятиям" tabIndex={0}>
            <table className="w-max min-w-full border-separate border-spacing-0 bg-white text-xs text-[#202124]">
              <thead>
                <tr>
                  <th rowSpan={2} scope="col" className={frozen + ' bg-[#efefef]'}>Сотрудник</th>
                  {warehouseDates.length > 0 && <th colSpan={warehouseDates.length} scope="colgroup" className={sheetCell + ' bg-[#fff2cc] text-center'}>Склад</th>}
                  {groups.map(({ event, columns }) => {
                    const budget = reportBudget(event);
                    const bank = (budget?.settings.budget_payment_mode ?? event.settings.budget_payment_mode) === 'byn_noncash';
                    return <th key={event.id} colSpan={columns.length + 2} scope="colgroup"
                      className={sheetCell + (bank ? ' bg-[#cfe2f3]' : ' bg-[#d9ead3]') + ' text-left font-semibold'}>
                      {shortDate(event.event_date)} · {event.name}
                    </th>;
                  })}
                  {hasStandalone && <th rowSpan={2} scope="col" className={sheetCell + ' bg-[#f4cccc]'}>Без мероприятия</th>}
                  <th colSpan={totalColumns.length} scope="colgroup" className={sheetCell + ' bg-[#efefef] text-center'}>{week === null ? 'Итого за месяц' : 'Итого за неделю'}</th>
                </tr>
                <tr>
                  {warehouseDates.map(date => <th key={date} scope="col" className={sheetCell + ' bg-[#fff2cc]'}>{shortDate(date)}</th>)}
                  {groups.map(({ event, columns }) => <ReportColumns key={event.id} columns={columns} cellClass={sheetCell} />)}
                  {totalColumns.map((label, index) => <th key={label} scope="col" className={`${sheetCell} ${totalColors[index]} max-w-28`}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {orderedPeople.map(([key, entries]) => <tr key={key} className="even:bg-[#f8f9fa] hover:bg-[#fffaf0]">
                  <th scope="row" className={frozen + ' bg-[#f4f4f5] font-semibold'}>{entries[0].name}</th>
                  {warehouseDates.map(date => <td key={date} className={sheetNumber}>{entries.filter(row => !row.eventId && row.warehouse && (row.workDate || row.date) === date).map(renderWork)}</td>)}
                  {groups.map(({ event, columns }) => {
                    const eventEntries = entries.filter(row => row.eventId === event.id);
                    return <ReportGroupCells key={event.id}
                      work={columns.map(({ key, date }) => eventEntries.filter(row => !row.expense && reportWorkKey(row.work) === key && (date === undefined || (row.workDate ?? '') === date)))}
                      expenses={sum(eventEntries.filter(row => row.expense))} total={sum(eventEntries.filter(row => !row.expense))}
                      cellClass={sheetNumber} renderWork={renderWork} format={moneyCell} />;
                  })}
                  {hasStandalone && <td className={sheetNumber}>{entries.filter(row => !row.eventId && !row.warehouse).map(renderWork)}</td>}
                  {summary(entries).map((value, index) => <td key={totalColumns[index]} className={`${sheetNumber} ${totalColors[index]} font-medium`}>{moneyCell(value)}</td>)}
                </tr>)}
              </tbody>
              <tfoot className="bg-[#efefef] font-semibold"><tr>
                <th scope="row" className={frozen + ' bg-[#efefef]'}>Итого</th>
                {warehouseDates.map(date => <td key={date} className={sheetNumber}>{moneyCell(sum(rows.filter(row => !row.eventId && row.warehouse && (row.workDate || row.date) === date)))}</td>)}
                {groups.map(({ event, columns }) => {
                  const entries = rows.filter(row => row.eventId === event.id);
                  return <ReportGroupTotals key={event.id} values={[
                    ...columns.map(({ key, date }) => sum(entries.filter(row => !row.expense && reportWorkKey(row.work) === key && (date === undefined || (row.workDate ?? '') === date)))),
                    sum(entries.filter(row => row.expense)), sum(entries.filter(row => !row.expense)),
                  ]} cellClass={sheetNumber} format={moneyCell} />;
                })}
                {hasStandalone && <td className={sheetNumber}>{moneyCell(sum(rows.filter(row => !row.eventId && !row.warehouse)))}</td>}
                {summary(rows).map((value, index) => <td key={totalColumns[index]} className={`${sheetNumber} ${totalColors[index]}`}>{moneyCell(value)}</td>)}
              </tr></tfoot>
            </table>
          </div> : <p className="px-3 py-4 text-sm text-gray-400">За выбранный период записей нет.</p>}
        </section>
        <section aria-labelledby="event-report-title" className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <h2 id="event-report-title" className="border-b border-gray-800 px-3 py-2.5 font-semibold">Результат по мероприятиям, BYN</h2>
          {report.events.length ? <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-sm">
            <thead className="bg-gray-800 text-xs text-gray-300"><tr>
              {['Мероприятие', 'Работа', 'По смете', 'Затраты', 'Остаток'].map((label, index) =>
                <th key={label} scope="col" className={index >= 2 ? numericCell : cell}>{label}</th>)}
            </tr></thead>
            {report.events.map(({ event, revenue, cost, balance, metrics }) => <tbody key={event.id} className="border-b border-gray-800 last:border-b-0">
              <tr className="bg-gray-800/50 font-semibold">
                <th scope="row" className={cell}>{event.name}<span className="ml-2 text-xs font-normal text-gray-400">{event.event_date.split('-').reverse().join('.')}</span></th>
                <td className={cell}>Итого</td><td className={numericCell}>{revenue === null ? '—' : money.format(revenue)}</td><td className={numericCell}>{money.format(cost)}</td>
                <td className={numericCell + (balance === null ? '' : balance < 0 ? ' text-red-400' : ' text-green-400')}>{balance === null ? '—' : money.format(balance)}</td>
              </tr>
              {metrics.map(metric => <tr key={metric.name}>
                <td className={cell}></td><td className={cell + ' capitalize'}>{metric.name}</td><td className={numericCell}>{money.format(metric.budget)}</td>
                <td className={numericCell}>{money.format(metric.cost)}</td><td className={numericCell}>{money.format(metric.budget - metric.cost)}</td>
              </tr>)}
            </tbody>)}
          </table></div> : <p className="px-3 py-4 text-sm text-gray-400">За выбранный период мероприятий нет.</p>}
        </section>
        <p className="text-xs leading-relaxed text-gray-400">Мероприятие относится к периоду по дате начала. Итог — сумма по выбранной в бухгалтерии смете за вычетом учтённых затрат. Хозрасходы учитываются в затратах мероприятия и исключаются из выплат сотрудникам.</p>
      </>}
    <details className="rounded-xl border border-gray-800 bg-gray-900" onToggle={event => setHistory(event.currentTarget.open)}>
      <summary className="cursor-pointer px-3 py-3 text-sm font-medium">История выплат</summary>
      {history && <PersonnelPaymentsHistory />}
    </details>
  </div>;
}


function ReportColumns({ columns, cellClass }: { columns: ReportColumn[]; cellClass: string }) {
  return <Fragment>
    {columns.map(({ key, name, date }) => <th key={key + date} scope="col" className={cellClass + ' min-w-24 max-w-36 bg-[#f3f3f3] text-left capitalize'}>
      {name}{date && <span className="block font-normal">{date.slice(5).split('-').reverse().join('.')}</span>}
    </th>)}
    <th scope="col" className={cellClass + ' bg-[#fff2cc]'}>Расходы</th>
    <th scope="col" className={cellClass + ' bg-[#ffe599]'}>Итого работы</th>
  </Fragment>;
}

function ReportGroupCells({ work, expenses, total, cellClass, renderWork, format }: {
  work: PayoutRow[][]; expenses: number; total: number; cellClass: string;
  renderWork: (row: PayoutRow) => ReactNode; format: (value: number) => string;
}) {
  return <Fragment>
    {work.map((entries, index) => <td key={index} className={cellClass}>{entries.map(renderWork)}</td>)}
    <td className={cellClass + ' bg-[#fff2cc]'}>{format(expenses)}</td>
    <td className={cellClass + ' bg-[#ffe599] font-medium'}>{format(total)}</td>
  </Fragment>;
}

function ReportGroupTotals({ values, cellClass, format }: { values: number[]; cellClass: string; format: (value: number) => string }) {
  return <Fragment>{values.map((value, index) => <td key={index} className={cellClass}>{format(value)}</td>)}</Fragment>;
}
