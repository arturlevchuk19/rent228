import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const js=ts.transpile(fs.readFileSync('src/lib/budgetAutosave.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
const {createBudgetAutosave}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const base={discount:0,days:1,note:'',rate:3};
let writes=[],states=[],pendingDraft,fail=false;
const queue=createBudgetAutosave(async patch=>{if(fail)throw Error('offline');writes.push(patch);},(status,error,pending)=>{states.push([status,error?.message]);pendingDraft=pending;},10000);
queue.initialize(base);queue.stage(base);await queue.flush();assert.deepEqual(writes,[],'Opening an estimate must not save default values over server data');
for(let i=1;i<=25;i++)queue.stage({...base,note:String(i)});
await queue.flush();assert.deepEqual(writes,[{note:'25'}],'Typing coalesces and only changed fields are patched');
queue.stage({...base,note:'25',days:2,rate:3.5});await queue.flush();assert.deepEqual(writes.at(-1),{days:2,rate:3.5});
fail=true;queue.stage({...base,note:'offline',days:2,rate:3.5});await assert.rejects(queue.flush(),/offline/);assert.deepEqual(states.at(-1),['error','offline']);assert.deepEqual(pendingDraft,{note:'offline'},'Recovery caches only unsaved fields, preserving changes made on other devices');
fail=false;await queue.flush();assert.deepEqual(writes.at(-1),{note:'offline'});assert.equal(states.at(-1)[0],'saved');
// New edits arriving during a request must follow it; reverting while a request is in flight must persist the revert too.
let release;const pending=new Promise(r=>release=r);const ordered=[];
const serial=createBudgetAutosave(async patch=>{ordered.push(patch);if(ordered.length===1)await pending;},()=>{},10000);
serial.initialize(base);serial.stage({...base,discount:10});const running=serial.flush();
serial.stage({...base,discount:20});serial.stage(base);release();await running;await serial.flush();assert.deepEqual(ordered,[{discount:10},{discount:0}]);
// Separate estimates have separate baselines and never copy another estimate's fields.
const isolated=[];const other=createBudgetAutosave(async patch=>isolated.push(patch),()=>{},10000);other.initialize({...base,note:'Other'});other.stage({...base,note:'Other',days:7});await other.flush();assert.deepEqual(isolated,[{days:7}]);
// The debounce also saves without callers invoking flush (typing/pasting then waiting).
const automatic=[];const auto=createBudgetAutosave(async patch=>automatic.push(patch),()=>{},5);auto.initialize(base);auto.stage({...base,note:'Automatic'});await new Promise(r=>setTimeout(r,15));assert.deepEqual(automatic,[{note:'Automatic'}]);
console.log('PASS: no writes on initial load, automatic save, typing coalescing, field patches, flush on close, serialized writes/reverts, error retry and estimate isolation.');
