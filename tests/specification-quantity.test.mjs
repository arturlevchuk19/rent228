import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const js=ts.transpile(fs.readFileSync('src/lib/specificationQuantity.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
const {createQuantityQueue,writeGroupedQuantity}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
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
