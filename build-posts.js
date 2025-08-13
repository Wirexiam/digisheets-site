// build-posts.js — статическая генерация страниц постов для SEO
// Читает /blog/posts.json и соответствующие .md, рендерит /dist/blog/<slug>/index.html
// Генерирует sitemap.xml и robots.txt

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = "https://digisheets.ru"; // ваш прод-домен
const SRC_DIR  = path.join(__dirname);    // корень репо
const BLOG_DIR = path.join(__dirname, 'blog');
const DIST_DIR = path.join(__dirname, 'dist');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseFrontmatter(raw) {
  // Простая разметка фронтматтера вида:
  // ---
  // title: ...
  // description: ...
  // date: YYYY-MM-DD
  // cover: /assets/...
  // tags:
  // - Тег1
  // - Тег2
  // ---
  if (!raw.startsWith('---')) return { meta: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { meta: {}, body: raw };
  const block = raw.slice(3, end).trim();
  const body  = raw.slice(end + 4).replace(/^\s+/, '');
  const meta = {};
  const lines = block.split('\n');
  let currKey = null;
  let arr = null;
  for (const ln of lines) {
    const mArr = ln.match(/^\s*-\s+(.*)$/);
    if (mArr && currKey) {
      (arr ||= []).push(mArr[1].trim());
      meta[currKey] = arr;
      continue;
    }
    const mKV = ln.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (mKV) {
      currKey = mKV[1];
      const val = mKV[2].trim();
      if (val === '') { arr = []; meta[currKey] = arr; }
      else {
        if (/^(true|false)$/i.test(val)) meta[currKey] = /^true$/i.test(val);
        else meta[currKey] = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        arr = null;
      }
    }
  }
  return { meta, body };
}

function htmlEscape(s) {
  return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}

function renderTemplate({ title, description, cover, date, tags, slug, html }) {
  const pageTitle = `${title} — DigiSheets`;
  const canonical = `${SITE_URL}/blog/${slug}/`;
  const ogImage   = cover || `${SITE_URL}/assets/og-default.png`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    "description": description || title,
    "image": ogImage,
    "datePublished": date,
    "dateModified": date,
    "author": { "@type": "Organization", "name": "DigiSheets" },
    "publisher": {
      "@type": "Organization",
      "name": "DigiSheets",
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/assets/logo.png` }
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonical }
  };

  return [
`<!doctype html>
<html lang="ru" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${htmlEscape(pageTitle)}</title>
  <meta name="description" content="${htmlEscape(description || '')}">
  <link rel="icon" href="/favicon.ico">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${htmlEscape(title)}">
  <meta property="og:description" content="${htmlEscape(description || '')}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${htmlEscape(title)}">
  <meta name="twitter:description" content="${htmlEscape(description || '')}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="/blog/blog.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <header class="header">
    <div class="container header__inner">
      <a class="logo" href="/#hero">DigiSheets</a>
      <nav class="nav">
        <button class="burger" id="burger" aria-label="Открыть меню" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <ul id="navList" class="nav-list">
          <li><a class="nav-link" href="/#features">Возможности</a></li>
          <li><a class="nav-link" href="/#walkthrough">Быстрый запуск</a></li>
          <li><a class="nav-link" href="/#cases">Кейсы</a></li>
          <li><a class="nav-link" href="/#guide">Гайд</a></li>
          <li><a class="nav-link" href="/#testimonials">Отзывы</a></li>
          <li><a class="nav-link" href="/#custom">Внедрение</a></li>
          <li><a class="nav-link" href="/#faq">FAQ</a></li>
          <li><a class="nav-link" href="/#partners">Партнёры</a></li>
          <li><a class="nav-link" href="/blog/">Блог</a></li>
          <li><a class="btn primary" target="_blank" rel="noopener"
                 href="https://script.google.com/macros/s/AKfycbwUhLtIB5H9LjEGhBLCdTEyYNn6oDTI3xm5yPKCYyixNEa676JOIvt_gJQp3TRwNGibMw/exec">Создать таблицу</a></li>
          <li><button id="themeToggle" class="btn ghost" type="button">🌙 Тёмная</button></li>
        </ul>
      </nav>
    </div>
  </header>

  <main class="section">
    <article class="container" style="max-width:800px">
      <p><a class="btn secondary" href="/blog/">← Ко всем статьям</a></p>
      <h1 id="postTitle" style="margin:12px 0">${htmlEscape(title)}</h1>
      <p id="postMeta" style="color:var(--muted);margin-bottom:10px">${date ? new Date(date).toLocaleDateString('ru-RU') : ''}${Array.isArray(tags) && tags.length ? ' • ' + tags.join(', ') : ''}</p>
      ${cover ? `<img class="post-cover" src="${htmlEscape(cover)}" alt="${htmlEscape(title)}">` : ''}
      <div id="postContent" class="post-content">${html}</div>
    </article>
  </main>

  <footer class="footer">
    <div class="container footer__inner">
      <div class="footer__brand">
        <a class="logo" href="/#hero">DigiSheets</a>
        <p>AI-инструменты для контент-команд на базе Google&nbsp;Таблиц.</p>
        <a href="https://t.me/s/digis_news" target="_blank" rel="noopener" class="footer-telegram" aria-label="Наш Telegram-канал">
          <img src="/assets/telegram.svg" alt="Telegram" width="32" height="32">
        </a>
      </div>
      <nav class="footer__nav" aria-label="Навигация футера">
        <strong>Продукт</strong>
        <a href="/#features">Возможности</a>
        <a href="/#walkthrough">Быстрый запуск</a>
        <a href="/#cases">Кейсы</a>
        <a href="/#guide">Гайд</a>
        <a href="/#faq">FAQ</a>
      </nav>
      <nav class="footer__nav" aria-label="Компания">
        <strong>Компания</strong>
        <a href="/#partners">Партнёры</a>
        <a href="/#testimonials">Отзывы</a>
        <a href="/#custom">Внедрение</a>
        <a href="/blog/">Блог</a>
        <a href="/privacy-policy.html">Политика конфиденциальности</a>
      </nav>
    </div>
    <div class="footer__bottom">
      <div class="container">
        © DigiSheets, 2025 • <a href="mailto:info@digisheets.ru">info@digisheets.ru</a>
      </div>
    </div>
  </footer>
  <script src="/main.js"></script>
</body>
</html>`
  ].join('\n');
}

(async function main() {
  ensureDir(DIST_DIR);

  // Копируем статические файлы сайта как есть (кроме блога — его сгенерим выборочно)
  // Если у вас весь сайт в корне, минимум — скопируйте /blog и корневые статические.
  // Здесь скопируем всё содержимое репозитория в dist, затем перезапишем /blog/ постами.
  // (Простой вариант без зависимостей на копировщики.)
  function copyDir(src, dst) {
    ensureDir(dst);
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === '.git') continue;
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) copyDir(s, d);
      else fs.copyFileSync(s, d);
    }
  }
  copyDir(SRC_DIR, DIST_DIR);

  // Прочитаем манифест постов
  const postsJsonPath = path.join(DIST_DIR, 'blog', 'posts.json');
  const posts = readJSON(postsJsonPath);

  // Настраиваем MarkdownIt
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight: (str, lang) => {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return `<pre><code class="language-${lang}">${hljs.highlight(str, { language: lang }).value}</code></pre>`;
        }
      } catch {}
      const esc = str.replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
      return `<pre><code>${esc}</code></pre>`;
    }
  });

  // Сгенерим страницы постов
  const urls = [];
  for (const p of posts) {
    const slug = String(p.slug);
    const mdPath = p.md && !/^https?:\/\//.test(p.md)
      ? path.join(DIST_DIR, 'blog', p.md)
      : null;

    let raw = '';
    if (mdPath && fs.existsSync(mdPath)) {
      raw = readText(mdPath);
    } else {
      // если md отсутствует (например HTML-пост) — пропускаем в статике
      continue;
    }

    const { meta, body } = parseFrontmatter(raw);
    const title = (meta.title || p.title || '').trim();
    const description = (meta.description || p.description || '').trim();
    const date = (meta.date || p.date || '').trim();
    const tags = Array.isArray(meta.tags) ? meta.tags : (Array.isArray(p.tags) ? p.tags : []);
    const cover = (meta.cover || p.cover || '').trim();

    const html = md.render(body);

    const outDir = path.join(DIST_DIR, 'blog', slug);
    ensureDir(outDir);
    fs.writeFileSync(
      path.join(outDir, 'index.html'),
      renderTemplate({ title, description, cover, date, tags, slug, html }),
      'utf8'
    );

    urls.push(`${SITE_URL}/blog/${slug}/`);
  }

  // Обновим список — чтобы в нём были красивые URL (ссылки дальше поправим в blog.js)
  // (Ничего не меняем в JSON, просто для sitemap).
  // Генерация sitemap.xml:
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ]
    .concat(urls.map(u => `  <url><loc>${u}</loc></url>`))
    .concat(['</urlset>'])
    .join('\n');

  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf8');

  // robots.txt (мягкий, разрешающий индексацию)
  const robots = [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${SITE_URL}/sitemap.xml`
  ].join('\n');
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots, 'utf8');

  console.log('Build complete.');
})();
