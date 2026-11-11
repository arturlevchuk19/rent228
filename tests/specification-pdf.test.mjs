import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);const cache=new Map();
const load=(file,mocks={})=>{if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);new Function('exports','require',ts.transpile(fs.readFileSync(file,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}))(exports,name=>{if(name in mocks)return mocks[name];if(name.startsWith('.'))return load(path.join(path.dirname(file),name+'.ts'),mocks);return require(name);});return exports;};
const scopeCalls=[];
const mocks=Object.fromEntries(['./eventBudgets','./equipmentCompositions','./equipment','./categories','./locations','./warehouseSpecification'].map(name=>[name,{}]));
Object.assign(mocks, {
 './supabase':{supabase:{}},
 './events':{getBudgetItems:async(event,budget)=>{scopeCalls.push(['services',event,budget]);return [{id:'service1',item_type:'work',quantity:2,work_item:{name:'Доставка',unit:'рейс'},notes:'После монтажа'}];}},
 './eventBudgets':{getBudgetEvent:async(event,budget)=>{scopeCalls.push(['event',event,budget]);return {name:'Событие',status:'Подтверждено'};}},
 './equipmentCompositions':{getEquipmentCompositions:async()=>[]}, './equipment':{getModificationComponents:async()=>[]},
 './categories':{getCategories:async()=>[],getCategoriesForEvent:async()=>[]}, './locations':{getLocationsForEvent:async()=>[]},
 './warehouseSpecification':{
  ensureWarehouseSpecificationSnapshot:async(event,budget)=>scopeCalls.push(['initialize',event,budget]),
  getSpecificationBudgetItems:async(event,budget)=>{scopeCalls.push(['items',event,budget]);return [];},
  getCables:async(event,budget)=>{scopeCalls.push(['cables',event,budget]);return [{cable_type:'PowerCON',cable_length:'10м',quantity:2,notes:'A'},{cable_type:'PowerCON',cable_length:'10м',quantity:3,notes:'B'}];},
  getConnectors:async(event,budget)=>{scopeCalls.push(['connectors',event,budget]);return [{connector_type:'Аксессуары::Сплиттер X6',quantity:4,notes:''}];},
  getOtherItems:async(event,budget)=>{scopeCalls.push(['other',event,budget]);return [{category:'Ремешки',item_type:'0.5м',quantity:1,notes:''},{category:'Ремешки',item_type:'1м',quantity:0,notes:''}];}
 }
});
const {buildSpecificationEquipmentRows,loadSpecificationExport}=load('src/lib/specificationExport.ts',mocks);
const parent={id:'parent',item_type:'equipment',equipment_id:'rack',quantity:2,category_id:'sound',location_id:'hall',notes:'Примечание',equipment:{name:'Комплект',object_type:'virtual'},excluded_child_keys:['parent-comp-a-eq-a']};
const items=[parent,{id:'physical',item_type:'equipment',quantity:3,equipment:{name:'Колонка',sku:'SKU',object_type:'physical'}},{id:'screen',item_type:'equipment',quantity:1,equipment:{name:'Светодиодный экран',object_type:'virtual'}},{id:'child',parent_budget_item_id:'screen',item_type:'equipment',name:'Кейс',quantity:2},{id:'work',item_type:'work',quantity:5,name:'Работа'},{id:'zero',item_type:'equipment',name:'Ноль',quantity:0}];
const comp=new Map([['rack',[{id:'a',child_id:'eq-a',quantity:1,child_name:'Исключённый'},{id:'b',child_id:'eq-b',quantity:4,child_name:'Микрофон',child_sku:'MIC',child_category:'Звук'}]]]);
const rows=buildSpecificationEquipmentRows(items,comp,new Map(),new Map([['sound','Звуковое оборудование']]),new Map([['hall','Главная сцена']]));
assert.equal(rows.length,4);assert.equal(rows[0].name,'Микрофон');assert.equal(rows[0].quantity,8);assert.match(rows[0].group,/Главная сцена/);assert.ok(!rows.some(r=>r.name==='Исключённый'||r.name==='Работа'||r.name==='Ноль'));
assert.equal(rows[0].group, 'Главная сцена / Звуковое оборудование');
assert.equal(rows[1].group, 'Прочее');
assert.ok(rows.every(row => !row.group.startsWith('Оборудование /') && !row.group.includes('Без локации')));
const loaded=await loadSpecificationExport('event-A','budget-B',true);
assert.ok(scopeCalls.every(([,event,budget])=>event==='event-A'&&budget==='budget-B'));
assert.equal(loaded.rows.find(row=>row.name==='10м').quantity,5);assert.equal(loaded.rows.find(row=>row.name==='10м').notes,'A\nB');
assert.equal(loaded.rows.find(row=>row.name==='Сплиттер X6').quantity,4);assert.ok(loaded.rows.some(row=>row.name==='0.5м'));assert.ok(!loaded.rows.some(row=>row.name==='1м'));
assert.ok(!loaded.rows.some(row=>row.name==='Доставка'),'No standalone all-services block');
// Export must use the budget category/location order, even when snapshot rows
// arrive in a different order (sort_order is local to each category).
mocks['./categories'].getCategories = async () => [{id:'global',name:'Общая'}];
mocks['./categories'].getCategoriesForEvent = async () => [{id:'sound',name:'Звук'}, {id:'light',name:'Свет'}];
mocks['./locations'].getLocationsForEvent = async () => [{id:'hall',name:'Зал'}, {id:'stage',name:'Сцена'}];
mocks['./warehouseSpecification'].getSpecificationBudgetItems = async () => [
  {id:'light',item_type:'equipment',category_id:'light',location_id:'hall',name:'Светильник',quantity:1,sort_order:0},
  {id:'none',item_type:'equipment',category_id:'sound',name:'Без площадки',quantity:1,sort_order:0},
  {id:'stage',item_type:'equipment',category_id:'sound',location_id:'stage',name:'Сценический звук',quantity:1,sort_order:0},
  {id:'sound',item_type:'equipment',category_id:'sound',location_id:'hall',name:'Колонка',quantity:1,sort_order:5},
  {id:'global',item_type:'equipment',category_id:'global',location_id:'hall',name:'Общая позиция',quantity:1,sort_order:10}
];
const orderedExport = await loadSpecificationExport('event-A','budget-B',false);
assert.deepEqual(orderedExport.rows.slice(0,5).map(row=>row.group), ['Зал / Общая','Зал / Звук','Зал / Свет','Сцена / Звук','Звук']);
const {budgetSpecificationPreview,specificationIsEditable,getSpecificationDifferences}=load('src/lib/specificationServices.ts');
assert.equal(specificationIsEditable('Запрос'),false);
assert.equal(specificationIsEditable('Подтверждено'),true);
const source={id:'eq1',item_type:'equipment',equipment_id:'e1',quantity:2};
const saved={...source,id:'spec1',source_budget_item_id:'eq1'};
assert.equal(getSpecificationDifferences([source],[saved]).length,0);
assert.equal(getSpecificationDifferences([{...source,quantity:3}],[saved])[0].kind,'update');
assert.equal(getSpecificationDifferences([source],[])[0].kind,'add');
assert.equal(getSpecificationDifferences([],[saved])[0].kind,'remove');
assert.equal(budgetSpecificationPreview([{...source,picked:true}])[0].picked,false);
assert.equal(budgetSpecificationPreview([source])[0].source_budget_item_id,'eq1');
const extraRows=buildSpecificationEquipmentRows([{...source,category_id:'extra',is_extra:true,source_budget_item_id:'eq1',equipment:{name:'Экран'}},{id:'service',item_type:'work',category_id:'extra',quantity:2,work_item:{name:'Монтаж экрана',unit:'час'}}],new Map(),new Map(),new Map([['extra','Дополнительная сцена']]),new Map(),new Set(['extra']));
assert.equal(extraRows.length,2);
assert.ok(extraRows.every(row=>row.group.includes('Дополнительная сцена')&&!row.group.includes('Добор')));
assert.equal(extraRows[1].unit,'час');
const {withBudgetUnits}=load('src/lib/specificationUnits.ts');
const oldSnapshot=withBudgetUnits([{id:'saved-truss',source_budget_item_id:'source-truss',item_type:'equipment',quantity:12,equipment:{name:'K4-290',unit:'шт.'}}],[{id:'source-truss',item_type:'equipment',unit:'м',quantity:12,equipment:{unit:'шт.'}}]);
assert.equal(oldSnapshot[0].unit,'м');
assert.equal(buildSpecificationEquipmentRows(oldSnapshot,new Map(),new Map(),new Map(),new Map())[0].unit,'м');
const truss=buildSpecificationEquipmentRows([{id:'truss',item_type:'equipment',quantity:12,equipment:{name:'Фермовая Конструкция K4-290',unit:'м'}}],new Map(),new Map(),new Map(),new Map());
assert.equal(truss[0].unit,'м');assert.equal(truss[0].quantity,12);
const {buildSpecificationPdf}=load('src/lib/specificationPdf.ts');
const pdf=buildSpecificationPdf({eventName:'Фестиваль в парке',budgetName:'Вариант 2',startDate:'2026-10-29',endDate:'2026-10-31',venue:'Лотос. Хилтон',rows:Array.from({length:180},(_,i)=>({group:i<90?'Оборудование / Главная сцена':'Прочее / Ремешки',name:'Микрофон '+(i+1),sku:'MIC-'+i,quantity:i+1,unit:'шт.',notes:'Примечание с кириллицей и длинным текстом для переноса в таблице.'}))});
assert.ok(pdf.getNumberOfPages()>2);const bytes=Buffer.from(pdf.output('arraybuffer'));assert.ok(bytes.includes(Buffer.from('/FontFile2')),'Embed a font instead of rasterizing text');fs.mkdirSync('work/spec-pdf',{recursive:true});fs.writeFileSync('work/spec-pdf/specification-test.pdf',bytes);
assert.equal(buildSpecificationPdf({eventName:'Событие',budgetName:'Пустая спецификация',startDate:'',rows:[]}).getNumberOfPages(),1);
console.log('PASS: composition expansion, exclusions, saved children, quantities, no work/zero rows, embedded Cyrillic fonts and multi-page PDF table.');

