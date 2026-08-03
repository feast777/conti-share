/**
 * 오프라인 대비 서비스워커.
 * 예배당 인터넷이 끊겨도 미리 받아둔 악보를 볼 수 있게 한다.
 *
 * - 악보 파일(Supabase storage): 한 번 받은 건 캐시에 두고, 다음엔 캐시를 먼저 쓴다
 * - 앱 화면(HTML/RSC): 네트워크를 먼저 쓰되 끊기면 캐시로 보여준다
 * - 그 외(스크립트·폰트): 캐시 우선
 */
const SHEET_CACHE = "sheets-v1";
const PAGE_CACHE = "pages-v1";
const ASSET_CACHE = "assets-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keep = [SHEET_CACHE, PAGE_CACHE, ASSET_CACHE];
      for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
      await self.clients.claim();
    })()
  );
});

/** 악보 파일인지 (Supabase 스토리지에서 오는 파일) */
const isSheet = (url) =>
  url.pathname.includes("/storage/v1/object/") || url.pathname.endsWith(".pdf");

/** 캐시 키에서 서명 토큰을 떼어낸다 — 토큰이 갱신돼도 같은 파일로 인식하도록 */
const sheetKey = (url) => new URL(url.origin + url.pathname).toString();

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 1) 악보 파일 — 캐시 먼저, 없으면 받아서 캐시에 저장
  if (isSheet(url)) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(SHEET_CACHE);
        const key = sheetKey(url);
        const hit = await cache.match(key);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(key, res.clone());
          return res;
        } catch (err) {
          const stale = await cache.match(key);
          if (stale) return stale;
          throw err;
        }
      })()
    );
    return;
  }

  // 우리 사이트가 아니면 그대로 둔다 (유튜브 등)
  if (url.origin !== self.location.origin) return;

  // 2) 화면(HTML·데이터) — 네트워크 먼저, 끊기면 캐시
  const isPage = req.mode === "navigate" || req.headers.get("RSC") === "1";
  if (isPage) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(PAGE_CACHE);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch (err) {
          const hit = await cache.match(req);
          if (hit) return hit;
          throw err;
        }
      })()
    );
    return;
  }

  // 3) 스크립트·폰트 등 — 캐시 먼저
  if (url.pathname.startsWith("/_next/") || url.pathname.endsWith(".mjs")) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })()
    );
  }
});

/** 화면에서 "이 콘티 미리 받기"를 누르면 악보들을 통째로 캐시에 담는다 */
self.addEventListener("message", (e) => {
  const { type, urls } = e.data || {};
  if (type !== "cache-sheets" || !Array.isArray(urls)) return;

  e.waitUntil(
    (async () => {
      const cache = await caches.open(SHEET_CACHE);
      let done = 0;
      for (const u of urls) {
        try {
          // 상대 경로도 받을 수 있게 기준 주소를 준다
          const abs = new URL(u, self.location.origin);
          const res = await fetch(abs.toString());
          if (res.ok) await cache.put(sheetKey(abs), res.clone());
        } catch {
          /* 한 장 실패해도 계속 */
        }
        done += 1;
        const clients = await self.clients.matchAll();
        for (const c of clients) c.postMessage({ type: "cache-progress", done, total: urls.length });
      }
    })()
  );
});
