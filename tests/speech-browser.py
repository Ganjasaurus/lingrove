"""Real English/Mandarin PCM and WebAudio playback, plus device-voice regressions.
AI is mocked; the Basic voice runtime, worker and audio playback are real.
"""
from playwright.sync_api import sync_playwright,expect
from browser_helpers import *
import json
TRACK_AUDIO='''
window.audioClips=[];
const originalStart=AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer&&this.buffer.length>1){const data=this.buffer.getChannelData(0);let nonzero=0,sum=0;for(const value of data){if(value)nonzero++;sum+=value*value}const clip={samples:data.length,nonzero,rms:Math.sqrt(sum/data.length),duration:this.buffer.duration,ended:false};window.audioClips.push(clip);this.addEventListener('ended',()=>{clip.ended=true})}return originalStart.apply(this,args)};
'''
NO_VOICES="Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){},resume(){},addEventListener(){}}});"
NATIVE='''
window.spoken=[];window.cancelled=0;window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'en-US',localService:true},{lang:'zh-CN',localService:true}],addEventListener(){},resume(){},cancel(){window.cancelled++},speak(u){window.lastUtterance=u;window.spoken.push({text:u.text,lang:u.lang,voice:u.voice.lang,rate:u.rate});if(window.voiceFailure)setTimeout(()=>u.onerror({error:'synthesis-failed'}),10);else if(!window.voiceStall){setTimeout(()=>u.onstart(),10);setTimeout(()=>u.onend(),100)}}}});
'''
with sync_playwright() as p:
 b=launch(p);c=mobile(b,NO_VOICES+TRACK_AUDIO);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));start(page);generate(page)
 for field in (0,1):
  page.locator('[data-read-line="0"][data-field="'+str(field)+'"]').click();expect(page.locator('#speech-status')).to_have_text('Finished playing.',timeout=30000)
 clips=page.evaluate('audioClips');assert len(clips)==2 and all(a['nonzero']>1000 and a['rms']>.01 and a['ended'] for a in clips),clips
 print(json.dumps({'check':'English and Mandarin real audio without installed voices','clips':clips}),flush=True)
 # Stop an active whole-lesson sequence; stale audio must not continue onto the next line.
 page.locator('[data-read-all="en"]').click();expect(page.locator('#speech-status')).to_contain_text('Playing the basic voice',timeout=10000);page.locator('[data-read-all="en"]').click();expect(page.locator('#speech-status')).to_be_empty();count=page.evaluate('audioClips.length');page.wait_for_timeout(1000);assert page.evaluate('audioClips.length')==count;assert page.evaluate("async()=>(await import('/speech.js?v=5')).speech.status")=='idle';print('Stop cancels speech without starting later lines',flush=True)
 page.locator('[data-action="audio-settings"]').click();page.locator('#voice-mode').select_option('basic');page.locator('#speech-rate').fill('1.2');page.locator('[data-test-voice="zh"]').click();expect(page.locator('#modal-speech-status')).to_have_text('Finished playing.',timeout=20000);assert page.evaluate("JSON.parse(localStorage.getItem('lingrove-lessons-v2')).speech.rate")==1.2;print('Voice and speed controls work and persist',flush=True);c.close()
 c=mobile(b,NATIVE+TRACK_AUDIO);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));start(page);generate(page)
 for field in (0,1):
  page.locator('[data-read-line="0"][data-field="'+str(field)+'"]').click();expect(page.locator('#speech-status')).to_have_text('Finished playing.')
 spoken=page.evaluate('spoken');assert spoken[0]['lang']=='en-US' and spoken[0]['text']=='I would like a cup of tea.';assert spoken[1]['lang']=='zh-CN' and spoken[1]['text']=='我想要一杯茶。';print('Device voices receive the correct English or Chinese text and locale',flush=True)
 page.evaluate('window.voiceFailure=true');page.locator('[data-read-line="0"][data-field="1"]').click();expect(page.locator('#speech-status')).to_have_text('Finished playing.',timeout=20000);assert page.evaluate('audioClips[0].nonzero')>1000;print('Failed device voice automatically falls back to real local audio',flush=True)
 # A speech provider may deliver a delayed callback after cancellation.
 page.evaluate('window.voiceFailure=false;window.voiceStall=true');page.locator('[data-read-line="0"][data-field="0"]').click();page.locator('[data-read-line="0"][data-field="0"]').click();page.evaluate('window.lastUtterance.onstart();window.lastUtterance.onend()');expect(page.locator('#speech-status')).to_be_empty();assert page.evaluate("async()=>(await import('/speech.js?v=5')).speech.status")=='idle';print('Late native callbacks do not revive cancelled playback',flush=True)
 # A provider that never starts also triggers the fallback watchdog.
 page.locator('[data-read-line="0"][data-field="1"]').click();expect(page.locator('#speech-status')).to_have_text('Finished playing.',timeout=20000);assert page.evaluate('audioClips.length')==2;print('Silent device voice startup falls back instead of waiting forever',flush=True);c.close()
 # A permanently suspended audio context must show an actionable error.
 c=mobile(b,NO_VOICES+"AudioContext.prototype.resume=function(){return new Promise(()=>{})};");page=c.new_page();start(page);generate(page);page.locator('[data-read-line="0"][data-field="0"]').click();expect(page.locator('#speech-status')).to_contain_text('Tap Listen again',timeout=8000);print('Blocked audio activation reports a visible retry action',flush=True);c.close()
 assert not errors,errors
 print(json.dumps({'passed':8,'errors':errors}));b.close()
