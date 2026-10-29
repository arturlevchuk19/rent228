import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const queries=[];
let results=[];
const client={from(table){const calls=[['from',table]];queries.push(calls);const query=new Proxy({}, {get(_,method){if(method==='then')return(resolve)=>resolve(results.shift()||{data:[],error:null});return(...args)=>{calls.push([method,...args]);return query;};}});return query;}};
const load=path=>{const exports={};new Function('exports','require',ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(exports,()=>({supabase:client}));return exports;};
const events=load('src/lib/events.ts'),spec=load('src/lib/warehouseSpecification.ts'),cats=load('src/lib/categories.ts'),locs=load('src/lib/locations.ts');
const eventId='11111111-1111-4111-8111-111111111111',budgetId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await events.getBudgetItems(eventId,budgetId);assert.ok(queries.at(-1).some(([method,arg])=>method==='or'&&arg.includes(budgetId)));
for(const name of ['getCables','getConnectors','getOtherItems','getSpecificationBudgetItems']){await spec[name](eventId,budgetId);assert.ok(queries.at(-1).some(([method,key,value])=>method==='eq'&&key==='budget_id'&&value===budgetId),name);}
await cats.getCategoriesForEvent(eventId,budgetId);assert.ok(queries.at(-1).some(([method,arg])=>method==='or'&&arg.includes(budgetId)));
await locs.getLocationsForEvent(eventId,budgetId);assert.ok(queries.at(-1).some(([method,arg])=>method==='or'&&arg.includes(budgetId)));
await events.updateBudgetItemsExchangeRate(eventId,3.2,budgetId);assert.ok(queries.at(-1).some(([method,key,value])=>method==='eq'&&key==='budget_id'&&value===budgetId));
const start=queries.length;results=[{count:0,error:null},{data:[],error:null}];await spec.ensureWarehouseSpecificationSnapshot(eventId,budgetId);for(const query of queries.slice(start))assert.ok(query.some(([method,key,value])=>method==='eq'&&key==='budget_id'&&value===budgetId),'Snapshot source and destination must use the same budget');
const {eventProgress}=load('src/lib/eventProgress.ts');assert.deepEqual(eventProgress('Запрос',0),{progress_budget_done:false,progress_equipment_reserved:false,progress_project_completed:false});assert.deepEqual(eventProgress('Подтверждено',1),{progress_budget_done:true,progress_equipment_reserved:true,progress_project_completed:false});assert.deepEqual(eventProgress('Выполнено',2),{progress_budget_done:true,progress_equipment_reserved:true,progress_project_completed:true});
console.log('PASS: scoped budget/specification/catalog queries, exchange rate isolation, snapshot isolation and automatic progress.');
