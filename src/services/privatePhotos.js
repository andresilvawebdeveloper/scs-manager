import { supabase } from './supabaseClient';

// As fotografias estão em pastas privadas do Supabase. Para as mostrar, a app pede
// um endereço temporário (válido 1 hora), que só é dado a quem tem permissão para a ver.
// Os pedidos feitos ao mesmo tempo (ex.: lista de atletas) são agrupados num só.

export const PRIVATE_BUCKETS = ['athlete-photos', 'avatars'];
const EXPIRES_IN = 60 * 60; // segundos
const cache = new Map(); // "bucket/path" -> { url, expiresAt } | Promise
let queue = {}; // bucket -> [{ path, resolve }]
let timer = null;

// "https://x.supabase.co/storage/v1/object/public/avatars/coach-photos/a.jpg" -> { bucket, path }
export function parseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/);
  if (!m || !PRIVATE_BUCKETS.includes(m[1])) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

async function flush() {
  const batches = queue;
  queue = {};
  timer = null;
  await Promise.all(Object.entries(batches).map(async ([bucket, items]) => {
    const paths = [...new Set(items.map((i) => i.path))];
    let byPath = {};
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, EXPIRES_IN);
      if (error) throw error;
      (data || []).forEach((d) => { if (d && !d.error && d.signedUrl) byPath[d.path] = d.signedUrl; });
    } catch (err) {
      console.error('Não foi possível obter as fotografias:', err.message || err);
    }
    items.forEach(({ path, resolve }) => {
      const url = byPath[path] || null;
      const key = `${bucket}/${path}`;
      if (url) cache.set(key, { url, expiresAt: Date.now() + (EXPIRES_IN - 300) * 1000 });
      else cache.delete(key);
      resolve(url);
    });
  }));
}

// Devolve um endereço que pode ser usado em <img src>, ou null se não houver permissão.
export function getPhotoUrl(storedUrl) {
  const parsed = parseStorageUrl(storedUrl);
  if (!parsed) return Promise.resolve(storedUrl || null); // pré-visualização local (blob:) ou outro endereço
  const key = `${parsed.bucket}/${parsed.path}`;
  const hit = cache.get(key);
  if (hit && !(hit instanceof Promise) && hit.expiresAt > Date.now()) return Promise.resolve(hit.url);
  if (hit instanceof Promise) return hit;
  const p = new Promise((resolve) => {
    (queue[parsed.bucket] = queue[parsed.bucket] || []).push({ path: parsed.path, resolve });
    if (!timer) timer = setTimeout(flush, 30);
  });
  cache.set(key, p);
  return p;
}

export function clearPhotoCache() {
  cache.clear();
}
