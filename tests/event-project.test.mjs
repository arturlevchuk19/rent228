import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const load=path=>{const exports={};new Function('exports','require',ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}))(exports,name=>name==='./employeeClaimMath'?load('src/lib/employeeClaimMath.ts'):name==='./calendar'?load('src/lib/calendar.ts'):require(name));return exports;};
const api=load('src/lib/eventProject.ts');
const initial=api.normalizeProjectDetails(null);
assert.deepEqual(api.normalizeProjectDetails({schedule:'bad',people:[null],transport:undefined}),initial);
const project={...initial,description:'# Сцена\n**Монтаж** ==Внимание==',schedule:[{id:'one',date:'2026-10-27',title:'Демонтаж',start:'21:00',end:'03:00'}],people:[{id:'p',personnel_id:'',name:'Иван',group:'external',rate:'120.50'}]};
assert.deepEqual(api.normalizeProjectDetails(JSON.parse(JSON.stringify(project))),project);
assert.equal(api.validateProjectDetails(project,'2026-10-26','2026-10-29'),null);
assert.ok(api.validateProjectDetails(project,'2026-10-28','2026-10-29'));
assert.ok(api.validateProjectDetails({...project,schedule:[{...project.schedule[0],date:'2026-02-30'}]},'2026-10-26','2026-10-29'));
assert.ok(api.validateProjectDetails({...project,people:[{...project.people[0],rate:'-1'}]},'2026-10-26','2026-10-29'));
assert.ok(api.validateProjectDetails({...project,transport:[{id:'t',vehicle:'',driver:'',notes:''}]},'2026-10-26','2026-10-29'));
assert.match(api.eventDateLabel('2026-10-26','2026-10-29'),/^26–29/);
assert.ok(api.eventDateLabel('2026-12-31','2027-01-02').includes('2027'));
const {renderToStaticMarkup}=require('react-dom/server');
const {ProjectText}=load('src/components/ProjectText.tsx');
const html=renderToStaticMarkup(ProjectText({text:'# Сцена\n<script>alert(1)</script>\n**Важно** ==Дождь=='}));
assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('<strong'));assert.ok(html.includes('<mark'));
const source=fs.readFileSync('src/components/EventForm.tsx','utf8');const start=source.indexOf('  const handleSubmit =');const end=source.indexOf('  const handleContractConfirm =',start);const js=ts.transpile(source.slice(start,end),{target:ts.ScriptTarget.ES2022});
const formData={name:'Фестиваль',event_date:'2026-10-26',event_end_date:'2026-10-29',event_type:'Фестиваль',venue_id:'venue',client_id:'client',site_manager_id:'senior',budget:'legacy budget',specification:'legacy specification',status:'Подтверждено',progress_budget_done:true,progress_equipment_reserved:false,progress_project_completed:false,progress_paid:false,notes:'legacy notes'};
async function save({projectChanged=true,fail=false,isNew=false,datesCleared=false,assignedLead=false}={}){
 let payload;let savedId;let error;let newId;let saving;let created=0;let updated=0;let rpcCall;
 const mocks={saving:false,editEvent:!assignedLead,editAssignedPeople:assignedLead,previousPeopleDetails:{current:initial},operationalProjectDetails:api.operationalProjectDetails,normalizeProjectDetails:api.normalizeProjectDetails,setProject(){},supabase:{rpc:async(name,args)=>{rpcCall={name,args};return {data:project};}},budgets:[{id:'budget'}],dateParts:{day:'26',month:'10',year:'2026'},endDateParts:{day:'29',month:'10',year:'2026'},isValidDate:()=>{if(datesCleared)throw Error("Cleared dates must be allowed");return true;},formData:datesCleared?{...formData,event_date:"",event_end_date:""}:formData,project,projectBaseline:{current:JSON.stringify(projectChanged?initial:project)},validateProjectDetails:api.validateProjectDetails,setSaving:v=>saving=v,setPageError:v=>error=v,setSaveMessage(){},setSavedEventId:v=>newId=v,setContractOrganizationId(){},baseline:{current:''},onDirtyChange(){},onSave:v=>savedId=v,event:isNew?undefined:{id:'event'},savedEventId:undefined,page:true,getErrorMessage:e=>e.message,alert(){throw Error('Unexpected alert')},console:{error(){}},createEvent:async body=>{created++;payload=body;return {id:'new-event'}},updateEvent:async(id,body)=>{updated++;payload=body;if(fail)throw {message:'project_details column missing'};return {id}}};
 const run=new Function(...Object.keys(mocks),js+';return handleSubmit')(...Object.values(mocks));await run({preventDefault(){}});return {payload,savedId,error,newId,saving,created,updated,rpcCall};
}
const changed=await save();assert.deepEqual(changed.payload.project_details,api.operationalProjectDetails(project));assert.equal(changed.payload.site_manager_id,'senior');assert.equal(changed.payload.notes,'legacy notes');assert.equal(changed.payload.budget,'legacy budget');assert.equal(changed.savedId,'event');assert.equal(changed.saving,false);
const unchanged=await save({projectChanged:false});assert.equal(Object.hasOwn(unchanged.payload,'project_details'),false);
const failed=await save({fail:true});assert.equal(failed.savedId,undefined);assert.ok(failed.error.includes('миграцию'));assert.equal(failed.saving,false);
const cleared=await save({datesCleared:true});assert.equal(cleared.payload.event_date,'');assert.equal(cleared.payload.event_end_date,'');
const created=await save({isNew:true});assert.equal(created.created,1);assert.equal(created.updated,0);assert.equal(created.newId,'new-event');
console.log('PASS: project data round trip, timing/date validation, overnight schedules, people/transport validation, safe rich text, full save payload, legacy fields, missing migration and create flow');

