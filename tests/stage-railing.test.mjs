import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const exports = {};
new Function('exports', ts.transpile(readFileSync('src/lib/stageRailing.ts', 'utf8'), {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
}))(exports);
const { getStageRailingComposition, getStageRailingCounts, getStageRailingOptions, isStageRailing, suggestStageRailingHardware } = exports;

test('the calculator is available for a railing assembly and excluded from individual parts', () => {
  assert.equal(isStageRailing('Ограждение сценического подиума'), true);
  assert.equal(isStageRailing('Ограждение для сценического подиума (зал)'), true);
  assert.equal(isStageRailing('Ограждение сцены 2м'), false);
  assert.equal(isStageRailing('Ограждение сцены 1 м'), false);
  assert.equal(isStageRailing('Закладная для ограждения сцены'), false);
  assert.equal(isStageRailing('Сценический подиум'), false);
});

test('suggests hardware by number of sections and respects manual quantities', () => {
  const sections = { twoMetre: 3, oneMetre: 2 };
  assert.deepEqual(suggestStageRailingHardware(sections), { anchors: 10, legs: 5 });
  assert.deepEqual(suggestStageRailingHardware({ twoMetre: 0, oneMetre: 0 }), { anchors: 0, legs: 0 });

  const options = getStageRailingOptions([
    { id: 'old-anchor', name: 'Крепления для ограждения', sku: 'SCN_FIX_OTH_FENC' },
    { id: 'anchor', name: 'Закладная для ограждения сцены', sku: 'ANCHOR' },
  ]);
  assert.equal(options.find(item => item.key === 'anchors').sku, 'ANCHOR');
  const saved = [
    { id: 'saved', name: 'Ограждение сцены 2м', sku: 'SCN_PDM_FENC_2', quantity: 1 },
    { id: 'extra', name: 'Накладка', sku: 'OTHER', quantity: 7 },
  ];
  const counts = { ...sections, anchors: 0, legs: 4 };
  const children = getStageRailingComposition(counts, saved, options);
  assert.deepEqual(getStageRailingCounts(children), counts);
  assert.deepEqual(children.find(item => item.id === 'saved'), { ...saved[0], quantity: 3 });
  assert.ok(children.includes(saved[1]));
  assert.ok(children.every(item => item.quantity > 0));
});
