"""Real budget panel, mocked copy API; no production database writes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
path=Path('work/budget-duplicate-preview.html');path.parent.mkdir(exist_ok=True)
path.write_text('''<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#111110;padding:16px"><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';import {EventBudgetsPanel} from '/src/components/EventBudgetsPanel.tsx';
function App(){const [budgets,setBudgets]=React.useState(window.budgets);return React.createElement(EventBudgetsPanel,{eventId:'event',budgets,onChanged:async()=>setBudgets([...window.budgets]),onOpen:()=>window.opened++});}createRoot(document.getElementById('root')).render(React.createElement(App));
</script></body></html>''')
api='''export async function duplicateEventBudget(id){window.copies++;await new Promise(resolve=>setTimeout(resolve,350));if(window.fail){window.fail=false;throw Error('Ошибка копирования')}const index=window.budgets.findIndex(b=>b.id===id);const source=window.budgets[index];const copy={...source,id:'copy-'+window.copies,name:source.name+' (копия)',is_primary:false};window.budgets.splice(index+1,0,copy);return copy.id;}export const createEventBudget=async()=>{};export const deleteEventBudget=async()=>{};export const renameEventBudget=async()=>{};export const setPrimaryEventBudget=async()=>{};'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for width in [1100,390]:
   context=browser.new_context(viewport={'width':width,'height':700})
   context.add_init_script("window.user={id:'admin',role:'admin',status:'active'};window.copies=0;window.opened=0;window.budgets=[{id:'primary',name:'Основная смета',is_primary:true},{id:'second',name:'Монтаж',is_primary:false},{id:'third',name:'Запасная',is_primary:false}];")
   context.route('**/src/lib/eventBudgets.ts*',lambda route:route.fulfill(content_type='text/javascript',body=api))
   context.route('**/src/contexts/authContext.ts*',lambda route:route.fulfill(content_type='text/javascript',body='export const useAuth=()=>({user:window.user});'))
   page=context.new_page();page.goto('http://127.0.0.1:5173/work/budget-duplicate-preview.html')
   button=page.get_by_role('button',name='Копировать Основная смета',exact=True);button.wait_for()
   button.evaluate('(button)=>{button.click();button.click()}')
   assert button.is_disabled()
   page.get_by_role('button',name='Открыть смету: Основная смета (копия)',exact=True).wait_for()
   assert page.evaluate('window.copies')==1
   name_box=page.get_by_text('Основная смета (копия)',exact=True).bounding_box()
   assert name_box['width']>80 and name_box['height']<100,'Mobile names must not collapse to one character per line'
   assert page.evaluate('window.opened')==0
   assert page.get_by_role('button',name='Открыть смету:',exact=False).evaluate_all('(buttons)=>buttons.map(button=>button.getAttribute("aria-label"))')==['Открыть смету: Основная смета','Открыть смету: Основная смета (копия)','Открыть смету: Монтаж','Открыть смету: Запасная']
   page.evaluate('window.fail=true');page.get_by_role('button',name='Копировать Монтаж',exact=True).click();page.get_by_role('alert').wait_for();assert page.get_by_role('alert').inner_text()=='Ошибка копирования';assert page.get_by_role('button',name='Открыть смету: Монтаж (копия)',exact=True).count()==0
   page.screenshot(path=f'work/budget-copy-{width}.png');context.close()
  context=browser.new_context();context.add_init_script("window.user={id:'viewer',role:'clerk',status:'active',permissions:{budgets:1}};window.opened=0;window.budgets=[{id:'primary',name:'Основная смета',is_primary:true}];")
  context.route('**/src/lib/eventBudgets.ts*',lambda route:route.fulfill(content_type='text/javascript',body=api));context.route('**/src/contexts/authContext.ts*',lambda route:route.fulfill(content_type='text/javascript',body='export const useAuth=()=>({user:window.user});'))
  page=context.new_page();page.goto('http://127.0.0.1:5173/work/budget-duplicate-preview.html');page.get_by_role('button',name='Открыть смету: Основная смета',exact=True).wait_for();assert page.get_by_role('button',name='Копировать Основная смета',exact=True).count()==0
  browser.close();print('PASS: copy icon desktop/mobile, adjacent result, no accidental opening, double-click protection, failure feedback and view-only permissions')
finally:path.unlink(missing_ok=True)
