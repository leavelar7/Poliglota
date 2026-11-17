// teste de fumaça no navegador: abre o app com o Supabase simulado e fotografa as telas
const puppeteer = require("puppeteer-core"), fs = require("fs"), path = require("path");
const BASE = "http://localhost:4173", OUT = path.join(__dirname, "fotos");
const dados = JSON.parse(fs.readFileSync(path.join(__dirname, "dados.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new",
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const erros = [];
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") erros.push("console: " + m.text()); });
  page.on("requestfailed", (r) => { if (!r.url().includes("supabase.co")) erros.push("falhou: " + r.url()); });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("supabase.co")) {
      const m = /rest\/v1\/(\w+)/.exec(u);
      const corpo = m && dados[m[1]] ? dados[m[1]] : [];
      return req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" }, body: JSON.stringify(corpo) });
    }
    req.continue();
  });
  const foto = async (nome) => { await espera(500); await page.screenshot({ path: path.join(OUT, nome + ".png") }); };
  const visivel = (id) => page.evaluate((i) => !document.getElementById(i).hidden, id);
  const passo = (nome, cond) => { console.log((cond ? "OK   " : "FALHA") + " " + nome); if (!cond) process.exitCode = 1; };

  await page.goto(BASE + "/app", { waitUntil: "networkidle0" });
  passo("capa aparece", await visivel("tela-inicio"));
  await foto("01-capa");

  await page.click('[data-idioma="en"]');
  passo("mapa aparece", await visivel("tela-mapa"));
  passo("6 fases no mapa (frases fica fora)", (await page.$$eval(".fase", (f) => f.length)) === 6);
  passo("nome com acento", (await page.$eval(".fase .nome", (e) => e.textContent)) === "Saudações");
  await foto("02-mapa");

  // joga a fase 1 no modo sem microfone (o Chrome de teste não reconhece fala)
  await page.evaluate(() => localStorage.setItem("pp:pref:semMic", "true"));
  await page.reload({ waitUntil: "networkidle0" });
  passo("volta direto ao mapa do último idioma", await visivel("tela-mapa"));
  await page.click(".fase.atual .bolha");
  passo("jogo aparece", await visivel("tela-jogo"));
  await foto("03-cartao");
  for (let rodada = 1; rodada <= 3; rodada++) {
    for (let i = 0; i < 3; i++) { await page.click("#btn-falar"); await espera(800); }
    passo("fim da rodada " + rodada, await visivel("tela-fim"));
    if (rodada === 1) await foto("04-fim-1-estrela");
    if (rodada < 3) await page.click("#btn-denovo");
  }
  await espera(900);
  await foto("05-fim-3-estrelas");
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem("pp:local:dados")).progresso.en.saudacoes);
  passo("progresso gravado (3 rodadas, 100%)", prog.rodadas === 3 && prog.melhorAcc === 1);
  passo("botão próxima fase aparece", await page.$eval("#btn-proxima", (b) => !b.hidden));
  await page.click("#btn-fim-mapa");
  passo("fase 2 destravada", await page.$eval(".fase:nth-of-type(2)", (f) => f.classList.contains("atual")));
  await foto("06-mapa-depois");

  // sair no meio da fase não conta rodada
  await page.click(".fase.atual .bolha"); await page.click("#btn-sair");
  passo("sair volta ao mapa", await visivel("tela-mapa"));

  // revisão: as 3 palavras da fase jogada estão pendentes
  passo("revisão mostra 3 pendentes", (await page.$eval("#btn-revisao-txt", (e) => e.textContent)) === "Revisão (3)");
  await page.click("#btn-revisao");
  for (let i = 0; i < 3; i++) { await page.click("#btn-falar"); await espera(800); }
  passo("fim da revisão", await visivel("tela-aviso"));
  await foto("07-fim-revisao");
  await page.click("#aviso-botoes button");
  passo("revisão zerada", (await page.$eval("#btn-revisao-txt", (e) => e.textContent)) === "Revisão");

  // alfabeto
  await page.click("#btn-abc"); await espera(300);
  await foto("08-letra");
  await espera(2600);
  await foto("09-letra-palavra");
  await page.click("#btn-sair");

  // progresso
  await page.click("#btn-progresso");
  passo("painel de progresso", await visivel("tela-progresso"));
  await foto("10-progresso");
  await page.click("#progresso-voltar");

  // área dos pais (com portão)
  await page.click("#mapa-inicio");
  await page.click("#btn-pais"); await espera(200);
  await foto("11-portao");
  const conta = await page.$eval('label[for="portao-resposta"]', (e) => e.textContent.match(/(\d+) × (\d+)/).slice(1).map(Number));
  await page.type("#portao-resposta", "1"); await page.keyboard.press("Enter"); await espera(150);
  passo("portão recusa resposta errada", await page.$eval("#portao-erro", (e) => e.textContent.length > 0));
  await page.type("#portao-resposta", String(conta[0] * conta[1])); await page.keyboard.press("Enter");
  await espera(200);
  passo("área dos pais abre", await visivel("tela-pais"));
  await page.screenshot({ path: path.join(OUT, "12-pais-entrar.png"), fullPage: true });
  await page.evaluate(() => [...document.querySelectorAll(".aba")].find((a) => a.textContent === "Criar conta").click());
  await page.screenshot({ path: path.join(OUT, "13-pais-criar.png"), fullPage: true });

  // migração do progresso da versão antiga
  await page.evaluate(() => { localStorage.clear();
    localStorage.setItem("poliglota_versao", "2");
    localStorage.setItem("poliglota_progresso", JSON.stringify({ de: { saudacoes: { rodadas: 4, melhorAcc: 0.95 } } })); });
  await page.reload({ waitUntil: "networkidle0" });
  await page.click('[data-idioma="de"]');
  passo("progresso antigo migrado (2 estrelas em alemão)", (await page.$$eval(".fase:first-of-type .st-cheia", (s) => s.length)) === 2);

  // offline: com o vocabulário em cache, o app abre mesmo com o Supabase fora do ar
  dados.palavras = null;
  await page.reload({ waitUntil: "networkidle0" });
  passo("abre com o cache quando a rede falha", await visivel("tela-mapa"));

  // sem cache e sem rede: tela de erro
  await page.evaluate(() => localStorage.removeItem("pp:vocab"));
  await page.reload({ waitUntil: "networkidle0" });
  passo("tela de erro sem cache e sem rede", await visivel("tela-erro"));
  await foto("14-erro");

  // tablet / desktop
  dados.palavras = JSON.parse(fs.readFileSync(path.join(__dirname, "dados.json"), "utf8")).palavras;
  await page.setViewport({ width: 1100, height: 800, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "networkidle0" }); await espera(400);
  await foto("15-desktop-mapa");

  const sw = await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r));
  passo("service worker registrado", sw);
  console.log(erros.length ? "ERROS DO NAVEGADOR:\n" + [...new Set(erros)].join("\n") : "sem erros no console");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
