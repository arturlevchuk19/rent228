import { getEffectiveBudgetItems } from './budgetCoefficientGroups';
import { budgetLineAmount, calcCombinedUnitPrice, ceilCurrencyUnit, roundBudgetPrice, roundBudgetTotalDown } from './budgetPricing';
import { minskInput, minskInstant, sumClaimAmounts } from './employeeClaimMath';
import type { ClaimLine, EmployeeClaim } from './employeeClaims';
import { deliveryCategory, driverMileagePayout, personWorkAmount, personWorkHours, rateForWorkAmount, vehiclePayout } from './eventPeople';
import { journeyDrivers, normalizeProjectDetails, type ProjectPerson } from './eventProject';
import type { EventBudget } from './eventBudgets';
import type { BudgetItem, Event } from './events';

type ReportBudget = Pick<EventBudget, 'id' | 'is_primary' | 'settings'>;
export interface ReportEvent {
  id: string;
  name: string;
  event_date: string;
  settings: Partial<Event>;
  details: Record<string, unknown>;
  budgets: ReportBudget[];
  items: BudgetItem[];
}
export type ReportClaim = Pick<EmployeeClaim, 'id' | 'personnel_id' | 'employee_name' | 'event_id' | 'state' | 'lines'> & { date: string };
export interface PersonnelReportData { events: ReportEvent[]; claims: ReportClaim[] }

export interface PayoutRow {
  id: string;
  eventId: string | null;
  date: string;
  personKey: string;
  name: string;
  work: string;
  amount: number;
  hours?: number;
  warehouse?: boolean;
  workDate?: string;
  rate?: string;
  payment: 'cash' | 'bank';
  paid: boolean;
  expense: boolean;
  direct: boolean;
  assignment?: ProjectPerson;
}

export const reportWorkKey = (work: string) => work.trim().toLocaleLowerCase('ru-RU');
const amount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function reportWeeks(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const weekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const ranges = [{ start: 1, end: Math.min(days, ((7 - weekday) % 7) + 1) }];
  while (ranges[ranges.length - 1].end < days) {
    const start = ranges[ranges.length - 1].end + 1;
    ranges.push({ start, end: Math.min(start + 6, days) });
  }
  if (ranges.length === 6) {
    ranges[1].start = 1;
    ranges.shift();
  }
  return ranges;
}

function workDay(value?: string) {
  if (!value) return undefined;
  try { return minskInput(minskInstant(value)).slice(0, 10); }
  catch { return undefined; }
}

export function reportBudget(event: ReportEvent) {
  return event.budgets.find(budget => budget.id === event.details.people_budget_id) ??
    event.budgets.find(budget => budget.is_primary) ?? event.budgets[0];
}

function budgetReport(event: ReportEvent) {
  const budget = reportBudget(event);
  const settings = { ...event.settings, ...budget?.settings };
  const exchange = settings.budget_exchange_rate || 3;
  const mode = settings.budget_payment_mode;
  const days = settings.budget_days || 1;
  const items = getEffectiveBudgetItems(event.items.filter(item =>
    budget ? item.budget_id === budget.id || (!item.budget_id && budget.is_primary) : !item.budget_id
  ), settings);
  const work = new Map<string, number>();
  let discountable = 0;
  let fixed = 0;
  let extras = 0;
  for (const item of items) {
    const unit = calcCombinedUnitPrice(item, days);
    const bankMultiplier = item.item_type === 'work' && !deliveryCategory(item.work_item?.name || item.name || '') ? 1.67 : 1 / 0.8;
    const line = budgetLineAmount(mode === 'byn_noncash'
      ? ceilCurrencyUnit(unit * exchange * bankMultiplier)
      : mode === 'byn_cash' ? ceilCurrencyUnit(unit * exchange) : unit, item.quantity);
    const valueBYN = mode === 'byn_cash' || mode === 'byn_noncash' ? line : roundBudgetPrice(line * exchange);
    if (item.is_extra) extras += line;
    else if (item.item_type !== 'work' && item.equipment?.category?.trim().toLowerCase() !== 'расходные материалы') discountable += line;
    else fixed += line;
    if (item.item_type === 'work') {
      const name = reportWorkKey(item.work_item?.name || item.name || 'Работа');
      const add = (key: string, value: number) => work.set(key, roundBudgetPrice((work.get(key) ?? 0) + value));
      if (/^монтаж\s*(?:\/|\\|и|[-–—])\s*демонтаж$/i.test(name)) {
        const installation = roundBudgetPrice(valueBYN * 0.6);
        add('монтаж', installation);
        add('демонтаж', valueBYN - installation);
      } else add(name, valueBYN);
    }
  }
  const discount = (settings.discount_enabled ? 1 - amount(settings.discount_percent) / 100 : 1) *
    (settings.discount2_enabled ? 1 - amount(settings.discount2_percent) / 100 : 1);
  const total = roundBudgetTotalDown(roundBudgetPrice(discountable * discount + fixed) + extras);
  return { revenue: items.length ? roundBudgetPrice(total * (mode === 'byn_cash' || mode === 'byn_noncash' ? 1 : exchange)) : null, work };
}

