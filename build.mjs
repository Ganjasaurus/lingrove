import { build } from 'esbuild';
import { mkdir,copyFile } from 'node:fs/promises';
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
console.log('Local AI runtime bundled successfully.');
