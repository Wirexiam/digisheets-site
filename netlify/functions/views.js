// netlify/functions/views.js
// Уникальные просмотры: 1 раз в сутки на пользователя (cookie ds_uid) для каждого slug.
// Хранилище: Netlify Blobs (store "stats"). Агрегат по посту: { views, likes }.
// Возвращает JSON: { views, likes }.
// Поддержка CORS и preflight.

import { getStore } from '@netlify/blobs';

const COOKIE_NAME = 'ds_uid';
const ONE_YEAR = 60 * 60 * 24 * 365;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS, body: '' };
    }

    if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const slug = event.queryStringParameters?.slug;
    if (!slug) return json(400, { error: 'Missing "slug"' });

    // uid из cookie, если нет — поставить
    const { uid, setCookie } = getOrSetUserId(event);

    // Агрегаты по посту
    const store = getStore('stats');
    const stats = await readJSON(store, slug, { views: 0, likes: 0 });

    // Ключ уникальности на день
    const ymd = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const seenKey = `views:${slug}:${ymd}`;
    const seen = await readJSON(store, seenKey, {}); // { [uid]: true }

    if (!seen[uid]) {
      // Засчитываем просмотр 1 раз в сутки на пользователя
      seen[uid] = true;
      stats.views = (stats.views || 0) + 1;

      // Пишем атомарно: сначала отметку уникальности, потом агрегат
      await store.set(seenKey, JSON.stringify(seen));
      await store.set(slug, JSON.stringify(stats));
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'content-type': 'application/json',
        ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
      },
      body: JSON.stringify({ views: stats.views || 0, likes: stats.likes || 0 }),
    };
  } catch (e) {
    return json(500, { error: 'Internal Error', details: String(e && e.message || e) });
  }
};

// ===== utils =====

function json(code, obj) {
  return {
    statusCode: code,
    headers: { ...CORS, 'content-type': 'application/json' },
    body: JSON.stringify(obj),
  };
}

function getOrSetUserId(event) {
  const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
  const m = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const existing = m ? m[1] : null;
  const uid = existing || randomHex(16);
  const setCookie = existing
    ? null
    : `${COOKIE_NAME}=${uid}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
  return { uid, setCookie };
}

function randomHex(lenBytes) {
  // Простая криптографическая генерация uid (если crypto.randomUUID недоступен)
  const arr = new Uint8Array(lenBytes);
  // В Node 18+ доступен globalThis.crypto
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    // Фоллбек: Math.random (не криптостойкий, но приемлем для uid cookie)
    for (let i = 0; i < lenBytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function readJSON(store, key, fallback) {
  const raw = await store.get(key);
  if (!raw) return { ...(fallback || {}) };
  try { return JSON.parse(raw); } catch { return { ...(fallback || {}) }; }
}
