import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const equipmentSearch = {};
const source = readFileSync('src/lib/equipmentSearch.ts', 'utf8');
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
new Function('exports', compiled)(equipmentSearch);

const { canonicalEquipmentSubtype, canonicalEquipmentType, normalizeEquipmentSearch } = equipmentSearch;
assert.equal(canonicalEquipmentType('Силовой распределитель'), 'Распределитель питания');
assert.equal(canonicalEquipmentType(' распределитель ПИТАНИЯ '), 'Распределитель питания');
assert.equal(canonicalEquipmentSubtype('63A / 32 а'), '63А / 32А');
assert.equal(canonicalEquipmentSubtype('Модель 63AX'), 'Модель 63AX');

for (const name of ['Распределитель 63А', 'Распределитель 63A', 'Распределитель 63 A']) {
  for (const query of ['63A', '63А', '63 A', '63 а']) {
    assert(normalizeEquipmentSearch(name).includes(normalizeEquipmentSearch(query)));
  }
}
assert.equal(normalizeEquipmentSearch('PowerCON 32A'), normalizeEquipmentSearch('PowerCON 32А'));
