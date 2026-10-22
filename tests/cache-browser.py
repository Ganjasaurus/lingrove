"""Real service-worker shell and Basic voice offline regression; no model download."""
from playwright.sync_api import sync_playwright,expect
from browser_helpers import BASE,launch
import json
lesson={'id':'offline','title':'Offline lesson','zhTitle':'离线课','language':'en','level':'A1','lines':[['Hello, my friend.','你好，我的朋友。','Nǐ hǎo, wǒ de péngyou.']]}
state={'version':2,'language':'en','languageChosen':True,'lessons':[lesson],'speech':{'mode':'basic','rate':1.2}}
with sync_playwright() as p:
 b=launch(p);c=b.new_context(viewport={'width':393,'height':852},is_mobile=True,has_touch=True)
 c.add_init_script("Object.defineProperty(navigator,'gpu',{value:undefined});if(!localStorage.getItem('lingrove-lessons-v2'))localStorage.setItem('lingrove-lessons-v2',"+json.dumps(json.dumps(state))+');')
 # Reading and speech must remain usable even when model download is unavailable.
 c.route('**/*huggingface.co/**',lambda r:r.abort());c.route('**/*hf.co/**',lambda r:r.abort())
 q=c.new_page();errors=[];q.on('pageerror',lambda e:errors.append(str(e)));q.goto(BASE+'#/read/offline');expect(q.locator('.lesson-heading h1')).to_have_text('Offline lesson');q.evaluate('navigator.serviceWorker.ready');q.wait_for_function('!!navigator.serviceWorker.controller');q.locator('[data-read-line="0"][data-field="1"]').click();expect(q.locator('#speech-status')).to_have_text('Finished playing.',timeout=20000)
 urls=q.evaluate("async()=>{const c=await caches.open('lingrove-shell-v6');return(await c.keys()).map(r=>new URL(r.url).pathname+new URL(r.url).search)}")
 for path in ['/app.js?v=6','/lessons.js?v=6','/speech.js?v=6','/speech-worker.js?v=6','/vendor/speech/espeak-ng.js','/vendor/speech/espeak-ng.data']:assert path in urls,(path,urls)
 print('Versioned app shell and real voice runtime/data cached',flush=True)
 c.set_offline(True);q.reload();expect(q.locator('.lesson-heading h1')).to_have_text('Offline lesson')
 for field in (0,1):
  q.locator('[data-read-line="0"][data-field="'+str(field)+'"]').click();expect(q.locator('#speech-status')).to_have_text('Finished playing.',timeout=15000)
 print('Saved lesson, English audio and Mandarin audio work after offline reload',flush=True)
 assert not errors,errors
 b.close();print(json.dumps({'passed':4,'errors':errors}))
