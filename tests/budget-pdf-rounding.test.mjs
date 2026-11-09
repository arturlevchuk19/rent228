import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
let html='';
globalThis.window={scrollX:0,scrollY:0,innerHeight:900};
const nativeTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,ms)=>nativeTimeout(fn,ms).unref();
globalThis.Image=class { width=10;height=10;set src(value){queueMicrotask(()=>this.onload());} };
globalThis.document={documentElement:{clientWidth:1200},fonts:{ready:Promise.resolve()},createElement:tag=>tag==='canvas'?{getContext:()=>({drawImage:()=>{}}),toDataURL:()=> 'data:image/png;base64,AA'}:{style:{},innerHTML:'',scrollHeight:1000,getBoundingClientRect:()=>({width:800,top:0,left:0}),remove:()=>{}},body:{appendChild:element=>{html=element.innerHTML;}}};
globalThis.requestAnimationFrame=callback=>{callback();return 1;};
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);new Function('exports','require',ts.transpile(fs.readFileSync(file,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}))(exports,name=>name==='jspdf'?class{addImage(){}addPage(){}save(){}}:name==='html2canvas'?async()=>({width:1000,height:1000,toDataURL:()=> 'data:image/png;base64,AA'}):name==='./budgetPricing'?load('src/lib/budgetPricing.ts'):name==='./pdfPagination'?{...load('src/lib/pdfPagination.ts'),measurePdfBlocks:()=>[]}:{});return exports;}
const {generateBudgetPDF}=load('src/lib/pdfGenerator.ts');const {ceilCurrencyUnit,calcCombinedTotal,roundBudgetTotalDown}=load('src/lib/budgetPricing.ts');
assert.equal(ceilCurrencyUnit(3.0000000000000004),3);assert.equal(ceilCurrencyUnit(3.001),4);assert.equal(ceilCurrencyUnit(0),0);assert.equal(roundBudgetTotalDown(294),290);assert.equal(roundBudgetTotalDown(322),320);assert.equal(roundBudgetTotalDown(325),325);
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
// Hidden USD precision and fractional quantities must not leak into visible amounts.
for (const mode of ['usd','byn_cash','byn_noncash']) for (const extra of [false,true]) {
 const precise=[1.005,1.23456,0.2666663333333,2.675,3.335].map((price,index)=>({category_id:'c',equipment:{name:`Item ${index}`,category:'Расходные материалы'},quantity:[1,3,28,0.25,1.333][index],price,total:0,multi_day_rate_override:0.13,is_extra:extra}));
 await generateBudgetPDF({...data,paymentMode:mode,budgetItems:precise});
 const table=html.match(/<table[^>]*>([\s\S]*?)<\/table>/)[1];
 const entries=[...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(match=>values(match[1])).filter(row=>row.length);
 const lines=entries.filter(row=>row.length===4);
 for(const row of lines) assert(Math.abs(parseFloat(row[3])-parseFloat(row[2])*parseFloat(row[1]))<=0.00501,`Visible price × quantity mismatch: ${mode}: ${row}`);
 const sum=lines.reduce((sum,row)=>sum+Math.round(parseFloat(row[3])*100),0)/100;
 const total=parseFloat(entries.find(row=>row[0].includes('ИТОГО ПО РАЗДЕЛУ')).at(-1));assert.equal(total,sum,'Section total must add the rounded visible rows');
 if(!extra) {
  const footer=html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/)[1];
  const amounts=[...footer.matchAll(/<span style="font-size: 30px[^>]*>([^<]*)<\/span>/g)].map(match=>parseFloat(match[1]));
  assert.equal(amounts[0],Math.floor(sum/5)*5,'Grand total is rounded down to a multiple of five, leaving line and section amounts exact');
 }
}
globalThis.setTimeout=nativeTimeout;
console.log('PASS: actual PDF HTML main/extra rows in USD/BYN cash/noncash; zero coefficient equals first day; displayed unit × quantity equals amount; floating point boundary and nonzero coefficient');
