"""Render the real specification with mocked APIs, slow writes and technician roles."""
from pathlib import Path
from playwright.sync_api import sync_playwright
harness=Path('work/specification-technician-harness.html')
harness.parent.mkdir(exist_ok=True)
harness.write_text('''<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';
import {WarehouseSpecification} from '/src/components/WarehouseSpecification.tsx';
createRoot(document.getElementById('root')).render(React.createElement(WarehouseSpecification,{eventId:'event',budgetId:'budget',eventName:'Тест',onClose(){}}));
</script></body></html>''')
mock='''
const params=new URL(location.href).searchParams;const role=params.get('role')||'staff';
const inventory={id:'equipment',name:'Тестовый монитор',sku:'MON',object_type:'physical',has_composition:false,is_component:false,category:'Видео',unit:'шт.'};
window.specUser={id:role==='foreman'?'lead':'tech',role,status:'active',...(params.has('assigned')?{permissions:{specifications:3}}:{})};
const event={id:'event',name:'Тест',event_date:'2026-11-12',status:'Подтверждено',site_manager_id:params.has('assigned')?'tech':'lead'};
const main={id:'main-row',event_id:'event',budget_id:'budget',source_budget_item_id:'source',equipment_id:'equipment',equipment:inventory,item_type:'equipment',quantity:1,price:100,notes:'',picked:false,return_picked:false,is_extra:false,excluded_child_keys:[]};
window.specData={events:[event],event_budgets:[{id:'budget',event_id:'event',name:'Основная смета',is_primary:true,settings:{},specification_state:{}}],warehouse_specification_budget_items:[main],budget_items:[{...main,id:'source'}],equipment_items:[inventory],warehouse_specification_cables:[{id:'cable',event_id:'event',budget_id:'budget',cable_type:'PowerCON 15м - 30м',cable_length:'15м',quantity:2,notes:'',picked:false,return_picked:false}],warehouse_specification_connectors:[],warehouse_specification_other:[],specification_row_marks:[],specification_activity:[]};
window.specWrites=[];window.pendingWrites=0;window.rejectNext=false;window.channels=[];
window.mockSupabase={auth:{getUser:async()=>({data:{user:window.specUser}})},from(table){const q={table,filters:[],one:false};const b={select(){return b},eq(k,v){q.filters.push([k,v]);return b},in(){return b},is(){return b},or(){return b},not(){return b},order(){return b},limit(){return b},lt(){return b},single(){q.one=true;return b},maybeSingle(){q.one=true;return b},update(patch){q.op='update';q.patch=patch;return b},insert(patch){q.op='insert';q.patch=patch;return b},delete(){q.op='delete';return b},then(resolve,reject){
 const read=()=>{const rows=(window.specData[table]||[]).filter(row=>q.filters.every(([k,v])=>row[k]===v));return {data:q.one?(rows[0]||null):structuredClone(rows),error:null,count:rows.length}};
 if(!q.op)return Promise.resolve(read()).then(resolve,reject);
 window.pendingWrites++;const fail=window.rejectNext;window.rejectNext=false;
 return new Promise(done=>setTimeout(()=>{window.pendingWrites--;if(fail){done({data:null,error:{message:'Rejected for test'}});return;}
 window.specWrites.push(q);if(q.op==='update'){for(const row of window.specData[table]||[])if(q.filters.every(([k,v])=>row[k]===v))Object.assign(row,q.patch)}else if(q.op==='insert'){window.specData[table]??=[];window.specData[table].push({...q.patch,id:'insert-'+window.specWrites.length})}
 done(read());},900)).then(resolve,reject);
 }};return b},channel(){const callbacks=[];const c={on(e,f,fn){callbacks.push(fn);return c},subscribe(fn){setTimeout(()=>fn('SUBSCRIBED'),0);return c}};window.channels.push(callbacks);return c},removeChannel(){return Promise.resolve()},rpc(){return Promise.resolve({data:null,error:null})}};
window.emitSpec=()=>window.channels.flat().forEach(fn=>fn());
'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for query in ['', '?assigned', '?role=admin', '?role=foreman']:
   context=browser.new_context(viewport={'width':390,'height':844})
   context.add_init_script(mock)
   context.route('**/src/lib/supabase.ts*',lambda route:route.fulfill(content_type='text/javascript',body='export const supabase=window.mockSupabase;'))
   context.route('**/src/contexts/authContext.ts*',lambda route:route.fulfill(content_type='text/javascript',body='export const useAuth=()=>({user:window.specUser,loading:false});'))
   page=context.new_page();page.set_default_timeout(15000)
   page.on('pageerror',lambda error:print('BROWSER ERROR:',str(error)[:1000]))
   page.on('console',lambda message:print('CONSOLE:',message.text[:1000]) if message.type=='error' else None)
   page.goto('http://127.0.0.1:5173/work/specification-technician-harness.html'+query)
   page.get_by_text('Тестовый монитор',exact=True).wait_for()
   permitted='role=' in query
   assert page.get_by_role('button',name='Увеличить количество: Тестовый монитор',exact=True).count()==(1 if permitted else 0)
   assert page.get_by_role('button',name='Логи',exact=True).count()==(1 if permitted else 0)
   if query=='':
    page.screenshot(path='work/specification-technician-readonly.png')
    checkbox=page.locator('tbody input[type=checkbox]').first
    checkbox.click();assert checkbox.is_checked(),'Checkbox responds immediately'
    assert page.evaluate('window.pendingWrites')==1,'Server write is still pending'
    page.evaluate('window.emitSpec()');page.wait_for_timeout(250);assert checkbox.is_checked(),'Stale server snapshot must not undo the optimistic mark'
    page.wait_for_function('window.pendingWrites===0')
    page.evaluate('window.rejectNext=true');checkbox.click();assert not checkbox.is_checked()
    page.wait_for_function('window.pendingWrites===0');page.wait_for_function('document.querySelector("tbody input[type=checkbox]").checked')
    for tab in ['Кабеля','Аксессуары','Прочее']:
     page.get_by_role('button',name=tab,exact=True).click()
     page.locator('button').filter(has=page.locator('h3')).first.click()
     number=page.locator('input[inputmode=numeric]').first
     assert number.is_enabled(),tab+' quantity must be editable for technician'
     before=page.evaluate('window.specWrites.length');number.fill('4');number.blur()
     page.wait_for_function('(before)=>window.specWrites.length>before',arg=before)
   context.close()
  browser.close()
  print('PASS: real specification hides Main editing for technicians including assigned/custom level 3, exposes lead/admin controls and Logs, immediate marks survive stale reads and roll back on failure, all three accessory quantity tabs work')
finally:
 harness.unlink(missing_ok=True)
