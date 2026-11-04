import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
let html='';
const nativeTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms)=>nativeTimeout(fn,ms).unref();
globalThis.Image=class { width=10;height=10;set src(value){queueMicrotask(()=>this.onload());} };
globalThis.document={fonts:{ready:Promise.resolve()},createElement:tag=>tag==='canvas'?{getContext:()=>({drawImage:()=>{}}),toDataURL:()=> 'data:image/png;base64,AA'}:{style:{},innerHTML:'',scrollHeight:1000,remove:()=>{}},body:{appendChild:element=>{html=element.innerHTML;}}};
globalThis.requestAnimationFrame=callback=>{callback();return 1;};
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);new Function('exports','require',ts.transpile(fs.readFileSync(file,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}))(exports,name=>name==='jspdf'?class{addImage(){}save(){}}:name==='html2canvas'?async()=>({width:1000,height:1000,toDataURL:()=> 'data:image/png;base64,AA'}):name==='./budgetPricing'?load('src/lib/budgetPricing.ts'):{});return exports;}
const {generateBudgetPDF}=load('src/lib/pdfGenerator.ts');const {ceilCurrencyUnit,calcCombinedTotal}=load('src/lib/budgetPricing.ts');
assert.equal(ceilCurrencyUnit(3.0000000000000004),3);assert.equal(ceilCurrencyUnit(3.001),4);assert.equal(ceilCurrencyUnit(0),0);
const rows=(extra=false,coefficient=0)=>[{category_id:'c',equipment:{name:'Жидкость',category:'Расходные материалы'},quantity:7,price:10,total:70,multi_day_rate_override:coefficient,is_extra:extra},{category_id:'c',equipment:{name:'Батарейки',category:'Расходные материалы'},quantity:28,price:1.1,total:30.8,multi_day_rate_override:coefficient,is_extra:extra}];
const data={eventName:'Проверка',categories:[{id:'c',name:'Расходные материалы'}],exchangeRate:3,budgetDays:7,budgetTotalsMode:'day1_plus_combined'};
const values=row=>[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match=>match[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
for(const paymentMode of ['byn_cash','byn_noncash','usd'])for(const extra of [false,true]){
 await generateBudgetPDF({...data,paymentMode,budgetItems:rows(extra)});
 const table=html.match(/<table[^>]*>([\s\S]*?)<\/table>/)[1];
 const trs=[...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(match=>values(match[1])).filter(row=>row.length);
 const totals=trs.filter(row=>row[0].includes('ИТОГО ПО РАЗДЕЛУ'));
 assert.equal(totals[0].at(-1),totals[1].at(-1),`${paymentMode}, extra=${extra}: zero coefficient must keep 7-day total unchanged`);
 for(const row of trs.filter(row=>row.length===4)){
  const quantity=parseFloat(row[1]),price=parseFloat(row[2]),amount=parseFloat(row[3]);
  assert(Math.abs(amount-quantity*price)<0.011,`${row}: amount must equal displayed price times quantity`);
 }
}
const floatingRows=rows();floatingRows[1].price=1;
await generateBudgetPDF({...data,exchangeRate:3.0000000000000004,paymentMode:'byn_cash',budgetItems:floatingRows});
const floatingTotals=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(match=>values(match[1])).filter(row=>row[0]?.includes('ИТОГО ПО РАЗДЕЛУ'));
assert.equal(parseFloat(floatingTotals[0].at(-1)),294);assert.equal(parseFloat(floatingTotals[1].at(-1)),294,'Boundary rounding must not add 28 BYN at zero coefficient');
await generateBudgetPDF({...data,paymentMode:'byn_cash',budgetItems:rows(false,0.5)});let totals=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(match=>values(match[1])).filter(row=>row[0]?.includes('ИТОГО ПО РАЗДЕЛУ'));assert(parseFloat(totals[1].at(-1))>parseFloat(totals[0].at(-1)),'Nonzero coefficient still increases multi-day totals');
assert.equal(calcCombinedTotal({price:10,quantity:28,multi_day_rate_override:0},7),280);
globalThis.setTimeout=nativeTimeout;
console.log('PASS: actual PDF HTML main/extra rows in USD/BYN cash/noncash; zero coefficient equals first day; displayed unit × quantity equals amount; floating point boundary and nonzero coefficient');
