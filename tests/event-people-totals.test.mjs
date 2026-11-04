import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const modules=new Map();function load(path){if(modules.has(path))return modules.get(path);const exports={};modules.set(path,exports);new Function('exports','require',ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(exports,name=>name==='./budgetPricing'?load('src/lib/budgetPricing.ts'):name==='./calendar'?load('src/lib/calendar.ts'):{});return exports;}
const {budgetPeopleWorks,documentPeopleWorks,personWorkAmount,peopleWorkBalance,budgetWorkAmountBYN,rateForWorkAmount}=load('src/lib/eventPeople.ts');
const item=(id,name,price,rest={})=>({id,budget_id:'a',item_type:'work',work_item_id:id,work_item:{name},price,quantity:1,exchange_rate:3,...rest});
let works=budgetPeopleWorks([item('combined','Монтаж/демонтаж',100),item('light','Светорежиссёр',50),{...item('equipment','Колонка',200),item_type:'equipment'}],{});
assert.deepEqual(works.map(row=>[row.name,row.budgetAmount]),[['Монтаж',180],['Демонтаж',120],['Светорежиссёр',150]]);assert(!works.some(row=>row.name==='Колонка'));
assert.deepEqual(budgetPeopleWorks([],{}),[],'No artificial jobs when absent from the estimate');
works=budgetPeopleWorks([item('one','Монтаж / демонтаж',0.01,{exchange_rate:1})],{});assert.equal(works.reduce((sum,row)=>sum+row.budgetAmount,0),0.01,'60/40 split preserves exact cents');
works=budgetPeopleWorks([item('combined','Монтаж/демонтаж',100),item('inst','Монтаж',20)],{});assert.equal(works.find(row=>row.name==='Монтаж').budgetAmount,240,'Combine separately quoted installation and split allocation');
works=budgetPeopleWorks([item('one','Работа',10,{quantity:2}),item('two','Работа',5)],{});assert.equal(works.length,1);assert.equal(works[0].budgetAmount,75,'Sum duplicate work lines across categories');
assert.equal(budgetWorkAmountBYN(item('x','Работа',10,{quantity:2,multi_day_rate_override:0.5}),{budget_days:3,budget_totals_mode:'combined_only'}),120);
assert.equal(budgetWorkAmountBYN(item('x','Работа',10,{quantity:2,multi_day_rate_override:0.5}),{budget_days:3,budget_totals_mode:'day1_plus_combined'}),60);
assert.equal(budgetWorkAmountBYN(item('x','Работа',1.1,{quantity:2}),{budget_payment_mode:'byn_cash'}),8);
assert.equal(budgetWorkAmountBYN(item('x','Работа',10),{budget_payment_mode:'byn_noncash'}),51);
assert.equal(budgetWorkAmountBYN(item('x','Доставка оборудования',10),{budget_payment_mode:'byn_noncash'}),38);
assert.equal(personWorkAmount({rate:'15',hours:'3.5'}),52.5);assert.equal(personWorkAmount({rate:'12,5',hours:'2'}),25);assert.equal(personWorkAmount({rate:'bad',hours:'2'}),0);
assert.deepEqual(peopleWorkBalance([{rate:'10',hours:'3'}],50),{amount:30,budgetAmount:50,difference:20});assert.equal(peopleWorkBalance([{rate:'10',hours:'6'}],50).difference,-10);
const all=[item('x','Работа A',10),item('y','Работа B',100,{budget_id:'b'}),item('legacy','Работа legacy',2,{budget_id:null})];assert.deepEqual(documentPeopleWorks(all,{id:'a',is_primary:true,settings:{}}).map(x=>x.name),['Работа A','Работа legacy']);assert.deepEqual(documentPeopleWorks(all,{id:'b',is_primary:false,settings:{}}).map(x=>x.name),['Работа B']);
const {normalizeProjectDetails}=load('src/lib/eventProject.ts');const details={people_budget_id:'b',people_works:[{id:'custom',name:'Особая работа'}]};const normalized=normalizeProjectDetails(details);assert.equal(normalized.people_budget_id,'b');assert.deepEqual(normalized.people_works,details.people_works);
console.log('PASS: estimate-only work list, 60/40 split and cent preservation, duplicate rows, periods, USD/BYN cash/noncash conversion, hourly totals, signed balance, separate estimate variants and custom-work persistence');

assert.equal(rateForWorkAmount(100,'3'),String(100/3));assert.equal(personWorkAmount({rate:rateForWorkAmount(100,'3'),hours:'3'}),100);assert.equal(rateForWorkAmount(100,'0'),null);assert.equal(rateForWorkAmount(100,''),null);assert.equal(rateForWorkAmount(-10,'2'),null);assert.equal(rateForWorkAmount(0,'2'),'0');assert.equal(rateForWorkAmount(25,'2,5'),'10');
console.log('PASS: manual total conversion, non-divisible amounts, zero/empty hours, negative totals and decimal hours');

const {withLoadingWorks,copyPeopleToWork,peopleWorkPriority}=load('src/lib/eventPeople.ts');
let operational=withLoadingWorks([{id:'inst',name:'Монтаж',budgetAmount:60},{id:'dem',name:'Демонтаж',budgetAmount:40}]);assert.deepEqual(operational.map(x=>x.name),['Загрузка','Монтаж','Демонтаж','Разгрузка']);assert.equal(operational.reduce((sum,x)=>sum+x.budgetAmount,0),100);assert.equal(withLoadingWorks(operational).length,4,'Do not duplicate loading jobs');assert.deepEqual(withLoadingWorks([]),[]);
assert.equal(peopleWorkPriority('Разгрузка'),3);
const original={id:'source-person',personnel_id:'p',name:'Иван',group:'team',rate:'12',hours:'5',work_id:'inst',work_name:'Монтаж'};const already={...original,id:'target-person',work_id:'dem',work_name:'Демонтаж',rate:'99'};let serial=0;
let copied=copyPeopleToWork([original],[original],{id:'dem',name:'Демонтаж'},()=>String(++serial));assert.equal(copied.length,2);assert.deepEqual([copied[1].rate,copied[1].hours],['12','5']);assert.notEqual(copied[1].id,original.id);assert.equal(original.work_id,'inst');assert.equal(copyPeopleToWork([original,already],[original],{id:'dem',name:'Демонтаж'},()=>String(++serial)).length,2);assert.equal(already.rate,'99');
const manual={...original,id:'manual',personnel_id:'',name:'Пётр'};copied=copyPeopleToWork([manual],[manual],{id:'dem',name:'Демонтаж'},()=>String(++serial));assert.equal(copyPeopleToWork(copied,[manual],{id:'dem',name:'Демонтаж'},()=>String(++serial)).length,2,'Deduplicate manually entered people by name');
console.log('PASS: loading/unloading order and zero budget allowances; copying preserves source/rates/hours with new IDs and prevents directory/manual duplicates');
