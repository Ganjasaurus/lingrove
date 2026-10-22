import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAIError,waitForAI,lessonSchema,verifyAIReady,readBilingualReply} from '../dist/ai-support.js';
import {ai,complete,cancelAI,stopGeneration} from '../dist/ai.js';
import {WebWorkerMLCEngine} from '@mlc-ai/web-llm';
const message=[{role:'user',content:'Hello'}];
function ready(engine){cancelAI();ai.status='ready';ai.engine=engine}
function engineFor(create){return {chat:{completions:{create}},interruptGenerate(){}}}
const chunk=text=>({choices:[{delta:{content:text}}]});
const never=()=>new Promise(()=>{});

test('the real WebLLM worker client string rejection becomes a visible Error',async()=>{
  const worker={postMessage(msg){if(msg.kind==='chatCompletionStreamInit')queueMicrotask(()=>worker.onmessage({kind:'throw',uuid:msg.uuid,content:'Error: GPU device lost'}))}};
  const engine=new WebWorkerMLCEngine(worker);engine.modelId=['test'];ready(engine);
  await assert.rejects(complete(message),e=>e instanceof Error&&e.message==='Error: GPU device lost');
  assert.equal(ai.status,'error');assert.equal(ai.busy,false);
});
test('lesson generation sends an explicit serializable schema and returns streamed text',async()=>{
  let request;ready(engineFor(async r=>{request=r;return (async function*(){yield chunk('{"title":"Tea"');yield chunk('}')})()}));
  const answer=await complete(message,{json:true,schema:lessonSchema(6)});
  assert.equal(answer,'{"title":"Tea"}');const schema=JSON.parse(request.response_format.schema);assert.equal(schema.properties.lines.minItems,6);assert.equal(schema.properties.lines.items.required.length,2);assert.equal(request.extra_body.enable_thinking,false);assert.equal(ai.busy,false);
});
test('dead stream initialization has a deadline and releases the UI',async()=>{
  let terminated=false;ready(engineFor(never));ai.worker={terminate(){terminated=true}};
  await assert.rejects(complete(message,{firstTokenTimeoutMs:20}),e=>e.name==='TimeoutError');assert.equal(terminated,true);assert.equal(ai.status,'error');assert.equal(ai.busy,false);
});
test('a stalled stream chunk rejects rather than locking the generation queue',async()=>{
  ready(engineFor(async()=>({[Symbol.asyncIterator](){return {next:never}}})));
  await assert.rejects(complete(message,{firstTokenTimeoutMs:20}),/did not start replying/);
  ready(engineFor(async function*(){yield chunk('Hello!')}));assert.equal(await complete(message),'Hello!');
});
test('cancelling rejects active and queued work immediately',async()=>{
  ready(engineFor(never));const a=complete(message),b=complete(message);const outcome=Promise.allSettled([a,b]);await new Promise(r=>setTimeout(r,5));cancelAI();
  const results=await outcome;assert.ok(results.every(r=>r.status==='rejected'&&r.reason.name==='AbortError'));assert.equal(ai.busy,false);
});
test('empty and plain string model failures have a readable message',async()=>{
  ready(engineFor(async()=>{throw 'The model failed'}));await assert.rejects(complete(message),/The model failed/);assert.equal(ai.busy,false);
  ready(engineFor(async function*(){}));await assert.rejects(complete(message),/returned no answer/);
  assert.ok(normalizeAIError(undefined).message.length>0);
});
test('abort before a network task settles rejects once without losing the original rejection',async()=>{
  const c=new AbortController();c.abort(new DOMException('Cancelled','AbortError'));await assert.rejects(waitForAI(Promise.reject('late error'),{signal:c.signal}),/Cancelled/);
});
test('a normal stop drains the iterator and keeps the ready engine usable',async()=>{
  ready(engineFor(async function*(){yield chunk('A partial');await new Promise(r=>setTimeout(r,5));yield chunk(' reply')}));
  const request=complete(message,{onToken:()=>stopGeneration()});await assert.rejects(request,e=>e.name==='AbortError'&&e.partial==='A partial reply');assert.equal(ai.status,'ready');assert.equal(ai.busy,false);
});
for(const finish of ['length','stop'])test(`readiness retries an empty ${finish} reply with sufficient token budget`,async()=>{
  let calls=0,resets=0;const diagnostics=[];
  const engine={...engineFor(async request=>{assert.equal(request.max_tokens,64);return {choices:[{message:{content:++calls===1?'<think>\n\n</think>\n\n':'<think>\n\n</think>\n\nHello'},finish_reason:finish}],usage:{completion_tokens:8}}}),resetChat:async()=>{resets++}};
  await verifyAIReady(engine,{onDiagnostic:d=>diagnostics.push(d)});assert.equal(calls,2);assert.equal(resets,2);assert.equal(diagnostics[0].visibleLength,0);assert.equal(diagnostics[1].visibleLength,5);
});
test('readiness accepts a first visible reply without extra generation',async()=>{
  let calls=0;const engine={...engineFor(async()=>{calls++;return {choices:[{message:{content:'Hello'}}]}}),resetChat:async()=>{}};await verifyAIReady(engine);assert.equal(calls,1);
});
test('two empty readiness replies fail instead of marking an unhealthy model ready',async()=>{
  const engine={...engineFor(async()=>({choices:[{message:{content:'<think>\n</think>'}}]})),resetChat:async()=>{}};await assert.rejects(verifyAIReady(engine),/two empty/);
});
test('cancellation during readiness does not retry',async()=>{
  const controller=new AbortController();let calls=0;const engine={...engineFor(async()=>{calls++;controller.abort(new DOMException('Cancelled','AbortError'));return {choices:[{message:{content:''}}]}}),resetChat:async()=>{}};
  await assert.rejects(verifyAIReady(engine,{signal:controller.signal}),e=>e.name==='AbortError');assert.equal(calls,1);
});
test('bilingual streaming renders text without exposing partial JSON or broken escapes',()=>{
  assert.deepEqual(readBilingualReply('{"en":"Hello, \\"friend\\"!","zh":"你',{partial:true}),{en:'Hello, "friend"!',zh:'你'});
  assert.deepEqual(readBilingualReply('{"en":"Hi","zh":"\\u4f',{partial:true}),{en:'Hi',zh:''});
  assert.throws(()=>readBilingualReply('{"en":"Hi","zh":"Hi"}'),/both languages/);
  assert.deepEqual(readBilingualReply('{"en":"Hi","zh":"你好"}'),{en:'Hi',zh:'你好'});
});
