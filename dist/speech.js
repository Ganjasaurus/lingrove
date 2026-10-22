export const speech={status:'idle',key:null,message:'',engine:null};
const listeners=new Set();
export function subscribeSpeech(listener){listeners.add(listener);return()=>listeners.delete(listener)}
function update(patch){Object.assign(speech,patch);for(const listener of listeners)listener(speech)}
let voices=[],utterance=null,context=null,source=null,controller=null,request=0,worker=null,workerId=0;
const pending=new Map();
function refreshVoices(){try{voices=globalThis.speechSynthesis?.getVoices()||[]}catch{voices=[]}}
refreshVoices();globalThis.speechSynthesis?.addEventListener?.('voiceschanged',refreshVoices);
export function selectVoice(list,lang){
  const matches=list.filter(v=>lang==='zh'?/^(cmn|zh-(CN|TW|Hans|Hant))(?:-|$)/i.test(v.lang):/^en(?:-|$)/i.test(v.lang));
  return matches.find(v=>v.localService&&/^(en-US|zh-CN|cmn)$/i.test(v.lang))||matches.find(v=>v.localService)||matches[0]||null;
}
export function speechChunks(items){
  return items.flatMap(item=>{
    const parts=String(item.text||'').trim().match(/[^.!?。！？\n]+[.!?。！？\n]*/g)||[];const result=[];
    for(let part of parts){while(part.length>220){let at=part.lastIndexOf(' ',220);if(at<80)at=220;result.push({lang:item.lang,text:part.slice(0,at).trim()});part=part.slice(at).trim()}if(part.trim())result.push({lang:item.lang,text:part.trim()})}
    return result;
  });
}
const aborted=()=>new DOMException('Playback stopped.','AbortError');
export function stopSpeech(){
  request++;controller?.abort();controller=null;
  try{globalThis.speechSynthesis?.cancel()}catch{}
  utterance=null;
  if(source){try{source.stop();source.disconnect()}catch{}source=null}
  update({status:'idle',key:null,message:'',engine:null});
}
function unlockAudio(){
  const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Constructor)return Promise.resolve(false);
  try{
    context??=new Constructor();
    // Run in the original click, before imports, voice lookup or network activity.
    const resumed=context.resume();
    const empty=context.createBuffer(1,1,context.sampleRate),node=context.createBufferSource();node.buffer=empty;node.connect(context.destination);node.start();node.onended=()=>node.disconnect();
    return new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),5000);Promise.resolve(resumed).then(()=>{clearTimeout(timer);resolve(context.state==='running')},()=>{clearTimeout(timer);resolve(false)})});
  }catch{return Promise.resolve(false)}
}
function nativeSpeak(item,voice,rate,signal,onStart){
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(aborted());return}
    let startTimer,endTimer,finished=false;
    const done=(error)=>{if(finished)return;finished=true;clearTimeout(startTimer);clearTimeout(endTimer);signal.removeEventListener('abort',cancel);if(utterance===u)utterance=null;error?reject(error):resolve()};
    const cancel=()=>done(aborted());
    const u=new SpeechSynthesisUtterance(item.text);utterance=u;u.lang=item.lang==='zh'?'zh-CN':'en-US';u.voice=voice;u.rate=rate;u.volume=1;
    u.onstart=()=>{if(finished||signal.aborted)return;clearTimeout(startTimer);onStart();endTimer=setTimeout(()=>{done(new Error('The device voice stopped responding.'));globalThis.speechSynthesis?.cancel()},Math.max(18000,item.text.length*250/rate))};
    u.onend=()=>done();u.onerror=e=>done(signal.aborted?aborted():new Error(e.error||'The device voice could not play.'));
    signal.addEventListener('abort',cancel,{once:true});
    startTimer=setTimeout(()=>{done(new Error('The device voice did not start.'));globalThis.speechSynthesis?.cancel()},4500);
    try{globalThis.speechSynthesis.resume();globalThis.speechSynthesis.speak(u)}catch(error){done(error)}
  });
}
function resetWorker(error){
  worker?.terminate();worker=null;for(const entry of pending.values()){entry.cleanup();entry.reject(error)}pending.clear();
}
function synthesize(item,rate,signal){
  if(!worker){
    worker=new Worker(new URL('./speech-worker.js?v=6',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{const entry=pending.get(data.id);if(!entry)return;pending.delete(data.id);entry.cleanup();data.error?entry.reject(new Error(data.error)):entry.resolve(data)};
    worker.onerror=e=>{e.preventDefault();resetWorker(new Error('The basic voice could not load. Reconnect and try Listen again.'))};
    worker.onmessageerror=()=>resetWorker(new Error('The basic voice returned unreadable audio. Try again.'));
  }
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(aborted());return}
    const id=++workerId,timer=setTimeout(()=>resetWorker(new Error('The basic voice download took too long. Check your connection and try Listen again.')),120000);
    const cancel=()=>{pending.delete(id);cleanup();reject(aborted())};
    const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel)};
    pending.set(id,{resolve,reject,cleanup});signal.addEventListener('abort',cancel,{once:true});worker.postMessage({id,text:item.text,lang:item.lang,rate});
  });
}
function playPCM(audio,signal){
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(aborted());return}
    if(!context||context.state!=='running'){reject(new Error('Audio is paused by your browser. Tap Listen again to enable sound.'));return}
    const buffer=context.createBuffer(1,audio.pcm.length,audio.sampleRate),channel=buffer.getChannelData(0);for(let i=0;i<audio.pcm.length;i++)channel[i]=audio.pcm[i]/32768;
    const node=context.createBufferSource();source=node;node.buffer=buffer;node.connect(context.destination);let finished=false;
    const done=error=>{if(finished)return;finished=true;signal.removeEventListener('abort',cancel);if(source===node)source=null;node.disconnect();error?reject(error):resolve()};
    const cancel=()=>{try{node.stop()}catch{}done(aborted())};node.onended=()=>done();signal.addEventListener('abort',cancel,{once:true});
    try{node.start()}catch(error){done(error)}
  });
}
export function playSpeech(items,{key='audio',mode='auto',rate=.85}={}){
  stopSpeech();const run=request,signal=(controller=new AbortController()).signal;
  const unlocked=unlockAudio();refreshVoices();const chunks=speechChunks(items);rate=Math.min(1.2,Math.max(.6,Number(rate)||.85));
  if(!chunks.length){update({status:'error',key,message:'There is no text to read aloud.'});return Promise.resolve(false)}
  update({status:'loading',key,message:'Preparing audio…',engine:null});
  return (async()=>{
    try{
      let basic=mode==='basic',usedBasic=false;
      for(const item of chunks){
        if(signal.aborted)throw aborted();const voice=!basic&&selectVoice(voices,item.lang);
        if(voice){
          try{await nativeSpeak(item,voice,rate,signal,()=>{if(run===request)update({status:'speaking',engine:'device',message:'Playing with your device voice. No sound? Choose Basic voice in Voice & speed.'})});continue}
          catch(error){if(signal.aborted)throw error;basic=true;try{globalThis.speechSynthesis?.cancel()}catch{}}
        }
        if(!(await unlocked))throw new Error('Your browser has paused audio. Tap Listen again, or open Lingrove in Chrome or Safari.');
        if(run===request)update({status:'loading',engine:'basic',message:usedBasic?'Preparing the next line…':'Preparing the basic voice. First use downloads its audio files…'});
        const audio=await synthesize(item,rate,signal);if(signal.aborted)throw aborted();usedBasic=true;
        if(run===request)update({status:'speaking',engine:'basic',message:'Playing the basic voice on your device.'});
        await playPCM(audio,signal);
      }
      if(run===request)update({status:'idle',key:null,message:'Finished playing.',engine:usedBasic?'basic':'device'});return true;
    }catch(error){if(run===request&&error.name!=='AbortError')update({status:'error',key:null,message:error.message||'Audio could not play. Try the basic voice in Voice & speed.'});return false}
  })();
}
