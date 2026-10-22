import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('dist/vendor', { recursive: true });
await Promise.all([
  build({entryPoints:['src/worker.js'],bundle:true,format:'esm',outfile:'dist/vendor/worker.js',minify:true,target:'es2022'}),
  build({entryPoints:['src/engine.js'],bundle:true,format:'esm',outfile:'dist/vendor/engine.js',minify:true,target:'es2022'})
]);
console.log('Local AI runtime bundled successfully.');
