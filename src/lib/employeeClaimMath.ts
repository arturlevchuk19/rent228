import type { ClaimLine,ClaimPerson,ClaimRates } from './employeeClaims';
const number=(value:unknown)=>Number(String(value??0).replace(',','.'));
const round=(value:number)=>Math.round((value+Number.EPSILON*Math.max(1,Math.abs(value)))*100)/100;
export function minskToday(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Minsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function minskInput(value:string){if(!value)return '';const date=new Date(value);if(!Number.isFinite(+date))return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Minsk',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date).replace(' ','T');}
export function minskInstant(value:string){if(!value)throw Error('Укажите дату и время');const date=new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value)?value:`${value}+03:00`);if(!Number.isFinite(+date))throw Error('Проверьте дату и время');return date.toISOString();}
export function sumClaimAmounts(values:number[]){return values.reduce((cents,value)=>cents+Math.round(value*100),0)/100;}
export function tripRate(rates:ClaimRates,ownCar=false,ownFuel=false){return round(number(rates.driver_rate)+(ownCar?number(rates.car_rate):0)+(ownFuel?number(rates.fuel_rate):0));}
export function lineEstimate(line:ClaimLine,person:ClaimPerson|null,rates:ClaimRates,snapshot=false,fixedRates:Record<string,number>={}){
 let rate=0,minutes=0,amount=0;
 if(line.kind==='time'){
  try{minutes=(+new Date(minskInstant(line.ends_at||''))- +new Date(minskInstant(line.starts_at||'')))/60000;}catch{minutes=0;}
  rate=snapshot&&line.rate!==undefined?number(line.rate):/склад|загрузка|разгрузка/i.test(line.work_name||'')?number(person?.warehouse_rate):number(person?.installation_rate);
  if((snapshot&&line.calculation==='fixed')||(!snapshot&&!/^(монтаж|демонтаж|загрузка|разгрузка)$/i.test((line.work_name||'').trim()))){
   amount=round(snapshot?number(line.amount):fixedRates[line.work_name||'']??NaN);rate=minutes>0?round(amount*60/minutes):0;
  }else{rate=round(rate);amount=round(rate*Math.max(0,minutes)/60);}
 }else if(line.kind==='trip'){rate=snapshot&&line.rate!==undefined?number(line.rate):tripRate(rates,line.own_car,line.own_fuel);rate=round(rate);amount=round(number(line.kilometers)*rate);}
 else amount=round(number(line.amount));
 return {rate,minutes,amount:Number.isFinite(amount)?amount:0};
}
export function claimLineError(line:ClaimLine,now=new Date()):string|null{
 if((line.kind==='time'||line.kind==='trip')&&!line.work_name)return 'Выберите работу';
 if(line.kind==='time'){
  try{const start=+new Date(minskInstant(line.starts_at||'')),end=+new Date(minskInstant(line.ends_at||''));
   if(end<=start)return 'Окончание должно быть позже начала. Для ночной смены укажите следующую дату.';
   if(end>+now)return 'Нельзя подать ещё не отработанное время';
  }catch{return 'Заполните дату и время начала и окончания';}
 }else if(line.kind==='trip'){if(!/доставк/i.test(line.work_name||''))return 'Выберите работу по доставке';if(!Number.isFinite(number(line.kilometers))||number(line.kilometers)<=0)return 'Укажите километраж';}
 else{if(!line.description?.trim())return 'Укажите назначение расхода';if(!Number.isFinite(number(line.amount))||number(line.amount)<=0)return 'Укажите положительную сумму';if(line.kind==='expense'&&!line.receipt_path)return 'Приложите фото чека';}
 return null;
}
