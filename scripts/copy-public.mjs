/**
 * Copies public/ fragments (manifest.json + icons) into dist/ after the Vite
 * build so the final dist/ is a directly loadable extension directory.
 */
import { cpSync, mkdirSync, readdirSync, statSync, existsSync, renameSync, rmSync, readFileSync } from 'node:fs';
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

// Validate the manifest so a misconfigured extension never ships (e.g. the
// earlier "default_locale: null" bug that Chrome rejects at load time).
{
  const manifestPath = join(distDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const errors = [];
  if (manifest.manifest_version !== 3) errors.push('manifest_version must be 3');
  if (!manifest.name || typeof manifest.name !== 'string') errors.push('name must be a non-empty string');
  if (!manifest.version || typeof manifest.version !== 'string') errors.push('version must be a string');
  if ('default_locale' in manifest && !fsHasLocales(publicDir)) {
    errors.push("'default_locale' is set but there is no _locales/ directory; remove it or add _locales");
  }
  for (const ref of Object.values(manifest.icons ?? {})) {
    if (!existsSync(join(distDir, ref))) errors.push(`icon missing: ${ref}`);
  }
  if (manifest.action?.default_icon) {
    for (const ref of Object.values(manifest.action.default_icon)) {
      if (!existsSync(join(distDir, ref))) errors.push(`action icon missing: ${ref}`);
    }
  }
  if (manifest.background?.service_worker && !existsSync(join(distDir, manifest.background.service_worker))) {
    errors.push(`service worker missing: ${manifest.background.service_worker}`);
  }
  if (errors.length > 0) {
    console.error('Manifest validation FAILED:\n - ' + errors.join('\n - '));
    process.exit(1);
  }
  console.log('manifest validation OK');
}

function fsHasLocales(dir) {
  try {
    return statSync(join(dir, '_locales')).isDirectory();
  } catch {
    return false;
  }
}

console.log('Public assets copied to dist/.');
