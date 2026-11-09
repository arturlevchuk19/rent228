import { supabase } from './supabase';
import { prepareGaragePhoto } from './garagePhoto';
export type ClaimState = 'draft'|'submitted'|'approved'|'paid'|'rejected';
export type ClaimKind = 'time'|'trip'|'expense'|'allowance';
export interface ClaimLine {
 id?:number; kind:ClaimKind; work_name?:string; starts_at?:string; ends_at?:string;
 break_minutes?:number|string; kilometers?:number|string; own_car?:boolean; own_fuel?:boolean;
 description?:string; receipt_path?:string; amount?:number|string; rate?:number|string; minutes?:number;
}
export interface ClaimPerson {id:string;full_name:string;account_user_id?:string;installation_rate:number;warehouse_rate:number;}
export interface ClaimEvent {id:string;name:string;event_date:string;event_end_date?:string;deadline:string|null;status?:string;}
export interface ClaimRates {driver_rate:number;car_rate:number;fuel_rate:number;}
export interface EmployeeClaim {id:string;user_id:string;personnel_id:string;employee_name:string;event_id:string|null;event_name:string;state:ClaimState;lines:ClaimLine[];work_amount:number;expense_amount:number;total:number;revision:number;review_note:string;created_at:string;updated_at:string;}
export interface ClaimBootstrap {personnel:ClaimPerson|null;people:ClaimPerson[];events:ClaimEvent[];settings:ClaimRates;today:string;}
export const CLAIM_STATES:Record<ClaimState,string>={draft:'Черновик',submitted:'На проверке',approved:'Утверждено',paid:'Выплачено',rejected:'Отклонено'};
export async function claimBootstrap():Promise<ClaimBootstrap>{const {data,error}=await supabase.rpc('employee_claim_bootstrap');if(error)throw error;return data;}
export async function claimWorks(eventId:string):Promise<string[]>{const {data,error}=await supabase.rpc('employee_claim_context',{p_event:eventId});if(error)throw error;return data.works;}
export async function listClaims(userId?:string):Promise<EmployeeClaim[]>{let query=supabase.from('employee_claims').select('*').order('updated_at',{ascending:false});if(userId)query=query.eq('user_id',userId);const {data,error}=await query;if(error)throw error;return data||[];}
export async function saveClaim(claim:EmployeeClaim|null,eventId:string,lines:ClaimLine[],submit:boolean,personnelId?:string,note='',requestId?:string):Promise<EmployeeClaim>{
 const numeric=(value:unknown)=>{const parsed=Number(String(value??0).replace(',','.'));if(!Number.isFinite(parsed))throw Error('Проверьте числовые поля заявки');return parsed;};
 const payload=lines.map(line=>({...line,break_minutes:numeric(line.break_minutes),kilometers:line.kind==='trip'?numeric(line.kilometers):undefined,amount:['expense','allowance'].includes(line.kind)?numeric(line.amount):undefined,rate:line.rate===undefined?undefined:numeric(line.rate),starts_at:line.kind==='time'?minskInstant(line.starts_at||''):undefined,ends_at:line.kind==='time'?minskInstant(line.ends_at||''):undefined}));
 const {data,error}=await supabase.rpc('employee_claim_save',{p_id:claim?.id||requestId||null,p_event:eventId||null,p_lines:payload,p_submit:submit,p_revision:claim?.revision??null,p_personnel:personnelId||null,p_note:note});if(error)throw error;return data;
}
export async function reviewClaim(claim:EmployeeClaim,action:'approve'|'pay'|'reject'|'return'|'withdraw',note=''){const {data,error}=await supabase.rpc('employee_claim_review',{p_id:claim.id,p_action:action,p_revision:claim.revision,p_note:note});if(error)throw error;return data as EmployeeClaim;}
export async function claimHistory(id:string){const {data,error}=await supabase.from('employee_claim_history').select('id,action,actor_id,created_at,before_value,after_value').eq('claim_id',id).order('created_at',{ascending:false});if(error)throw error;return data||[];}
export async function saveClaimRates(rates:ClaimRates){const {error}=await supabase.rpc('employee_claim_set_rates',{p_driver:rates.driver_rate,p_car:rates.car_rate,p_fuel:rates.fuel_rate});if(error)throw error;}
export async function uploadClaimReceipt(file:File,userId:string){const photo=await prepareGaragePhoto(file);const path=`${userId}/${crypto.randomUUID()}.jpg`;const {error}=await supabase.storage.from('claim-receipts').upload(path,photo,{contentType:'image/jpeg',upsert:false});if(error)throw error;return path;}
export async function openClaimReceipt(path:string){const {data,error}=await supabase.storage.from('claim-receipts').createSignedUrl(path,120);if(error)throw error;return data.signedUrl;}
export { minskToday, minskInput, minskInstant, tripRate, lineEstimate, claimLineError, sumClaimAmounts } from './employeeClaimMath';
import { minskInstant } from './employeeClaimMath';
