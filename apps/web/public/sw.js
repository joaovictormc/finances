// v2: a v1 gravava toda resposta GET no cache — páginas HTML e payloads RSC
// (com dados financeiros do usuário) inclusive — e nunca limpava entre deploys.
// Trocar o nome faz o activate apagar esse cache antigo.
// v3: ícones trocados para a identidade nova — mesmos nomes de arquivo, então
// sem trocar o cache quem já tinha os antigos continuaria com eles.
const CACHE_NAME = "finances-static-v3";
const PRECACHE_URLS = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];
// Teto de entradas: cada deploy gera chunks com hash novo, e os antigos nunca
// mais são pedidos. Sem limite o cache só cresce.
const MAX_ENTRIES = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Só arquivo estático com nome imutável (hash no nome) ou ícone. Página,
// navegação, RSC e /api/* passam direto pra rede, sem o SW no meio.
function isCacheable(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))
  );
}

async function trimCache(cache) {
  const keys = await cache.keys();
  // cache.keys() vem em ordem de inserção: apaga os mais antigos.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES)).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isCacheable(url)) return;

  // Cache-first: o conteúdo de um chunk com hash nunca muda, então não há por
  // que ir à rede se ele já está guardado.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        event.waitUntil(cache.put(request, response.clone()).then(() => trimCache(cache)));
      }
      return response;
    })
  );
});
