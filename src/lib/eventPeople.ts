import { isAssignablePersonnel, type Personnel, type WorkItem } from './personnel';
import type { EventBudget } from './eventBudgets';
import type { BudgetItem, Event } from './events';
import { budgetLineAmount, roundBudgetPrice, ceilCurrencyUnit, calcCombinedTotal } from './budgetPricing';
import type { ProjectPerson } from './eventProject';

export interface PeopleWork { id: string; name: string; }
const normalized = (name: string) => name.trim().toLocaleLowerCase('ru-RU');
export function orderedPeopleWorks(works: WorkItem[]): PeopleWork[] {
  const first = ['Монтаж', 'Демонтаж'].map((name, index) => works.find(work => normalized(work.name) === normalized(name)) || { id: `default-work-${index}`, name });
  return [...first, ...works.filter(work => !first.some(row => row.id === work.id)).sort((a, b) => a.name.localeCompare(b.name, 'ru'))];
}
export function peopleWorkRate(person: Personnel, workName: string): string {
  return String(/склад|загрузка|разгрузка/i.test(workName) ? person.warehouse_rate ?? 0 : person.installation_rate ?? 0);
}
export function addWorkPeople(current: ProjectPerson[], selected: Personnel[], work: PeopleWork, id: () => string): ProjectPerson[] {
  return [...current, ...selected.filter(person => isAssignablePersonnel(person) && !current.some(row => row.personnel_id === person.id && (row.work_id === work.id || (!row.work_id && row.work_name === work.name)))).map(person => ({
    id: id(), personnel_id: person.id, name: person.full_name,
    group: person.employment_type === 'freelance' ? 'freelance' as const : 'team' as const,
    work_id: work.id, work_name: work.name, rate: peopleWorkRate(person, work.name), hours: '',
  }))];
}

export interface BudgetPeopleWork extends PeopleWork { budgetAmount: number; }
export const moneyRound = roundBudgetPrice;
export function personWorkAmount(person: Pick<ProjectPerson, 'rate' | 'hours'>): number {
  const rate = Number((person.rate || '').replace(',', '.')), hours = Number((person.hours || '').replace(',', '.'));
  return Number.isFinite(rate) && Number.isFinite(hours) && rate >= 0 && hours >= 0 ? moneyRound(rate * hours) : 0;
}
export function peopleWorkBalance(people: ProjectPerson[], budgetAmount: number) {
  const amount = moneyRound(people.reduce((sum, person) => sum + personWorkAmount(person), 0));
  return { amount, budgetAmount, difference: moneyRound(budgetAmount - amount) };
}
/** Use the same per-unit rounding and displayed period as the estimate editor. */
export function budgetWorkAmountBYN(item: BudgetItem, settings: Partial<Event>): number {
  const rate = settings.budget_exchange_rate || item.exchange_rate || 3;
  const unitUSD = settings.budget_totals_mode === 'combined_only' ? calcCombinedTotal({ ...item, quantity: 1 }, settings.budget_days || 1) : item.price;
  if (settings.budget_payment_mode === 'byn_cash') return moneyRound(ceilCurrencyUnit(unitUSD * rate) * item.quantity);
  if (settings.budget_payment_mode === 'byn_noncash') {
    const delivery = /доставка оборудования|доставка персонала/i.test(item.work_item?.name || item.name || '');
    return moneyRound(ceilCurrencyUnit(delivery ? unitUSD * rate / 0.8 : unitUSD * rate * 1.67) * item.quantity);
  }
  return moneyRound(budgetLineAmount(unitUSD, item.quantity) * rate);
}
export function budgetPeopleWorks(items: BudgetItem[], settings: Partial<Event>): BudgetPeopleWork[] {
  const totals = new Map<string, BudgetPeopleWork>();
  const add = (id: string, name: string, amount: number) => {
    const key = normalized(name);
    const previous = totals.get(key);
    totals.set(key, { id: previous?.id || id, name: previous?.name || name, budgetAmount: moneyRound((previous?.budgetAmount || 0) + amount) });
  };
  let combined = 0;
  for (const item of items) {
    if (item.item_type !== 'work') continue;
    const name = (item.work_item?.name || item.name || 'Работа').trim();
    const amount = budgetWorkAmountBYN(item, settings);
    if (/^монтаж\s*(?:\/|\\|и|[-–—])\s*демонтаж$/i.test(name)) combined += amount;
    else add(item.work_item_id || item.id, name, amount);
  }
  if (combined) {
    const installation = moneyRound(combined * 0.6);
    add('default-work-0', 'Монтаж', installation);
    add('default-work-1', 'Демонтаж', moneyRound(combined - installation));
  } else if (items.some(item => item.item_type === 'work' && /^монтаж\s*(?:\/|\\|и|[-–—])\s*демонтаж$/i.test((item.work_item?.name || item.name || '').trim()))) {
    add('default-work-0', 'Монтаж', 0); add('default-work-1', 'Демонтаж', 0);
  }
  const priority = (name: string) => normalized(name) === 'монтаж' ? 0 : normalized(name) === 'демонтаж' ? 1 : 2;
  return [...totals.values()].sort((a, b) => priority(a.name) - priority(b.name) || a.name.localeCompare(b.name, 'ru'));
}

export function documentPeopleWorks(items: BudgetItem[], budget: Pick<EventBudget, 'id' | 'is_primary' | 'settings'>): BudgetPeopleWork[] {
  return budgetPeopleWorks(items.filter(item => item.budget_id === budget.id || (!item.budget_id && budget.is_primary)), budget.settings);
}

/** Retain division precision so a manually entered total survives recomputation. */
export function rateForWorkAmount(amount: number, hours: string | undefined): string | null {
  const count = Number((hours || '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(count) || count <= 0) return null;
  return String(amount / count);
}

export function peopleWorkPriority(name: string): number {
  const order = ['загрузка', 'монтаж', 'демонтаж', 'разгрузка'];
  const index = order.indexOf(normalized(name));
  return index < 0 ? order.length : index;
}
/** Operational jobs have no estimate allowance unless explicitly quoted. */
export function withLoadingWorks(works: BudgetPeopleWork[]): BudgetPeopleWork[] {
  const result = [...works];
  if (works.some(work => normalized(work.name) === 'монтаж') && !works.some(work => normalized(work.name) === 'загрузка')) result.push({ id: 'operational-loading', name: 'Загрузка', budgetAmount: 0 });
  if (works.some(work => normalized(work.name) === 'демонтаж') && !works.some(work => normalized(work.name) === 'разгрузка')) result.push({ id: 'operational-unloading', name: 'Разгрузка', budgetAmount: 0 });
  return result.sort((a, b) => peopleWorkPriority(a.name) - peopleWorkPriority(b.name) || a.name.localeCompare(b.name, 'ru'));
}
export function copyPeopleToWork(current: ProjectPerson[], source: ProjectPerson[], target: PeopleWork, id: () => string): ProjectPerson[] {
  const result = [...current];
  for (const person of source) {
    const exists = result.some(row => (row.work_id === target.id || normalized(row.work_name || '') === normalized(target.name)) &&
      (person.personnel_id ? row.personnel_id === person.personnel_id : !row.personnel_id && normalized(row.name) === normalized(person.name)));
    if (exists) continue;
    result.push({ ...person, id: id(), work_id: target.id, work_name: target.name });
  }
  return result;
}
