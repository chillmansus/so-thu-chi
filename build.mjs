// Builds the installable app into dist/ from src/.
// src/index.html has no doctype (so it can also be shown as a prototype page);
// this script wraps it in a real page and adds the manifest, icons and service worker.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'icons'), { recursive: true });

const page = readFileSync(join(src, 'index.html'), 'utf8');
const cut = page.indexOf('<div id="app">');
if (cut < 0) throw new Error('src/index.html: <div id="app"> not found');
const head = page.slice(0, cut).replace(/<meta name="claude:[^>]*>\s*/g, '').trim();
const body = page.slice(cut).trim();

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="description" content="Sổ ghi thu chi hằng ngày và thống kê theo tháng.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon-64.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Thu Chi">
${head}
</head>
<body>
${body}
</body>
</html>
`;

const files = { 'index.html': html };
for (const f of ['app.css', 'fx.js', 'sfx.js', 'firebase-config.js', 'app.js', 'manifest.webmanifest']) files[f] = readFileSync(join(src, f));

// cloud.js: sign-in and backup, with the Firebase SDK packed into one file so it also works offline.
// "node build.mjs --mock" packs a pretend server instead, for trying the flow on this computer.
const mock = process.argv.includes('--mock');
const cloud = await build({
  entryPoints: [mock ? join(root, 'tools', 'cloud-mock.js') : join(src, 'cloud-entry.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', legalComments: 'none', write: false,
});
files['cloud.js'] = cloud.outputFiles[0].contents;
for (const f of readdirSync(join(src, 'icons'))) files['icons/' + f] = readFileSync(join(src, 'icons', f));

const hash = createHash('sha256');
for (const [name, data] of Object.entries(files)) { hash.update(name); hash.update(data); }
// Content hash + build time: every deploy gets a fresh cache, so the phone always picks up the newest copy.
const version = hash.digest('hex').slice(0, 8) + '-' + Date.now().toString(36);

const assets = ['./', ...Object.keys(files).map(f => './' + f)];
files['sw.js'] = readFileSync(join(src, 'sw.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__ASSETS__', JSON.stringify(assets));

for (const [name, data] of Object.entries(files)) writeFileSync(join(dist, name), data);
console.log(`built dist/ (${Object.keys(files).length} files, version ${version}, cloud.js ${Math.round(files['cloud.js'].length / 1024)} KB${mock ? ', PRETEND SERVER' : ''})`);