const lead = await save({assignedLead:true});
assert.equal(lead.savedId,undefined);
assert.equal(lead.updated,0);
assert.equal(lead.rpcCall,undefined);
console.log('PASS: operational event form leaves accounting assignments to the accounting editor');

const periodProject={...project,people:[{...project.people[0],starts_at:'2026-10-27T22:00',ends_at:'2026-10-28T01:30'}]};
assert.deepEqual(api.normalizeProjectDetails(JSON.parse(JSON.stringify(periodProject))),periodProject);
assert.equal(api.validateProjectDetails(periodProject,'2026-10-26','2026-10-29'),null);
assert.match(api.validateProjectDetails({...periodProject,people:[{...periodProject.people[0],ends_at:'2026-10-27T01:30'}]},'2026-10-26','2026-10-29'),/начало и окончание/);

const resolvePeopleDependency = (name) => {
  if (name === './eventProject') return api;
  if (name === './employeeClaimMath' || name === './budgetPricing') return load(`src/lib/${name.slice(2)}.ts`);
  if (name === './personnel' || name === './budgetCoefficientGroups') return {};
  return require(name);
};
const peopleMath = {};
new Function('exports', 'require', ts.transpile(fs.readFileSync('src/lib/eventPeople.ts', 'utf8'), {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}))(peopleMath, resolvePeopleDependency);

const transport = [
  { id: 'truck', vehicle: 'Грузовой', driver: '', notes: '', vehicle_id: '1', category: 'cargo', employment_type: 'staff', trip_price: 100 },
  { id: 'car', vehicle: 'Легковой', driver: '', notes: '', vehicle_id: '2', category: 'passenger', employment_type: 'freelance', trip_price: 80 },
];
const works = [
  { id: 'cargo', name: 'Доставка оборудования', budgetAmount: 100 },
  { id: 'passenger', name: 'Доставка тех. персонала', budgetAmount: 80 },
];
const driver = {
  id: 'driver', personnel_id: '', name: 'Водитель', group: 'external', rate: '0.25',
  work_id: 'cargo', work_name: works[0].name, trip: { kilometers: '50', own_car: false, own_fuel: false },
};
const deliveryProject = { ...initial, transport, people: [driver] };
assert.deepEqual(api.normalizeProjectDetails(JSON.parse(JSON.stringify(deliveryProject))), deliveryProject);
assert.equal(api.validateProjectDetails(deliveryProject, '', ''), null);
assert.equal(peopleMath.personWorkAmount(driver), 12.5);
const [cargo, passenger] = peopleMath.deliveryWorksAfterTransport(works, transport);
assert.equal(cargo.transportAmount, 60);
assert.equal(passenger.transportAmount, 80);
assert.deepEqual(peopleMath.peopleWorkBalance([driver], cargo.budgetAmount, cargo.transportAmount),
  { amount: 72.5, budgetAmount: 100, difference: 27.5 });
