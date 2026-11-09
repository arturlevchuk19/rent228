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
const container = {getBoundingClientRect:()=>({top:0}),querySelectorAll:selector=>selector==='table'?[]:fractionalRows};
const measured = exports.measurePdfBlocks(container, 300);
const measuredPages = paginatePdf(1220,300,measured);
assert.equal(measuredPages.length,5);
assert.ok(measuredPages.slice(0,-1).every(page=>page.bottom-page.top>=270));
// A heading stays with the first item even when the block exceeds 20% of a page.
const rows = Array.from({length:10},(_,i)=>({top:i*20,bottom:(i+1)*20}));
assert.deepEqual(paginatePdf(200,100,[...rows,{top:40,bottom:120,keepWithNext:true}]),[{top:0,bottom:40},{top:40,bottom:140},{top:140,bottom:200}]);
// Small heading + first-row groups still move together when they fit.
assert.deepEqual(paginatePdf(150,100,[{top:90,bottom:105,keepWithNext:true}]),[{top:0,bottom:90},{top:90,bottom:150}]);
// Conflicting overlapping preferences cannot keep shifting a cut backwards.
assert.deepEqual(paginatePdf(180,100,[{top:0,bottom:60},{top:60,bottom:120},{top:50,bottom:110,keepWithNext:true}]),[{top:0,bottom:60},{top:60,bottom:160},{top:160,bottom:180}]);
// Font rectangles may extend outside row boxes. Do not let these redundant
// rectangles join separate normal rows into an indivisible category.
const tableRows = Array.from({length:12},(_,i)=>({getBoundingClientRect:()=>({top:i*20,bottom:(i+1)*20,height:20})}));
const nodes = tableRows.map(row=>({textContent:'Позиция',parentElement:{closest:()=>row}}));
let index=-1, selected;
globalThis.document = {
 createTreeWalker:()=>({nextNode:()=>++index<nodes.length,get currentNode(){return nodes[index];}}),
 createRange:()=>({selectNodeContents:node=>{selected=node;},getClientRects:()=>{const rect=selected.parentElement.closest().getBoundingClientRect();return [{top:rect.top-1,bottom:rect.bottom+1}];}})
};
const fontContainer={getBoundingClientRect:()=>({top:0}),querySelectorAll:selector=>selector==='table'?[]:tableRows};
const fontBlocks=exports.measurePdfBlocks(fontContainer,100);
assert.equal(fontBlocks.length,12,'Normal rows need no extra font rectangles');
assert.deepEqual(paginatePdf(240,100,fontBlocks),[{top:0,bottom:100},{top:100,bottom:200},{top:200,bottom:240}]);
