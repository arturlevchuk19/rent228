"""Two isolated browsers against mocked data. Requires Vite on 127.0.0.1:5173."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

harness = Path('work/specification-collaboration-harness.html')
harness.parent.mkdir(exist_ok=True)
harness.write_text('''<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#111;color:white"><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import '/src/index.css';
import {useSpecificationCollaboration} from '/src/lib/useSpecificationCollaboration.ts';
import {mergeSharedMarks,saveGeneratedRowMark} from '/src/lib/specificationCollaboration.ts';
import {canViewSpecificationLogs} from '/src/lib/specificationPermissions.ts';
import {SpecificationLogs} from '/src/components/SpecificationLogs.tsx';
function Client(){const lead=location.search.includes('lead');const [rows,setRows]=React.useState([{id:'parent-comp-link-child',picked:false}]);const [draft,setDraft]=React.useState('11');const [logs,setLogs]=React.useState(false);
const live=useSpecificationCollaboration('event','budget',true,snapshot=>setRows(previous=>mergeSharedMarks(previous,snapshot.marks.map(row=>({...row,id:row.row_key})),row=>row.id)));
return React.createElement('main',{className:'p-4 space-y-4'},React.createElement('h1',null,'Спецификация'),React.createElement('label',null,'Приёмник ',React.createElement('input',{type:'checkbox','aria-label':'Выдано',checked:rows[0].picked,onChange:async e=>{await saveGeneratedRowMark('event','budget','parent',rows[0].id,'picked',e.target.checked,'Приёмник');live.refresh();}})),React.createElement('input',{'aria-label':'Черновик количества',value:draft,onChange:e=>setDraft(e.target.value),className:'bg-gray-800'}),canViewSpecificationLogs({id:lead?'lead':'tech',role:lead?'foreman':'staff',status:'active'},'lead')&&React.createElement('button',{onClick:()=>setLogs(true)},'Логи'),logs&&React.createElement(SpecificationLogs,{eventId:'event',budgetId:'budget',onClose:()=>setLogs(false)}));}
createRoot(document.getElementById('root')).render(React.createElement(Client));
</script></body></html>''')
state = {name: [] for name in ['warehouse_specification_budget_items','warehouse_specification_cables','warehouse_specification_connectors','warehouse_specification_other','specification_row_marks','specification_activity']}
def read_fixture(source, query):
    if query['table'] == 'event_budgets':
        return {'data': {'specification_state': {}}, 'error': None}
    rows = state[query['table']]
    if query['table'] == 'specification_activity':
        rows = list(reversed(rows))
    return {'data': rows, 'error': None}
def mutate(source, query):
    patch = query['patch']
    marks = state['specification_row_marks']
    row = next((row for row in marks if row['row_key'] == patch['p_row_key']), None)
    if row is None:
        row = {'row_key':patch['p_row_key'],'picked':False,'return_picked':False}
        marks.append(row)
    old = row[patch['p_field']]
    row[patch['p_field']] = patch['p_value']
    state['specification_activity'].append({'id':len(state['specification_activity'])+1,'actor_name':'Техник Один','row_name':patch['p_label'],'action':'update','changes':{patch['p_field']:{'old':old,'new':patch['p_value']}},'created_at':'2026-11-11T12:00:00Z'})
    return {'data':None,'error':None}
script = '''window.channels=[];
window.mockSupabase={from(table){const query={table,filters:[]};const builder={select(){return builder},eq(...args){query.filters.push(args);return builder},order(){return builder},limit(){return builder},lt(){return builder},single(){return builder},then(resolve,reject){return window.readFixture(query).then(resolve,reject)}};return builder},rpc(name,patch){return window.mutateFixture({name,patch}).then(result=>{window.emitSpecification();return result})},channel(){const callbacks=[];const channel={on(event,filter,fn){callbacks.push(fn);return channel},subscribe(fn){setTimeout(()=>fn('SUBSCRIBED'),0);return channel}};window.channels.push(callbacks);return channel},removeChannel(){return Promise.resolve()}};
window.emitSpecification=()=>window.channels.flat().forEach(fn=>fn());'''
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        contexts=[browser.new_context(),browser.new_context(viewport={'width':390,'height':844})]
        pages=[]
        for index,context in enumerate(contexts):
            context.add_init_script(script)
            context.expose_binding('readFixture',read_fixture)
            context.expose_binding('mutateFixture',mutate)
            context.route('**/src/lib/supabase.ts*',lambda route:route.fulfill(body='export const supabase=window.mockSupabase;',content_type='text/javascript'))
            page=context.new_page()
            page.goto('http://127.0.0.1:5173/work/specification-collaboration-harness.html'+('?lead' if index else ''))
            page.get_by_role('checkbox',name='Выдано').wait_for()
            pages.append(page)
        tech,lead=pages
        assert tech.get_by_role('button',name='Логи',exact=True).count()==0
        lead.get_by_label('Черновик количества').fill('27')
        tech.get_by_role('checkbox',name='Выдано').click()
        tech.wait_for_function('document.querySelector("input[type=checkbox]").checked')
        lead.evaluate('window.emitSpecification()')
        lead.wait_for_function('document.querySelector("input[type=checkbox]").checked')
        assert lead.get_by_label('Черновик количества').input_value()=='27'
        lead.get_by_role('button',name='Логи',exact=True).click()
        lead.get_by_role('dialog').wait_for(state='visible')
        assert lead.get_by_text('Техник Один',exact=True).count()==1
        assert lead.get_by_text('Отметил выдачу',exact=True).count()==1
        lead.screenshot(path='work/specification-logs-mobile.png')
        lead.get_by_role('button',name='Закрыть',exact=True).click()
        tech.get_by_role('checkbox',name='Выдано').click()
        tech.wait_for_function('!document.querySelector("input[type=checkbox]").checked')
        lead.evaluate('window.emitSpecification()')
        lead.wait_for_function('!document.querySelector("input[type=checkbox]").checked')
        assert lead.get_by_label('Черновик количества').input_value()=='27'
        print('PASS: two isolated browser sessions share generated checkboxes, local drafts survive, technician has no Logs button and lead sees actor/action history on mobile')
        browser.close()
finally:
    harness.unlink(missing_ok=True)
