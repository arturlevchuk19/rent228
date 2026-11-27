import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const exports = {};
new Function('exports', ts.transpile(readFileSync('src/lib/podiumSpecification.ts', 'utf8'), {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
}))(exports);
const { getPodiumFootprint, getPodiumCoveredArea, getPodiumModuleTab, getPodiumBracing, getPodiumModules } = exports;

test('stage dimensions written by the budget editor use only the first two measurements', () => {
  for (const dimensions of ['12х10х2м', '12 x 10 x 0.5 м', '12 × 10 × 1,5 м']) {
    assert.deepEqual(getPodiumFootprint(dimensions), { width: 12, depth: 10, area: 120 });
  }
  assert.equal(getPodiumFootprint('Нет размеров', 'Размер 3,5Х2м').area, 7);
  assert.equal(getPodiumFootprint('0х10х2м'), null);
});

test('sums the footprint of each platform multiplied by its quantity', () => {
  const modules = [
    { name: 'Подиум 2х1 Внешний', sku: 'SCN_PDM_OUT_2x1', quantity: 3 },
    { name: 'Подиум внешний', sku: 'SCN_PDM_OUT_1x0,5', quantity: 5 },
    { name: 'Нога для площадки 2х1', sku: 'SCN_PDM_LEG_20', quantity: 10 },
    { name: 'Ферма 2х2', sku: 'TRUSS', quantity: 1 },
  ];
  assert.equal(getPodiumCoveredArea(modules.filter(item => getPodiumModuleTab(item) === 'platform')), 8.5);
});

test('offers four distinct bracing parts and reuses matching equipment SKUs', () => {
  const catalog = [
    { id: 'pipe25', name: 'Труба серебрянная', sku: 'SCN_PIPE_(S)_2.5' },
    { id: 'pipe3', name: 'Труба серебрянная', sku: 'SCN_PIPE_(S)_3' },
    { id: 'unbranded', name: 'Клемп двойной черный', sku: 'SCN_FIX_CLAMP_X2' },
    { id: 'china', name: 'Клемп двойной China', sku: 'CLAMP-CHINA' },
  ];
  const parts = getPodiumBracing(catalog);
  assert.deepEqual(parts.map(({ name, sku }) => [name, sku]), [
    ['Труба серебристая 2,5 м', 'SCN_PIPE_(S)_2.5'],
    ['Труба серебристая 3 м', 'SCN_PIPE_(S)_3'],
    ['Двойной хомут China', 'CLAMP-CHINA'],
    ['Двойной хомут PKC', ''],
  ]);
  assert.ok(parts.every(part => getPodiumModuleTab(part) === 'bracing'));
});

test('restores saved child quantities and displays other options with zero', () => {
  const platform = { id: 'deck', name: 'Подиум 2х1', sku: 'DECK', category: 'Сцена' };
  const leg = { id: 'leg', name: 'Нога 20', sku: 'LEG', category: 'Сцена' };
  const braces = getPodiumBracing([{ id: 'china', name: 'Клемп двойной China', sku: 'CLAMP-CHINA' }]);
  const options = [platform, leg, ...braces, { ...platform, id: 'duplicate-deck' }];
  assert.deepEqual(getPodiumModules([], options).map(item => item.quantity), [0, 0, 0, 0, 0, 0]);

  const saved = [
    { ...platform, id: 'saved-deck', quantity: 4 },
    { id: 'saved-china', name: 'Двойной хомут China', sku: '', category: 'Сцена', quantity: 2 },
    { id: 'legacy-deck', name: 'Подиум 3х1', sku: 'LEGACY', category: 'Сцена', quantity: 3 },
  ];
  const modules = getPodiumModules(saved, options);
  assert.equal(modules.length, 7);
  assert.ok(saved.every(item => modules.some(module => module.id === item.id && module.quantity === item.quantity)));
  assert.equal(modules.find(item => item.id === 'leg').quantity, 0);
  assert.equal(modules.find(item => item.id === 'double-clamp-pkc').quantity, 0);
});