assert.deepEqual(peopleMath.peopleWorkBalance([], passenger.budgetAmount, passenger.transportAmount),
  { amount: 80, budgetAmount: 80, difference: 0 });
const [fallback] = peopleMath.deliveryWorksAfterTransport([works[0]], transport);
assert.equal(fallback.transportAmount, 140);
assert.equal(peopleMath.deliveryWorksAfterTransport([works[0]], [])[0].transportAmount, undefined);
assert.deepEqual(peopleMath.deliveryWorksAfterTransport([], transport), []);
console.log('PASS: vehicle cost percentages, delivery fallback, driver mileage and project data round trip');

const owner = { id: 'owner', name: 'Владелец машины' };
const journey = { work_name: works[1].name, owner, kilometers: 50, own_fuel: false,
  driver: { id: 'driver', name: 'Водитель', kilometers: 40 } };
const passengerTrip = { ...transport[1], trip_price: undefined, journey };
assert.equal(peopleMath.vehiclePayout(passengerTrip), 12.5);
assert.equal(peopleMath.vehiclePayout({ ...passengerTrip, journey: { ...journey, own_fuel: true } }), 20);
assert.equal(peopleMath.driverPayout(passengerTrip), 10);
assert.equal(peopleMath.transportCost(passengerTrip), 22.5);
const cargoTrip = { ...transport[0], journey: { work_name: works[0].name, owner, driver: journey.driver } };
assert.equal(peopleMath.vehiclePayout(cargoTrip), 60);
assert.equal(peopleMath.vehiclePayout({ ...cargoTrip, employment_type: 'freelance' }), 100);
assert.equal(peopleMath.transportCost(cargoTrip), 70);
const updatedDelivery = JSON.parse(JSON.stringify({ ...initial, transport: [passengerTrip, cargoTrip] }));
assert.deepEqual(api.normalizeProjectDetails(updatedDelivery), updatedDelivery);
assert.equal(api.validateProjectDetails(updatedDelivery, '', ''), null);
assert.match(api.validateProjectDetails({ ...initial, transport: [{ ...passengerTrip, journey: { ...journey, kilometers: 0 } }] }, '', ''), /километраж/i);
console.log('PASS: passenger mileage and fuel, separate driver mileage, staff and freelance truck payouts, journey persistence');

const unassignedTrip = {
  ...cargoTrip,
  journey: { work_name: works[0].name, drivers: [
    { id: 'driver-a', name: 'Водитель 1', kilometers: 40 },
    { id: 'driver-b', name: 'Водитель 2', kilometers: 80 },
  ] },
};
const multiDriverProject = { ...initial, transport: [unassignedTrip] };
assert.deepEqual(api.normalizeProjectDetails(JSON.parse(JSON.stringify(multiDriverProject))), multiDriverProject);
assert.equal(api.validateProjectDetails(multiDriverProject, '', ''), null);
assert.equal(peopleMath.driverPayout(unassignedTrip), 30);
assert.equal(peopleMath.transportCost(unassignedTrip), 90);
assert.equal(api.journeyDrivers(cargoTrip.journey)[0].kilometers, 40);
console.log('PASS: trips without an owner, multiple driver payouts, and legacy driver compatibility');
