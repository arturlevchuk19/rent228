export function optionalEquipmentNumber(value: string, label: string): number | null {
 if(!value.trim())return null;
 const number=Number(value.replace(',','.'));
 if(!Number.isFinite(number)||number<0)throw Error(`${label}: укажите неотрицательное число.`);
 return number;
}
export function equipmentVolumeM3(width: number | null, height: number | null, length: number | null): number | null {
 if(width===null||height===null||length===null)return null;
 if([width,height,length].some(value=>!Number.isFinite(value)||value<0))return null;
 return Math.round(width*height*length/1000000*1e9)/1e9;
}
