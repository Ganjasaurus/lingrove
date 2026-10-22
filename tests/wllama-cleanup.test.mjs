import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {patchWllama381} from '../scripts/patch-wllama-381.mjs';
const original=await readFile(new URL('../node_modules/@wllama/wllama/esm/index.js',import.meta.url),'utf8');
const patched=patchWllama381(original);
const folder=await mkdtemp(join(tmpdir(),'lingrove-cleanup-'));
const modulePath=join(folder,'patched.mjs');
await writeFile(modulePath,patched);
const {CacheManager}=await import(pathToFileURL(modulePath).href);
await rm(folder,{recursive:true});

Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 Version/26.3 Mobile Safari/605.1',storage:{getDirectory(){}}},configurable:true});
const results=[];
for (const failAt of ['constructor','open','write','close',null]) {
  const workers=[];let created=0,revoked=0;
  const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
  URL.createObjectURL=blob=>{created++;return originalCreate(blob)};
  URL.revokeObjectURL=url=>{revoked++;return originalRevoke(url)};
  globalThis.Worker=class extends EventTarget {
    constructor(){super();if(failAt==='constructor')throw new Error('simulated constructor failure');this.terminated=false;workers.push(this)}
    postMessage(message){queueMicrotask(()=>{const data=message.action===failAt?{err:new DOMException('simulated OPFS failure','UnknownError')}:{ok:true};const e=new MessageEvent('message',{data});this.dispatchEvent(e);this.onmessage?.(e)})}
    terminate(){this.terminated=true}
  };
  let error=null;
  try {await new CacheManager().write('probe',new Blob(['1234']).stream(),{originalURL:'probe',originalSize:4,etag:'x'})}catch(e){error=e.message}
  finally {URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke}
  assert.equal(workers.filter(w=>w.terminated).length,workers.length,`${failAt}: all workers terminated`);
  assert.equal(revoked,created,`${failAt}: all worker URLs revoked`);
  assert.equal(Boolean(error),failAt!==null);
  results.push({test:'CacheManager write',failAt,error,workers:workers.length,terminated:workers.filter(w=>w.terminated).length,urlsCreated:created,urlsRevoked:revoked});
}
assert.throws(()=>patchWllama381(original+' '),/exact audited/);
assert.throws(()=>patchWllama381(original,'3.8.2'),/exact audited/);
results.push({test:'Source and version guards',passed:true});

// Execute the embedded worker code itself with a sync handle whose flush fails.
const workerCode=JSON.parse(patched.match(/^var OPFS_UTILS_WORKER_CODE = (.*);$/m)[1]);
let closed=0;const messages=[];
const handle={truncate(){},flush(){throw new Error('simulated flush failure')},close(){closed++},write(){return 4}};
const file={createSyncAccessHandle:async()=>handle};const dir={getDirectoryHandle:async()=>dir,getFileHandle:async()=>file};
const context=vm.createContext({AbortController,TextEncoder,navigator:{storage:{getDirectory:async()=>dir}},postMessage:message=>messages.push(message)});
vm.runInContext(workerCode,context);
await context.onmessage({data:{action:'open',filename:'probe'}});
await context.onmessage({data:{action:'close'}});
assert.equal(closed,1);
assert.equal(messages.at(-1).err.message,'simulated flush failure');
await context.onmessage({data:{action:'close'}});
assert.equal(closed,1);
assert.equal(messages.at(-1).ok,true);
results.push({test:'Worker flush failure closes handle and preserves error',passed:true,closed});

// Lifecycle: no premature revocation; error and early termination both release URLs.
const factory=patched.slice(patched.indexOf('var createWorker = (workerCode) => {'),patched.indexOf('var cbToAsyncIter'));
for(const event of ['terminate','error','message']){
 let revoked=0,terminated=0;
 class Fake extends EventTarget {terminate(){terminated++}}
 const sandbox={Blob,URL:{createObjectURL:()=> 'blob:probe',revokeObjectURL(){revoked++}},Worker:Fake};
 const create=vm.runInNewContext('const isString = v => typeof v === "string";'+factory+';createWorker',sandbox);
 const worker=create('postMessage(1)');assert.equal(revoked,0);
 if(event==='terminate')worker.terminate();else worker.dispatchEvent(new Event(event));
 assert.equal(revoked,1);
 worker.terminate();assert.equal(revoked,1);
 results.push({test:'Worker URL lifecycle',event,revoked,terminated});
}
console.log('Wllama cleanup: all 10 fault-injection and lifecycle checks passed.');
