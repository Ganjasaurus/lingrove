import { build } from 'esbuild';
import { mkdir,copyFile,cp,readFile } from 'node:fs/promises';
await mkdir('dist/vendor', { recursive: true });
await Promise.all([
  build({entryPoints:['src/worker.js'],bundle:true,format:'esm',outfile:'dist/vendor/worker.js',minify:true,target:'es2022'}),
  build({entryPoints:['src/engine.js'],bundle:true,format:'esm',outfile:'dist/vendor/engine.js',minify:true,target:'es2022'}),
  build({entryPoints:['src/cpu.js'],bundle:true,format:'esm',outfile:'dist/vendor/cpu.js',minify:true,target:'es2022'}),
  build({entryPoints:['src/language.js'],bundle:true,format:'esm',outfile:'dist/vendor/language.js',minify:true,target:'es2022'}),
  copyFile('node_modules/@wllama/wllama/esm/wasm/wllama.wasm','dist/vendor/wllama.wasm'),
  copyFile('node_modules/@wllama/wllama-compat/wasm/wllama.wasm','dist/vendor/wllama-compat.wasm'),
  copyFile('node_modules/@wllama/wllama-compat/wasm/wllama.js','dist/vendor/wllama-compat.js')
]);
// Ship the exact rebuilt English/Mandarin runtime with its corresponding source.
// The runtime uses import.meta.url to find the adjacent data; do not bundle it.
await cp('third_party/speech','dist/vendor/speech',{recursive:true});
const provenance=JSON.parse(await readFile('third_party/speech/provenance.json','utf8'));
const {createHash}=await import('node:crypto');
for(const file of provenance.files){
  const bytes=await readFile('dist/vendor/speech/'+file.name);
  if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Speech asset differs from pinned source build: '+file.name);
  if(bytes.length>=25*1024*1024)throw new Error('Speech asset exceeds hosting limit: '+file.name);
}
console.log('Local AI, pronunciation and pinned bilingual speech runtimes bundled.');
