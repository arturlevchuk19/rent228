import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, ImagePlus, X } from 'lucide-react';
import { GARAGE_CATEGORIES, GARAGE_COUNTRIES, GARAGE_FUELS, GARAGE_STATUSES, formatGaragePlate, removeGaragePhoto, saveGarageVehicle, uploadGaragePhoto, validateGarageVehicle, type GarageVehicle, type GarageVehicleFields } from '../lib/garage';
import { prepareGaragePhoto } from '../lib/garagePhoto';
import { getErrorMessage } from '../lib/errors';
import { supabase } from '../lib/supabase';

const input='mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-gray-700 bg-[#171e28] px-4 py-3 text-base text-gray-100 outline-none placeholder:text-gray-600 focus:border-cyan-500 disabled:opacity-70';
const empty: GarageVehicleFields={category:'cargo',status:'available',name:'',plate_country:'BY',plate_number:'',brand_model:'',body_type:'',payload:'',dimensions:'',fuel:'',fuel_consumption:null,driver_name:'',phone_country:'BY',driver_phone:'',photo_path:null};
export function GaragePlate({ number, country, small=false }: {number:string;country:string;small?:boolean}) {
 return <div aria-label={`Госномер ${number || 'не указан'}`} className={`flex overflow-hidden rounded-lg border-2 border-gray-600 bg-gray-100 font-mono text-gray-950 ${small?'min-h-11':'min-h-20'}`}><span className={`flex shrink-0 items-center justify-center px-3 font-sans text-xs font-bold text-white ${country==='BY'?'bg-emerald-800':'bg-blue-800'}`}>{country==='OTHER'?'INT':country}</span><span className={`flex min-w-0 flex-1 items-center justify-center break-all px-3 text-center font-bold tracking-wide ${small?'text-lg':'text-2xl sm:text-3xl'}`}>{formatGaragePlate(number,country).replace(/\s/g,'')||'—'}</span></div>;
}
export function GarageVehicleForm({ vehicle, defaultCategory='cargo', editable, onClose, onSaved }: {vehicle?:GarageVehicle;defaultCategory?:GarageVehicleFields['category'];editable:boolean;onClose:()=>void;onSaved:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
 const initial:GarageVehicleFields=vehicle?{category:vehicle.category,status:vehicle.status,name:vehicle.name,plate_country:vehicle.plate_country,plate_number:vehicle.plate_number,brand_model:vehicle.brand_model,body_type:vehicle.body_type,payload:vehicle.payload,dimensions:vehicle.dimensions,fuel:vehicle.fuel,fuel_consumption:vehicle.fuel_consumption,driver_name:vehicle.driver_name,phone_country:vehicle.phone_country,driver_phone:vehicle.driver_phone,photo_path:vehicle.photo_path}:{...empty,category:defaultCategory};
 const [form,setForm]=useState(initial);const [consumption,setConsumption]=useState(initial.fuel_consumption===null?'':String(initial.fuel_consumption));
 const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState(vehicle?.photo_url||'');const [removedPhoto,setRemovedPhoto]=useState(false);
 const [processing,setProcessing]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const dirty=JSON.stringify(form)!==JSON.stringify(initial)||consumption!==(initial.fuel_consumption===null?'':String(initial.fuel_consumption))||!!file||removedPhoto;
 const close=()=>{if(busy||processing)return;if(dirty&&editable&&!window.confirm('Закрыть без сохранения изменений автомобиля?'))return;onClose();};
 const closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{const node=dialog.current;const previous=document.activeElement as HTMLElement|null;node?.showModal();return()=>{node?.close();previous?.focus();};},[]);
 useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const change=<K extends keyof GarageVehicleFields>(key:K,value:GarageVehicleFields[K])=>setForm(current=>({...current,[key]:value}));
 const choosePhoto=async(selected?:File)=>{if(!selected)return;setProcessing(true);setError('');try{setFile(await prepareGaragePhoto(selected));setRemovedPhoto(false);}catch(caught){setError(getErrorMessage(caught));}finally{setProcessing(false);}};
 const save=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy||processing||!editable)return;
  const fields={...form,fuel_consumption:consumption.trim()?Number(consumption.replace(',','.')):null};
  const invalid=validateGarageVehicle(fields);if(invalid){setError(invalid);return;}
  setBusy(true);setError('');let uploaded:string|undefined;
  try{
   if(file)uploaded=await uploadGaragePhoto(file);
   fields.photo_path=uploaded||(removedPhoto?null:initial.photo_path);
   await saveGarageVehicle(vehicle?.id,fields,vehicle?.updated_at);
   if(initial.photo_path&&initial.photo_path!==fields.photo_path)await removeGaragePhoto(initial.photo_path).catch(()=>{});
   onSaved();
  }catch(caught){
   if(uploaded){const {data,error:checkError}=await supabase.from('garage_vehicles').select('id').eq('photo_path',uploaded).limit(1);if(!checkError&&!data?.length)await removeGaragePhoto(uploaded).catch(()=>{});}
   setError(getErrorMessage(caught));
  }finally{setBusy(false);}
 };
 const textField=(key:'name'|'brand_model'|'body_type'|'payload'|'dimensions'|'driver_name',label:string,placeholder='',maxLength=200)=><label className="block min-w-0 text-sm text-gray-300">{label}<input required={key==='name'} maxLength={maxLength} value={form[key]} placeholder={placeholder} onChange={event=>change(key,event.target.value)} disabled={!editable||busy} className={input}/></label>;
 return createPortal(<dialog ref={dialog} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();closeRef.current();}} className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-[#10151e] p-0 text-gray-200 backdrop:bg-black/70 sm:m-auto sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-gray-700">
  <form onSubmit={save} className="flex h-full min-h-0 flex-col sm:max-h-[92dvh]">
   <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-800 bg-[#10151e] px-4 py-4 sm:px-6"><div className="min-w-0"><h2 id={titleId} className="text-xl font-bold">{vehicle?editable?'Редактирование':'Автомобиль':'Добавить автомобиль'}</h2>{vehicle&&<p className="mt-1 flex items-start gap-1 text-xs text-gray-500"><Clock3 className="h-3.5 w-3.5 shrink-0"/><span>Изменено: {vehicle.updated_by_name||'Пользователь'} · {new Date(vehicle.updated_at).toLocaleString('ru-RU',{timeZone:'Europe/Minsk',dateStyle:'short',timeStyle:'short'})}</span></p>}</div><button type="button" aria-label="Закрыть автомобиль" disabled={busy||processing} onClick={close} className="shrink-0 p-2 text-gray-400"><X className="h-6 w-6"/></button></header>
   <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
    {error&&<p role="alert" className="rounded-xl border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>}
    <div className="space-y-3"><p className="text-sm text-gray-300">Фото</p><label className={`relative flex min-h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/30 ${!editable?'pointer-events-none':''}`}>
     {preview&&!removedPhoto?<img src={preview} alt={form.name||'Фото автомобиля'} className="max-h-80 w-full object-contain"/>:<span className="flex flex-col items-center gap-2 py-8 text-sm text-gray-500"><ImagePlus className="h-8 w-8"/>{editable?'Нажмите, чтобы добавить фото':'Фото не добавлено'}</span>}
     <input type="file" aria-label="Фото автомобиля" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" disabled={!editable||busy||processing} onChange={event=>{void choosePhoto(event.target.files?.[0]);event.target.value='';}} className="sr-only"/>
    </label>{processing&&<p role="status" className="text-xs text-gray-500">Подготовка фото…</p>}{editable&&(initial.photo_path||file)&&!removedPhoto&&<button type="button" disabled={busy||processing} onClick={()=>{setFile(null);setPreview('');setRemovedPhoto(true);}} className="text-sm text-blue-400 underline">Убрать фото</button>}</div>
    <div className="grid gap-6 sm:grid-cols-2"><label className="block text-sm text-gray-300">Категория<select value={form.category} onChange={event=>change('category',event.target.value as GarageVehicleFields['category'])} disabled={!editable||busy} className={input}>{Object.entries(GARAGE_CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="block text-sm text-gray-300">Статус<select value={form.status} onChange={event=>change('status',event.target.value as GarageVehicleFields['status'])} disabled={!editable||busy} className={input}>{Object.entries(GARAGE_STATUSES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
    {textField('name','Название','Например, Isuzu',160)}
    <div className="space-y-4 rounded-xl bg-gray-800/20 p-4"><label className="block text-sm text-gray-300">Страна номера<select value={form.plate_country} onChange={event=>change('plate_country',event.target.value)} disabled={!editable||busy} className={input}>{GARAGE_COUNTRIES.map(country=><option key={country.code} value={country.code}>{country.name}</option>)}</select></label><label className="block text-sm text-gray-300">Госномер<input maxLength={32} value={form.plate_number} onChange={event=>change('plate_number',event.target.value.toUpperCase())} onBlur={()=>change('plate_number',formatGaragePlate(form.plate_number,form.plate_country))} disabled={!editable||busy} placeholder={form.plate_country==='BY'?'0345 HB-1':'Номер автомобиля'} className={`${input} font-mono`}/>{form.plate_country==='BY'&&<span className="mt-2 block text-xs text-gray-500">4 цифры · 2 буквы · регион</span>}</label><GaragePlate number={form.plate_number} country={form.plate_country}/></div>
    {textField('brand_model','Марка, модель','Isuzu NPR')}{textField('body_type','Тип','Фургон, тент…')}
    <div className="grid gap-6 sm:grid-cols-2">{textField('payload','Грузоподъёмность','3.5 т',100)}{textField('dimensions','Габариты','5 × 2.2 × 2.4 м',100)}</div>
    <label className="block text-sm text-gray-300">Топливо<select value={form.fuel} onChange={event=>change('fuel',event.target.value as GarageVehicleFields['fuel'])} disabled={!editable||busy} className={input}>{Object.entries(GARAGE_FUELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="flex items-center justify-between gap-4 text-sm text-gray-300">Расход, л/100 км<input type="number" inputMode="decimal" min="0" max="9999.99" step="0.01" placeholder="12.5" value={consumption} onChange={event=>setConsumption(event.target.value)} disabled={!editable||busy} className={`${input} mt-0 max-w-32 text-right`}/></label>
    {textField('driver_name','Водитель','ФИО или водитель смены')}
    <label className="block text-sm text-gray-300">Телефон водителя<div className="mt-2 flex overflow-hidden rounded-xl border border-gray-700 bg-[#171e28]"><select aria-label="Страна телефона водителя" value={form.phone_country} onChange={event=>{const country=GARAGE_COUNTRIES.find(row=>row.code===event.target.value);const previous=GARAGE_COUNTRIES.find(row=>row.code===form.phone_country);setForm(current=>({...current,phone_country:event.target.value,driver_phone:!current.driver_phone||current.driver_phone===previous?.phone?country?.phone||'':current.driver_phone}));}} disabled={!editable||busy} className="w-20 shrink-0 border-r border-gray-700 bg-transparent px-2 py-3 text-sm text-gray-400">{GARAGE_COUNTRIES.map(country=><option key={country.code} value={country.code} className="bg-gray-900">{country.code}</option>)}</select><input type="tel" maxLength={50} value={form.driver_phone} onChange={event=>change('driver_phone',event.target.value)} disabled={!editable||busy} placeholder={`${GARAGE_COUNTRIES.find(country=>country.code===form.phone_country)?.phone||'+'} …`} className="min-h-12 min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-gray-100 outline-none"/></div></label>
   </div>
   <footer className="flex shrink-0 justify-end gap-3 border-t border-gray-800 bg-[#10151e] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6"><button type="button" disabled={busy||processing} onClick={close} className="rounded-xl px-4 py-3 text-sm text-gray-400">{editable?'Отмена':'Закрыть'}</button>{editable&&<button type="submit" disabled={busy||processing} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?'Сохранение…':'Сохранить'}</button>}</footer>
  </form>
 </dialog>,document.body);
}
