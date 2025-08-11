// /blog/stats.js
// Общая логика статистики (просмотры + лайки) для списка и страницы поста.
// Требуются функции Netlify: /.netlify/functions/views и /.netlify/functions/likes

const _safeNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// ---- API ----
async function _apiGetViews(slug) {
  const r = await fetch(`/.netlify/functions/views?slug=${encodeURIComponent(slug)}`, { method: 'GET', cache: 'no-store' });
  if (!r.ok) throw new Error('views failed');
  return r.json(); // { views, likes }
}
async function _apiGetLikes(slug) {
  const r = await fetch(`/.netlify/functions/likes?slug=${encodeURIComponent(slug)}`, { method: 'GET', cache: 'no-store' });
  if (!r.ok) throw new Error('likes get failed');
  return r.json(); // { views, likes, liked }
}
async function _apiToggleLike(slug) {
  const r = await fetch(`/.netlify/functions/likes?slug=${encodeURIComponent(slug)}`, { method: 'POST', cache: 'no-store' });
  if (!r.ok) throw new Error('likes post failed');
  return r.json(); // { likes, liked }
}

// ---- Список постов ----
export async function initStatsList(posts, { pollMs = 15000 } = {}) {
  await _refreshAllListCards(posts);
  setInterval(() => _refreshAllListCards(posts), pollMs);
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
      const data = await _apiGetLikes(slug); // отдаёт и views, и likes
      viewsEl.textContent = _safeNum(data.views);
      likesEl.textContent = _safeNum(data.likes);
    } catch {
      // офлайн — оставляем как есть
    }
  }
}

// ---- Страница поста ----
export async function initStatsSingle(slug, {
  pollMs = 10000,
  viewElId = 'viewCount',
  likeBtnId = 'likeBtn',
  likeCountElId = 'likeCount'
} = {}) {
  const viewEl = document.getElementById(viewElId);
  const likeBtn = document.getElementById(likeBtnId);
  const likeCountEl = document.getElementById(likeCountElId);
  if (!slug || !viewEl || !likeBtn || !likeCountEl) return;

  const SS_VIEWED_THIS_SESSION = `viewed-session:${slug}`;
  const setLikedUI = (liked) => likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');

  if (!sessionStorage.getItem(SS_VIEWED_THIS_SESSION)) {
    try { await _apiGetViews(slug); } catch {}
    sessionStorage.setItem(SS_VIEWED_THIS_SESSION, '1');
  }

  async function refresh() {
    const data = await _apiGetLikes(slug); // {views, likes, liked}
    viewEl.querySelector('b').textContent = _safeNum(data.views);
    likeCountEl.textContent = _safeNum(data.likes);
    setLikedUI(!!data.liked);
  }
  await refresh();
  const timer = setInterval(refresh, pollMs);
  window.addEventListener('beforeunload', () => clearInterval(timer));

  likeBtn.addEventListener('click', async () => {
    if (likeBtn.dataset.busy === '1') return;
    likeBtn.dataset.busy = '1';
    try {
      likeBtn.classList.add('like-anim');
      const data = await _apiToggleLike(slug); // {likes, liked}
      likeCountEl.textContent = _safeNum(data.likes);
      setLikedUI(!!data.liked);
    } catch {
      // офлайн — можно добавить лок. фоллбек при желании
    } finally {
      setTimeout(() => likeBtn.classList.remove('like-anim'), 300);
      likeBtn.dataset.busy = '';
      try { await refresh(); } catch {}
    }
  });
}
