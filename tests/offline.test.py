"""Run against npm run dev -- --host 127.0.0.1 (no live database writes)."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    page.goto('http://127.0.0.1:5173')
    result = page.evaluate('''async () => {
      const { createOfflineTransport, getOfflineStatus } = await import('/src/lib/offline.ts');
      const assert = (value, message) => { if (!value) throw Error(message); };
      let online = true, reject = false;
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
      const sent = [];
      const mock = async (input, init) => {
        const request = new Request(input, init);
        if (!online) throw TypeError('Network disconnected');
        if (reject) return new Response('{}', {status: 403});
        if (request.method !== 'GET') sent.push({method: request.method, body: await request.text(), auth: request.headers.get('authorization')});
        if (request.url.includes('/rpc/set_specification_row_mark')) return new Response(null,{status:204});
        return new Response(JSON.stringify(request.url.includes('/specification_row_marks?') ? [] : [{id: 'row-1', name: 'Original'}]), {headers: {'Content-Type': 'application/json'}});
      };
      const url = 'https://offline-test.invalid/rest/v1/events?id=eq.row-1&select=*';
      const t = createOfflineTransport('https://offline-test.invalid', mock);
      const account = crypto.randomUUID();
      t.setAccount(account, {Authorization: 'Bearer fresh'});
      await t.fetch(url);
      online = false;
      assert((await (await t.fetch(url)).json())[0].name === 'Original', 'cached read');
      let response = await t.fetch(url, {method: 'PATCH', body: JSON.stringify({name:'Offline'}), headers: {Prefer:'return=representation'}});
      assert(response.ok && (await response.json())[0].name === 'Offline', 'durable acknowledgement');
      assert((await (await t.fetch(url)).json())[0].name === 'Offline', 'optimistic cache');
      assert(!(await t.fetch(url, {method:'POST', body:'{}'})).ok, 'unsupported write rejected');
      assert(!(await t.fetch(url.replace('events','venues'))).ok, 'uncached read rejected');
      const resumed = createOfflineTransport('https://offline-test.invalid', mock);
      resumed.setAccount(account, {Authorization:'Bearer fresh'});
      assert((await (await resumed.fetch(url)).json())[0].name === 'Offline', 'queue and cache survive new instance');
      online = true; reject = true;
      await resumed.sync();
      assert(getOfflineStatus().pending === 1 && getOfflineStatus().error, '403 retains queue');
      reject = false;
      await resumed.sync();
      assert(getOfflineStatus().pending === 0 && sent.length === 1 && sent[0].auth === 'Bearer fresh', 'authenticated replay');
      const marksUrl='https://offline-test.invalid/rest/v1/specification_row_marks?select=*&event_id=eq.event&budget_id=eq.budget';
      await resumed.fetch(marksUrl);
      online=false;
      const rpcUrl='https://offline-test.invalid/rest/v1/rpc/set_specification_row_mark';
      const patch={p_event_id:'event',p_budget_id:'budget',p_parent_id:'parent',p_row_key:'parent-comp-link-child',p_field:'picked',p_value:true,p_label:'Receiver'};
      assert((await resumed.fetch(rpcUrl,{method:'POST',body:JSON.stringify(patch)})).ok,'generated checkbox queued offline');
      assert((await (await resumed.fetch(marksUrl)).json()).find(row=>row.row_key===patch.p_row_key)?.picked,'optimistic shared mark cache');
      const restarted=createOfflineTransport('https://offline-test.invalid',mock);
      restarted.setAccount(account,{Authorization:'Bearer renewed'});
      assert((await (await restarted.fetch(marksUrl)).json()).find(row=>row.row_key===patch.p_row_key)?.picked,'generated checkbox survives restart');
      online=true;
      await restarted.sync();
      assert(getOfflineStatus().pending===0 && sent.at(-1).auth==='Bearer renewed','204 RPC replay succeeds with current token');
      online = false;
      resumed.setAccount(crypto.randomUUID());
      assert(!(await resumed.fetch(url)).ok, 'account isolation');
      return 'PASS: offline reads, durable edits, restart, server rejection, replay, account isolation';
    }''')
    print(result)
    browser.close()
