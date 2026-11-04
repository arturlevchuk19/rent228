import { supabase } from './supabase';
export const GARAGE_CATEGORIES = { cargo: 'Грузовой', passenger: 'Легковой' } as const;
export const GARAGE_STATUSES = { available: 'Готов к работе', in_use: 'В работе', repair: 'Требует ремонта', inactive: 'Не используется' } as const;
export const GARAGE_FUELS = { '': 'Не указано', petrol: 'Бензин', diesel: 'Дизель', gas: 'Газ', hybrid: 'Гибрид', electric: 'Электро' } as const;
export const GARAGE_COUNTRIES = [
  { code: 'BY', name: '🇧🇾 Беларусь', phone: '+375' }, { code: 'RU', name: '🇷🇺 Россия', phone: '+7' },
  { code: 'UA', name: '🇺🇦 Украина', phone: '+380' }, { code: 'PL', name: '🇵🇱 Польша', phone: '+48' },
  { code: 'LT', name: '🇱🇹 Литва', phone: '+370' }, { code: 'LV', name: '🇱🇻 Латвия', phone: '+371' },
  { code: 'EE', name: '🇪🇪 Эстония', phone: '+372' }, { code: 'KZ', name: '🇰🇿 Казахстан', phone: '+7' },
  { code: 'DE', name: '🇩🇪 Германия', phone: '+49' }, { code: 'OTHER', name: 'Другая страна', phone: '+' },
] as const;
export interface GarageVehicleFields {
 category: keyof typeof GARAGE_CATEGORIES; status: keyof typeof GARAGE_STATUSES; name: string;
 plate_country: string; plate_number: string; brand_model: string; body_type: string; payload: string; dimensions: string;
 fuel: keyof typeof GARAGE_FUELS; fuel_consumption: number | null; driver_name: string; phone_country: string; driver_phone: string; photo_path: string | null;
}
export interface GarageVehicle extends GarageVehicleFields { id: string; created_at: string; updated_at: string; created_by: string | null; updated_by: string | null; photo_url?: string; updated_by_name?: string; }
export const GARAGE_PHOTO_BUCKET = 'garage-photos';
export function formatGaragePlate(value: string, country: string): string {
 const upper=value.trim().toUpperCase();
 if(country!=='BY')return upper;
 const compact=upper.replace(/\s/g,'');
 const match=compact.match(/^(\d{4})([A-ZА-ЯІ]{2})-?(\d)$/u);
 return match ? `${match[1]} ${match[2]}-${match[3]}` : upper;
}
export function validateGarageVehicle(value: GarageVehicleFields): string | null {
 if(!value.name.trim())return 'Укажите название автомобиля.';
 if(value.name.trim().length>160)return 'Название должно быть не длиннее 160 символов.';
 if(!(value.category in GARAGE_CATEGORIES)||!(value.status in GARAGE_STATUSES)||!(value.fuel in GARAGE_FUELS))return 'Проверьте категорию, статус и топливо.';
 if(value.fuel_consumption!==null&&(!Number.isFinite(value.fuel_consumption)||value.fuel_consumption<0||value.fuel_consumption>=10000))return 'Расход топлива должен быть неотрицательным числом меньше 10000.';
 return null;
}
export async function garagePhotoUrl(path: string): Promise<string> {
 const {data,error}=await supabase.storage.from(GARAGE_PHOTO_BUCKET).createSignedUrl(path,3600);
 if(error)throw error;return data.signedUrl;
}
export async function getGarageVehicles(): Promise<GarageVehicle[]> {
 const {data,error}=await supabase.from('garage_vehicles').select('*, editor:users!garage_vehicles_updated_by_fkey(full_name)').order('name');
 if(error)throw error;
 return Promise.all((data||[]).map(async row=>{const {editor,...vehicle}=row;return {...vehicle,updated_by_name:(editor as {full_name?:string}|null)?.full_name,photo_url:vehicle.photo_path?await garagePhotoUrl(vehicle.photo_path).catch(()=>undefined):undefined} as GarageVehicle;}));
}
export async function saveGarageVehicle(id: string | undefined, fields: GarageVehicleFields, expectedUpdatedAt?: string): Promise<void> {
 const invalid=validateGarageVehicle(fields);if(invalid)throw Error(invalid);
 const payload={...fields,name:fields.name.trim(),plate_number:formatGaragePlate(fields.plate_number,fields.plate_country)};
 if(id){let query=supabase.from('garage_vehicles').update(payload).eq('id',id);if(expectedUpdatedAt)query=query.eq('updated_at',expectedUpdatedAt);const {data,error}=await query.select('id').maybeSingle();if(error)throw error;if(!data)throw Error('Автомобиль изменён другим пользователем или удалён. Закройте форму и обновите список.');}
 else {const {error}=await supabase.from('garage_vehicles').insert(payload).select('id').single();if(error)throw error;}
}
export async function removeGaragePhoto(path: string): Promise<void> {const {error}=await supabase.storage.from(GARAGE_PHOTO_BUCKET).remove([path]);if(error)throw error;}
export async function uploadGaragePhoto(file: File): Promise<string> {
 const path=`${crypto.randomUUID()}.jpg`;const {error}=await supabase.storage.from(GARAGE_PHOTO_BUCKET).upload(path,file,{contentType:'image/jpeg',upsert:false});if(error)throw error;return path;
}
export async function deleteGarageVehicle(vehicle: GarageVehicle): Promise<void> {
 const {data,error}=await supabase.from('garage_vehicles').delete().eq('id',vehicle.id).eq('updated_at',vehicle.updated_at).select('id').maybeSingle();
 if(error)throw error;if(!data)throw Error('Автомобиль уже изменён или удалён. Обновите список.');
 if(vehicle.photo_path)await removeGaragePhoto(vehicle.photo_path).catch(()=>{});
}
