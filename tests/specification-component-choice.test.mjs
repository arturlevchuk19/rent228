import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=fs.readFileSync('src/components/WarehouseSpecification.tsx','utf8');
const buildStart=source.indexOf('  const buildCaseExpandedItems =');
const buildEnd=source.indexOf('  const hasModifications =',buildStart);
const buildCode=ts.transpile(source.slice(buildStart,buildEnd),{target:ts.ScriptTarget.ES2022});
const build=new Function(buildCode+';return buildCaseExpandedItems;')();
const choiceStart=source.indexOf('  const handleComponentDecision =');
const choiceEnd=source.indexOf('  // Сохраняет отметку виртуального',choiceStart);
const choiceCode=ts.transpile(source.slice(choiceStart,choiceEnd),{target:ts.ScriptTarget.ES2022});
const group={items:[{budgetItemId:'one',equipmentId:'mic',name:'Микрофон',quantity:5,locationId:'hall',categoryId:'sound',picked:false,return_picked:false,isExtra:false,caseCapacityByCaseId:{kit:4}},{budgetItemId:'two',equipmentId:'receiver',name:'Приёмник',quantity:2,caseCapacityByCaseId:{kit:2}}]};
const kit={caseId:'kit',caseName:'Кейс микрофонов',caseSku:'MIC',componentQuantityInCase:4};
assert.equal(build(group,kit)[0].quantity,2);
async function run({selected=null,fail=false,allowed=true,busy=false}={}){
 const writes=[],reloads=[],notices=[];let saving=false;
 const mocks={componentDecisionQueue:[group],activeComponentDecisionIndex:0,savingComponentChoice:busy,canEditSpecification:allowed,setSavingComponentChoice:v=>saving=v,buildCaseExpandedItems:build,eventId:'event',saveSpecificationComponentChoice:async(...args)=>{writes.push(args);if(fail)throw Error('Database unavailable');},expandedItems:[{budgetItemId:'unrelated',quantity:3,notes:'Keep edits'}],modifiedItems:new Set(['unrelated']),showNotification:(...args)=>notices.push(args),loadData:async(...args)=>reloads.push(args),getErrorMessage:e=>e.message};
 const handler=new Function(...Object.keys(mocks),choiceCode+';return handleComponentDecision;')(...Object.values(mocks));await handler(selected);return {writes,reloads,notices,saving};
}
const separate=await run();assert.deepEqual(separate.writes,[['event',['one','two'],null]]);assert.equal(separate.reloads.length,1);assert.equal(separate.saving,false);
const replaced=await run({selected:kit});assert.equal(replaced.writes[0][2].name,'Кейс микрофонов');assert.equal(replaced.writes[0][2].quantity,2);assert.equal(replaced.reloads[0][0][0].notes,'Keep edits');
const failed=await run({selected:kit,fail:true});assert.equal(failed.reloads.length,0);assert.equal(failed.saving,false);assert.match(failed.notices[0][0],/Database unavailable/);
assert.equal((await run({allowed:false})).writes.length,0);assert.equal((await run({busy:true})).writes.length,0);
// Exercise the actual database adapter, including explicit migration errors.
const lib=fs.readFileSync('src/lib/warehouseSpecification.ts','utf8');const start=lib.indexOf('export async function saveSpecificationComponentChoice');
const code=ts.transpile(lib.slice(start),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
let rpcArgs;const exports={};let rpcError=null;
new Function('exports','supabase',code)(exports,{rpc:async(...args)=>{rpcArgs=args;return {error:rpcError};}});
await exports.saveSpecificationComponentChoice('event',['one'],null);assert.deepEqual(rpcArgs,['save_specification_component_choice',{p_event_id:'event',p_item_ids:['one'],p_case:null}]);
rpcError={code:'PGRST202'};await assert.rejects(exports.saveSpecificationComponentChoice('event',['one'],null),/20261029000000/);
console.log('PASS: separate/case persistence, case quantity, failure recovery, permissions and RPC payload.');
