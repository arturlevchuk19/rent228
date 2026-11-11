// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE TABLE public.users(id uuid PRIMARY KEY,role text,status text);
CREATE TABLE public.app_roles(key text PRIMARY KEY,permissions jsonb);
CREATE TABLE public.events(id uuid PRIMARY KEY,site_manager_id uuid,status text);
CREATE TABLE public.event_budgets(id uuid PRIMARY KEY,event_id uuid,specification_state jsonb DEFAULT '{}');
CREATE TABLE public.warehouse_specification_budget_items(id uuid PRIMARY KEY,event_id uuid,budget_id uuid,is_extra boolean DEFAULT false,source_budget_item_id uuid,picked boolean DEFAULT false,return_picked boolean DEFAULT false,updated_at timestamptz,quantity numeric,name text,notes text);
GRANT USAGE ON SCHEMA auth,public TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.warehouse_specification_budget_items TO authenticated;
ALTER TABLE public.warehouse_specification_budget_items ENABLE ROW LEVEL SECURITY;
`);
const accountSource=fs.readFileSync('supabase/migrations/20261026020000_account_and_role_access.sql','utf8');
for(const name of ['app_can_access','app_can_work_specification']) {
 const from=accountSource.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
 const end=accountSource.indexOf('$$;',from)+3;
 await db.exec(accountSource.slice(from,end));
}
await db.exec(`
INSERT INTO app_roles VALUES ('staff','{"specifications":1}'),('admin','{"specifications":3}'),('foreman','{"specifications":2}');
INSERT INTO users VALUES ('00000000-0000-0000-0000-000000000001','staff','active'),('00000000-0000-0000-0000-000000000002','foreman','active'),('00000000-0000-0000-0000-000000000003','foreman','active'),('00000000-0000-0000-0000-000000000004','admin','active'),('00000000-0000-0000-0000-000000000005','staff','inactive');
INSERT INTO events VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Подтверждено');
INSERT INTO event_budgets VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','{}');
INSERT INTO warehouse_specification_budget_items(id,event_id,budget_id,quantity,name) VALUES ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',2,'Main equipment');
INSERT INTO warehouse_specification_budget_items(id,event_id,budget_id,quantity,name,is_extra) VALUES ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',2,'Extra equipment',true);
CREATE POLICY account_view ON public.warehouse_specification_budget_items FOR SELECT TO authenticated USING (public.app_can_access('specifications',1));
CREATE POLICY account_insert ON public.warehouse_specification_budget_items FOR INSERT TO authenticated WITH CHECK (public.app_can_access('specifications',2) AND public.app_can_work_specification(event_id));
CREATE POLICY account_delete ON public.warehouse_specification_budget_items FOR DELETE TO authenticated USING (public.app_can_access('specifications',3) AND public.app_can_work_specification(event_id));
`);
await db.exec(fs.readFileSync('supabase/migrations/20261111120000_main_specification_permissions.sql','utf8'));
const main="id='30000000-0000-0000-0000-000000000001'";
const extra="id='30000000-0000-0000-0000-000000000002'";
async function actor(id,sql){await db.exec('BEGIN');try{await db.exec(`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${id}',true); SELECT set_config('request.jwt.claim.role','authenticated',true);`);return await db.query(sql);}finally{await db.exec('ROLLBACK');}}
assert.equal((await actor(1,`UPDATE warehouse_specification_budget_items SET picked=true WHERE ${main} RETURNING id`)).rows.length,1);
await assert.rejects(actor(1,`UPDATE warehouse_specification_budget_items SET quantity=10 WHERE ${main}`),/assigned site lead/);
await assert.rejects(actor(1,`UPDATE warehouse_specification_budget_items SET picked=true,notes='oops' WHERE ${main}`),/assigned site lead/);
await assert.rejects(actor(1,`UPDATE warehouse_specification_budget_items SET is_extra=true WHERE ${main}`),/assigned site lead/);
assert.equal((await actor(1,`DELETE FROM warehouse_specification_budget_items WHERE ${main} RETURNING id`)).rows.length,0);
assert.equal((await actor(1,`UPDATE warehouse_specification_budget_items SET quantity=10 WHERE ${extra} RETURNING id`)).rows.length,0);
assert.equal((await actor(2,`UPDATE warehouse_specification_budget_items SET quantity=10 WHERE ${main} RETURNING id`)).rows.length,1);
await assert.rejects(actor(3,`UPDATE warehouse_specification_budget_items SET quantity=10 WHERE ${main}`),/assigned site lead/);
assert.equal((await actor(4,`UPDATE warehouse_specification_budget_items SET quantity=10 WHERE ${main} RETURNING id`)).rows.length,1);
assert.equal((await actor(5,`UPDATE warehouse_specification_budget_items SET picked=true WHERE ${main} RETURNING id`)).rows.length,0);
await assert.rejects(actor(1,`UPDATE warehouse_specification_budget_items SET return_picked=true WHERE ${main}`),/shipment stage/);
await db.exec(`UPDATE event_budgets SET specification_state='{"equipment_shipped":true}';`);
assert.equal((await actor(1,`UPDATE warehouse_specification_budget_items SET return_picked=true WHERE ${main} RETURNING id`)).rows.length,1);
await assert.rejects(actor(1,`UPDATE warehouse_specification_budget_items SET picked=true WHERE ${main}`),/shipment stage/);
await db.exec(`UPDATE app_roles SET permissions='{"specifications":3}' WHERE key='staff'`);
await assert.rejects(actor(1,`UPDATE warehouse_specification_budget_items SET quantity=10 WHERE ${main}`),/assigned site lead/);
assert.equal((await actor(1,`UPDATE warehouse_specification_budget_items SET quantity=10 WHERE ${extra} RETURNING id`)).rows.length,1,'Extra tab preserves custom edit rights');
await assert.rejects(actor(1,`INSERT INTO warehouse_specification_budget_items(id,event_id,budget_id,name) VALUES ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Unauthorized main row')`),/row-level security/);
console.log('PASS SQL: technician checkboxes, no quantity/notes/reclassification/inserts/deletes, assigned lead/admin, unrelated lead, inactive user, shipment stages and unchanged Extra permissions');

