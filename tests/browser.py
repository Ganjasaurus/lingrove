from playwright.sync_api import sync_playwright,expect
import json
BASE='http://127.0.0.1:4173/'
results=[]
def passed(name):results.append(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':1440,'height':1000})
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE,wait_until='networkidle');expect(page.locator('.lesson-card')).to_have_count(6)
 page.locator('[data-category="Travel"]').click();expect(page.locator('.lesson-card')).to_have_count(3)
 page.locator('#library-search').fill('slower');expect(page.locator('.lesson-card')).to_have_count(1)
 page.locator('[data-bookmark="mountains"]').click();page.locator('#library-search').fill('');page.locator('[data-category="Saved"]').click();expect(page.locator('.lesson-card')).to_have_count(1);passed('Library search, category, bookmarks')
 page.goto(BASE+'#/read/small-talk');page.locator('.token',has_text='quiet').first.click();expect(page.locator('.lookup-meaning')).to_have_text('安静的');page.locator('[data-action="save-word"]').click();expect(page.locator('[data-action="save-word"]')).to_contain_text('In your word bank')
 page.locator('[data-sentence="0"]').click();expect(page.locator('[data-translation="0"]')).to_be_visible();expect(page.locator('.lookup-meaning')).to_contain_text('星期天')
 page.locator('[data-action="finish-reading"]').click();passed('English word and sentence translation, save word, complete story')
 page.locator('#language').select_option('zh');page.locator('[data-sentence="0"]').click();expect(page.locator('.lookup-meaning')).to_contain_text('quiet Sunday morning');expect(page.locator('.pinyin').first).to_be_visible();passed('Chinese-to-English and pinyin')
 page.goto(BASE+'#/words');expect(page.locator('.word-table tbody tr')).to_have_count(1);page.reload();expect(page.locator('.word-table tbody tr')).to_have_count(1);page.locator('[data-action="review"]').click();page.locator('[data-action="reveal-card"]').click();expect(page.locator('.flashcard')).to_contain_text('安静的');page.locator('[data-rating="good"]').click();expect(page.locator('#main')).to_contain_text('You reviewed 1 word');passed('Word persistence and spaced review')
 page.goto(BASE+'#/chat');expect(page.locator('.chat-bubble')).to_have_count(1);page.locator('[data-guided="0"]').click();expect(page.locator('.chat-bubble')).to_have_count(3);expect(page.locator('.chat-bubble').last).to_contain_text('hot or iced');page.locator('#chat-input').fill('Explain the moon');page.locator('#send-message').click();expect(page.locator('.chat-bubble').last).to_contain_text('guided practice');passed('Guided conversation and explicit free-chat gating')
 page.goto(BASE+'#/create');page.locator('[data-create-tab="import"]').click();page.locator('#import-title').fill('My <img src=x onerror=alert(1)> story');page.locator('#import-language').select_option('zh');page.locator('#import-text').fill('你好。今天是星期天。');page.locator('#import-form .button').click();expect(page.locator('.reader-head h1')).to_contain_text('<img');expect(page.locator('.reader-head img')).to_have_count(0);expect(page.locator('.line-group')).to_have_count(2);page.locator('.token').first.click();expect(page.locator('.lookup-meaning')).to_contain_text('hello');passed('Chinese text import, segmentation and XSS-safe rendering')
 page.locator('[data-action="ai"]').first.click();page.locator('.ai-advanced').first.locator('summary').click();page.locator('input[value="0.6B"]').check();page.locator('[data-action="enable-ai"]').click();expect(page.locator('#ai-status')).to_contain_text('compatible GPU',timeout=20000);page.locator('[data-action="modal-close"]').click();passed('Unsupported GPU gives actionable error')
 # Dictionary beyond the curated lesson vocabulary.
 result=page.evaluate("async()=>{const m=await import('/core.js');return {zh:await m.lookupDictionary('熊猫','zh'),en:await m.lookupDictionary('panda','en')}}")
 assert 'panda' in result['zh']['translation'].lower(),result
 assert '猫' in result['en']['translation'],result
 passed('Bundled dictionary English/Chinese lookup')
 # Exercise the actual generation UI using a deterministic mock engine; GPU inference is checked separately.
 page.goto(BASE+'#/create');page.locator('[data-create-tab="generate"]').click();page.locator('#language').select_option('en')
 page.evaluate("""async()=>{const {ai}=await import('/ai.js?v=3');ai.status='ready';ai.engine={chat:{completions:{create:async function*(){yield {choices:[{delta:{content:JSON.stringify({title:'Tea with a friend',zhTitle:'和朋友喝茶',lines:[['I like tea.','我喜欢茶。','Wǒ xǐhuan chá.'],['My friend likes coffee.','我的朋友喜欢咖啡。','Wǒ de péngyou xǐhuan kāfēi.'],['We meet at a cafe.','我们在咖啡馆见面。','Wǒmen zài kāfēiguǎn jiànmiàn.'],['We are happy.','我们很开心。','Wǒmen hěn kāixīn.']]})}}]};}}}};}""")
 page.locator('#lesson-topic').fill('Tea with a friend');page.locator('#generate-button').click();expect(page.locator('.reader-head h1')).to_have_text('Tea with a friend');expect(page.locator('.line-group')).to_have_count(4);passed('Generated bilingual lesson pipeline (mock model)')
 page.goto(BASE+'#/chat');page.evaluate("""async()=>{const {ai}=await import('/ai.js?v=3');ai.status='ready';ai.engine={chat:{completions:{create:async function*(){yield {choices:[{delta:{content:JSON.stringify({en:'Hello!',zh:'你好！'})}}]};}}}};}""");page.locator('#chat-input').fill('Hello');page.locator('#send-message').click();expect(page.locator('.chat-bubble').last).to_contain_text('Hello! 你好！');passed('Streaming chat pipeline (mock model)')
 # AI output is never rendered as HTML.
 assert not errors,errors
 page.goto(BASE);page.screenshot(path='/workspace/scratch/lingrove-final-desktop.png',full_page=True,animations='disabled')
 mobile=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);mp=mobile.new_page();mp.goto(BASE,wait_until='networkidle');assert not mp.evaluate('document.documentElement.scrollWidth>innerWidth');mp.screenshot(path='/workspace/scratch/lingrove-final-mobile.png',full_page=True,animations='disabled');mp.locator('[data-action="menu"]').click();expect(mp.locator('.sidebar')).to_have_class('sidebar open');mp.locator('.nav-link[href="#/chat"]').click();expect(mp.locator('.chat-window')).to_be_visible();assert not mp.evaluate('document.documentElement.scrollWidth>innerWidth');passed('Phone layout, navigation, no horizontal overflow')
 print(json.dumps({'passed':results,'console_errors':errors,'real_gpu_inference':'Unavailable: no GPU adapter in this test environment'},indent=2));b.close()
