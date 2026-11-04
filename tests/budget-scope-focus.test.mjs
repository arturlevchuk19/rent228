import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
let user={id:'account',role:'admin',status:'active'},states=[],stateIndex=0,effectIndex=0,effects=[],pending=[],loads=0,created=0;
const hooks={useState:initial=>{const i=stateIndex++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useEffect:(fn,deps)=>{const i=effectIndex++;const old=effects[i];if(!old||deps.some((d,j)=>!Object.is(d,old.deps[j]))){old?.cleanup?.();effects[i]={deps};pending.push(()=>{effects[i].cleanup=fn();});}}};
const exports={};new Function('exports','require',ts.transpile(fs.readFileSync('src/components/BudgetScope.tsx','utf8'),{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(exports,name=>{
 if(name==='react')return hooks;
 if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(name.includes('authContext'))return {useAuth:()=>({user})};
 if(name.includes('roles'))return {canAccess:()=>true};
 if(name.includes('errors'))return {getErrorMessage:String};
 if(name.includes('eventBudgets'))return {getEventBudgets:async()=>{loads++;return [{id:'budget-a',name:'A'},{id:'budget-b',name:'B'}];},createEventBudget:async()=>{created++;}};
 throw Error(name);
});
const render=(budgetId='budget-a')=>{stateIndex=0;effectIndex=0;const result=exports.BudgetScope({eventId:'event',budgetId,onClose:()=>{},children:(id,name)=>({editor:id,name})});pending.splice(0).forEach(fn=>fn());return result;};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
render();await flush();assert.equal(render().editor,'budget-a');assert.equal(loads,1);
for(let i=0;i<10;i++){user={...user,permissions:{budgets:3}};assert.equal(render().editor,'budget-a');await flush();}
assert.equal(loads,1,'Focus/token refresh with an equivalent user must not reload or remount the editor');assert.equal(created,0);
render('budget-b');await flush();assert.equal(render('budget-b').editor,'budget-b');assert.equal(loads,2,'Changing budget still resolves the new document');
user={...user,id:'other-account'};render('budget-b');await flush();assert.equal(loads,3,'Switching accounts still reloads');
console.log('PASS: repeated focus/auth refresh preserves resolved editor; budget and account changes reload correctly');
