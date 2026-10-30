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
const loaded=await loadSpecificationExport('event-A','budget-B',true);
assert.ok(scopeCalls.every(([,event,budget])=>event==='event-A'&&budget==='budget-B'));
assert.equal(loaded.rows.find(row=>row.name==='10м').quantity,5);assert.equal(loaded.rows.find(row=>row.name==='10м').notes,'A\nB');
assert.equal(loaded.rows.find(row=>row.name==='Сплиттер X6').quantity,4);assert.ok(loaded.rows.some(row=>row.name==='0.5м'));assert.ok(!loaded.rows.some(row=>row.name==='1м'));
assert.ok(!loaded.rows.some(row=>row.name==='Доставка'),'No standalone all-services block');
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
const {buildSpecificationPdf}=load('src/lib/specificationPdf.ts');
const pdf=buildSpecificationPdf({eventName:'Фестиваль в парке',budgetName:'Вариант 2',startDate:'2026-10-29',endDate:'2026-10-31',venue:'Лотос. Хилтон',rows:Array.from({length:180},(_,i)=>({group:i<90?'Оборудование / Главная сцена':'Прочее / Ремешки',name:'Микрофон '+(i+1),sku:'MIC-'+i,quantity:i+1,unit:'шт.',notes:'Примечание с кириллицей и длинным текстом для переноса в таблице.'}))});
assert.ok(pdf.getNumberOfPages()>2);const bytes=Buffer.from(pdf.output('arraybuffer'));assert.ok(bytes.includes(Buffer.from('/FontFile2')),'Embed a font instead of rasterizing text');fs.mkdirSync('work/spec-pdf',{recursive:true});fs.writeFileSync('work/spec-pdf/specification-test.pdf',bytes);
assert.equal(buildSpecificationPdf({eventName:'Событие',budgetName:'Пустая спецификация',startDate:'',rows:[]}).getNumberOfPages(),1);
console.log('PASS: composition expansion, exclusions, saved children, quantities, no work/zero rows, embedded Cyrillic fonts and multi-page PDF table.');
