// generate-sitemap.js — полная карта сайта по итоговому билду (без #якорей)
// - Обходит publish-директорию (dist/ или .)
// - Генерирует <loc>, <lastmod> (YYYY-MM-DD), опционально <changefreq>/<priority>
// - Позволяет переписать URL (канонизация: .html → со слэшем и т.п.)

import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://digisheets.ru';

// 1) Где искать собранные файлы
const ROOT = fs.existsSync(path.join(process.cwd(), 'dist'))
  ? path.join(process.cwd(), 'dist')
  : process.cwd();

const OUT = path.join(ROOT, 'sitemap.xml');

// 2) Исключения (регэкспы по URL-пути внутри publish-директории)
const EXCLUDE = [
  /^\/404\.html$/i,
  /^\/500\.html$/i,
  /^\/blog\/post\.html$/i,
  /^\/netlify\//i,
  /^\/assets\//i,
  /^\/blog\/posts\/.*\.md$/i,
  /^\/yandex_[a-z0-9]+\.html$/i   // <-- добавили
];


// 3) Канонизация URL (при желании можно включить/изменить правила)
const CANONICAL_REWRITE = [
  // Пример: /partners/digiup.html -> /partners/digiup/
  { from: /^\/partners\/([a-z0-9-]+)\.html$/i, to: (_m, slug) => `/partners/${slug}/` }
  // Добавляйте свои правила выше по мере надобности
];

// 4) Метаданные для changefreq/priority (по URL-пути ПОСЛЕ канонизации)
const URL_META = {
  '/':                       { changefreq: 'weekly',  priority: '1.0' },
  '/blog/':                  { changefreq: 'weekly',  priority: '0.8' },
  '/privacy-policy.html':    { changefreq: 'yearly',  priority: '0.5' },
  '/partners/digiup/':       { changefreq: 'yearly',  priority: '0.8' },
  '/partners/become.html':   { changefreq: 'yearly',  priority: '0.6' }
  // Можете дополнять списком ваших страниц
};

// ===== Вспомогательные =====
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

function toUrlPath(fileAbs) {
  const rel = fileAbs.replace(ROOT, '').replace(/\\/g, '/'); // /index.html, /dir/index.html, /page.html
  if (!rel.endsWith('.html')) return null;

  // /index.html -> /
  if (/^\/index\.html$/i.test(rel)) return '/';

  // /dir/index.html -> /dir/
  const m = rel.match(/^\/(.+?)\/index\.html$/i);
  if (m) return `/${m[1].replace(/\/+/g, '/')}/`;

  // /page.html -> /page.html
  return rel;
}

function isExcluded(urlPath) {
  return EXCLUDE.some(re => re.test(urlPath));
}

function canonicalize(urlPath) {
  let out = urlPath;
  for (const rule of CANONICAL_REWRITE) {
    const m = out.match(rule.from);
    if (m) {
      out = typeof rule.to === 'function' ? rule.to(...m) : out.replace(rule.from, rule.to);
      break;
    }
  }
  return out;
}

function ymd(date) {
  // YYYY-MM-DD (как в вашем «старом» файле)
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function lastmodFor(fileAbs) {
  try { return ymd(fs.statSync(fileAbs).mtime); }
  catch { return ymd(new Date()); }
}

// ===== Основной билд =====
function build() {
  const files = walk(ROOT);
  const items = [];

  for (const f of files) {
    let urlPath = toUrlPath(f);
    if (!urlPath) continue;
    if (isExcluded(urlPath)) continue;

    urlPath = canonicalize(urlPath);

    const meta = URL_META[urlPath] || {};
    items.push({
      loc: SITE_URL + urlPath,
      lastmod: lastmodFor(f),
      changefreq: meta.changefreq,
      priority: meta.priority
    });
  }

  // Упорядочим по loc
  items.sort((a, b) => a.loc.localeCompare(b.loc));

  const builtAt = new Date().toISOString();
  const xml = [
    `<!--  built at ${builtAt}  -->`,
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ]
    .concat(items.map(it => {
      const extra =
        (it.changefreq ? `<changefreq>${it.changefreq}</changefreq>` : '') +
        (it.priority   ? `<priority>${it.priority}</priority>`       : '');
      return `  <url>\n    <loc>${it.loc}</loc>\n    <lastmod>${it.lastmod}</lastmod>\n${extra ? '    ' + extra + '\n' : ''}  </url>`;
    }))
    .concat(['</urlset>'])
    .join('\n');

  fs.writeFileSync(OUT, xml, 'utf8');
  console.log(`Generated ${OUT} with ${items.length} URLs`);
}

build();
