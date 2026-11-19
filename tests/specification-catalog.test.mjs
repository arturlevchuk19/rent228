import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const exports = {};
new Function('exports', ts.transpile(fs.readFileSync('src/lib/catalogLookup.ts', 'utf8'), {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
}))(exports);
const { readCatalogRows, createCatalogLookup } = exports;

const ids = Array.from({ length: 111 }, (_, index) => String(index));
const fixture = ids.flatMap(id => Array.from({ length: id === '0' ? 501 : 1 }, (_, index) => ({ id, index })));
const calls = [];
const lookup = createCatalogLookup(keys => readCatalogRows(keys, async (batch, from, to) => {
  calls.push({ keys: batch, from, to });
  return { data: fixture.filter(row => batch.includes(row.id)).slice(from, to + 1), error: null };
}), row => row.id);

const [all, overlap] = await Promise.all([lookup(ids), lookup(['0', '110', 'missing'])]);
assert.equal(all.size, 111);
assert.equal(calls.length, 4); // 111 keys split in two, one extra page and one new key.
assert.ok(calls.every(call => call.keys.length <= 100));
assert.equal(all.get('0').length, 501);
assert.deepEqual(overlap.get('0'), all.get('0'));
assert.deepEqual(overlap.get('missing'), []);
assert.equal(calls.filter(call => call.keys.includes('110')).length, 1);

const failed = createCatalogLookup(keys => readCatalogRows(keys, async () => ({ data: null, error: Error('Catalog unavailable') })), row => row.id);
await assert.rejects(failed(['0', '1']), /Catalog unavailable/);
console.log('PASS: batching, complete pagination, shared in-flight reads and errors');
