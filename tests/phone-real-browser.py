"""Opt-in ~533 MB Qwen test. Emulates a phone; does not benchmark physical phones."""
from playwright.sync_api import sync_playwright,expect
from browser_helpers import BASE
import os,json,re,time
if os.environ.get('LINGROVE_REAL_MODEL')!='1':raise SystemExit('Set LINGROVE_REAL_MODEL=1 to permit the ~533 MB real model download.')
profile=os.environ.get('LINGROVE_TEST_PROFILE','/workspace/scratch/lingrove-phone-profile')
with sync_playwright() as p:
 c=p.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy={'server':os.environ['HTTPS_PROXY'],'bypass':'localhost,127.0.0.1'},viewport={'width':393,'height':852},is_mobile=True,has_touch=True,user_agent=p.devices['Pixel 7']['user_agent'])
 c.add_init_script("Object.defineProperty(navigator,'gpu',{value:undefined});"+("Object.defineProperty(WebAssembly,'Suspending',{value:undefined});" if os.environ.get('LINGROVE_TEST_COMPAT')=='1' else ''))
 page=c.new_page()
 for old in c.pages:
  if old!=page:old.close()
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 page.wait_for_function("document.querySelector('[data-language]') || document.querySelector('#lesson-topic') || document.querySelector('#setup-progress .error')",timeout=660000)
 status=page.evaluate("async()=>{const {ai}=await import('/ai.js?v=6');return {status:ai.status,backend:ai.backend,diagnostic:ai.diagnostic,error:ai.error}}")
 assert status['status']=='ready',status
 print(json.dumps({'check':'automatic real Qwen startup and test reply','status':status}),flush=True)
 if page.locator('[data-language="zh"]').count():page.locator('[data-language="zh"]').click()
 page.locator('#lesson-language').select_option('zh');page.locator('#lesson-topic').fill('Two friends buy apples at a market.');page.locator('.customize summary').click();page.locator('#lesson-format').select_option('dialogue');page.locator('#lesson-level').select_option('A1');page.locator('#lesson-length').select_option('4');page.locator('#lesson-focus').fill('apples and please');started=time.monotonic();page.locator('#generate-button').click()
 page.wait_for_function("location.hash.startsWith('#/read/') || document.querySelector('#generation-status .error')",timeout=310000)
 assert '#/read/' in page.url,page.locator('#generation-status').inner_text()
 assert page.locator('.lesson-line').count()==4
 lesson=page.evaluate("JSON.parse(localStorage.getItem('lingrove-lessons-v2')).lessons[0]")
 assert all(re.search('[A-Za-z]',line[0]) and re.search('[\u4e00-\u9fff]',line[1]) and line[2] for line in lesson['lines']),lesson
 assert any('apple' in line[0].lower() and '苹果' in line[1] for line in lesson['lines']),lesson
 assert lesson['spec']['format']=='dialogue' and lesson['language']=='zh'
 print(json.dumps({'check':'real custom bilingual lesson, autosave and pinyin','seconds':round(time.monotonic()-started,1),'lesson':lesson},ensure_ascii=False),flush=True)
 page.screenshot(path='/workspace/scratch/lingrove-real-custom-lesson.png',full_page=True)
 page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null');c.set_offline(True);page.reload();expect(page.locator('.lesson-line')).to_have_count(4);assert page.locator('.lesson-heading h1').inner_text()==lesson['zhTitle'];print('Saved custom lesson reloads offline',flush=True)
 assert not errors,errors
 c.close();print('Real Qwen custom lesson checks passed',flush=True)
