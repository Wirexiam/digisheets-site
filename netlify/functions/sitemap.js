// netlify/functions/sitemap.js
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  try {
    // Базовый origin: прод (URL) или предпросмотр (DEPLOY_PRIME_URL), иначе — из запроса
    const origin =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      (`https://${event.headers.host}`);

    // Читаем posts.json из репозитория (без сборки)
    const postsPath = path.resolve(__dirname, '..', '..', 'blog', 'posts.json');
    const postsRaw = fs.readFileSync(postsPath, 'utf8');
    const posts = JSON.parse(postsRaw);

    // Базовые статические страницы, которые хотите видеть в sitemap:
    const staticPages = [
      '/',            // главная
      '/blog/',       // список постов
      // добавьте при желании другие разделы сайта:
      // '/#features',  // якоря не включаем в sitemap, оставлено для примера
    ];

    // Превращаем посты в «красивые» URL: /blog/<slug>/
    // (если у вас есть папка /blog/<slug>/index.html — отлично; если нет —
    // всё равно можно включать ссылку, так как у вас есть редирект/заглушка)
    const postUrls = posts.map(p => ({
      loc: `${origin}/blog/${encodeURIComponent(p.slug)}/`,
      lastmod: (p.date && !Number.isNaN(Date.parse(p.date)))
        ? new Date(p.date).toISOString().slice(0, 10)
        : undefined,
      // можете добавить <changefreq> и <priority> при желании
    }));

    // Склеиваем
    const urlset = [
      ...staticPages.map(u => ({ loc: `${origin}${u}` })),
      ...postUrls,
    ];

    // Генерация XML
    const escapeXml = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset.map(u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `
    <lastmod>${u.lastmod}</lastmod>` : ``}
  </url>`).join('\n')}
</urlset>
`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // 5 минут кэша
      },
      body: xml
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Sitemap generation failed: ' + (err && err.message ? err.message : String(err))
    };
  }
};