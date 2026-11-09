import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const exports = {};
new Function('exports', ts.transpile(fs.readFileSync('src/lib/pdfPagination.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }))(exports);
const { paginatePdf } = exports;
assert.deepEqual(paginatePdf(80, 100, []), [{top:0,bottom:80}]);
assert.deepEqual(paginatePdf(300, 100, [{top:80,bottom:130},{top:175,bottom:205}]), [{top:0,bottom:80},{top:80,bottom:175},{top:175,bottom:275},{top:275,bottom:300}]);
// A row longer than a page can continue only between its text lines.
const lines = Array.from({length:15},(_,i)=>({top:i*20,bottom:i*20+16}));
const blocks = [{top:0,bottom:300},...lines];
const pages = paginatePdf(300, 95, blocks);
assert.ok(pages.length > 3);
for (const page of pages) {
 assert.ok(page.bottom > page.top && page.bottom-page.top <= 95);
 assert.ok(!lines.some(line=>line.top<page.bottom && line.bottom>page.bottom));
}
assert.equal(pages.at(-1).bottom, 300);
assert.deepEqual(paginatePdf(200,100,[]),[{top:0,bottom:100},{top:100,bottom:200}], 'No trailing empty page');
console.log('PASS: A4 page cuts, whole rows, oversized rows between text lines, no trailing page');
// Fractional shared table edges must stay shared after measurement. Expanding
// each side by a pixel makes all rows overlap and wastes almost every page.
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.document = { createTreeWalker:()=>({nextNode:()=>false}), createRange:()=>({}) };
const fractionalRows = Array.from({length:40},(_,i)=>({getBoundingClientRect:()=>({top:i*30.5,bottom:(i+1)*30.5})}));
const container = {getBoundingClientRect:()=>({top:0}),querySelector:()=>null,querySelectorAll:selector=>['table','section'].includes(selector)?[]:fractionalRows};
const measured = exports.measurePdfBlocks(container, 300);
const measuredPages = paginatePdf(1220,300,measured);
assert.equal(measuredPages.length,5);
assert.ok(measuredPages.slice(0,-1).every(page=>page.bottom-page.top>=270));

// A small category moves as a whole instead of leaving one item on the previous page.
assert.deepEqual(paginatePdf(160,100,[{top:60,bottom:140}]), [{top:0,bottom:60},{top:60,bottom:160}]);
// Last item, category totals and grand totals travel together.
assert.deepEqual(paginatePdf(130,100,[{top:80,bottom:100},{top:100,bottom:115},{top:115,bottom:130},{top:80,bottom:130}]), [{top:0,bottom:80},{top:80,bottom:130}]);
// If a whole category plus its footer cannot fit, preserve its last item + totals.
const conflict = paginatePdf(140,100,[{top:0,bottom:30},{top:30,bottom:60},{top:60,bottom:90},{top:90,bottom:110},{top:110,bottom:140},{top:60,bottom:140},{top:0,bottom:110}]);
assert.deepEqual(conflict,[{top:0,bottom:60},{top:60,bottom:140}]);
console.log('PASS: whole categories, totals anchored to items, conflicting groups do not split rows');
