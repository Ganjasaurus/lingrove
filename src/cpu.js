import {Wllama} from '@wllama/wllama/esm/index.js';
import {checkModelStorage} from './phone-support.js';

// Immutable, Apache-2.0 quantization. No prompts leave the browser.
export const PHONE_MODEL={
  id:'qwen3.5-0.8b-q4km-cpu',
  url:'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/6ab461498e2023f6e3c1baea90a8f0fe38ab64d0/Qwen3.5-0.8B-Q4_K_M.gguf',
  bytes:532517120,
};
function runtime(){
  const instance=new Wllama({default:'/vendor/wllama.wasm'},{allowOffline:true,suppressNativeLog:true,logger:{debug(){},log(){},warn:console.warn,error:console.error}});
  instance.setCompat({wasm:'/vendor/wllama-compat.wasm',worker:'/vendor/wllama-compat.js'},'firefox_safari');
  return instance;
}
export async function hasPhoneModel(){
  return (await runtime().modelManager.getModels()).some(m=>m.url===PHONE_MODEL.url);
}
export async function removePhoneModel(){await runtime().cacheManager.delete(PHONE_MODEL.url)}
export function createPhoneEngine(){
  let instance=null,requestController=null;
  const create=async request=>{
    const controller=new AbortController();requestController=controller;
    const {extra_body,response_format,...options}=request;
    const format=response_format?{type:'json_schema',json_schema:{name:'bilingual_lesson',strict:true,schema:JSON.parse(response_format.schema)}}:undefined;
    try{
      const result=await instance.createChatCompletion({...options,cache_prompt:false,chat_template_kwargs:{enable_thinking:false},abortSignal:controller.signal,...(format?{response_format:format}:{})});
      if(!request.stream){if(requestController===controller)requestController=null;return result}
      return (async function*(){try{yield* result}finally{if(requestController===controller)requestController=null}})();
    }catch(error){if(requestController===controller)requestController=null;throw error}
  };
  return {
    chat:{completions:{create}},
    async load({signal,onProgress,onPhase=()=>{}}){
      let model;
      onPhase({phase:'storage',text:'Checking browser storage…'});
      try{
        instance=runtime();
        model=(await instance.modelManager.getModels()).find(m=>m.url===PHONE_MODEL.url);
        // Complete cached models remain usable without testing a new write.
        if(!model)await checkModelStorage({signal});
      }catch(error){if(signal?.aborted)throw signal.reason;const tagged=error instanceof Error?error:new Error(error?.message||String(error));tagged.stage='storage';throw tagged}
      if(signal?.aborted)throw signal.reason;
      if(!model){
        onPhase({phase:'download',text:'Downloading Qwen. Keep this page open.'});
        model=await instance.modelManager.downloadModel({url:PHONE_MODEL.url},{signal,progressCallback:onProgress});
      }
      if(signal?.aborted)throw signal.reason;
      onPhase({phase:'loading',text:'Model files ready. Loading Qwen into memory…'});
      await instance.loadModel(model,{n_gpu_layers:0,n_threads:1,n_ctx:2048,n_batch:128,n_ubatch:64,n_parallel:1,warmup:false,default_template_kwargs:{enable_thinking:false}});
      if(signal?.aborted){await instance.exit();throw signal.reason}
    },
    // Every request evaluates its supplied context; no previous task's prompt is reused.
    async resetChat(){},
    interruptGenerate(){requestController?.abort()},
    dispose(){requestController?.abort();void instance?.exit().catch(()=>{})},
  };
}