const physicalParent = {...parent, picked:true, return_picked:true, id:'mic-row', equipment_id:'mic', quantity:2, excluded_child_keys:[], equipment:{name:'Радиомикрофон', sku:'MIC', object_type:'physical', has_composition:true, unit:'шт.'}};
const physicalContents = new Map([['mic', [{id:'receiver-link',child_id:'receiver',quantity:1,child_name:'Приёмник',child_sku:'RX',child_unit:'шт.',child_category:'Звук'},{id:'power-link',child_id:'power',quantity:2,child_name:'Блок питания',child_unit:'шт.',child_category:'Звук'}]]]);
const physicalRows = buildSpecificationEquipmentRows([physicalParent],physicalContents,new Map(),new Map([['sound','Звук']]),new Map([['hall','Зал']]));
assert.deepEqual(physicalRows.map(row=>[row.name,row.quantity]),[['Радиомикрофон',2],['Приёмник',2],['Блок питания',4]]);
assert.ok(physicalRows.every(row=>row.group==='Зал / Звук' && row.notes==='Примечание'));
const excludedPhysical = buildSpecificationEquipmentRows([{...physicalParent,excluded_child_keys:['mic-row-comp-receiver-link-receiver']}],physicalContents,new Map(),new Map(),new Map());
assert.deepEqual(excludedPhysical.map(row=>row.name),['Радиомикрофон','Блок питания']);
assert.equal(buildSpecificationEquipmentRows([{...physicalParent,equipment:{...physicalParent.equipment,has_composition:false}}],physicalContents,new Map(),new Map(),new Map()).length,1);
console.log('PASS: physical parent and linked contents, quantities, location/category, exclusions and disabled contents');