await db.exec(`
CREATE ROLE anon;
ALTER TABLE public.users ADD COLUMN full_name text;
UPDATE public.users SET full_name=CASE role WHEN 'staff' THEN 'Техник Один' WHEN 'foreman' THEN 'Старший' ELSE 'Администратор' END;
ALTER TABLE public.warehouse_specification_budget_items ADD COLUMN excluded_child_keys text[] NOT NULL DEFAULT '{}';
CREATE TABLE public.equipment_items(id uuid PRIMARY KEY,name text);
ALTER TABLE public.warehouse_specification_budget_items ADD COLUMN equipment_id uuid, ADD COLUMN modification_id uuid;
CREATE TABLE public.equipment_compositions(id uuid PRIMARY KEY,parent_id uuid,child_id uuid);
CREATE TABLE public.modification_components(id uuid PRIMARY KEY,modification_id uuid,component_equipment_id uuid);
INSERT INTO public.equipment_items VALUES ('50000000-0000-0000-0000-000000000001','Приёмник');
INSERT INTO public.equipment_compositions VALUES ('40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001');
UPDATE public.warehouse_specification_budget_items SET equipment_id='50000000-0000-0000-0000-000000000002' WHERE id='30000000-0000-0000-0000-000000000001';

CREATE TABLE public.warehouse_specification_cables(id uuid PRIMARY KEY,event_id uuid,budget_id uuid,quantity numeric,cable_type text,cable_length text,return_picked boolean DEFAULT false);
CREATE TABLE public.warehouse_specification_connectors(id uuid PRIMARY KEY,event_id uuid,budget_id uuid,quantity numeric,connector_type text,connector_item text,return_picked boolean DEFAULT false);
CREATE TABLE public.warehouse_specification_other(id uuid PRIMARY KEY,event_id uuid,budget_id uuid,quantity numeric,category text,item_type text,return_picked boolean DEFAULT false);
`);
await db.exec('CREATE PUBLICATION supabase_realtime');
await db.exec(fs.readFileSync('supabase/migrations/20261111130000_specification_collaboration_and_logs.sql','utf8'));
assert.equal((await db.query("SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime'")).rows.length,6,'Realtime publication includes every shared row table and budget state');
await db.exec(`UPDATE event_budgets SET specification_state='{}'; UPDATE app_roles SET permissions='{"specifications":1}' WHERE key='staff';`);
const rowKey='30000000-0000-0000-0000-000000000001-comp-40000000-0000-0000-0000-000000000001-50000000-0000-0000-0000-000000000001';
const mark=(field,value,key=rowKey)=>`SELECT public.set_specification_row_mark('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','${key}','${field}',${value},'Поддельная подпись')`;
// Run committed actor transactions for shared state and immutable audit assertions.
async function commitActor(id,sql) {
 await db.exec('BEGIN');
 try { await db.exec(`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${id}',true); SELECT set_config('request.jwt.claim.role','authenticated',true);`); const result=await db.query(sql);await db.exec('COMMIT');return result; }
 catch(error){await db.exec('ROLLBACK');throw error;}
}
await commitActor(1,mark('picked',true));
let shared=(await db.query('SELECT * FROM specification_row_marks')).rows;
assert.equal(shared[0].picked,true);
let logs=(await db.query(`SELECT * FROM specification_activity WHERE entity='specification_row_marks'`)).rows;
assert.equal(logs.length,1);assert.equal(logs[0].actor_name,'Техник Один');assert.equal(logs[0].actor_id,'00000000-0000-0000-0000-000000000001');assert.equal(logs[0].row_name,'Приёмник');
await commitActor(1,mark('picked',true));
assert.equal((await db.query(`SELECT * FROM specification_activity WHERE entity='specification_row_marks'`)).rows.length,1,'Idempotent replay does not duplicate audit entries');
await commitActor(1,mark('picked',false));
assert.equal((await db.query('SELECT picked FROM specification_row_marks')).rows[0].picked,false);
await assert.rejects(commitActor(1,mark('return_picked',true)),/shipment stage/);
await assert.rejects(commitActor(1,mark('picked',true,'wrong-prefix')),/Invalid child row/);
await assert.rejects(commitActor(1,mark('picked',true,rowKey+'-fake')),/Composition child not found/);
await assert.rejects(commitActor(1,`UPDATE specification_row_marks SET picked=true`),/permission denied/);
assert.equal((await actor(1,'SELECT * FROM specification_activity')).rows.length,0,'Technician cannot read logs');
assert.equal((await actor(3,'SELECT * FROM specification_activity')).rows.length,0,'Unassigned lead cannot read logs');
assert.ok((await actor(2,'SELECT * FROM specification_activity')).rows.length>0,'Assigned lead reads logs');
assert.ok((await actor(4,'SELECT * FROM specification_activity')).rows.length>0,'Admin reads logs');
await assert.rejects(commitActor(4,`DELETE FROM specification_activity`),/permission denied/,'Even admin cannot rewrite history through the client');
const logCount=(await db.query('SELECT count(*)::int AS n FROM specification_activity')).rows[0].n;
await assert.rejects(commitActor(1,`UPDATE warehouse_specification_budget_items SET quantity=7 WHERE ${main}`),/assigned site lead/);
assert.equal((await db.query('SELECT count(*)::int AS n FROM specification_activity')).rows[0].n,logCount,'Rejected edits do not create success logs');
await commitActor(4,`UPDATE warehouse_specification_budget_items SET quantity=7 WHERE ${main}`);
const quantityLog=(await db.query(`SELECT * FROM specification_activity WHERE entity='warehouse_specification_budget_items' ORDER BY id DESC LIMIT 1`)).rows[0];
assert.equal(quantityLog.actor_name,'Администратор');assert.equal(quantityLog.changes.quantity.new,7);
await db.exec(`UPDATE event_budgets SET specification_state='{"equipment_shipped":true}'`);
await commitActor(1,mark('return_picked',true));
shared=(await db.query('SELECT * FROM specification_row_marks')).rows;
assert.equal(shared[0].picked,false);assert.equal(shared[0].return_picked,true,'One-field updates preserve the other checkbox');
await assert.rejects(commitActor(1,mark('picked',true)),/shipment stage/);
console.log('PASS SQL: shared generated checkboxes, atomic fields, repeat-safe audit, verified actor, log read restrictions, immutable history, failed edits, quantity history and shipment stages');
await db.close();
