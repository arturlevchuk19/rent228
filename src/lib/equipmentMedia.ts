import { supabase } from './supabase';
export { prepareGaragePhoto as prepareEquipmentPhoto } from './garagePhoto';
const bucket='equipment-photos';
export async function equipmentPhotoUrl(path: string): Promise<string> {
 const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,3600);if(error)throw error;return data.signedUrl;
}
export async function uploadEquipmentPhoto(file: File): Promise<string> {
 const path=`${crypto.randomUUID()}.jpg`;const {error}=await supabase.storage.from(bucket).upload(path,file,{contentType:'image/jpeg',upsert:false});if(error)throw error;return path;
}
/** Keep shared/committed images when a save response is lost or another row references it. */
export async function cleanupEquipmentPhoto(path: string): Promise<void> {
 const {data,error}=await supabase.from('equipment_items').select('id').eq('photo_path',path).limit(1);
 if(error||data?.length)return;
 await supabase.storage.from(bucket).remove([path]);
}
