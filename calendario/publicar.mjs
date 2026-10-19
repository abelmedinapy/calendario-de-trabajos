// Publica la app. Antes de desplegar le estampa la fecha al service worker:
// si sus bytes no cambian, el navegador no lo reinstala, no tira los caches
// viejos y se puede quedar con archivos de dos versiones distintas mezclados.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const sw = readFileSync('sw.js', 'utf-8')
  .replace(/const VERSION = '[^']*';/, `const VERSION = 'calendario-${sello}';`);
writeFileSync('sw.js', sw);
console.log(`service worker sellado: calendario-${sello}`);

execFileSync('wrangler', ['deploy'], { stdio: 'inherit' });
