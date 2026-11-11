import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const load=file=>{const exports={};new Function('exports','require',ts.transpile(fs.readFileSync(file,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(exports,name=>name==='./roles'?load('src/lib/roles.ts'):{});return exports;};
const {canEditMainSpecification:edit,canMarkMainSpecification:mark}=load('src/lib/specificationPermissions.ts');
const user=(role,id=role,level)=>({id,role,status:'active',...(level===undefined?{}:{permissions:{specifications:level}})});
assert.equal(mark(user('staff')),true,'Read-only technician can mark main rows');
assert.equal(edit(user('staff'),'other'),false);
assert.equal(edit(user('staff','tech',3),'other'),false,'Custom edit permission alone does not unlock Main');
assert.equal(edit(user('foreman'),'foreman'),true,'Assigned lead can edit');
assert.equal(edit(user('foreman'),'other'),false,'Other lead cannot edit');
assert.equal(edit(user('warehouse'),'other'),false,'Warehouse edit rights do not unlock Main');
assert.equal(edit(user('admin'),'other'),true);
assert.equal(edit(user('superuser'),'other'),true);
assert.equal(mark(user('staff','staff',0)),false,'No module access means no checkboxes');
assert.equal(mark({...user('staff'),status:'inactive'}),false);
assert.equal(edit({...user('admin'),status:'inactive'},'admin'),false);
assert.equal(edit(null,null),false);

// Exercise actual handlers: UI attributes alone must not be the permission boundary.
const source=fs.readFileSync('src/components/WarehouseSpecification.tsx','utf8');
const start=source.indexOf('  const handlePickedChange = async');
const end=source.indexOf('  const handleCablePickedChange',start);
const js=ts.transpile(source.slice(start,end),{target:ts.ScriptTarget.ES2022});
async function toggle({allowed=true,shipped=false,generated=false}={}) {
  const writes=[],states=[];
  const mocks={collaboration:{refresh(){}},canMarkEquipmentRow:()=>allowed,eventDetails:{equipment_shipped:shipped},isGeneratedCompositionItemId:()=>generated,setExpandedItems:fn=>states.push(fn([{budgetItemId:'row',picked:false},{budgetItemId:'sibling',picked:false}])),persistCompositionPickedState:(...args)=>writes.push(args),updateSpecificationBudgetItemPicked:async(...args)=>writes.push(args),showNotification:()=>{throw Error('Unexpected error');}};
  const fn=new Function(...Object.keys(mocks),js+';return handlePickedChange')(...Object.values(mocks));
  await fn('row',true);return {writes,states};
}
assert.equal((await toggle({allowed:false})).writes.length,0);
assert.equal((await toggle({shipped:true})).writes.length,0);
assert.deepEqual((await toggle()).writes,[['row',true]]);
const generated=await toggle({generated:true});assert.deepEqual(generated.writes,[['row',{picked:true}]]);assert.deepEqual(generated.states[0].map(row=>row.picked),[true,false]);
const main=source.slice(source.indexOf("{activeTab === 'budget' && ("),source.indexOf("{activeTab === 'cables' && ("));
assert.ok(main.includes('!canMarkMainSpecification'));
assert.ok(main.includes('canEditMainSpecification && isLedScreenItem'));
assert.ok(main.includes('disabled={!canEditMainSpecification || item.budgetItemId'));
console.log('PASS: technician marking, assigned lead/admin editing, custom permissions, disabled users, handler guards and independent child marks');

const rowStart=source.indexOf('  const canEditEquipmentRow =');
const rowEnd=source.indexOf('  const canMarkEquipmentRow =',rowStart);
const rowJs=ts.transpile(source.slice(rowStart,rowEnd),{target:ts.ScriptTarget.ES2022});
const rowPermission=(main,extra)=>new Function('expandedItems','budgetItems','canEditSpecification','canEditMainSpecification',rowJs+';return canEditEquipmentRow;')([{budgetItemId:'extra',isExtra:true}],[{id:'hidden-virtual-parent'}],extra,main);
assert.equal(rowPermission(true,false)('hidden-virtual-parent'),true,'Assigned lead can save children of a hidden virtual parent');
assert.equal(rowPermission(false,true)('hidden-virtual-parent'),false,'Extra edit permission does not unlock hidden Main parent');
assert.equal(rowPermission(false,true)('extra'),true,'Extra permissions are unchanged');
const persistStart=source.indexOf('  const persistCompositionPickedState =');
const persistEnd=source.indexOf('  const handlePickedChange =',persistStart);
const persistJs=ts.transpile(source.slice(persistStart,persistEnd),{target:ts.ScriptTarget.ES2022});
const snapshots=[];
const remoteWrites=[];
const persistMocks={budgetId:'budget',eventId:'event',expandedItems:[{budgetItemId:'parent-comp-link-component',parentBudgetItemId:'parent',name:'Компонент'}],getPersistedBudgetItemId:()=> 'parent',saveGeneratedRowMark:async(...args)=>remoteWrites.push(args),readCompositionPickedSnapshot:()=>({}),writeCompositionPickedSnapshot:(id,snapshot)=>snapshots.push(snapshot),collaboration:{refresh(){}}};
const persist=new Function(...Object.keys(persistMocks),persistJs+';return persistCompositionPickedState;')(...Object.values(persistMocks));
await persist('parent-comp-link-component',{picked:true});
assert.equal(snapshots[0]['parent-comp-link-component'].picked,true);
assert.deepEqual(remoteWrites,[['event','budget','parent','parent-comp-link-component','picked',true,'Компонент']]);
console.log('PASS: hidden virtual parent saves, preserved Extra rights and checkbox-only changes never queue structural saves');
