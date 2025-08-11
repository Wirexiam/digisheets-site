// /blog/blog.js — объединённый движок Markdown + Google Docs HTML
document.addEventListener('DOMContentLoaded', async () => {
  const LIST = document.getElementById('blogList');
  const POST = document.getElementById('postContent');

  // === УТИЛИТЫ ===================================================
  const esc = (s) => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const fmtDate = (d) => new Date(d).toLocaleDateString('ru-RU');

  async function loadJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} → ${r.status} ${r.statusText}`);
    return r.json();
  }
  async function loadText(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} → ${r.status} ${r.statusText}`);
    return r.text();
  }

  // === Мини-YAML парсер для фронт-маттера =======================
  // Поддержка: ключ: значение, массивы через "- ", массивы строк.
  function parseYAML(src) {
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const root = {};
    let currKey = null;
    let currArr = null;

    const commitArr = () => {
      if (currKey !== null) { root[currKey] = currArr || []; }
      currKey = null; currArr = null;
    };

    for (let raw of lines) {
      const line = raw.replace(/\t/g, '  ');
      if (!line.trim()) { continue; }

      // элемент массива: "- value"
      const mArr = line.match(/^\s*-\s+(.*)$/);
      if (mArr && currKey) {
        if (!currArr) currArr = [];
        currArr.push(mArr[1].trim());
        continue;
      }

      // "key: value" или "key:"
      const mKV = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (mKV) {
        // зафиксировать предыдущий массив
        if (currArr) commitArr();

        const key = mKV[1];
        let val = mKV[2];

        if (val === '' || val === null || typeof val === 'undefined') {
          // ожидаем массив в следующих строках
          currKey = key;
          currArr = [];
        } else {
          // примитив
          val = val.trim();
          // булевые/числа
          if (/^(true|false)$/i.test(val)) root[key] = /^true$/i.test(val);
          else if (!isNaN(Number(val))) root[key] = Number(val);
          else root[key] = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
          currKey = null; currArr = null;
        }
        continue;
      }
    }
    if (currArr) commitArr();
    return root;
  }

  // === СИЛЬНЫЙ OFFLINE Markdown-рендерер ========================
  // Поддерживает: #..######, абзацы, цитаты (>), заметки (Важно/Пример/Совет/Внимание/Заметка/Note/Tip/Warning/Example),
  // списки ul/ol и чек-листы, код-блоки ```lang и отступом 4 пробела,
  // инлайн-форматирование, горизонтальные линии, таблицы | |, картинки и ссылки, автоссылки.
  function renderMarkdownStrong(src) {
    const PLACE = [];
    const HOLE = (html) => `\u0000BLOCK${PLACE.push(html)-1}\u0000`;

    // нормализуем переносы
    let text = String(src).replace(/\r\n?/g, '\n');

    // fenced code ```lang
    text = text.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/g, (_, lang='', code='') => {
      const cls = lang ? ` class="language-${esc(lang)}"` : '';
      return HOLE(`<pre><code${cls}>${esc(code)}</code></pre>`);
    });

    // инлайн-код `...` → плейсхолдер
    text = text.replace(/`([^`\n]+)`/g, (_, c) => HOLE(`<code>${esc(c)}</code>`));

    // HTML-комменты убираем
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    const lines = text.split('\n');
    const out = [];
    let i = 0;

    const isHr  = (s) => /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/.test(s);
    const isH   = (s) => s.match(/^(#{1,6})\s+(.+)$/);
    const isQ   = (s) => /^\s*&gt;\s?/.test(s) || /^\s*>\s?/.test(s);
    const isUL  = (s) => /^\s*[-*+]\s+/.test(s);
    const isOL  = (s) => /^\s*\d+\.\s+/.test(s);
    const isIndentCode = (s) => /^\s{4,}\S/.test(s);

    // ---- таблицы: утилиты ----
    const splitRow = (row) => {
      let s = row.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|'))  s = s.slice(0, -1);
      return s.split('|').map(c => c.trim());
    };
    const isTableSep = (s) => {
      const cells = splitRow(s);
      if (cells.length < 2) return false;
      return cells.every(c => /^:?-{3,}:?$/.test(c));
    };
    const colAlign = (sepCells) => sepCells.map(c => {
      const left  = c.startsWith(':');
      const right = c.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      return 'left';
    });

    const renderInline = (s) => {
      let r = s;

      // вернуть плейсхолдеры
      r = r.replace(/\u0000BLOCK(\d+)\u0000/g, (_, n) => PLACE[Number(n)] ?? '');

      // картинки
      r = r.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g,
        (_, alt, url, title) => `<img alt="${esc(alt)}" src="${esc(url)}"${title?` title="${esc(title)}"`:''}>`);

      // ссылки
      r = r.replace(/\[([^\]]+)\]\((\S+?)(?:\s+"([^"]*)")?\)/g,
        (_, txt, href, title) => `<a href="${esc(href)}"${title?` title="${esc(title)}"`:''}>${txt}</a>`);

      // автоссылки
      r = r.replace(/(^|[\s(])((?:https?:\/\/|mailto:)[^\s)]+)/g,
        (_, pre, url) => `${pre}<a href="${esc(url)}">${esc(url)}</a>`);

      // ~~зачёркнутый~~, **жирный**, *курсив*
      r = r.replace(/~~([^~]+)~~/g, '<del>$1</del>')
           .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
           .replace(/__([^_]+)__/g, '<strong>$1</strong>')
           .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).]|$)/g, '$1<em>$2</em>')
           .replace(/(^|[\s(])_([^_]+)_(?=[\s).]|$)/g, '$1<em>$2</em>');

      return r;
    };

    // сопоставление меток заметок (поддерживает жирное **LABEL:** и __LABEL:__)
    const NOTE_MAP = [
      { re: /^(?:\*\*|__)?\s*(?:важно|важно!|important)\s*(?:\*\*|__)?\s*:?\s*/i, cls: 'important', title: 'Важно' },
      { re: /^(?:\*\*|__)?\s*(?:внимание|warning)\s*(?:\*\*|__)?\s*:?\s*/i,     cls: 'warning',  title: 'Внимание' },
      { re: /^(?:\*\*|__)?\s*(?:пример|example)\s*(?:\*\*|__)?\s*:?\s*/i,       cls: 'example',   title: 'Пример' },
      { re: /^(?:\*\*|__)?\s*(?:совет|tip)\s*(?:\*\*|__)?\s*:?\s*/i,            cls: 'tip',       title: 'Совет' },
      { re: /^(?:\*\*|__)?\s*(?:заметка|note|инфо|info)\s*(?:\*\*|__)?\s*:?\s*/i, cls: 'info',    title: 'Заметка' },
    ];

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) { out.push(''); i++; continue; }
      if (isHr(line))   { out.push('<hr>'); i++; continue; }

      const hm = isH(line);
      if (hm) { out.push(`<h${hm[1].length}>${renderInline(hm[2].trim())}</h${hm[1].length}>`); i++; continue; }

      // ---- БЛОК-ЦИТАТА / ЗАМЕТКА ----
      if (isQ(line)) {
        const buf = [];
        while (i < lines.length && isQ(lines[i])) {
          buf.push(lines[i].replace(/^\s*&gt;\s?/, '').replace(/^\s*>\s?/, ''));
          i++;
        }
        // определяем заметку по первой строке
        let first = buf[0] ?? '';
        let matched = null;
        for (const m of NOTE_MAP) {
          if (m.re.test(first)) { matched = m; first = first.replace(m.re, ''); break; }
        }
        if (matched) {
          // склеиваем тело и рендерим как обычный markdown (внутри могут быть списки/ссылки)
          const body = [first, ...buf.slice(1)].join('\n').trim();
          const inner = renderMarkdownStrong(body);
          out.push(`<div class="note ${matched.cls}"><p><strong>${matched.title}:</strong> ${inner}</p></div>`);
        } else {
          out.push(`<blockquote>${renderMarkdownStrong(buf.join('\n'))}</blockquote>`);
        }
        continue;
      }

      // ---- ТАБЛИЦА ----
      if (line.includes('|') && i+1 < lines.length && isTableSep(lines[i+1])) {
        const headCells = splitRow(line);
        const sepCells  = splitRow(lines[i+1]);
        const aligns    = colAlign(sepCells);
        i += 2;

        const bodyRows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|') && !isHr(lines[i]) && !isH(lines[i])) {
          bodyRows.push(lines[i]); i++;
        }

        const th = headCells.map((c, idx) =>
          `<th style="text-align:${aligns[idx]||'left'}">${renderInline(c)}</th>`).join('');
        const trs = bodyRows.map(r => {
          const cells = splitRow(r);
          const tds = cells.map((c, idx) =>
            `<td style="text-align:${aligns[idx]||'left'}">${renderInline(c)}</td>`).join('');
          return `<tr>${tds}</tr>`;
        }).join('');

        out.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
        continue;
      }

      // код с отступом
      if (isIndentCode(line)) {
        const buf = [];
        while (i < lines.length && isIndentCode(lines[i])) { buf.push(lines[i].replace(/^ {4}/, '')); i++; }
        out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
        continue;
      }

      // ---- СПИСКИ (с фиксом нумерации OL) ----
      if (isUL(line) || isOL(line)) {
        const ordered = isOL(line);
        const items = [];
        let startNum = null;
        let prevNum  = null;

        while (i < lines.length && (isUL(lines[i]) || isOL(lines[i]))) {
          let raw = lines[i];
          let valueAttr = '';

          if (ordered) {
            const mm = raw.match(/^\s*(\d+)\.\s+(.*)$/);
            const currentNum = mm ? Number(mm[1]) : null;
            const content    = mm ? mm[2] : raw.replace(/^\s*\d+\.\s+/, '');
            if (startNum === null && currentNum !== null) startNum = currentNum;
            if (prevNum !== null && currentNum !== null && currentNum !== prevNum + 1) {
              valueAttr = ` value="${currentNum}"`;
            }
            prevNum = currentNum ?? (prevNum === null ? 1 : prevNum + 1);
            raw = content;
          } else {
            raw = raw.replace(/^\s*[-*+]\s+/, '');
          }

          // чек-листы [ ] / [x]
          const task = raw.match(/^\[( |x|X)\]\s+(.*)$/);
          let liInner;
          if (task) {
            const checked = /x/i.test(task[1]) ? ' checked' : '';
            liInner = `<label class="task-item"><input type="checkbox" disabled${checked}> <span>${renderInline(task[2])}</span></label>`;
          } else {
            liInner = renderInline(raw);
          }
          items.push(`<li${valueAttr}>${liInner}</li>`);
          i++;
        }
        const startAttr = ordered && Number.isFinite(startNum) && startNum !== 1 ? ` start="${startNum}"` : '';
        out.push(ordered ? `<ol${startAttr}>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
        continue;
      }

      // ---- АБЗАЦ ----
      const p = [line]; i++;
      while (i < lines.length && lines[i].trim() &&
             !isH(lines[i]) && !isHr(lines[i]) && !isQ(lines[i]) &&
             !isUL(lines[i]) && !isOL(lines[i]) && !isIndentCode(lines[i]) &&
             !(lines[i].includes('|') && i+1 < lines.length && isTableSep(lines[i+1]))) {
        p.push(lines[i]); i++;
      }
      out.push(`<p>${renderInline(p.join('\n')).replace(/\n/g,'<br>')}</p>`);
    }

    // вернуть плейсхолдеры
    return out.join('\n').replace(/\u0000BLOCK(\d+)\u0000/g, (_, n) => PLACE[Number(n)] ?? '');
  }

  // === ЧТЕНИЕ И ОЧИСТКА Google Docs HTML ========================
  function renderGoogleDocsHtml(srcHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(srcHtml, 'text/html');

    // убираем head-мусор
    doc.querySelectorAll('style, meta, link').forEach(n => n.remove());
    const root = doc.body || doc;

    // рекурсивная чистка
    const ALLOWED_ATTR = new Set(['href','src','alt','title']);
    const WALK = (node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // чистим классы/инлайновые стили/размеры
        ['class','style','width','height'].forEach(a => node.removeAttribute(a));
        [...node.attributes].forEach(a => {
          if (!ALLOWED_ATTR.has(a.name.toLowerCase())) node.removeAttribute(a.name);
        });

        // unwrap span/font/u/s
        if (['SPAN','FONT','U','S'].includes(node.tagName)) {
          const parent = node.parentNode;
          while (node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
          return;
        }

        // рекурсия
        [...node.childNodes].forEach(WALK);
      }
    };
    [...root.childNodes].forEach(WALK);

    return root.innerHTML;
  }

  // === ЗАГРУЗКА МАНИФЕСТА =======================================
  let posts = [];
  try {
    posts = await loadJSON('/blog/posts.json');
  } catch (e) {
    if (LIST) LIST.innerHTML = `<div class="feature-card"><p>Не удалось загрузить список постов.</p><pre><code>${esc(e)}</code></pre></div>`;
    if (POST) POST.innerHTML = `<div class="post-content"><p>Не удалось загрузить манифест постов.</p><pre><code>${esc(e)}</code></pre></div>`;
    return;
  }

  // === СТРАНИЦА СПИСКА ==========================================
  if (LIST) {
    const cut = (s, n=80) => {
      const t = String(s || '').trim();
      if (t.length <= n) return t;
      return t.slice(0, n).replace(/\s+\S*$/, '') + '…'; // не рвём слово
    };

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    LIST.innerHTML = posts.map(p => {
      const desc = cut(p.description, 80);
      return `
        <article class="feature-card" data-slug="${esc(p.slug)}">
          ${p.cover ? `<img class="blog-card__cover" src="${p.cover}" alt="${esc(p.title)}">` : ''}
          <h3 class="feature-title">
            <a href="/blog/post.html?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
          </h3>
          <p class="feature-text feature-text--compact">${esc(desc)}</p>
          <p class="feature-text feature-date">${fmtDate(p.date)}</p>
          <a class="btn secondary btn--compact" href="/blog/post.html?slug=${encodeURIComponent(p.slug)}">Читать</a>
        </article>
      `;
    }).join('');

    // --- (опционально) наполнение статистики после рендера списка ---
    const safeNum = v => Number.isFinite(Number(v)) ? Number(v) : 0;

    async function readServer(slug) {
      const r = await fetch(`/.netlify/functions/likes?slug=${encodeURIComponent(slug)}`, { method: 'GET' });
      if (!r.ok) throw new Error('server stat failed');
      return r.json();
    }

    function readLocal(slug) {
      const v = localStorage.getItem(`views:${slug}`) || 0;
      const l = localStorage.getItem(`likes:${slug}`) || 0;
      return { views: safeNum(v), likes: safeNum(l) };
    }

    for (const p of posts) {
      const box = document.getElementById(`stats-${p.slug}`);
      if (!box) continue;
      const viewsEl = box.querySelector('b[data-role="views"]');
      const likesEl = box.querySelector('b[data-role="likes"]');

      readServer(p.slug)
        .then(data => {
          viewsEl.textContent = safeNum(data.views);
          likesEl.textContent = safeNum(data.likes);
        })
        .catch(() => {
          const data = readLocal(p.slug);
          viewsEl.textContent = data.views;
          likesEl.textContent = data.likes;
        });
    }
  }

  // === СТРАНИЦА ПОСТА ===========================================
  if (POST) {
    const params = new URLSearchParams(location.search);
    const slug = params.get('slug');
    const p = posts.find(x => x.slug === slug);

    if (!p) {
      POST.innerHTML = `<div class="post-content"><p>Пост не найден. <a href="/blog/">Вернуться в блог</a>.</p></div>`;
      return;
    }

    // Метаданные (часть возьмём из posts.json, остальное — из фронт-маттера Markdown при его наличии)
    let title = p.title || '';
    let description = p.description || '';
    let date = p.date || '';
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const cover = p.cover || '';

    // Развилка: HTML (Google Docs) -> Markdown
    if (p.html) {
      const htmlUrl = !/^https?:\/\//.test(p.html) ? `/blog/${p.html}` : p.html;
      try {
        const raw = await loadText(htmlUrl);
        const clean = renderGoogleDocsHtml(raw);

        // заголовок страницы
        const titleEl = document.getElementById('postTitle');
        if (titleEl) titleEl.textContent = title;
        document.title = title ? `${title} — DigiSheets` : 'Пост — DigiSheets';

        const metaEl = document.getElementById('postMeta');
        if (metaEl) metaEl.textContent = `${date ? fmtDate(date) : ''}${tags.length ? ' • ' + tags.join(', ') : ''}`;

        const mdDesc = document.getElementById('metaDesc');
        if (mdDesc) mdDesc.setAttribute('content', description);

        let og = document.querySelector('meta[property="og:image"]');
        if (!og) { og = document.createElement('meta'); og.setAttribute('property','og:image'); document.head.appendChild(og); }
        og.setAttribute('content', cover || '');

        const coverHTML = cover ? `<img class="post-cover" src="${cover}" alt="${esc(title)}">` : '';
        POST.innerHTML = `${coverHTML}<div class="post-content">${clean}</div>`;

        // Подсветка кода
        try { if (window.hljs) POST.querySelectorAll('pre code').forEach(b => window.hljs.highlightElement(b)); } catch {}
      } catch (e) {
        POST.innerHTML = `
          <div class="post-content">
            <p><strong>Не удалось загрузить HTML поста:</strong> ${esc(htmlUrl)}</p>
            <pre><code>${esc(e)}</code></pre>
            <p><a href="/blog/">← Вернуться в блог</a></p>
          </div>`;
        return;
      }
    } else {
      // === Markdown-путь ===
      const mdUrl = p.md && !/^https?:\/\//.test(p.md) ? `/blog/${p.md}` : p.md;
      let raw = '';
      try {
        raw = await loadText(mdUrl);
      } catch (e) {
        POST.innerHTML = `
          <div class="post-content">
            <p><strong>Не удалось загрузить файл:</strong> ${esc(mdUrl)}</p>
            <pre><code>${esc(e)}</code></pre>
            <p><a href="/blog/">← Вернуться в блог</a></p>
          </div>`;
        return;
      }

      // Фронт-маттер
      let meta = {};
      let body = raw;
      if (raw.startsWith('---')) {
        const end = raw.indexOf('\n---', 3);
        if (end > -1) {
          const fm = raw.slice(3, end).trim();
          body = raw.slice(end + 4).replace(/^\s+/, '');
          meta = parseYAML(fm);
        }
      }

      // Метаданные (перекрытие данными из фронт-маттера)
      title = meta.title || title;
      description = meta.description || description;
      date = meta.date || date;
      const coverFM = meta.cover || '';
      const coverFinal = coverFM || cover;

      const titleEl = document.getElementById('postTitle');
      if (titleEl) titleEl.textContent = title;
      document.title = `${title} — DigiSheets`;

      const metaEl = document.getElementById('postMeta');
      if (metaEl) metaEl.textContent = `${date ? fmtDate(date) : ''}${(Array.isArray(meta.tags) ? meta.tags : tags).length ? ' • ' + (meta.tags || tags).join(', ') : ''}`;

      const mdDesc = document.getElementById('metaDesc');
      if (mdDesc) mdDesc.setAttribute('content', description);

      let og = document.querySelector('meta[property="og:image"]');
      if (!og) { og = document.createElement('meta'); og.setAttribute('property','og:image'); document.head.appendChild(og); }
      og.setAttribute('content', coverFinal || '');

      // Рендер Markdown: сначала markdown-it, иначе — наш парсер
      let html = '';
      if (window.markdownit) {
        try {
          const md = window.markdownit({
            html: false, linkify: true, typographer: true,
            highlight: function (str) {
              try { return window.hljs ? window.hljs.highlightAuto(str).value : esc(str); }
              catch { return esc(str); }
            }
          });
          html = md.render(body);
        } catch {
          html = renderMarkdownStrong(body);
        }
      } else {
        html = renderMarkdownStrong(body);
      }

      const coverHTML = coverFinal ? `<img class="post-cover" src="${coverFinal}" alt="${esc(title)}">` : '';
      POST.innerHTML = `${coverHTML}<div class="post-content">${html}</div>`;

      // Подсветка кода
      try { if (window.hljs) document.querySelectorAll('pre code').forEach(b => window.hljs.highlightElement(b)); } catch {}
    }

    // ===== СТАТИСТИКА: просмотры + лайк =====
    (async () => {
      const params = new URLSearchParams(location.search);
      const slug = params.get('slug');
      const viewEl = document.getElementById('viewCount');
      const likeBtn = document.getElementById('likeBtn');
      const likeCountEl = document.getElementById('likeCount');

      if (!slug || !viewEl || !likeBtn || !likeCountEl) return;

      const LS_VIEW_KEY = `views:${slug}`;
      const LS_LIKE_KEY = `likes:${slug}`;
      const LS_LIKED_KEY = `liked:${slug}`;
      const SS_VIEWED_THIS_SESSION = `viewed-session:${slug}`;

      const safeParse = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
      const setLikedUI = (liked) => likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');

      const localFallback = {
        incViewOncePerSession() {
          if (!sessionStorage.getItem(SS_VIEWED_THIS_SESSION)) {
            const curr = safeParse(localStorage.getItem(LS_VIEW_KEY));
            localStorage.setItem(LS_VIEW_KEY, String(curr + 1));
            sessionStorage.setItem(SS_VIEWED_THIS_SESSION, '1');
          }
          viewEl.querySelector('b').textContent = safeParse(localStorage.getItem(LS_VIEW_KEY));
        },
        initLike() {
          likeCountEl.textContent = safeParse(localStorage.getItem(LS_LIKE_KEY));
          setLikedUI(!!localStorage.getItem(LS_LIKED_KEY));
        },
        toggleLike() {
          const liked = !!localStorage.getItem(LS_LIKED_KEY);
          const curr = safeParse(localStorage.getItem(LS_LIKE_KEY));
          if (liked) {
            localStorage.removeItem(LS_LIKED_KEY);
            localStorage.setItem(LS_LIKE_KEY, String(Math.max(0, curr - 1)));
          } else {
            localStorage.setItem(LS_LIKED_KEY, '1');
            localStorage.setItem(LS_LIKE_KEY, String(curr + 1));
          }
          likeCountEl.textContent = safeParse(localStorage.getItem(LS_LIKE_KEY));
          setLikedUI(!liked);
        }
      };

      async function apiGetViews() {
      const r = await fetch(`/.netlify/functions/views?slug=${encodeURIComponent(slug)}`, { method: 'GET' });
      if (!r.ok) throw new Error('views failed');
      return r.json(); // {views, likes}
    }
    async function apiGetLikes() {
      const r = await fetch(`/.netlify/functions/likes?slug=${encodeURIComponent(slug)}`, { method: 'GET' });
      if (!r.ok) throw new Error('likes get failed');
      return r.json(); // {views, likes, liked}
    }
    async function apiToggleLike() {
      const r = await fetch(`/.netlify/functions/likes?slug=${encodeURIComponent(slug)}`, { method: 'POST' });
      if (!r.ok) throw new Error('likes post failed');
      return r.json(); // {likes, liked}
    }

    try {
      // Просмотр считаем один раз за сессию (для уменьшения трафика),
      // но уникальность обеспечивается сервером по cookie ds_uid + день
      if (!sessionStorage.getItem(SS_VIEWED_THIS_SESSION)) {
        const data = await apiGetViews(); // {views, likes}
        sessionStorage.setItem(SS_VIEWED_THIS_SESSION, '1');
        viewEl.querySelector('b').textContent = data.views ?? 0;
      } else {
        const data = await apiGetViews();
        viewEl.querySelector('b').textContent = data.views ?? 0;
      }

      // Подтягиваем лайки и состояние кнопки с сервера
      const l = await apiGetLikes(); // {views, likes, liked}
      likeCountEl.textContent = l.likes ?? 0;
      setLikedUI(!!l.liked);

      likeBtn.addEventListener('click', async () => {
        // простая защита от дабл-клика
        if (likeBtn.dataset.busy === '1') return;
        likeBtn.dataset.busy = '1';

        try {
          // анимация "подпрыгивания" при клике
          likeBtn.classList.add('like-anim');
          const data = await apiToggleLike(); // {likes, liked}
          likeCountEl.textContent = data.likes ?? 0;
          setLikedUI(!!data.liked);
        } catch {
          // локальный фоллбек, если совсем офлайн
          localFallback.toggleLike();
        } finally {
          // снять анимацию после окончания кадра
          setTimeout(() => likeBtn.classList.remove('like-anim'), 300);
          likeBtn.dataset.busy = '';
        }
      });

    } catch {
      // офлайн режим — старые локальные заглушки
      localFallback.incViewOncePerSession();
      localFallback.initLike();
      likeBtn.addEventListener('click', localFallback.toggleLike);
    }
        })();
      }
});
