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
export function lessonSchema(count=4){return {type:'object',properties:{title:{type:'string'},zhTitle:{type:'string'},lines:{type:'array',minItems:count,maxItems:count,items:{type:'object',properties:{en:{type:'string'},zh:{type:'string'},pinyin:{type:'string'}},required:['en','zh','pinyin'],additionalProperties:false}}},required:['title','zhTitle','lines'],additionalProperties:false}}
export function cleanOutput(value){return String(value||'').replace(/<think>[\s\S]*?<\/think>/g,'').replace(/<think>[\s\S]*$/g,'').replace(/^\s*<\/think>\s*/,'').trim()}
