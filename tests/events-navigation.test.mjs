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
