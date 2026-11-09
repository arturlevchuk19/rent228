import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const exports = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/calendar.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText)(exports);
const { calendarPeriodWeeks, dayNumber, dateFromDay, weekSegments } = exports;
const wednesday = dayNumber('2026-11-11');
assert.deepEqual(calendarPeriodWeeks(2026, 10, 11, 'week'), [wednesday]);
assert.deepEqual(calendarPeriodWeeks(2026, 10, 11, 'fortnight'), [wednesday, wednesday + 7]);
assert.deepEqual(calendarPeriodWeeks(2026, 10, 11, 'day'), [wednesday]);
assert.equal(calendarPeriodWeeks(2026, 10, 11, 'month')[0], dayNumber('2026-10-26'));
const crossingYear = calendarPeriodWeeks(2026, 11, 30, 'fortnight');
assert.equal(dateFromDay(crossingYear[1] + 6).toISOString().slice(0, 10), '2027-01-12');
const events = [
  {id:'before',event_date:'2026-11-10'},
  {id:'span',event_date:'2026-11-10',event_end_date:'2026-11-13'},
  {id:'after',event_date:'2026-11-18'},
];
const segments = weekSegments(events, wednesday);
assert.deepEqual(segments.map(row=>row.event.id), ['span']);
assert.equal(segments[0].start, 0);
assert.equal(segments[0].end, 2);
assert.equal(segments[0].continuesBefore, true);
console.log('PASS: rolling week/fortnight, unchanged month grid, year boundary and event clipping');
