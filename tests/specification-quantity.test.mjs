import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const js=ts.transpile(fs.readFileSync('src/lib/specificationQuantity.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
const {createQuantityQueue,writeGroupedQuantity,createOptimisticQuantityQueue}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const queue=createQuantityQueue();let rows=[],created=0,fail=false;const db=new Map();
const delay=()=>new Promise(r=>setTimeout(r,1));
const commit=row=>{rows=rows.some(r=>r.id===row.id)?rows.map(r=>r.id===row.id?row:r):[...rows,row];};
const write=change=>queue('splitter',()=>writeGroupedQuantity({rows:[...rows],change,
 create:async quantity=>{await delay();if(fail)throw Error('offline');const row={id:'row'+(++created),quantity,notes:'keep'};db.set(row.id,row);return row;},
 update:async(id,quantity)=>{await delay();if(fail)throw Error('offline');const row={...db.get(id),quantity};db.set(id,row);return row;},commit}));
await Promise.all(Array.from({length:25},()=>write({delta:1})));
assert.equal(rows.reduce((s,r)=>s+r.quantity,0),25);assert.equal(created,1,'Rapid clicks must not create duplicate rows');
// Older duplicated data: the entered quantity is the total, not a value added to duplicates.
const duplicate={id:'old-duplicate',quantity:1,notes:'Legacy note'};rows.push(duplicate);db.set(duplicate.id,duplicate);
await write({set:5});assert.equal(rows.reduce((s,r)=>s+r.quantity,0),5);assert.equal(rows.find(r=>r.id===duplicate.id).quantity,0);assert.equal(db.get(duplicate.id).notes,'Legacy note');
await write({delta:1});assert.equal(rows.reduce((s,r)=>s+r.quantity,0),6);
await write({set:0});await write({delta:1});assert.equal(rows.reduce((s,r)=>s+r.quantity,0),1);assert.equal(created,1);
// Committing an input and then clicking plus applies the increment once.
await Promise.all([write({set:4}),write({delta:1})]);assert.equal(rows.reduce((s,r)=>s+r.quantity,0),5);
fail=true;await assert.rejects(write({set:8}),/offline/);fail=false;await write({set:5});assert.equal(rows.reduce((s,r)=>s+r.quantity,0),5);
// One rejected queue must neither block a retry nor a different row.
let separate=0;await queue('other',async()=>{separate=1;});assert.equal(separate,1);
console.log('PASS: 25 rapid increments, no duplicate creation, exact manual totals with old duplicates, zero/reset, blur + click, errors and independent rows.');

const optimistic=createOptimisticQuantityQueue();
let confirmed=[],insertions=0,errors=0,reject=false,release;
let firstCreate=true;
const confirmedTotal=()=>confirmed.reduce((sum,row)=>sum+row.quantity,0);
const display=()=>optimistic.value('template',confirmedTotal());
const observed=[];
const commitConfirmed=row=>{confirmed=confirmed.some(old=>old.id===row.id)?confirmed.map(old=>old.id===row.id?row:old):[...confirmed,row];};
const change=change=>optimistic.change('template',change,{read:confirmedTotal,notify:()=>observed.push(display()),failed:()=>errors++,settled(){},save:quantity=>writeGroupedQuantity({rows:[...confirmed],change:{set:quantity},commit:commitConfirmed,
 create:async quantity=>{if(firstCreate){firstCreate=false;await new Promise(resolve=>release=resolve);}if(reject)throw Error('Rejected');return {id:'created-'+(++insertions),quantity,notes:'Preserve'};},
 update:async(id,quantity)=>{await delay();if(reject)throw Error('Rejected');return {...confirmed.find(row=>row.id===id),quantity};}})});
const burst=Array.from({length:25},()=>change({delta:1}));
assert.equal(display(),25,'All 25 clicks appear before any server response');assert.equal(insertions,0);assert.equal(optimistic.hasPending(),true);
await delay();release();await Promise.all(burst);
assert.equal(insertions,1,'Optimistic empty rows still create exactly once');assert.equal(confirmedTotal(),25);assert.equal(display(),25);assert.equal(optimistic.hasPending(),false);
assert.ok(observed.every((value,index)=>index===0||value>=observed[index-1]),'Old responses cannot move the displayed total backwards');
const manual=change({set:4});const plus=change({delta:1});assert.equal(display(),5,'Blur and plus apply immediately and in order');await Promise.all([manual,plus]);assert.equal(confirmedTotal(),5);
reject=true;const failed=change({set:99});assert.equal(display(),99);await failed;assert.equal(display(),5,'Failed latest request rolls back to confirmed rows');assert.equal(errors,1);reject=false;
await change({delta:1});assert.equal(display(),6);
confirmed.push({id:'legacy',quantity:2,notes:'Keep duplicate note'});
const legacy=change({set:3});assert.equal(display(),3);await legacy;assert.equal(confirmedTotal(),3);assert.equal(confirmed.find(row=>row.id==='legacy').quantity,0);assert.equal(confirmed.find(row=>row.id==='legacy').notes,'Keep duplicate note');
assert.throws(()=>change({set:NaN}),/количество/);assert.equal(optimistic.hasPending(),false);
console.log('PASS: instant totals before server response, 25 queued clicks, one insert, no stale-number jitter, manual blur + plus, rollback/retry and legacy duplicates');
