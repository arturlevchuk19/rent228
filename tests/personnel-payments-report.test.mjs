import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const module = {};
  modules.set(path, module);
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  new Function('exports', 'require', compiled)(module, name => {
    if (['./personnel', './supabase'].includes(name)) return {};
    return load(resolve(dirname(path), name + '.ts'));
  });
  return module;
}

const { buildPersonnelReport, rateForReportAmount, reportWeeks } = load(resolve('src/lib/personnelPaymentsReport.ts'));
assert.equal(reportWeeks('2026-02').at(-1).end, 28);
assert.equal(reportWeeks('2028-02').at(-1).end, 29);
assert.deepEqual(reportWeeks('2026-11'), [
  { start: 1, end: 8 }, { start: 9, end: 15 }, { start: 16, end: 22 }, { start: 23, end: 29 }, { start: 30, end: 30 },
]);

const person = {
  id: 'assigned', name: 'Техник', personnel_id: 'tech', group: 'team', work_name: 'Монтаж',
  starts_at: '2026-11-29T10:00', ends_at: '2026-11-29T15:00', rate: '30',
};
const event = {
  id: 'event', name: 'Мероприятие', event_date: '2026-11-29', settings: {},
  budgets: [{ id: 'main', is_primary: true, settings: { budget_payment_mode: 'byn_noncash', budget_exchange_rate: 3 } }],
  items: [{ id: 'work', budget_id: 'main', item_type: 'work', work_item: { name: 'Монтаж' }, price: 100, quantity: 1 }],
  details: { people: [person, { ...person, id: 'second-assignment' }], transport: [] },
};
const claims = [
  { id: 'paid', personnel_id: 'tech', employee_name: 'Техник', event_id: 'event', state: 'paid', lines: [
    { kind: 'time', work_name: 'Монтаж', amount: 150, starts_at: '2026-11-29T07:00:00Z', ends_at: '2026-11-29T12:00:00Z' },
  ] },
  { id: 'expense', personnel_id: 'tech', employee_name: 'Техник', event_id: 'event', state: 'approved', lines: [
    { kind: 'allowance', amount: 25 }, { kind: 'expense', amount: 10 },
  ] },
];
const report = buildPersonnelReport({ events: [event], claims }, { start: 29, end: 30 });
assert.equal(report.rows.filter(row => row.assignment).length, 1, 'one paid claim offsets one assignment');
assert.equal(report.rows.find(row => row.assignment).payment, 'bank');
assert.equal(report.rows.find(row => row.expense && !row.direct).payment, 'cash');
assert.equal(report.rows.find(row => row.direct).amount, 10);
assert.equal(report.events[0].cost, 335);
assert.equal(report.events[0].revenue, 500);
assert.equal(report.events[0].balance, 165);
assert.equal(rateForReportAmount(person, 100), '20');
assert.equal(rateForReportAmount(person, 0), '0');
assert.equal(rateForReportAmount({ ...person, ends_at: person.starts_at }, 100), null);
assert.equal(buildPersonnelReport({ events: [event], claims }, { start: 1, end: 7 }).rows.length, 0);
