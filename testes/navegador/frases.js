// teste das frases aplicadas na revisão (Supabase simulado)
const puppeteer = require("puppeteer-core");
const path = require("path");
const BASE = "http://localhost:4173";
const dados = require("./dados.json");
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

(async function () {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (!u.includes("supabase.co")) return req.continue();
    const t = (/rest\/v1\/(\w+)/.exec(u) || [])[1];
    req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: JSON.stringify(dados[t] || []) });
  });
  const passo = (n, c) => { console.log((c ? "OK   " : "FALHA") + " " + n); if (!c) process.exitCode = 1; };
  const texto = (sel) => page.$eval(sel, (e) => e.textContent);
  const vis = (id) => page.$eval("#" + id, (e) => !e.hidden);

  // "oi" já foi aprendida (caixa 3); a frase simples de "oi" ainda não foi vista.
  // "bom dia" está na caixa 2 (não libera frase). A frase simples de "tchau" já foi aprendida e
  // libera a completa — mas "tchau" não tem frase completa nos dados, então nada aparece.
  await page.goto(BASE + "/app", { waitUntil: "networkidle0" });
  const futuro = Date.now() + 9e8;
  await page.evaluate((futuro) => {
    localStorage.setItem("pp:pref:idioma", '"en"');
    localStorage.setItem("pp:pref:semMic", "true");
    localStorage.setItem("pp:local:dados", JSON.stringify({
      progresso: { en: { saudacoes: { rodadas: 3, melhorAcc: 1 } } },
      revisao: { en: {
        "oi": { caixa: 3, prox: futuro, em: 1 },
        "bom dia": { caixa: 2, prox: futuro, em: 1 },
        "tchau": { caixa: 4, prox: futuro, em: 1 },
        "frase:6:1": { caixa: 3, prox: futuro, em: 1 }
      } },
      sujo: { fases: {}, revs: {} }
    }));
  }, futuro);
  await page.reload({ waitUntil: "networkidle0" });
  passo("botão de revisão conta só a frase liberada", (await texto("#btn-revisao-txt")) === "Revisão (1)");

  await page.click("#btn-revisao"); await espera(600);
  passo("abre o cartão de frase", await vis("selo-frase"));
  passo("mostra a frase no idioma", (await texto("#palavra")) === "Hi, Mom!");
  passo("mostra a tradução", (await texto("#traducao")) === "Oi, mamãe!");
  passo("usa a figura da palavra", await page.$eval("#figura", (i) => i.src.endsWith("/img/oi.svg")));
  passo("pede o áudio da frase", await page.evaluate(() => performance.getEntriesByType("resource").some((r) => r.name.endsWith("/audio/f1_1_en.mp3"))));
  passo("selo de frase simples", await page.$eval("#selo-frase", (e) => e.classList.contains("nivel-1") && e.getAttribute("aria-label") === "Frase simples"));
  await page.screenshot({ path: path.join(__dirname, "fotos", "40-frase-simples.png") });

  await page.click("#btn-falar"); await espera(900);
  passo("fim da revisão", await vis("tela-aviso"));
  passo("conta a frase no resumo", (await texto("#aviso-texto")).includes("frase"));
  const rev = await page.evaluate(() => JSON.parse(localStorage.getItem("pp:local:dados")).revisao.en["frase:1:1"]);
  passo("frase agendada na caixa 2", rev && rev.caixa === 2);

  // simples aprendida -> libera a completa
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("pp:local:dados"));
    d.revisao.en["frase:1:1"] = { caixa: 3, prox: Date.now() + 9e8, em: 2 };
    localStorage.setItem("pp:local:dados", JSON.stringify(d));
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.click("#btn-revisao"); await espera(600);
  passo("frase completa aparece depois da simples", (await texto("#palavra")) === "Hi, Grandma, it's good to see you!");
  passo("selo de frase completa", await page.$eval("#selo-frase", (e) => e.classList.contains("nivel-2")));
  await page.screenshot({ path: path.join(__dirname, "fotos", "41-frase-completa.png") });

  console.log(erros.length ? "ERROS: " + erros.join(" | ") : "sem erros no console");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
