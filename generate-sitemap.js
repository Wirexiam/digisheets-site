// generate-sitemap.js — полная карта сайта по итоговому билду
// Обходит publish-директорию (dist/ или .), находит все HTML-страницы и пишет sitemap.xml

import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://digisheets.ru';

// Вычисляем корень публикации: если есть dist — берём его, иначе корень
const ROOT = fs.existsSync(path.join(process.cwd(), 'dist'))
  ? path.join(process.cwd(), 'dist')
  : process.cwd();

const OUT = path.join(ROOT, 'sitemap.xml');

// Исключения (регулярки по путям внутри publish-директории)
const EXCLUDE = [
  /^\/404\.html$/i,
  /^\/500\.html$/i,
  /^\/blog\/post\.html$/i,      // старая страница-мост
  /^\/netlify\//i,              // служебные
  /^\/assets\//i,               // статические ассеты
  /^\/blog\/posts\/.*\.md$/i    // исходники постов
];

function toUrlPath(fileAbs) {
  const rel = fileAbs.replace(ROOT, '').replace(/\\/g, '/'); // кросс-платформенный путь
  if (!rel.endsWith('.html')) return null;

  // /index.html -> /
  if (/^\/index\.html$/i.test(rel)) return '/';

  // /dir/index.html -> /dir/
  const m = rel.match(/^\/(.+?)\/index\.html$/i);
  if (m) return `/${m[1].replace(/\/+/g,'/')}/`;

  // /page.html -> /page.html  (пускаем как есть)
  return rel;
}

function isExcluded(urlPath) {
  return EXCLUDE.some(re => re.test(urlPath));
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

function isoDate(p) {
  try { return new Date(fs.statSync(p).mtime).toISOString(); }
  catch { return new Date().toISOString(); }
}

function build() {
  const files = walk(ROOT);
  const items = [];

  for (const f of files) {
    const urlPath = toUrlPath(f);
    if (!urlPath) continue;
    if (isExcluded(urlPath)) continue;

    items.push({
      loc: SITE_URL + urlPath,
      lastmod: isoDate(f)
    });
  }

  // Упорядочим красиво: сначала корень, потом каталоги, затем файлы без index
  items.sort((a, b) => a.loc.localeCompare(b.loc));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ]
    .concat(items.map(it => `  <url><loc>${it.loc}</loc><lastmod>${it.lastmod}</lastmod></url>`))
    .concat(['</urlset>'])
    .join('\n');

  fs.writeFileSync(OUT, xml, 'utf8');
  console.log(`Generated ${OUT} with ${items.length} URLs`);
}

build();
