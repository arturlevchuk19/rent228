import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=fs.readFileSync('src/components/WarehouseSpecification.tsx','utf8');
const from=source.indexOf('  const handleDeleteSpecificationItem =');
const to=source.indexOf('  const requestDeleteSpecificationItem =',from);
const code=ts.transpile(source.slice(from,to),{target:ts.ScriptTarget.ES2022});
const parent='11111111-1111-4111-8111-111111111111';
const suffix=/(-comp-.*|-mod-.*|-case-.*|-kitcase-.*|-podium-.*)$/;
async function remove(id,{fail=false,allowed=true}={}){
 const generated=suffix.test(id);
 let rows=[{budgetItemId:parent},{budgetItemId:id,parentBudgetItemId:parent},{budgetItemId:parent+'-comp-sibling',parentBudgetItemId:parent},{budgetItemId:'other'}];
 let budget=[{id:parent},{id:'saved-child',parent_budget_item_id:parent},{id:'other'}];
 let modified=new Set([parent,'saved-child']);const calls=[];const notices=[];
 const mocks={canEditSpecification:allowed,canAccess:()=>allowed,user:{},eventDetails:{equipment_shipped:false},expandedItems:rows,isGeneratedCompositionItemId:id=>suffix.test(id),getPersistedBudgetItemId:id=>id.replace(suffix,''),eventId:'event',excludeSpecificationChild:async(...args)=>{calls.push(['exclude',...args]);if(fail)throw Error('offline');},deleteSpecificationBudgetItem:async id=>{calls.push(['delete',id]);if(fail)throw Error('offline');},setBudgetItems:fn=>budget=fn(budget),setExpandedItems:fn=>rows=fn(rows),setModifiedItems:fn=>modified=fn(modified),showNotification:(...args)=>notices.push(args),getErrorMessage:e=>e.message,console:{error(){}}};
 const fn=new Function(...Object.keys(mocks),code+';return handleDeleteSpecificationItem')(...Object.values(mocks));await fn(id);return {rows,budget,modified,calls,notices,generated};
}
for(const kind of ['comp','mod','case','kitcase','podium']){
 const id=parent+'-'+kind+'-source';const result=await remove(id);
 assert.deepEqual(result.calls,[['exclude','event',parent,id]]);
 assert.ok(result.rows.some(r=>r.budgetItemId===parent));assert.ok(result.rows.some(r=>r.budgetItemId===parent+'-comp-sibling'));assert.ok(!result.rows.some(r=>r.budgetItemId===id));
 assert.deepEqual(result.budget.find(r=>r.id===parent).excluded_child_keys,[id]);assert.ok(result.modified.has(parent));
 // Reload uses stored exclusions, while keeping the original parent and siblings.
 const excluded=new Set(result.budget.flatMap(r=>r.excluded_child_keys||[]));
 const regenerated=[parent,id,parent+'-comp-sibling'].filter(key=>!excluded.has(key));assert.deepEqual(regenerated,[parent,parent+'-comp-sibling']);
}
const persisted=await remove('saved-child');assert.deepEqual(persisted.calls,[['delete','saved-child']]);assert.ok(persisted.budget.some(r=>r.id===parent));assert.ok(persisted.rows.some(r=>r.budgetItemId===parent+'-comp-sibling'));
const failed=await remove(parent+'-comp-a',{fail:true});assert.ok(failed.rows.some(r=>r.budgetItemId===parent+'-comp-a'));assert.equal(failed.budget[0].excluded_child_keys,undefined);assert.equal(failed.notices[0][0],'offline');
assert.deepEqual((await remove(parent+'-comp-a',{allowed:false})).calls,[]);
console.log('PASS: generated and persisted child removal, parent/sibling preservation, reload exclusions, permission checks and failure recovery.');
