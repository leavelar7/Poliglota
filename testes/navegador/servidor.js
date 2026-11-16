// servidor local que imita a Vercel (cleanUrls) para os testes de navegador
const http = require("http"), fs = require("fs"), path = require("path");
const RAIZ = process.argv[2], PORTA = Number(process.argv[3] || 4173);
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json" };
http.createServer(function (req, res) {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  const tentativas = [p, p + ".html", p + "/index.html"];
  for (const t of tentativas) {
    const f = path.join(RAIZ, t);
    if (f.startsWith(RAIZ) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" });
      return fs.createReadStream(f).pipe(res);
    }
  }
  res.writeHead(404); res.end("404");
}).listen(PORTA, function () { console.log("ok " + PORTA); });
