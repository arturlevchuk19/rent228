/** Normalize phone photos (including supported HEIC) to a bounded JPEG upload. */
export async function prepareGaragePhoto(file: File): Promise<File> {
 if(file.size>15*1024*1024)throw Error('Выберите фото размером до 15 МБ.');
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif'].includes(file.type.toLowerCase()))throw Error('Выберите фото JPEG, PNG, WebP или поддерживаемое фото с телефона.');
 const url=URL.createObjectURL(file);
 try {
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Не удалось прочитать фото. Попробуйте выбрать JPEG или PNG.'));image.src=url;});
  const factor=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Не удалось подготовить фото.');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Не удалось подготовить фото.')),'image/jpeg',0.88));
  return new File([blob],'vehicle.jpg',{type:'image/jpeg'});
 } finally {URL.revokeObjectURL(url);}
}
