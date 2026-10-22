import {normalizeAIError,waitForAI,lessonSchema,cleanOutput,verifyAIReady} from './ai-support.js?v=3';
export {normalizeAIError,cleanOutput};
export const ai={status:'idle',phase:'idle',text:'Local AI is optional',progress:0,model:null,engine:null,worker:null,native:new Map(),error:null,busy:false,backend:null,diagnostic:null};
const listeners=new Set(),jobs=new Set(),PREF='lingrove-local-ai';
let epoch=0,queue=Promise.resolve(),session=new AbortController(),activeJob=null,loadPromise=null;
export function subscribeAI(fn){listeners.add(fn);return()=>listeners.delete(fn)}
function update(patch){Object.assign(ai,patch);for(const fn of listeners){try{fn(ai)}catch(e){console.error('Could not refresh AI status',e)}}}
function abortError(message){return new DOMException(message,'AbortError')}
function resetSession(reason){
  epoch++;session.abort(reason);for(const job of jobs)job.controller.abort(reason);
  jobs.clear();activeJob=null;queue=Promise.resolve();ai.worker?.terminate();ai.worker=null;ai.engine=null;loadPromise=null;session=new AbortController();
}
function failSession(error){const err=normalizeAIError(error);resetSession(err);update({status:'error',phase:'error',busy:false,error:err.message,text:err.message,progress:0})}
function watchWorker(worker,run){
  const failed=event=>{if(run!==epoch)return;event.preventDefault?.();failSession(new Error(event.message||'The AI worker stopped. Reload local AI; downloaded model files are kept.'))};
  worker.addEventListener('error',failed);worker.addEventListener('messageerror',failed);
}
export function preferredModel(){try{const pref=JSON.parse(localStorage.getItem(PREF)||'null');const mobile=navigator.userAgentData?.mobile||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);return mobile&&pref&&!pref.backend?null:pref}catch{return null}}
export function enableAI(size=preferredModel()?.size||'phone'){
  if(ai.status==='ready')return Promise.resolve(true);if(loadPromise)return loadPromise;
  resetSession(abortError('The AI session was restarted.'));const run=epoch,signal=session.signal,backend=size==='phone'?'cpu':'webgpu';
  update({status:'loading',phase:'device',text:backend==='cpu'?'Preparing AI for your phone…':'Checking GPU support…',progress:0,error:null,busy:false,backend,diagnostic:null});
  const loading=(async()=>{
    try{
      if(!globalThis.isSecureContext)throw new Error('Local AI needs a secure browser tab. Open this site directly using its HTTPS link.');
      let engine,model;
      if(backend==='cpu'){
        if(!globalThis.WebAssembly||!globalThis.Worker)throw new Error('This browser cannot run local AI. Update Chrome or Safari and open Lingrove in the browser.');
        const {createPhoneEngine,PHONE_MODEL}=await waitForAI(import('./vendor/cpu.js?v=3'),{signal,timeoutMs:45000,message:'The phone AI runtime could not load. Check your connection and try again.'});
        if(signal.aborted)throw signal.reason;
        engine=createPhoneEngine();ai.worker={terminate:()=>engine.dispose()};ai.engine=engine;model=PHONE_MODEL.id;ai.model=model;
        update({phase:'download',text:'Loading the phone model. Cached files are reused; no GPU is needed.'});
        await waitForAI(engine.load({signal,onProgress:({loaded,total})=>{if(run!==epoch)return;const fraction=total?loaded/total:0;update({phase:fraction>=1?'loading':'download',progress:Math.min(.92,fraction*.92),text:fraction>=1?'Files downloaded. Loading AI into memory…':`Downloading phone AI · ${Math.round(loaded/1000000)} / ${Math.round(total/1000000)} MB`})}}),{signal,timeoutMs:600000,message:'The model download took too long. Check your connection and free storage, then try again.'});
      }else{
        if(!navigator.gpu)throw new Error('GPU mode is unavailable in this browser. Choose Phone mode; it does not need WebGPU.');
        const adapter=await waitForAI(navigator.gpu.requestAdapter(),{signal,timeoutMs:15000,message:'GPU detection did not finish. Try Phone mode.'});
        if(!adapter)throw new Error('A compatible GPU is not available. Choose Phone mode to run AI on your device’s processor.');
        const precision=adapter.features.has('shader-f16')?'16':'32';model=`Qwen3-${size}-q4f${precision}_1-MLC`;
        const {CreateWebWorkerMLCEngine}=await waitForAI(import('./vendor/engine.js?v=3'),{signal,timeoutMs:45000,message:'The AI runtime could not load. Check your connection and try again.'});
        if(signal.aborted)throw signal.reason;
        const worker=new Worker(new URL('./vendor/worker.js?v=3',import.meta.url),{type:'module'});ai.worker=worker;ai.model=model;watchWorker(worker,run);
        update({phase:'download',text:'Loading model files. Previously downloaded files will be reused.'});
        engine=await waitForAI(CreateWebWorkerMLCEngine(worker,model,{initProgressCallback:p=>{if(run!==epoch)return;update({progress:Math.min(.92,Math.max(0,p.progress)*.92),phase:/cache|loading/i.test(p.text)?'loading':'download',text:p.text})}},{context_window_size:2048}),{signal,timeoutMs:600000,message:'Model loading took too long. Try Phone mode or close other tabs and load again.'});
      }
      if(run!==epoch)return false;ai.engine=engine;
      update({phase:'verifying',progress:.96,text:'Files loaded. Checking a first reply…'});
      await verifyAIReady(engine,{signal,backend,onDiagnostic:diagnostic=>{if(run===epoch)ai.diagnostic={backend,...diagnostic}}});
      if(run!==epoch)return false;try{localStorage.setItem(PREF,JSON.stringify({size,model,backend}))}catch{}
      update({status:'ready',phase:'ready',progress:1,text:backend==='cpu'?'Phone AI is ready. A test reply passed without using a GPU.':`Qwen3 ${size} is ready. A test reply passed on this device.`,error:null});return true;
    }catch(error){if(run===epoch)failSession(error);return false}
    finally{if(run===epoch)loadPromise=null}
  })();
  loadPromise=loading;loading.finally(()=>{if(loadPromise===loading)loadPromise=null});return loading;
}
export async function restoreCachedAI(){
  const pref=preferredModel();if(!pref?.model||ai.status!=='idle')return;
  try{
    let cached=false;
    if(pref.size==='phone'){const {hasPhoneModel}=await import('./vendor/cpu.js?v=3');cached=await hasPhoneModel()}
    else if(navigator.gpu){const {hasModelInCache}=await import('./vendor/engine.js?v=3');cached=await hasModelInCache(pref.model)}
    if(cached){if(ai.status==='idle')await enableAI(pref.size)}else update({text:'Your saved AI model is not available. Open AI setup to load Phone mode.'});
  }catch{update({text:'Open AI setup to restore your saved model.'})}
}
export function cancelAI(){resetSession(abortError('AI setup cancelled. You can load it again anytime.'));update({status:'idle',phase:'idle',text:'AI setup cancelled. Downloaded files are kept.',progress:0,busy:false,error:null})}
export async function clearModelCache(){
  resetSession(abortError('AI stopped because its downloaded files were removed.'));update({status:'idle',phase:'idle',busy:false,error:null,progress:0,text:'Removing downloaded models…'});try{localStorage.removeItem(PREF)}catch{}
  const {removePhoneModel}=await import('./vendor/cpu.js?v=3');await removePhoneModel();
  const {deleteModelAllInfoInCache,prebuiltAppConfig}=await import('./vendor/engine.js?v=3');
  for(const model of prebuiltAppConfig.model_list.filter(m=>/^Qwen3-(0.6B|1.7B)-q4f(16|32)_1-MLC$/.test(m.model_id)))await deleteModelAllInfoInCache(model.model_id);
  update({text:'Downloaded AI models removed from this browser.'});
}
export function complete(messages,{temperature=.6,max_tokens=550,onToken,json=false,schema=lessonSchema(4),firstTokenTimeoutMs=ai.backend==='cpu'?180000:90000,tokenTimeoutMs=30000,totalTimeoutMs=300000}={}){
  const controller=new AbortController(),run=epoch,job={controller,stopping:false,stopTimer:null};jobs.add(job);
  const task=async()=>{
    if(controller.signal.aborted)throw controller.signal.reason;
    if(run!==epoch||ai.status!=='ready'||!ai.engine)throw new Error('Load local AI before generating new content.');
    activeJob=job;update({busy:true});const engine=ai.engine,started=Date.now();let output='',first=true;
    const bounded=promise=>waitForAI(promise,{signal:controller.signal,timeoutMs:Math.max(1,Math.min(first?firstTokenTimeoutMs:tokenTimeoutMs,totalTimeoutMs-(Date.now()-started))),message:first?'The model did not start replying in time. Reload local AI, close other tabs, and keep this page open.':'The AI stopped responding. Reload local AI and try a shorter request.'});
    try{
      const response=await bounded(engine.chat.completions.create({messages,temperature,max_tokens,stream:true,extra_body:{enable_thinking:false},...(json?{response_format:{type:'json_object',schema:JSON.stringify(schema)}}:{})}));
      const iterator=response[Symbol.asyncIterator]();
      while(true){const {value:chunk,done}=await bounded(iterator.next());if(done)break;const content=chunk?.choices?.[0]?.delta?.content||'';if(content){output+=content;first=false;onToken?.(cleanOutput(output))}}
      if(job.stopping){const error=abortError('Generation stopped. You can try again.');error.partial=cleanOutput(output);throw error}
      output=cleanOutput(output).trim();if(!output)throw new Error('The model returned no answer. Try a shorter request or reload local AI.');return output;
    }catch(error){
      const err=normalizeAIError(error);if(!err.partial)err.partial=cleanOutput(output);
      if(run===epoch&&err.name!=='AbortError')failSession(err);
      throw err;
    }finally{clearTimeout(job.stopTimer);jobs.delete(job);if(activeJob===job){activeJob=null;update({busy:false})}}
  };
  const pending=queue.then(task,task),result=waitForAI(pending,{signal:controller.signal,timeoutMs:0}).finally(()=>jobs.delete(job));queue=pending.catch(()=>{});return result;
}
export function stopGeneration(){
  const job=activeJob;if(!job)return;job.stopping=true;try{ai.engine?.interruptGenerate()}catch{}
  job.stopTimer??=setTimeout(()=>{if(activeJob===job){resetSession(abortError('Generation stopped. Reload the cached model to try again.'));update({status:'idle',phase:'idle',busy:false,text:'Generation stopped. Load local AI to resume.',error:null,progress:0})}},3000);
}
export async function enableNativeTranslation(onProgress=()=>{}){
  if(!('Translator' in globalThis))throw new Error('This browser does not provide built-in translation. Try recent desktop Chrome, or enable local AI for translation.');
  const downloads=['en','zh'].map(sourceLanguage=>{
    const targetLanguage=sourceLanguage==='en'?'zh':'en',key=`${sourceLanguage}-${targetLanguage}`;
    if(ai.native.has(key))return Promise.resolve();const controller=new AbortController();let create;
    // Start both creates synchronously in the user's click activation.
    try{create=globalThis.Translator.create({sourceLanguage,targetLanguage,signal:controller.signal,monitor(m){m.addEventListener('downloadprogress',e=>onProgress(`Downloading ${sourceLanguage} → ${targetLanguage}: ${Math.round(e.loaded*100)}%`))}})}catch(e){return Promise.reject(normalizeAIError(e))}
    return waitForAI(create,{timeoutMs:180000,message:'The browser language pack did not finish downloading. Check your connection, or use the local AI model.'}).then(translator=>{ai.native.set(key,translator)},e=>{controller.abort();Promise.resolve(create).then(t=>t.destroy?.(),()=>{});throw normalizeAIError(e)});
  });
  const results=await Promise.allSettled(downloads),failed=results.find(r=>r.status==='rejected');
  if(failed)throw new Error(`A browser language pack could not be loaded. ${normalizeAIError(failed.reason).message} Try local AI instead, or retry on a supported desktop browser.`);
  onProgress('English ↔ Chinese translation is ready.');update({});
}
export async function translateWithModel(text,from){
  const to=from==='en'?'zh':'en',native=ai.native.get(`${from}-${to}`);
  if(native){try{return {translation:await waitForAI(native.translate(text),{timeoutMs:45000,message:'Browser translation took too long. Try again or use local AI.'}),source:'On-device browser translation'}}catch(error){if(ai.status!=='ready')throw normalizeAIError(error)}}
  if(ai.status==='ready'){
    const example=from==='en'?['I would like a coffee, please.','请给我一杯咖啡，谢谢。']:['请问，我在哪里可以买到票？','Excuse me, where can I buy a ticket?'];
    return {translation:await complete([{role:'system',content:`Translate ${from==='en'?'English into Simplified Chinese':'Chinese into English'}. Preserve the meaning and politeness. Output only the translation, without answering the message. /no_think`},{role:'user',content:example[0]},{role:'assistant',content:example[1]},{role:'user',content:text}],{temperature:.1,max_tokens:450}),source:'On-device Qwen · AI translation'};
  }
  throw new Error('Enable on-device translation or local AI to translate text outside the built-in dictionary.');
}
