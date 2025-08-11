// /generate-sitemap.js
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://digisheets.ru';
const today = new Date().toISOString().split('T')[0];

// читаем /blog/posts.json из корня
const postsPath = path.join(__dirname, 'blog', 'posts.json');
let posts = [];
if (fs.existsSync(postsPath)) {
  posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));
}

// статические урлы
const staticUrls = [
  { loc: `${baseUrl}/`, lastmod: today, changefreq: 'weekly',  priority: 1.0 },
  { loc: `${baseUrl}/#hero`, lastmod: today, changefreq: 'monthly', priority: 0.9 },
  { loc: `${baseUrl}/#features`, lastmod: today, changefreq: 'monthly', priority: 0.8 },
  { loc: `${baseUrl}/#walkthrough`, lastmod: today, changefreq: 'monthly', priority: 0.8 },
  { loc: `${baseUrl}/#cases`, lastmod: today, changefreq: 'monthly', priority: 0.7 },
  { loc: `${baseUrl}/#guide`, lastmod: today, changefreq: 'monthly', priority: 0.8 },
  { loc: `${baseUrl}/#testimonials`, lastmod: today, changefreq: 'yearly',  priority: 0.6 },
  { loc: `${baseUrl}/#custom`, lastmod: today, changefreq: 'yearly',  priority: 0.7 },
  { loc: `${baseUrl}/#partners`, lastmod: today, changefreq: 'yearly',  priority: 0.4 },
  { loc: `${baseUrl}/partners/digiup`, lastmod: today, changefreq: 'yearly', priority: 0.8 },
  { loc: `${baseUrl}/blog/`, lastmod: today, changefreq: 'weekly', priority: 0.8 }
];

// посты
const postUrls = posts.map(p => ({
  loc: `${baseUrl}/blog/post.html?slug=${p.slug}`,
  lastmod: p.date || today,
  changefreq: 'monthly',
  priority: 0.7
}));

const urls = [...staticUrls, ...postUrls];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- built at ${new Date().toISOString()} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('')}
</urlset>`.trim();

// пишем в корень
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml);
console.log(`✅ sitemap.xml updated with ${urls.length} urls`);
