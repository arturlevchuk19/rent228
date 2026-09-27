const fs = require('fs');
process.on('uncaughtException', e => { fs.appendFileSync('/tmp/out2.txt', 'UNCAUGHT: '+e.stack+'\n'); });
(async () => {
try {
const { JSDOM } = require('jsdom');
fs.appendFileSync('/tmp/out2.txt','jsdom ok\n');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.Image = dom.window.Image;
global.navigator = dom.window.navigator;
dom.window.HTMLCanvasElement.prototype.getContext = function(){ return { drawImage(){} }; };
dom.window.HTMLCanvasElement.prototype.toDataURL = function(){ return 'data:image/png;base64,AAA'; };

const Module = require('module');
const origLoad = Module._load;
Module._load = function(request, parent, isMain){
  if (request === 'jspdf' || request === 'html2canvas') {
    const stub = function(){ };
    stub.default = class { constructor(){ } save(){ } html(){ return this; } };
    stub.jsPDF = stub.default;
    stub.__esModule = true;
    return stub;
  }
  return origLoad.apply(this, arguments);
};
const { generateBudgetPDF } = require('/tmp/pdfgen.cjs');
console.log = (...a)=>require('fs').appendFileSync('/tmp/out2.txt', a.join(' ')+'
');
fs.appendFileSync('/tmp/out2.txt','loaded module\n');
const items = [
  { category_id:'c1', location_id:'l1', equipment:{name:'Монитор'}, quantity:2, price:100, total:200 },
  { category_id:'c1', location_id:'l1', work_item:{name:'Монтаж'}, quantity:1, price:50, total:50 },
];
async function run(label, data){
  try { await generateBudgetPDF(data); fs.appendFileSync('/tmp/out2.txt', label+' OK\n'); }
  catch(e){ fs.appendFileSync('/tmp/out2.txt', label+' ERROR: '+e.message+'\n'); }
}
const base = { eventName:'Test', budgetItems:items, categories:[{id:'c1',name:'Оборудование'}], locations:[{id:'l1',name:'Сцена'}], exchangeRate:3.3, budgetDays:2, budgetTotalsMode:'day1_plus_combined' };
await run('combined_only+discount', { ...base, budgetTotalsMode:'combined_only', discountEnabled:true, discountPercent:10 });
await run('day1+combined+discount', { ...base, discountEnabled:true, discountPercent:10 });
await run('day1+discount-1day', { ...base, budgetDays:1, discountEnabled:true, discountPercent:10 });
await run('no discount', { ...base });
} catch(e) { fs.appendFileSync('/tmp/out2.txt','FATAL: '+e.stack+'\n'); }
})();
