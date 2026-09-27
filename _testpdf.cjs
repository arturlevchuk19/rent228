const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.Image = dom.window.Image;
class FakeCanvas { getContext(){ return { drawImage(){}, }; } toDataURL(){ return 'data:image/png;base64,AAA'; } }
dom.window.HTMLCanvasElement.prototype.getContext = function(){ return { drawImage(){} }; };
dom.window.HTMLCanvasElement.prototype.toDataURL = function(){ return 'data:image/png;base64,AAA'; };
global.navigator = dom.window.navigator;


const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args){
  if (request === 'jspdf' || request === 'html2canvas') return require.resolve('/tmp/stub.cjs');
  return origResolve.call(this, request, ...args);
};

const { generateBudgetPDF } = require('/tmp/pdfgen.cjs');

const items = [
  { category_id:'c1', location_id:'l1', equipment:{name:'Монитор'}, quantity:2, price:100, total:200 },
  { category_id:'c1', location_id:'l1', work_item:{name:'Монтаж'}, quantity:1, price:50, total:50 },
];
async function run(label, data){
  try { await generateBudgetPDF(data); console.log(label, 'OK'); }
  catch(e){ console.log(label, 'ERROR:', e.message); }
}
(async () => {
  const base = { eventName:'Test', budgetItems:items, categories:[{id:'c1',name:'Оборудование'}], locations:[{id:'l1',name:'Сцена'}], exchangeRate:3.3, budgetDays:2, budgetTotalsMode:'day1_plus_combined' };
  await run('combined_only+discount', { ...base, budgetTotalsMode:'combined_only', discountEnabled:true, discountPercent:10 });
  await run('day1+combined+discount', { ...base, discountEnabled:true, discountPercent:10 });
  await run('day1+combined+discount days=1', { ...base, budgetDays:1, discountEnabled:true, discountPercent:10 });
  await run('no discount', { ...base });
})();
