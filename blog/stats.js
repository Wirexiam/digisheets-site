// /blog/stats.js
// Централизованная логика просмотров и лайков (страница поста + список).
// Требуются Netlify-функции: /netlify/functions/views и /netlify/functions/likes

const _safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// ---- API обёртки с явным no-store, логами и проверкой JSON ----
async function _apiGetViews(slug) {
  const url = `/netlify/functions/views?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!r.ok) throw new Error(`views failed: ${r.status} ${r.statusText}`);
  return r.json(); // { views, likes }
}
async function _apiGetLikes(slug) {
  const url = `/netlify/functions/likes?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!r.ok) throw new Error(`likes get failed: ${r.status} ${r.statusText}`);
  return r.json(); // { views, likes, liked }
}
async function _apiToggleLike(slug) {
  const url = `/netlify/functions/likes?slug=${encodeURIComponent(slug)}`;
  const r = await fetch(url, { method: 'POST', cache: 'no-store' });
  if (!r.ok) throw new Error(`likes post failed: ${r.status} ${r.statusText}`);
  return r.json(); // { likes, liked }
}

// ---- Список постов: статичные метрики (без кликов) -------------
export async function initStatsList(posts, { pollMs = 15000 } = {}) {
  try { await _refreshAllListCards(posts); } catch (e) { console.warn('[stats] list init error:', e); }
  const t = setInterval(() => _refreshAllListCards(posts).catch(()=>{}), pollMs);
  window.addEventListener('beforeunload', () => clearInterval(t));
}

async function _refreshAllListCards(posts) {
  for (const p of posts) {
    const slug = p.slug;
    const box = document.getElementById(`stats-${slug}`);
    if (!box) continue;
    const viewsEl = box.querySelector('b[data-role="views"]');
    const likesEl = box.querySelector('b[data-role="likes"]');
    if (!viewsEl || !likesEl) continue;

    try {
      const data = await _apiGetLikes(slug); // отдаёт и views, и likes, и liked (игнорируем здесь)
      viewsEl.textContent = _safeNum(data.views);
      likesEl.textContent = _safeNum(data.likes);
    } catch (e) {
      // офлайн — оставляем как есть
      console.warn(`[stats] list fetch fail for ${slug}:`, e);
    }
  }
}

// ---- Страница поста: кликабельный лайк + просмотры -------------
export async function initStatsSingle(slug, {
  pollMs = 10000,
  viewElId = 'viewCount',
  likeBtnId = 'likeBtn',
  likeCountElId = 'likeCount'
} = {}) {
  // Ждём готовности DOM (на случай ранней инициализации)
  if (document.readyState === 'loading') {
    await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
  }

  const viewEl = document.getElementById(viewElId);
  const likeBtn = document.getElementById(likeBtnId);
  const likeCountEl = document.getElementById(likeCountElId);

  if (!slug) { console.error('[stats] no slug for single'); return; }
  if (!viewEl || !likeBtn || !likeCountEl) {
    console.error('[stats] elements not found', { viewEl, likeBtn, likeCountEl });
    return;
  }

  // На всякий случай снимаем блокировки клика
  try {
    likeBtn.style.pointerEvents = 'auto';
    likeBtn.disabled = false;
  } catch {}

  const SS_VIEWED_THIS_SESSION = `viewed-session:${slug}`;
  const setLikedUI = (liked) => likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');

  // Учёт просмотра (уникально на день на бэке). Делаем 1 раз за сессию.
  if (!sessionStorage.getItem(SS_VIEWED_THIS_SESSION)) {
    try {
      await _apiGetViews(slug);
      sessionStorage.setItem(SS_VIEWED_THIS_SESSION, '1');
    } catch (e) {
      console.warn('[stats] view register failed:', e);
    }
  }

  // Первичная отрисовка
  async function refresh() {
    const data = await _apiGetLikes(slug); // {views, likes, liked}
    viewEl.querySelector('b').textContent = _safeNum(data.views);
    likeCountEl.textContent = _safeNum(data.likes);
    setLikedUI(!!data.liked);
  }

  try { await refresh(); } catch (e) { console.warn('[stats] first refresh failed:', e); }

  // Пуллинг
  const timer = setInterval(() => refresh().catch(()=>{}), pollMs);
  window.addEventListener('beforeunload', () => clearInterval(timer));

  // Клик по лайку
  likeBtn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (likeBtn.dataset.busy === '1') return;
    likeBtn.dataset.busy = '1';
    likeBtn.classList.add('like-anim');

    try {
      // Немедленно визуально инвертируем состояние (опционально)
      setLikedUI(likeBtn.getAttribute('aria-pressed') !== 'true');

      const data = await _apiToggleLike(slug); // {likes, liked}
      likeCountEl.textContent = _safeNum(data.likes);
      setLikedUI(!!data.liked);
    } catch (e) {
      console.error('[stats] toggle like failed:', e);
      // Можно вернуть UI в исходное состояние, но проще сразу синхронизироваться
    } finally {
      setTimeout(() => likeBtn.classList.remove('like-anim'), 300);
      likeBtn.dataset.busy = '';
      try { await refresh(); } catch {}
    }
  });

  // Диагностика: отметим что инициализация прошла
  console.debug('[stats] single inited for', slug);
}
