// sw.js — deixa o app instalável e utilizável sem internet.
//  - "casca" (páginas, CSS, JS, fontes): guardada na instalação. Com internet, sempre
//    busca a versão nova primeiro (para uma correção valer já na próxima abertura);
//    sem internet, ou se a rede demorar mais de 4 s, usa a cópia guardada.
//  - imagens e áudios: guardados conforme a criança joga (e no pré-carregamento da fase).
//  - Supabase e qualquer outro domínio: passam direto, sem cache.
const VERSAO = "v3.1.2";
const CASCA = "pp-casca-" + VERSAO;
const MIDIA = "pp-midia-v1";   // imagens e áudios sobrevivem às atualizações do app

const ARQUIVOS = [
  "/app", "/manifest.webmanifest",
  "/css/base.css", "/css/app.css",
  "/vendor/supabase.js", "/logica.js",
  "/js/app.js", "/js/config.js", "/js/nuvem.js", "/js/estado.js", "/js/dados.js", "/js/guarda.js",
  "/js/conta.js", "/js/som.js", "/js/fala.js", "/js/ui.js",
  "/js/telas/mapa.js", "/js/telas/jogo.js", "/js/telas/pais.js",
  "/fonts/fredoka.woff2", "/fonts/andika-400.woff2", "/fonts/andika-700.woff2",
  "/icons/globo.svg", "/icons/favicon.svg", "/icons/icon-192.png",
  "/img/tartaruga.svg", "/img/estrela.svg", "/img/medalha.svg"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(caches.open(CASCA).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n.indexOf("pp-casca-") === 0 && n !== CASCA; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

// o Safari pede áudio em pedaços (Range). Responde o pedaço a partir do arquivo inteiro guardado.
async function responderPedaco(req, resp) {
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get("range") || "");
  if (!m) return resp;
  const dados = await resp.arrayBuffer();
  const ini = Number(m[1]);
  const fim = m[2] ? Math.min(Number(m[2]), dados.byteLength - 1) : dados.byteLength - 1;
  return new Response(dados.slice(ini, fim + 1), {
    status: 206, statusText: "Partial Content",
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": "bytes " + ini + "-" + fim + "/" + dados.byteLength,
      "Content-Length": String(fim - ini + 1), "Accept-Ranges": "bytes"
    }
  });
}

async function midia(req) {
  const cache = await caches.open(MIDIA);
  const url = req.url;
  let resp = await cache.match(url);
  if (!resp) {
    resp = await fetch(url);                 // sempre o arquivo inteiro (sem Range)
    if (resp.ok && resp.status === 200) cache.put(url, resp.clone());
  }
  return req.headers.has("range") ? responderPedaco(req, resp) : resp;
}

async function casca(req) {
  const cache = await caches.open(CASCA);
  const daRede = fetch(req).then(function (resp) {
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  });
  const limite = new Promise(function (resolver) { setTimeout(resolver, 4000); });
  try {
    const resp = await Promise.race([daRede, limite]);
    if (resp) return resp;
  } catch (e) { /* sem rede: cai para a cópia guardada */ }
  const guardado = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
  if (guardado) { daRede.catch(function () {}); return guardado; }
  return daRede;
}

self.addEventListener("fetch", function (ev) {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.indexOf("/img/") === 0 || url.pathname.indexOf("/audio/") === 0) {
    ev.respondWith(midia(req).catch(function () { return new Response("", { status: 504 }); }));
    return;
  }
  // páginas: rede primeiro (para receber atualizações), cache se estiver offline
  if (req.mode === "navigate") {
    ev.respondWith(fetch(req).then(function (resp) {
      if (resp.ok && url.pathname.indexOf("/app") === 0) {
        const copia = resp.clone();
        caches.open(CASCA).then(function (c) { c.put("/app", copia); });
      }
      return resp;
    }).catch(function () {
      return caches.match(url.pathname.indexOf("/app") === 0 ? "/app" : req).then(function (r) {
        return r || caches.match("/app");
      });
    }));
    return;
  }
  ev.respondWith(casca(req));
});
