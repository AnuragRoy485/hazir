// Build-time asset versioning for Vercel. Rewrites every local asset URL's
// ?v= in *.html and every relative import in src/**.js to the deploy's commit
// SHA, so no deploy can serve HTML pointing at a stale cached module.
// Fails the build (exit 1) on any error: Vercel then keeps the previous,
// working deployment live instead of publishing inconsistent versions.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sha = process.env.VERCEL_GIT_COMMIT_SHA;
if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
  console.error('bump-assets: VERCEL_GIT_COMMIT_SHA missing or unexpected:', sha);
  process.exit(1);
}
const V = 'gh-' + sha.slice(0, 10);
const root = process.cwd();
const bump = url => url.replace(/\?v=[^"')]*$/, '') + '?v=' + V;

let changed = 0;
const rewrite = (file, s) => {
  const prev = readFileSync(file, 'utf8');
  const next = s(prev);
  if (next !== prev) { writeFileSync(file, next); changed++; }
};

for (const f of readdirSync(root).filter(f => f.endsWith('.html'))) {
  rewrite(join(root, f), s => s.replace(/((?:href|src))="([^"]+)"/g, (m, attr, url) => {
    if (/^(https?:|data:|mailto:|#|\/\/)/.test(url)) return m;
    if (!/^(\/)?(assets|src)\//.test(url)) return m;
    return attr + '="' + bump(url) + '"';
  }));
}

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []);
for (const f of walk(join(root, 'src'))) {
  rewrite(f, s => s
    .replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (m, a, u, q) => a + bump(u) + q)
    .replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+?)(['"]\s*\))/g, (m, a, u, q) => a + bump(u) + q)
    .replace(/(import\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (m, a, u, q) => a + bump(u) + q));
}
console.log('bump-assets: version ' + V + ', rewrote ' + changed + ' files');
