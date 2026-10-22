export function isAppleMobile(nav=globalThis.navigator){return !!nav&&(/iPad|iPhone|iPod/i.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1))}

// WebKit's UnknownError text mentions memory even for failed file operations.
// Describe the operation that failed rather than treating that text as an OOM diagnosis.
export function describeSetupFailure(error,phase,{apple=isAppleMobile()}={}){
  const raw=typeof error==='string'?error:error?.message||'Qwen could not start.';
  const name=error?.name||'';
  const storage=error?.stage==='storage'||phase==='storage'||/No supported storage backend|QuotaExceeded|storage quota|createSyncAccessHandle/i.test(name+' '+raw);
  if(storage){
    const full=/quota|disk.*full|not enough.*space/i.test(name+' '+raw);
    return {message:full?'There is not enough browser storage for Qwen. Free some space, then retry. Your saved lessons have not been removed.':apple?'This browser could not open the storage Qwen needs. Open this link directly in Safari and try there.':'This browser could not open the storage Qwen needs. Open the link in a regular Chrome, Edge, Firefox or Safari tab and retry.',recovery:'browser',phase:error?.stage||phase};
  }
  if(/UnknownError|unknown transient reason/i.test(name+' '+raw))return {message:apple?'This browser could not finish setting up Qwen. Try the same link directly in Safari; this iOS error does not identify the exact cause.':'This browser could not finish setting up Qwen. Close other tabs and retry in a regular browser window.',recovery:'browser',phase};
  if(/out of memory|memory access|allocation failed|WebAssembly\.Memory|cannot enlarge memory/i.test(raw))return {message:'Qwen could not get enough memory to load. Close other apps and tabs, reopen this link'+(apple?' in Safari':' in your browser')+', and retry. Saved lessons are still available.',recovery:'browser',phase};
  return {message:raw,recovery:null,phase};
}
