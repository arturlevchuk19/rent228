import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const out={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/employeeClaimMath.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out);
const {tripRate,lineEstimate,minskToday,minskInput,minskInstant,claimLineError}=out;
const rates={driver_rate:.25,car_rate:.25,fuel_rate:.30},person={installation_rate:15,warehouse_rate:10};
assert.equal(tripRate(rates),.25);assert.equal(tripRate(rates,true),.50);assert.equal(tripRate(rates,false,true),.55);assert.equal(tripRate(rates,true,true),.80);
assert.equal(lineEstimate({kind:'trip',kilometers:100,own_car:true,own_fuel:true},person,rates).amount,80);
const night={kind:'time',work_name:'Монтаж',starts_at:'2026-11-02T18:30',ends_at:'2026-11-03T01:00',break_minutes:0};
assert.deepEqual(lineEstimate(night,person,rates),{rate:15,minutes:390,amount:97.5});
assert.deepEqual(lineEstimate({...night,break_minutes:30},person,rates),{rate:15,minutes:390,amount:97.5});
for(const work_name of ['Загрузка','Разгрузка']){
 assert.deepEqual(lineEstimate({...night,work_name},person,rates,false,{[work_name]:100}),{amount:65,minutes:390,rate:10});
 assert.equal(lineEstimate({...night,work_name,ends_at:'2026-11-02T19:30'},person,rates).amount,10);
}
assert.deepEqual(lineEstimate({...night,work_name:'Светорежиссёр'},person,rates,false,{'Светорежиссёр':100}),{amount:100,minutes:390,rate:15.38});
assert.equal(lineEstimate({...night,work_name:'Светорежиссёр',ends_at:'2026-11-02T19:30'},person,rates,false,{'Светорежиссёр':100}).amount,100);
assert.equal(lineEstimate({...night,calculation:'fixed',amount:200,rate:999},person,rates,true).amount,200);
assert.equal(lineEstimate({kind:'trip',kilometers:100,rate:.8,own_car:true,own_fuel:true},person,{...rates,driver_rate:.35},true).amount,80);
assert.equal(minskToday(new Date('2026-11-09T20:59:59Z')),'2026-11-09');
assert.equal(minskToday(new Date('2026-11-09T21:00:00Z')),'2026-11-10');
assert.equal(minskInstant('2026-11-09T23:59'),'2026-11-09T20:59:00.000Z');
assert.equal(minskInput('2026-11-09T21:00:00Z'),'2026-11-10T00:00');
assert.equal(claimLineError({...night,break_minutes:390}),null);assert(claimLineError({...night,ends_at:'2026-11-02T01:00'}));assert(claimLineError({...night,ends_at:'2028-01-01T00:00'},new Date('2026-11-09')));
assert(claimLineError({kind:'expense',description:'Инструмент',amount:20}));assert.equal(claimLineError({kind:'expense',description:'Инструмент',amount:20,receipt_path:'owner/check.jpg'}),null);
assert.equal(out.sumClaimAmounts([.1,.2]),.3);
console.log('PASS: all four mileage tariffs, overnight work, ignored legacy breaks, fixed work amounts, rate snapshots, Minsk midnight and receipt/time validation');