function matchesAssignment(line: ClaimLine, assignment: ProjectPerson, personId: string) {
  if (assignment.personnel_id !== personId || reportWorkKey(assignment.work_name || '') !== reportWorkKey(line.work_name || '')) return false;
  if (line.kind === 'trip') return !!assignment.trip && amount(assignment.trip.kilometers) === amount(line.kilometers);
  if (line.kind !== 'time' || assignment.trip) return false;
  if (assignment.starts_at || assignment.ends_at) {
    if (!assignment.starts_at || !assignment.ends_at || !line.starts_at || !line.ends_at) return false;
    try {
      return minskInput(minskInstant(assignment.starts_at)) === minskInput(minskInstant(line.starts_at)) &&
        minskInput(minskInstant(assignment.ends_at)) === minskInput(minskInstant(line.ends_at));
    } catch { return false; }
  }
  return amount(line.minutes) > 0 && Math.abs(personWorkHours(assignment) * 60 - amount(line.minutes)) < 0.01;
}

export function buildPersonnelReport({ events, claims }: PersonnelReportData, range?: { start: number; end: number }, month?: string) {
  const selected = (date: string) => (!month || date.startsWith(month + '-')) &&
    (!range || (+date.slice(8, 10) >= range.start && +date.slice(8, 10) <= range.end));
  const claimsByEvent = new Map<string | null, ReportClaim[]>();
  for (const claim of claims) {
    const list = claimsByEvent.get(claim.event_id) ?? [];
    list.push(claim);
    claimsByEvent.set(claim.event_id, list);
  }
  const claimRows = (claim: ReportClaim, event?: ReportEvent, matchedLines?: Set<number>): PayoutRow[] =>
    claim.lines.flatMap((line, index) => {
      if (matchedLines?.has(index)) return [];
      const expense = line.kind === 'expense' || line.kind === 'allowance';
      const mode = event?.budgets.find(budget => budget.id === line.budget_id)?.settings.budget_payment_mode ??
        (event && reportBudget(event)?.settings.budget_payment_mode) ?? event?.settings.budget_payment_mode;
      return [{
        id: `claim:${claim.id}:${index}`, eventId: claim.event_id, date: event?.event_date ?? (line.kind === 'warehouse' ? workDay(line.starts_at) : undefined) ?? claim.date,
        personKey: claim.personnel_id, name: claim.employee_name,
        work: line.work_name || (line.kind === 'warehouse' ? 'Склад' : line.kind === 'expense' ? 'Хозрасходы' : 'Расходы'),
        amount: amount(line.amount), payment: !expense && mode === 'byn_noncash' ? 'bank' : 'cash',
        paid: claim.state === 'paid', expense, direct: line.kind === 'expense',
        warehouse: line.kind === 'warehouse', workDate: workDay(line.starts_at),
        ...(line.minutes ? { hours: line.minutes / 60, rate: String(line.rate ?? '') } : {}),
      }];
    });

  const result = events.filter(event => selected(event.event_date)).map(event => {
    const project = normalizeProjectDetails(event.details);
    const related = claimsByEvent.get(event.id) ?? [];
    const payment = (reportBudget(event)?.settings.budget_payment_mode ?? event.settings.budget_payment_mode) === 'byn_noncash' ? 'bank' : 'cash';
    // Match one claim line to one assignment, prioritizing already-paid claims.
    const matchedPeople = new Set<string>();
    const paidPeople = new Set<string>();
    const matchedLines = new Map<string, Set<number>>();
    for (const claim of [...related].sort((a, b) => Number(b.state === 'paid') - Number(a.state === 'paid'))) {
      claim.lines.forEach((line, index) => {
        const person = project.people.find(row => !matchedPeople.has(row.id) && matchesAssignment(line, row, claim.personnel_id));
        if (!person) return;
        matchedPeople.add(person.id);
        if (claim.state === 'paid') paidPeople.add(person.id);
        else {
          const indices = matchedLines.get(claim.id) ?? new Set<number>();
          indices.add(index);
          matchedLines.set(claim.id, indices);
        }
      });
    }
    const rows: PayoutRow[] = project.people.flatMap(person => {
      if (paidPeople.has(person.id)) return [];
      return [{
        id: `person:${person.id}`, eventId: event.id, date: event.event_date, personKey: person.personnel_id || person.name,
        name: person.name, work: person.work_name || 'Работа', amount: personWorkAmount(person),
        payment, paid: false, direct: false, expense: false, assignment: person, workDate: workDay(person.starts_at),
        ...(person.trip ? {} : { hours: personWorkHours(person), rate: person.rate }),
      }];
    });
    for (const trip of project.transport) {
      const work = trip.journey?.work_name || 'Доставка';
      const add = (id: string, name: string, cost: number, index: string) => rows.push({
        id: `transport:${trip.id}:${index}`, eventId: event.id, date: event.event_date, personKey: id,
        name, work, amount: cost, payment, paid: false, expense: false, direct: false,
      });
      const owner = trip.journey?.owner;
      const vehicleCost = vehiclePayout(trip);
      if (owner || vehicleCost) add(owner?.id || '', owner?.name || trip.vehicle, vehicleCost, 'owner');
      journeyDrivers(trip.journey).forEach((driver, index) => add(driver.id, driver.name, driverMileagePayout(driver.kilometers), String(index)));
    }
    rows.push(...related.flatMap(claim => claimRows(claim, event, matchedLines.get(claim.id))));
    const totals = budgetReport(event);
    const metrics = new Map<string, { name: string; budget: number; cost: number }>();
    for (const [name, budget] of totals.work) metrics.set(name, { name, budget, cost: 0 });
    for (const row of rows.filter(row => !row.expense)) {
      const key = reportWorkKey(row.work);
      const metric = metrics.get(key) ?? { name: row.work, budget: 0, cost: 0 };
      metric.cost = sumClaimAmounts([metric.cost, row.amount]);
      metrics.set(key, metric);
    }
    const cost = sumClaimAmounts(rows.map(row => row.amount));
    return { event, rows, metrics: [...metrics.values()], cost, revenue: totals.revenue,
      balance: totals.revenue === null ? null : roundBudgetPrice(totals.revenue - cost) };
  });

  const rows = [...result.flatMap(event => event.rows),
    ...(claimsByEvent.get(null) ?? []).flatMap(claim => claimRows(claim)).filter(row => selected(row.date))];
  return { events: result, rows };
}

export function rateForReportAmount(person: ProjectPerson, value: number) {
  if (person.trip || value > 1_000_000_000) return null;
  return rateForWorkAmount(value, String(personWorkHours(person)));
}
