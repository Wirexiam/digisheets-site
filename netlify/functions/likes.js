// netlify/functions/likes.js
// Toggle-лайк c уникальностью по пользователю (cookie ds_uid) для каждого slug.
// Хранилище: Netlify Blobs (store "stats").
// GET → { views, likes, liked }
// POST → переключает лайк текущего пользователя и возвращает { likes, liked }

import { getStore } from '@netlify/blobs';

const COOKIE_NAME = 'ds_uid';
const ONE_YEAR = 60 * 60 * 24 * 365;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event) => {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS, body: '' };
    }

    const slug = event.queryStringParameters?.slug;
    if (!slug) return json(400, { error: 'Missing "slug"' });

    const { uid, setCookie } = getOrSetUserId(event);
    const store = getStore('stats');

    // агрегаты поста {views, likes}
    const stats = await readJSON(store, slug, { views: 0, likes: 0 });

    // множество лайкнувших пользователей (как объект: { uid: true })
    const likersKey = `likes:${slug}`;
    const likers = await readJSON(store, likersKey, {});

    if (event.httpMethod === 'GET') {
      const liked = !!likers[uid];
      return {
        statusCode: 200,
        headers: {
          ...CORS,
          'content-type': 'application/json',
          ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
        },
        body: JSON.stringify({ views: stats.views || 0, likes: stats.likes || 0, liked }),
      };
    }

    if (event.httpMethod === 'POST') {
      // Toggle
      let liked;
      if (likers[uid]) {
        delete likers[uid];
        stats.likes = Math.max(0, (stats.likes || 0) - 1);
        liked = false;
      } else {
        likers[uid] = true;
        stats.likes = (stats.likes || 0) + 1;
        liked = true;
      }

      // Сохраняем
      await store.set(likersKey, JSON.stringify(likers));
      await store.set(slug, JSON.stringify(stats));

      return {
        statusCode: 200,
        headers: {
          ...CORS,
          'content-type': 'application/json',
          ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
        },
        body: JSON.stringify({ likes: stats.likes || 0, liked }),
      };
    }

    return json(405, { error: 'Method Not Allowed' });
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
  const arr = new Uint8Array(lenBytes);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < lenBytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function readJSON(store, key, fallback) {
  const raw = await store.get(key);
  if (!raw) return { ...(fallback || {}) };
  try { return JSON.parse(raw); } catch { return { ...(fallback || {}) }; }
}
