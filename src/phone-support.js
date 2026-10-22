export function checkModelStorage({signal,timeoutMs=12000,makeWorker=()=>new Worker('/storage-probe.js?v=6')}={}){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(signal.reason);return}
    let worker,timer,finished=false;
    const done=(error)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker?.terminate();if(error){if(error.name!=='AbortError')error.stage='storage';reject(error)}else resolve()};
    const cancel=()=>done(signal.reason||new DOMException('Setup stopped.','AbortError'));
    try{
      worker=makeWorker();
      worker.onmessage=({data})=>{if(data?.ok)done();else{const error=new Error(data?.error?.message||'Browser storage check failed.');error.name=data?.error?.name||'Error';done(error)}};
      worker.onerror=event=>{event.preventDefault?.();done(new Error('The browser storage check could not run.'))};
      worker.onmessageerror=()=>done(new Error('The browser storage check returned an unreadable response.'));
      timer=setTimeout(()=>done(new Error('The browser storage check did not finish.')),timeoutMs);
      signal?.addEventListener('abort',cancel,{once:true});worker.postMessage({check:true});
    }catch(error){done(error)}
  });
}
