// Match the file operations used by the model downloader, using only our own
// four-byte temporary file. Never touch lessons or existing cached model files.
self.onmessage=async()=>{
  let directory,handle,name='lingrove-probe-'+crypto.randomUUID(),failure;
  try{
    if(!navigator.storage?.getDirectory)throw new Error('Model storage is unavailable in this browser.');
    const root=await navigator.storage.getDirectory();
    directory=await root.getDirectoryHandle('cache',{create:true});
    const file=await directory.getFileHandle(name,{create:true});
    if(!file.createSyncAccessHandle)throw new Error('This browser does not support the model storage writer.');
    handle=await file.createSyncAccessHandle();
    const bytes=new Uint8Array([76,71,82,86]);
    if(handle.write(bytes,{at:0})!==4)throw new Error('The browser could not write the model storage check.');
    handle.flush();
    handle.close();handle=null;
    const saved=await file.getFile(),read=new Uint8Array(await saved.arrayBuffer());
    if(read.length!==4||read.some((value,i)=>value!==bytes[i]))throw new Error('The browser could not read the model storage check.');
  }catch(error){failure={name:error?.name||'Error',message:error?.message||String(error)}}
  finally{
    try{handle?.close()}catch(error){failure??={name:error.name,message:error.message}}
    try{if(directory)await directory.removeEntry(name)}catch(error){if(error.name!=='NotFoundError')failure??={name:error.name,message:error.message}}
  }
  self.postMessage(failure?{error:failure}:{ok:true});
};
