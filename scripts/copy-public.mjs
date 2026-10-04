/**
 * Copies public/ fragments (manifest.json + icons) into dist/ after the Vite
 * build so the final dist/ is a directly loadable extension directory.
 */
import { cpSync, mkdirSync, readdirSync, statSync, existsSync, renameSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const distDir = join(root, 'dist');

mkdirSync(distDir, { recursive: true });

for (const entry of readdirSync(publicDir)) {
  const src = join(publicDir, entry);
  const dst = join(distDir, entry);
  if (statSync(src).isDirectory()) cpSync(src, dst, { recursive: true });
  else cpSync(src, dst);
  console.log(`copied ${entry}`);
}

// Vite writes the multi-page HTML under dist/src/<page>/index.html because the
// inputs live in src/. Relocate them to dist/<page>/index.html to match the
// manifest's popup/index.html and options/index.html references.
for (const page of ['popup', 'options']) {
  const nested = join(distDir, 'src', page);
  const target = join(distDir, page);
  if (existsSync(nested)) {
    mkdirSync(distDir, { recursive: true });
    rmSync(target, { recursive: true, force: true });
    renameSync(nested, target);
    console.log(`relocated ${page} -> dist/${page}`);
  }
}
// Remove the now-empty dist/src remainder.
rmSync(join(distDir, 'src'), { recursive: true, force: true });

console.log('Public assets copied to dist/.');
