import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const code = ts.transpileModule(fs.readFileSync('src/hooks/usePageNavigation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const updates = [];
for (const [query, expected] of [['', 'events'], ['?page=calendar', 'events'], ['?page=events', 'events'], ['?page=equipment', 'equipment'], ['?page=my-claims', 'my-claims']]) {
  globalThis.window = {
    location: { href: `https://example.com/${query}` },
    history: { state: { marker: 'keep', eventPage: true }, pushState: (...args) => updates.push(args) },
  };
  const exports = {};
  new Function('exports', 'require', code)(exports, () => ({ useEffect: () => {}, useState: read => [read(), () => {}] }));
  const navigation = exports.usePageNavigation();
  assert.equal(navigation.currentPage, expected);
  const count = updates.length;
  navigation.navigate('unknown-page');
  assert.equal(updates.length, count);
  navigation.navigate('calendar');
  if (query !== '?page=events') {
    const [state, , url] = updates.at(-1);
    assert.equal(url.searchParams.get('page'), 'events');
    assert.equal(state.marker, 'keep');
    assert.equal(state.eventPage, false);
  }
}
console.log('PASS: unified events entry, legacy calendar URLs/navigation, unrelated routes and history state');

const eventId = '11111111-1111-4111-8111-111111111111';
const budgetId = '22222222-2222-4222-8222-222222222222';
const eventUrl = `https://example.com/?page=events&event=${eventId}`;
let location = new URL(eventUrl);
let historyState = { eventPage: true };
let backCalls = 0;
const updateLocation = (state, _title, url) => {
  historyState = state;
  location = new URL(url);
};
globalThis.window = {
  get location() { return location; },
  history: {
    get state() { return historyState; },
    pushState: updateLocation,
    replaceState: updateLocation,
    back() { backCalls++; },
  },
};
const exports = {};
new Function('exports', 'require', code)(exports, () => ({ useEffect: () => {}, useState: read => [read(), () => {}] }));
const nav = exports.usePageNavigation();
assert.equal(nav.specification, null);
nav.openSpecification(eventId, budgetId);
assert.equal(location.searchParams.get('event'), eventId);
assert.equal(location.searchParams.get('specification'), eventId);
assert.equal(location.searchParams.get('specificationBudget'), budgetId);
assert.deepEqual(exports.usePageNavigation().specification, { eventId, budgetId });
nav.closeSpecification();
assert.equal(backCalls, 1);
historyState = null; // Directly opened link.
nav.closeSpecification();
assert.equal(location.href, eventUrl);
assert.equal(backCalls, 1);
nav.openSpecification(eventId, budgetId);
nav.navigate('events');
assert.equal(location.searchParams.has('specification'), false);
assert.equal(location.searchParams.has('specificationBudget'), false);
console.log('PASS: specification URL scopes the budget and supports return and direct links.');
