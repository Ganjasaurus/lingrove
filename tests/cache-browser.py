from playwright.sync_api import sync_playwright,expect
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=b.new_context();page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
 page.evaluate('async()=>{await navigator.serviceWorker.ready;}')
 page.wait_for_function('navigator.serviceWorker.controller !== null')
 assert page.evaluate("async()=>{const cache=await caches.open('lingrove-shell-v3');return !!await cache.match('/ai-support.js?v=2')}")
 page.evaluate("async()=>{await fetch('/dictionary.json')}")
 page.wait_for_function("async()=>!!await caches.match('/dictionary.json')")
 context.set_offline(True);page.reload(wait_until='networkidle')
 expect(page.locator('h1')).to_contain_text('A little reading.')
 page.locator('a[href="#/read/coffee"]').first.click();expect(page.locator('.reader-head h1')).to_be_visible()
 result=page.evaluate("async()=>{const {lookupDictionary}=await import('/core.js');return await lookupDictionary('你好','zh')}")
 assert result and result['translation'],result
 assert not errors,errors
 print(json.dumps({'passed':['versioned AI modules cached','offline app reload','offline reader','offline bilingual dictionary'],'console_errors':errors}))
 b.close()
