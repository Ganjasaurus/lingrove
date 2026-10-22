"""Reproduce iOS storage failures before downloading, with the real CPU adapter.
A 393px iPhone user agent does not replace testing physical Safari.
"""
from playwright.sync_api import sync_playwright,expect
from browser_helpers import BASE,launch,mobile,start
import json
ERROR='The operation failed for an unknown transient reason (e.g. out of memory).'
IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
with sync_playwright() as p:
 b=launch(p);c=b.new_context(viewport={'width':393,'height':852},is_mobile=True,has_touch=True,user_agent=IPHONE,service_workers='block');requests=[];errors=[]
 c.add_init_script("Object.defineProperty(StorageManager.prototype,'getDirectory',{value:async()=>{throw new DOMException("+json.dumps(ERROR)+",'UnknownError')}});")
 c.route('**/*huggingface.co/**',lambda r:(requests.append(r.request.url),r.abort())[-1]);q=c.new_page();q.on('pageerror',lambda e:errors.append(str(e)));q.goto(BASE)
 expect(q.locator('#setup-progress .error')).to_contain_text('Open this link directly in Safari');expect(q.locator('[data-action="copy-app-link"]')).to_be_visible();expect(q.locator('[data-nav="saved"]').last).to_be_visible();assert not requests
 assert q.evaluate("async()=>(await import('/ai.js?v=6')).ai.failedPhase")=='storage';assert not q.evaluate('document.documentElement.scrollWidth>innerWidth');q.screenshot(path='/workspace/scratch/lingrove-ios-storage-help.png',full_page=True)
 # A blocked clipboard exposes a selectable URL instead of silently doing nothing.
 q.evaluate("()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Denied')}}})}");q.locator('[data-action="copy-app-link"]').click();expect(q.locator('#browser-link')).to_have_value(BASE);q.locator('[data-action="close-modal"]').click();q.locator('[data-nav="saved"]').last.click();expect(q.locator('.saved-page')).to_be_visible();assert not requests;print('Actual storage UnknownError becomes Safari recovery before any model download; saved lessons remain accessible',flush=True);c.close()
 # A storage write failure happens in a dedicated worker. Test the real probe,
 # then inject the same worker error without a 533MB download.
 c=b.new_context(service_workers='block');q=c.new_page();q.goto(BASE+'assets/leaf.svg')
 result=q.evaluate("""()=>new Promise((resolve,reject)=>{const w=new Worker('/storage-probe.js?v=6');w.onmessage=e=>{w.terminate();resolve(e.data)};w.onerror=reject;w.postMessage({check:true})})""");assert result=={'ok':True},result
 leftovers=q.evaluate("async()=>{const root=await navigator.storage.getDirectory();const cache=await root.getDirectoryHandle('cache');const names=[];for await(const [name] of cache.entries())if(name.startsWith('lingrove-probe-'))names.push(name);return names}");assert not leftovers,leftovers;print('Real storage preflight writes, reads, closes and deletes its own temporary file',flush=True);c.close()
 c=b.new_context(viewport={'width':393,'height':852},user_agent=IPHONE,service_workers='block');c.route('**/storage-probe.js*',lambda r:r.fulfill(content_type='text/javascript',body="self.onmessage=()=>postMessage({error:{name:'UnknownError',message:"+json.dumps(ERROR)+"}})"));c.route('**/*huggingface.co/**',lambda r:(requests.append(r.request.url),r.abort())[-1]);q=c.new_page();q.goto(BASE);expect(q.locator('#setup-progress .error')).to_contain_text('Open this link directly in Safari');assert not requests;print('Failed worker storage access is caught before downloading',flush=True);c.close()
 # Stage callbacks on a cached model must show loading, not a stuck 0% download.
 c=mobile(b);q=c.new_page();start(q);q.locator('#lesson-topic').fill('A day at school');q.evaluate("()=>{window.modelError='Test failure'}");q.locator('#generate-button').click();expect(q.locator('#generation-status')).to_contain_text('Test failure');q.locator('[data-action="open-setup"]').click();expect(q.locator('#setup-progress .error')).to_contain_text('Test failure');print('Lesson-builder errors link back to setup help',flush=True);c.close()
 assert not errors,errors
 b.close();print(json.dumps({'passed':5,'errors':errors}))
