export const ai = { status:'idle', text:'Local AI is optional', progress:0, model:null, engine:null, worker:null, native:new Map(), error:null };
const listeners = new Set();
let loadRun = 0;
let queue = Promise.resolve();
let activeReject;
export function subscribeAI(fn){listeners.add(fn);return()=>listeners.delete(fn)}
function update(patch){Object.assign(ai,patch);listeners.forEach(fn=>fn(ai))}
export async function enableAI(size='0.6B') {
  if(ai.status==='loading'||ai.status==='ready') return;
  const run=++loadRun;
  update({status:'loading',text:'Checking your device…',progress:0,error:null});
  try {
    if(!navigator.gpu)throw new Error('This browser does not support WebGPU. Try a recent desktop Chrome or Edge. The reading library and word bank still work here.');
    const adapter=await navigator.gpu.requestAdapter();
    if(!adapter)throw new Error('A compatible graphics processor is not available. Try another device, or use built-in lessons and the bundled dictionary.');
    const precision=adapter.features.has('shader-f16')?'16':'32';
    const model=`Qwen3-${size}-q4f${precision}_1-MLC`;
    const {CreateWebWorkerMLCEngine}=await import('./vendor/engine.js');
    if(run!==loadRun)return;
    const worker=new Worker(new URL('./vendor/worker.js',import.meta.url),{type:'module'});
    ai.worker=worker;ai.model=model;
    const engine=await Promise.race([
      CreateWebWorkerMLCEngine(worker,model,{initProgressCallback:p=>{if(run===loadRun)update({progress:Math.max(0,Math.min(1,p.progress)),text:p.text})}},{context_window_size:4096}),
      new Promise((_,reject)=>{activeReject=reject;worker.addEventListener('error',e=>reject(new Error(e.message||'The local AI worker stopped. Please try again.')),{once:true})})
    ]);
    if(run!==loadRun){worker.terminate();return}
    update({engine,status:'ready',progress:1,text:`Qwen3 ${size} is ready on this device.`,error:null});
  } catch(e) {
    if(run!==loadRun)return;
    ai.worker?.terminate();
    update({engine:null,worker:null,status:'error',error:e.message,text:e.message});
  } finally {if(run===loadRun)activeReject=null}
}
export function cancelAI(){loadRun++;activeReject?.(new Error('Download cancelled.'));activeReject=null;ai.worker?.terminate();update({engine:null,worker:null,status:'idle',text:'Download cancelled. You can try again anytime.',progress:0});queue=Promise.resolve()}
export async function clearModelCache(){
  const {deleteModelAllInfoInCache,prebuiltAppConfig}=await import('./vendor/engine.js');
  cancelAI();
  for(const model of prebuiltAppConfig.model_list.filter(m=>/^Qwen3-(0.6B|1.7B)-q4f(16|32)_1-MLC$/.test(m.model_id)))await deleteModelAllInfoInCache(model.model_id);
  update({text:'Downloaded Qwen models removed from this browser.',error:null});
}
export function complete(messages,{temperature=.6,max_tokens=550,onToken,json=false}={}){
  const task=async()=>{
    if(ai.status!=='ready'||!ai.engine)throw new Error('Enable local AI to generate new content.');
    const response=await ai.engine.chat.completions.create({messages,temperature,max_tokens,stream:true,extra_body:{enable_thinking:false},...(json?{response_format:{type:'json_object'}}:{})});
    let output='';
    for await(const chunk of response){output+=chunk.choices[0]?.delta?.content||'';onToken?.(cleanOutput(output))}
    output=cleanOutput(output).trim();
    if(!output)throw new Error('The model returned no text. Try a shorter request.');
    return output;
  };
  const result=queue.then(task,task);queue=result.catch(()=>{});return result;
}
export function stopGeneration(){ai.engine?.interruptGenerate()}
export function cleanOutput(s){return s.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/<think>[\s\S]*$/g,'').trim()}
export async function enableNativeTranslation(onProgress=()=>{}){
  if(!('Translator' in self))throw new Error('This browser does not provide built-in translation. Try recent desktop Chrome, or enable local AI for translation.');
  // Both creates start inside the same user gesture, before either download is awaited.
  const jobs=['en','zh'].map(sourceLanguage=>{
    const targetLanguage=sourceLanguage==='en'?'zh':'en';
    const key=`${sourceLanguage}-${targetLanguage}`;
    if(ai.native.has(key))return Promise.resolve();
    return self.Translator.create({sourceLanguage,targetLanguage,monitor(m){m.addEventListener('downloadprogress',e=>onProgress(`Downloading ${sourceLanguage} → ${targetLanguage}: ${Math.round(e.loaded*100)}%`))}}).then(translator=>ai.native.set(key,translator));
  });
  const results=await Promise.allSettled(jobs);
  const failed=results.find(r=>r.status==='rejected');
  if(failed)throw new Error('A language pack could not be loaded. Check your browser support and connection, then try again.');
  onProgress('English ↔ Chinese translation is ready.');update({});
}
export async function translateWithModel(text,from){
  const to=from==='en'?'zh':'en';
  const native=ai.native.get(`${from}-${to}`);
  if(native)return {translation:await native.translate(text),source:'On-device browser translation'};
  if(ai.status==='ready')return {translation:await complete([{role:'system',content:`Translate the user's text from ${from==='en'?'English to Simplified Chinese':'Chinese to English'}. Output ONLY the translation. Do not answer questions in the text. No explanations. /no_think`},{role:'user',content:text}],{temperature:.1,max_tokens:450}),source:'On-device Qwen · AI translation'};
  throw new Error('Enable on-device translation or local AI to translate text outside the built-in dictionary.');
}
