import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const queries=[];
let results=[];
const rpcCalls=[];
const client={async rpc(name,args){rpcCalls.push([name,args]);return {error:null};},from(table){const calls=[['from',table]];queries.push(calls);const query=new Proxy({}, {get(_,method){if(method==='then')return(resolve)=>resolve(results.shift()||{data:[],error:null});return(...args)=>{calls.push([method,...args]);return query;};}});return query;}};
const load=path=>{const exports={};new Function('exports','require',ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(exports,()=>({supabase:client}));return exports;};
const events=load('src/lib/events.ts'),spec=load('src/lib/warehouseSpecification.ts'),cats=load('src/lib/categories.ts'),locs=load('src/lib/locations.ts');
const eventId='11111111-1111-4111-8111-111111111111',budgetId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const { getBudgetCopySources, copyEventBudget } = load('src/lib/eventBudgets.ts');
const firstPage = Array.from({ length: 200 }, (_, index) => ({
  id: String(index),
  sourceBudgets: [{ id: `budget-${index}`, name: 'Смета' }],
}));
const lastSource = { id: eventId, sourceBudgets: [{ id: budgetId, name: 'Исходная смета' }] };
results.push({ data: firstPage, error: null }, { data: [lastSource], error: null });
const sources = await getBudgetCopySources();
assert.equal(sources.length, 201);
assert.deepEqual(sources.at(-1), lastSource);
assert.deepEqual(queries.slice(-2).map(calls => calls.find(([method]) => method === 'range')), [
  ['range', 0, 199], ['range', 200, 399],
]);
assert.ok(queries.slice(-2).every(calls => calls.some(([method, fields]) =>
  method === 'select' && fields.includes('sourceBudgets:event_budgets!inner')
)));
const targetEventId = '22222222-2222-4222-8222-222222222222';
await copyEventBudget(budgetId, targetEventId);
assert.deepEqual(rpcCalls.pop(), ['copy_event_budget', {
  p_source_budget_id: budgetId, p_target_event_id: targetEventId, p_name: null,
}]);
await events.getBudgetItems(eventId,budgetId);assert.ok(queries.at(-1).some(([method,arg])=>method==='or'&&arg.includes(budgetId)));
for(const name of ['getCables','getConnectors','getOtherItems','getSpecificationBudgetItems']){await spec[name](eventId,budgetId);assert.ok(queries.at(-1).some(([method,key,value])=>method==='eq'&&key==='budget_id'&&value===budgetId),name);}
await cats.getCategoriesForEvent(eventId,budgetId);assert.ok(queries.at(-1).some(([method,arg])=>method==='or'&&arg.includes(budgetId)));
await locs.getLocationsForEvent(eventId,budgetId);assert.ok(queries.at(-1).some(([method,arg])=>method==='or'&&arg.includes(budgetId)));
await events.updateBudgetItemsExchangeRate(eventId,3.2,budgetId);assert.ok(queries.at(-1).some(([method,key,value])=>method==='eq'&&key==='budget_id'&&value===budgetId));
await spec.ensureWarehouseSpecificationSnapshot(eventId,budgetId);
await spec.resetWarehouseSpecificationSnapshot(eventId,budgetId);
assert.deepEqual(rpcCalls,[false,true].map(reset=>['rebuild_warehouse_specification_snapshot',{p_event_id:eventId,p_budget_id:budgetId,p_reset:reset}]));
const {eventProgress}=load('src/lib/eventProgress.ts');assert.deepEqual(eventProgress('Запрос',0),{progress_budget_done:false,progress_equipment_reserved:false,progress_project_completed:false});assert.deepEqual(eventProgress('Подтверждено',1),{progress_budget_done:true,progress_equipment_reserved:true,progress_project_completed:false});assert.deepEqual(eventProgress('Выполнено',2),{progress_budget_done:true,progress_equipment_reserved:true,progress_project_completed:true});
console.log('PASS: scoped budget/specification/catalog queries, exchange rate isolation, snapshot isolation and automatic progress.');
