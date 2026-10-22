from playwright.sync_api import expect
import os
BASE=os.environ.get('LINGROVE_TEST_URL','http://127.0.0.1:4173/')
MOCK_CPU='''
export const PHONE_MODEL={id:'qwen-test'};
export const hasPhoneModel=async()=>false;
export const createPhoneEngine=()=>({
 async load({signal,onProgress}) {window.loads=(window.loads||0)+1;onProgress({loaded:20,total:100});await new Promise(r=>setTimeout(r,window.setupDelay||100));if(window.setupError)throw new Error(window.setupError);if(signal.aborted)throw signal.reason;onProgress({loaded:100,total:100})},
 dispose(){},interruptGenerate(){},resetChat:async()=>{},
 chat:{completions:{create:async r=>{if(!r.stream){window.checkedReady=true;return {choices:[{message:{content:'Hello'}}]}}window.lastRequest=r;if(window.modelError)throw window.modelError;if(window.stall)return new Promise(()=>{});const count=JSON.parse(r.response_format.schema).properties.lines.minItems;const data={title:'A cup of tea',zhTitle:'一杯茶',lines:Array.from({length:count},()=>({en:'I would like a cup of tea.',zh:'我想要一杯茶。'}))};return (async function*(){if(window.generationDelay)await new Promise(r=>setTimeout(r,window.generationDelay));yield {choices:[{delta:{content:window.incomplete?'{}':JSON.stringify(data)}}]}})()}}}
});
'''
def mock_cpu(context):
 context.route('**/vendor/cpu.js*',lambda r:r.fulfill(content_type='text/javascript',body=MOCK_CPU))
def launch(p):
 return p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
def mobile(browser,script=''):
 c=browser.new_context(viewport={'width':393,'height':852},is_mobile=True,has_touch=True,service_workers='block')
 c.add_init_script("Object.defineProperty(navigator,'gpu',{value:undefined});"+script);mock_cpu(c);return c
def start(page,lang='en'):
 page.goto(BASE);page.locator('[data-language="'+lang+'"]').click();expect(page.locator('#lesson-topic')).to_be_visible()
def generate(page,topic='Ordering tea'):
 page.locator('#lesson-topic').fill(topic);page.locator('#generate-button').click();expect(page.locator('.lesson-heading h1')).to_be_visible(timeout=10000)
def more(page,action):
 page.locator('.reader-actions .menu summary').click();page.locator('[data-action="'+action+'"]').click()
