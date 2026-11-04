import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const load=path=>{const exports={};new Function('exports','require',ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(exports,()=>({dayNumber:()=>null}));return exports;};
const peopleAPI=load('src/lib/eventPeople.ts');
const {orderedPeopleWorks,peopleWorkRate,addWorkPeople}=peopleAPI;
const works=[{id:'warehouse',name:'Работа на складе'},{id:'other',name:'Звукорежиссёр'},{id:'dem',name:'Демонтаж'},{id:'inst',name:'Монтаж'}];
assert.deepEqual(orderedPeopleWorks(works).slice(0,2).map(x=>x.name),['Монтаж','Демонтаж']);assert.deepEqual(orderedPeopleWorks([]).map(x=>x.name),['Монтаж','Демонтаж']);
const staff={id:'one',full_name:'Иван',installation_rate:15,warehouse_rate:10};const freelance={id:'two',full_name:'Пётр',employment_type:'freelance',installation_rate:20,warehouse_rate:12};
let id=0;const next=()=>String(++id);const rows=addWorkPeople([], [staff,freelance],{id:'inst',name:'Монтаж'},next);
assert.deepEqual(rows.map(row=>[row.group,row.rate,row.hours]),[['team','15',''],['freelance','20','']]);assert.equal(peopleWorkRate(staff,'Работа на складе'),'10');assert.equal(peopleWorkRate(staff,'Демонтаж'),'15');
assert.equal(addWorkPeople(rows,[staff],{id:'inst',name:'Монтаж'},next).length,2,'Never duplicate the same person in one job');assert.equal(addWorkPeople(rows,[staff],{id:'dem',name:'Демонтаж'},next).length,3,'Same person may do multiple jobs');
const {normalizeProjectDetails,validateProjectDetails}=load('src/lib/eventProject.ts');const project=normalizeProjectDetails({people:rows.map(row=>({...row,hours:'3.5'}))});assert.deepEqual(project.people,rows.map(row=>({...row,hours:'3.5'})));assert.equal(validateProjectDetails(project,'',''),null);assert(validateProjectDetails({...project,people:[{...project.people[0],hours:'-1'}]},'',''));assert(validateProjectDetails({...project,people:[{...project.people[0],hours:'NaN'}]},'',''));
// Exercise the actual two-stage picker with React state and JSX rendered as plain records.
let states=[],index=0,currentRows=[],customWorks=[];const exports={};const jsx=(type,props)=>({type,props});
new Function('exports','require',ts.transpile(fs.readFileSync('src/components/EventPeoplePanel.tsx','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}))(exports,name=>{
 if(name==='react')return {useState:value=>{const i=index++;if(!(i in states))states[i]=value;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];},useEffect:()=>{},useRef:value=>({current:value})};
 if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};if(name==='react-dom')return {createPortal:x=>x};
 if(name.endsWith('eventPeople'))return peopleAPI;if(name.endsWith('eventProject'))return {newProjectId:next};return {};
});
const render=()=>{index=0;return exports.EventPeoplePanel({people:currentRows,personnel:[staff,freelance],assigned:[],works,editable:true,error:'',onChange:rows=>currentRows=rows,customWorks,onCustomWorksChange:rows=>customWorks=rows});};
const nodes=n=>Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children),...nodes(n.props?.titleActions)]:[];
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props?.children):typeof n==='string'?n:'';
let tree=nodes(render());tree.find(n=>n.type==='button'&&text(n).includes('Добавить')).props.onClick();tree=nodes(render());tree.find(n=>n.type==='button'&&text(n).startsWith('Монтаж')&&n.props['aria-expanded']===undefined).props.onClick();tree=nodes(render());tree.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});tree=nodes(render());tree.find(n=>n.props?.role==='tab'&&text(n)==='Фриланс').props.onClick();tree=nodes(render());tree.find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});tree=nodes(render());tree.find(n=>n.type==='button'&&text(n).includes('Добавить выбранных')).props.onClick();assert.equal(currentRows.length,2);assert.deepEqual(currentRows.map(x=>x.work_name),['Монтаж','Монтаж']);assert(currentRows.some(x=>x.group==='freelance'));assert.equal(states[0],false);
console.log('PASS: job ordering, staff/freelance defaults, warehouse/install rates, deduplication, separate jobs, hours persistence/validation and two-step multi-tab checkbox picker');

// New work creation is part of the event, not an unrelated catalogue entry.
tree=nodes(render());tree.find(n=>n.type==='button'&&text(n)==='Добавить').props.onClick();tree=nodes(render());tree.find(n=>n.props?.['aria-label']==='Название новой работы').props.onChange({target:{value:'Новая работа'}});tree=nodes(render());tree.find(n=>n.type==='button'&&text(n)==='Добавить работу').props.onClick();assert.equal(customWorks[0].name,'Новая работа');assert.equal(states[1].name,'Новая работа');
console.log('PASS: custom work is saved to event and opens employee selection');
