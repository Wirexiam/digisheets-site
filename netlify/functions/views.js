import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
  const slug = event.queryStringParameters?.slug;
  if (!slug) return { statusCode: 400, body: 'No slug' };

  const store = getStore('stats'); // логическое имя хранилища
  const raw = await store.get(slug);
  const curr = raw ? JSON.parse(raw) : { views: 0, likes: 0 };

  // Инкрементим просмотр (дедуп по сессии делаем на клиенте; сервер — просто считает)
  curr.views += 1;
  await store.set(slug, JSON.stringify(curr));

  return {
    statusCode: 200,
    body: JSON.stringify(curr),
    headers: { 'content-type': 'application/json' }
  };
};
