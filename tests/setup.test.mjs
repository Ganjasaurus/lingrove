import test from 'node:test';
import assert from 'node:assert/strict';
import {describeSetupFailure,isAppleMobile} from '../dist/setup-support.js';
import {checkModelStorage} from '../src/phone-support.js';
const transient='The operation failed for an unknown transient reason (e.g. out of memory).';
test('the screenshot error is a storage failure when file operations failed, not an OOM diagnosis',()=>{const error=new DOMException(transient,'UnknownError');error.stage='storage';const result=describeSetupFailure(error,'download',{apple:true});assert.match(result.message,/storage.*Safari/);assert.doesNotMatch(result.message,/out of memory/);assert.equal(result.phase,'storage');assert.equal(result.recovery,'browser')});
test('generic iOS errors preserve uncertainty and actual memory errors give different guidance',()=>{assert.match(describeSetupFailure(new DOMException(transient,'UnknownError'),'loading',{apple:true}).message,/does not identify the exact cause/);assert.match(describeSetupFailure(new RangeError('WebAssembly.Memory could not allocate'),'loading',{apple:true}).message,/enough memory/);assert.match(describeSetupFailure(new DOMException('Quota full','QuotaExceededError'),'download').message,/Free some space/);assert.equal(describeSetupFailure(new Error('HTTP 503'),'download').message,'HTTP 503')});
test('iPhone and iPad detection includes iPad desktop mode without treating Macs as phones',()=>{assert.ok(isAppleMobile({userAgent:'iPhone'}));assert.ok(isAppleMobile({platform:'MacIntel',maxTouchPoints:5}));assert.ok(!isAppleMobile({platform:'MacIntel',maxTouchPoints:0}));assert.ok(!isAppleMobile({userAgent:'Android'}))});
test('the storage preflight terminates its worker on success, rejection, timeout and cancellation',async()=>{
 for(const scenario of ['success','error','timeout','cancel']){
  let terminated=0;const controller=new AbortController();const makeWorker=()=>({terminate(){terminated++},postMessage(){if(scenario==='success')queueMicrotask(()=>this.onmessage({data:{ok:true}}));if(scenario==='error')queueMicrotask(()=>this.onmessage({data:{error:{name:'UnknownError',message:transient}}}));if(scenario==='cancel')controller.abort(new DOMException('Cancelled','AbortError'))}});
  const result=checkModelStorage({signal:controller.signal,timeoutMs:10,makeWorker});
  if(scenario==='success')await result;else await assert.rejects(result,e=>scenario==='cancel'?e.name==='AbortError':e.stage==='storage');assert.equal(terminated,1,scenario);
 }
});
test('an already cancelled preflight never creates a worker',async()=>{const controller=new AbortController();controller.abort(new DOMException('Cancelled','AbortError'));await assert.rejects(checkModelStorage({signal:controller.signal,makeWorker(){throw new Error('must not create worker')}}),e=>e.name==='AbortError')});
