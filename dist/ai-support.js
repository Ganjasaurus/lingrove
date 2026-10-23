export function normalizeAIError(value){
  if(value instanceof Error||value instanceof DOMException)return value;
  let message=typeof value==='string'?value:value&&typeof value.message==='string'?value.message:'';
  if(!message&&value){try{message=JSON.stringify(value)}catch{}}
  return new Error(message?.trim()||'The local AI could not complete this request. Reload the model and try again.');
}
export function waitForAI(promise,{signal,timeoutMs=0,message='The local AI stopped responding.'}={}){
  return new Promise((resolve,reject)=>{
    let timer;
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort)};
    const done=(fn,value)=>{cleanup();fn(value)};
    const abort=()=>done(reject,normalizeAIError(signal.reason||new DOMException('Stopped.','AbortError')));
    Promise.resolve(promise).then(v=>done(resolve,v),e=>done(reject,normalizeAIError(e)));
    if(signal?.aborted){abort();return}signal?.addEventListener('abort',abort,{once:true});
    if(timeoutMs>0)timer=setTimeout(()=>{const e=new Error(message);e.name='TimeoutError';done(reject,e)},timeoutMs);
  });
}
export function lessonSchema(count=4,language='en'){return language==='es'?{type:'object',properties:{title:{type:'string'},esTitle:{type:'string'},lines:{type:'array',minItems:count,maxItems:count,items:spanishReplySchema()}},required:['title','esTitle','lines'],additionalProperties:false}:{type:'object',properties:{title:{type:'string'},zhTitle:{type:'string'},lines:{type:'array',minItems:count,maxItems:count,items:replySchema()}},required:['title','zhTitle','lines'],additionalProperties:false}}
export function replySchema(){return {type:'object',properties:{en:{type:'string',pattern:'^[ -~]*[A-Za-z][ -~]*$'},zh:{type:'string',minLength:1}},required:['en','zh'],additionalProperties:false}}
export function spanishReplySchema(){return {type:'object',properties:{en:{type:'string',pattern:'^[ -~]*[A-Za-z][ -~]*$'},es:{type:'string',minLength:1}},required:['en','es'],additionalProperties:false}}
export function readBilingualReply(raw,{partial=false}={}){
  let result;
  if(partial){
    const field=key=>{const match=new RegExp('"'+key+'"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)').exec(raw);if(!match)return '';try{return JSON.parse('"'+match[1].replace(/\\u[0-9a-f]{0,3}$/i,'')+'"')}catch{return ''}};
    result={en:field('en'),zh:field('zh')};
  }else{
    result=JSON.parse(raw);
    if(typeof result.en!=='string'||typeof result.zh!=='string'||!/[A-Za-z]/.test(result.en)||/[\u3400-\u9fff]/u.test(result.en)||!/[\u3400-\u9fff]/u.test(result.zh))throw new Error('The model did not return both languages. Try a shorter message.');
  }
  return {en:result.en.trim(),zh:result.zh.trim()};
}
export function cleanOutput(value){return String(value||'').replace(/<think>[\s\S]*?<\/think>/g,'').replace(/<think>[\s\S]*$/g,'').replace(/^\s*<\/think>\s*/,'').trim()}

export async function verifyAIReady(engine,{signal,onDiagnostic=()=>{},timeoutMs=180000,backend='webgpu'}={}){
  const started=Date.now();
  const bounded=promise=>waitForAI(promise,{signal,timeoutMs:Math.max(1,timeoutMs-(Date.now()-started)),message:backend==='cpu'?'Phone AI took too long to reply. Close other apps and reload it, keeping this page open.':'The GPU model took too long to reply. Try Phone mode to use your device’s processor.'});
  for(let attempt=0;attempt<2;attempt++){
    if(signal?.aborted)throw normalizeAIError(signal.reason);
    if(attempt)await bounded(engine.resetChat());
    const response=await bounded(engine.chat.completions.create({messages:[{role:'user',content:attempt?'Say hello in one short sentence.':'Reply with the word Hello.'}],max_tokens:64,temperature:0,stream:false,extra_body:{enable_thinking:false}}));
    const raw=String(response?.choices?.[0]?.message?.content||''),visible=cleanOutput(raw);
    const diagnostic={attempt:attempt+1,finishReason:response?.choices?.[0]?.finish_reason||'unknown',completionTokens:response?.usage?.completion_tokens??null,rawLength:raw.length,visibleLength:visible.length};
    onDiagnostic(diagnostic);
    if(visible){await bounded(engine.resetChat());return diagnostic}
  }
  throw new Error(backend==='cpu'?'Phone AI returned two empty replies. Reload it and try again.':'The GPU model returned two empty replies. Try Phone mode to use your device’s processor instead.');
}
