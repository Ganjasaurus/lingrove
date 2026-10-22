"""Opt-in real model QA: downloads ~533 MB once, no mocked model or GPU.

LINGROVE_REAL_MODEL=1 python tests/phone-real-browser.py
Set LINGROVE_TEST_COMPAT=1 to also disable JSPI and exercise the Safari/older-browser WASM.
This is mobile browser emulation, not a physical phone benchmark.
"""
from playwright.sync_api import sync_playwright,expect
import json,os,re,time
if os.environ.get('LINGROVE_REAL_MODEL')!='1':
 raise SystemExit('Set LINGROVE_REAL_MODEL=1 to allow the real ~533 MB model download.')
BASE='http://127.0.0.1:4173/'
profile=os.environ.get('LINGROVE_TEST_PROFILE','/workspace/scratch/lingrove-phone-profile')
results=[]
with sync_playwright() as p:
 context=p.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy={'server':os.environ['HTTPS_PROXY'],'bypass':'localhost,127.0.0.1'},viewport={'width':393,'height':852},is_mobile=True,has_touch=True,user_agent=p.devices['Pixel 7']['user_agent'])
 context.add_init_script("Object.defineProperty(navigator,'gpu',{value:undefined});"+("Object.defineProperty(WebAssembly,'Suspending',{value:undefined});" if os.environ.get('LINGROVE_TEST_COMPAT')=='1' else ''))
 page=context.new_page()
 for old in context.pages:
  if old!=page:old.close()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE,wait_until='networkidle');page.evaluate("localStorage.removeItem('lingrove-local-ai')");page.reload(wait_until='networkidle')
 assert page.evaluate('!navigator.gpu && !crossOriginIsolated')
 page.locator('[data-action="menu"]').click();page.locator('[data-action="ai"]').first.click();expect(page.locator('input[value="phone"]')).to_be_checked()
 assert page.locator('.modal-header').bounding_box()['y']>=0
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.screenshot(path='/workspace/scratch/lingrove-phone-setup.png')
 page.locator('[data-action="enable-ai"]').click()
 page.evaluate("async()=>{window.phoneAI=await import('/ai.js?v=3')}");page.wait_for_function("['ready','error'].includes(phoneAI.ai.status)",timeout=660000)
 status=page.evaluate("async()=>{const {ai}=await import('/ai.js?v=3');return {status:ai.status,backend:ai.backend,text:ai.text,diagnostic:ai.diagnostic}}")
 assert status['status']=='ready',status
 results.append({'check':'real phone-mode load and readiness','result':status});print(json.dumps(results[-1]),flush=True)
 page.locator('[data-action="modal-close"]').first.click();page.goto(BASE+'#/chat')
 for prompt in ['Hello!','What can I say when ordering tea?']:
  started=time.monotonic();page.locator('#chat-input').fill(prompt);page.locator('#send-message').click();expect(page.locator('#send-message')).to_be_enabled(timeout=240000)
  reply=page.locator('.chat-bubble').last.inner_text();parts=reply.split('\n\n');assert len(parts)>1 and re.search('[A-Za-z]',parts[0]) and re.search('[\u4e00-\u9fff]',parts[1]),reply
  if 'ordering tea' in prompt:
   assert 'tea' in parts[0].lower() and '茶' in parts[1] and re.search(r'\bI(?: would| want|\x27d)|(?:[Cc]an|[Cc]ould) I',parts[0]),reply
  results.append({'check':'real bilingual chat','prompt':prompt,'reply':reply,'seconds':round(time.monotonic()-started,1)});print(json.dumps(results[-1],ensure_ascii=False),flush=True)
 if os.environ.get('LINGROVE_TEST_RECOVERY_ONLY')!='1':
  for text,language in [('I would like a cup of tea, please.','en'),('请问，火车站在哪里？','zh')]:
   started=time.monotonic();result=page.evaluate("async input=>{const {translateWithModel}=await import('/ai.js?v=3');return await translateWithModel(input.text,input.language)}",{'text':text,'language':language})
   assert result['translation'].strip(),result
   assert re.search('[\u4e00-\u9fff]' if language=='en' else '[A-Za-z]',result['translation']),result
   assert ('我' in result['translation'] and '茶' in result['translation']) if language=='en' else ('station' in result['translation'].lower()),result
   results.append({'check':'real translation '+language,'input':text,'result':result,'seconds':round(time.monotonic()-started,1)});print(json.dumps(results[-1],ensure_ascii=False),flush=True)
  page.goto(BASE+'#/create');page.locator('#lesson-topic').fill('Two friends buy apples at a market.');page.locator('#lesson-length').select_option('4');page.locator('#generate-button').click()
  page.wait_for_function("location.hash.startsWith('#/read/') || document.querySelector('#generate-status .form-error')",timeout=310000)
  assert '#/read/' in page.url,page.locator('#generate-status').inner_text()
  lines=page.locator('.line-group').count();assert lines==4,lines
  lesson=page.evaluate("JSON.parse(localStorage.getItem('lingrove-v1')).custom[0]")
  assert all(re.search('[\u4e00-\u9fff]',line[1]) and line[2] for line in lesson['lines']),lesson
  results.append({'check':'real schema-constrained lesson','lesson':lesson});print(json.dumps(results[-1],ensure_ascii=False),flush=True)
 page.goto(BASE+'#/chat');page.locator('#chat-input').fill('Tell me a long story about a journey through China.');page.locator('#send-message').click()
 expect(page.locator('#send-message')).to_be_disabled();page.wait_for_timeout(2000)
 page.locator('[data-action="stop-generation"]').click();expect(page.locator('#send-message')).to_be_enabled(timeout=10000)
 assert not page.locator('.chat-bubble').last.inner_text().lstrip().startswith('{'),page.locator('.chat-bubble').last.inner_text()
 results.append({'check':'Stop interrupts real inference','text':page.locator('.chat-bubble').last.inner_text()});print(json.dumps(results[-1],ensure_ascii=False),flush=True)
 # A cached CPU model must work with both GPU and the network unavailable.
 page.evaluate('async()=>{await navigator.serviceWorker.ready}');context.set_offline(True);page.reload(wait_until='networkidle')
 page.evaluate("async()=>{window.phoneAI=await import('/ai.js?v=3')}");page.wait_for_function("phoneAI.ai.status==='ready'",timeout=180000)
 offline=page.evaluate("async()=>{const {translateWithModel}=await import('/ai.js?v=3');return await translateWithModel('Good morning.','en')}")
 assert re.search('[\u4e00-\u9fff]',offline['translation']),offline
 results.append({'check':'offline cached startup and real translation','result':offline});print(json.dumps(results[-1],ensure_ascii=False),flush=True)
 assert not errors,errors
 page.evaluate("async()=>{(await import('/ai.js?v=3')).cancelAI()}")
 context.close()
 print(json.dumps({'passed':len(results),'console_errors':errors,'compat':os.environ.get('LINGROVE_TEST_COMPAT')=='1'},ensure_ascii=False),flush=True)