// Exercise the actual UI row builder with the same composition fixtures.
const warehouseSource=fs.readFileSync('src/components/WarehouseSpecification.tsx','utf8');
const helperStart=warehouseSource.indexOf('        const appendContents = () =>');
const helperEnd=warehouseSource.indexOf('\n        // Handle child items',helperStart);
const helperJs=ts.transpile(warehouseSource.slice(helperStart,helperEnd),{target:ts.ScriptTarget.ES2022});
const uiItems=[], compositionPartsMap={};
const buildContents=new Function('item','compositionsByEquipmentId','items','compositionPartsMap','itemLocationId','itemLocationName','buildStableCompositionItemKey',helperJs+';return appendContents;')(physicalParent,physicalContents,uiItems,compositionPartsMap,'hall','Зал',(id,kind,link,equipment)=>`${id}-${kind}-${link}-${equipment}`);
assert.equal(buildContents(),true);
assert.deepEqual(uiItems.map(row=>[row.name,row.quantity]),[['Приёмник',2],['Блок питания',4]]);
assert.ok(uiItems.every(row=>row.parentBudgetItemId==='mic-row' && row.parentName==='Радиомикрофон' && row.isFromComposition));
assert.equal(compositionPartsMap['mic-row'].length,2);
console.log('PASS: UI contents retain parent identity, stable keys and composition actions');

assert.ok(uiItems.every(row=>row.picked===false && row.return_picked===false),'Linked equipment starts unchecked even if the parent is checked');
const pickedStart=warehouseSource.indexOf('  const handlePickedChange = async');
const pickedEnd=warehouseSource.indexOf('  const handleCablePickedChange',pickedStart);
let checkboxRows=[{budgetItemId:'mic-row',picked:true},...uiItems];
const persisted=[];
const toggleJs=ts.transpile(warehouseSource.slice(pickedStart,pickedEnd),{target:ts.ScriptTarget.ES2022});
const toggle=new Function('canMarkEquipmentRow','eventDetails','isGeneratedCompositionItemId','setExpandedItems','persistCompositionPickedState','updateSpecificationBudgetItemPicked','showNotification',toggleJs+';return handlePickedChange;')(()=>true,{},id=>id.includes('-comp-'),update=>{checkboxRows=update(checkboxRows);},(id,patch)=>persisted.push([id,patch]),()=>{throw Error('Generated child must not update parent in database');},()=>{throw Error('Unexpected notification');});
await toggle(uiItems[0].budgetItemId,true);
assert.deepEqual(checkboxRows.map(row=>row.picked),[true,true,false],'Checking one child does not change its sibling or parent');
await toggle(uiItems[0].budgetItemId,false);
assert.deepEqual(checkboxRows.map(row=>row.picked),[true,false,false]);
assert.equal(persisted.length,2);
console.log('PASS: independent linked-equipment checkboxes, unchecked initial state and persisted child keys');
