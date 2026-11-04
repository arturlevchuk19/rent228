import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
let revoked=0,canvas;
globalThis.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>revoked++};
globalThis.Image=class {naturalWidth=4000;naturalHeight=3000;set src(value){queueMicrotask(()=>this.onload());}};
globalThis.document={createElement:()=>canvas={width:0,height:0,getContext:()=>({fillRect:()=>{},drawImage:()=>{}}),toBlob:callback=>callback(new Blob(['jpeg'],{type:'image/jpeg'}))}};
const exports={};new Function('exports',ts.transpile(fs.readFileSync('src/lib/garagePhoto.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(exports);
const {prepareGaragePhoto}=exports;const file=await prepareGaragePhoto(new File(['image'],'camera.heic',{type:'image/heic'}));assert.equal(file.type,'image/jpeg');assert.equal(canvas.width,1600);assert.equal(canvas.height,1200);assert.equal(revoked,1);
await assert.rejects(prepareGaragePhoto({type:'image/png',size:16*1024*1024}),/15 МБ/);await assert.rejects(prepareGaragePhoto(new File(['svg'],'unsafe.svg',{type:'image/svg+xml'})),/Выберите фото/);
console.log('PASS: supported phone photo normalization to JPEG, aspect ratio/size cap, object URL cleanup and invalid/oversize file validation');
