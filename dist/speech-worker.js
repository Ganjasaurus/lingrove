import initialize from './vendor/speech/espeak-ng.js';
let ready;
function engine(){return ready??=initialize().then(module=>({module,voice:new module.eSpeakNGWorker()})).catch(error=>{ready=null;throw error})}
self.onmessage=async({data})=>{
  try{
    const {voice}=await engine();voice.set_voice(data.lang==='zh'?'cmn':'en-us');voice.set_rate(data.rate||.85);
    const chunks=[];voice.synthesize(data.text,samples=>{if(samples.length)chunks.push(new Int16Array(samples));return false});
    const pcm=new Int16Array(chunks.reduce((total,part)=>total+part.length,0));let offset=0;for(const part of chunks){pcm.set(part,offset);offset+=part.length}
    if(!pcm.length||!pcm.some(sample=>sample!==0))throw new Error('The basic voice returned no audio.');
    self.postMessage({id:data.id,pcm,sampleRate:voice.get_samplerate()},[pcm.buffer]);
  }catch(error){self.postMessage({id:data.id,error:error?.message||String(error)})}
};
