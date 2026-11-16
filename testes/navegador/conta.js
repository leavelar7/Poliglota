// teste de navegador da conta: login, perfis, envio do progresso, relatório, exclusão — com Supabase simulado
const puppeteer = require("puppeteer-core"), fs = require("fs"), path = require("path");
const BASE = "http://localhost:4173", OUT = path.join(__dirname, "fotos");
const dados = JSON.parse(fs.readFileSync(path.join(__dirname, "dados.json"), "utf8"));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "pai@exemplo.com", identities: [{ id: "x" }], app_metadata: {}, user_metadata: {} };
const exp = Math.floor(Date.now() / 1000) + 3600;
const JWT = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: USER.id, exp: exp, role: "authenticated", email: USER.email }) + ".assinatura";
const banco = { perfis: [], progresso_fases: [], revisoes: [], responsaveis: [{ plano: "gratis" }],
  tentativas: [0, 1, 2, 3].map((i) => ({ palavras: "tchau", idioma: "en", resultado: i ? "errou" : "acertou", created_at: "2026-11-01" })) };
const chamadas = [];

(async function () {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const erros = [];
  page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warn") erros.push(m.type() + ": " + m.text()); });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (!u.includes("supabase.co")) return req.continue();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    const ok = (corpo, status) => req.respond({ status: status || 200, contentType: "application/json", headers: cors, body: JSON.stringify(corpo) });
    const metodo = req.method();
    if (metodo === "OPTIONS") return ok({});
    chamadas.push(metodo + " " + u.replace(/^https:\/\/[^/]+/, "").split("?")[0]);
    if (u.includes("/auth/v1/token")) return ok({ access_token: JWT, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user: USER });
    if (u.includes("/auth/v1/user")) return ok(USER);
    if (u.includes("/auth/v1/logout")) return ok({}, 204);
    if (u.includes("/rpc/excluir_minha_conta")) { banco.perfis = []; return ok(null, 204); }
    const tabela = (/rest\/v1\/(\w+)/.exec(u) || [])[1];
    if (dados[tabela]) return ok(dados[tabela]);
    const corpo = req.postData() ? JSON.parse(req.postData()) : null;
    const umSo = (req.headers().accept || "").includes("vnd.pgrst.object");
    const idFiltro = (/[?&]id=eq\.([\w-]+)/.exec(u) || [])[1];
    if (tabela === "perfis") {
      if (metodo === "POST") { const p = Object.assign({ id: "p" + (banco.perfis.length + 1) + "000000-0000-4000-8000-000000000000", criado_em: new Date().toISOString() }, corpo); banco.perfis.push(p); return ok(umSo ? p : [p], 201); }
      if (metodo === "PATCH") { const p = banco.perfis.find((x) => x.id === idFiltro); Object.assign(p, corpo); return ok(umSo ? p : [p]); }
      if (metodo === "DELETE") { banco.perfis = banco.perfis.filter((x) => x.id !== idFiltro); return ok(null, 204); }
      return ok(banco.perfis);
    }
    if (metodo === "POST") { banco[tabela] = banco[tabela].concat(corpo); return ok(null, 201); }
    if (tabela === "responsaveis") return ok(umSo ? banco.responsaveis[0] : banco.responsaveis);
    const perfil = (/perfil_id=eq\.([\w-]+)/.exec(u) || [])[1];
    return ok((banco[tabela] || []).filter((x) => !perfil || !x.perfil_id || x.perfil_id === perfil));
  });
  const visivel = (id) => page.evaluate((i) => !document.getElementById(i).hidden, id);
  const passo = (nome, cond) => { console.log((cond ? "OK   " : "FALHA") + " " + nome); if (!cond) process.exitCode = 1; };
  const texto = (sel) => page.$eval(sel, (e) => e.textContent);
  const clicarTexto = (t) => page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t && x.offsetParent); if (!b) throw new Error("sem botão: " + t); b.click(); }, t);
  const portao = async () => {
    const c = await page.$eval('label[for="portao-resposta"]', (e) => e.textContent.match(/(\d+) × (\d+)/).slice(1).map(Number));
    await page.type("#portao-resposta", String(c[0] * c[1])); await page.keyboard.press("Enter"); await espera(200);
  };

  // progresso de visitante já existente neste aparelho
  await page.goto(BASE + "/app", { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.setItem("pp:local:dados", JSON.stringify({
    progresso: { en: { saudacoes: { rodadas: 3, melhorAcc: 1 } } }, revisao: { en: { oi: { caixa: 2, prox: Date.now() + 9e7, em: Date.now() } } }, sujo: { fases: {}, revs: {} } })));
  await page.reload({ waitUntil: "networkidle0" });

  await page.click("#btn-pais"); await espera(200); await portao();
  await page.type("#conta-email", "pai@exemplo.com"); await page.type("#conta-senha", "senha-segura");
  await page.keyboard.press("Enter"); await espera(1200);
  passo("depois do login pede o perfil da criança", (await texto("#pais-conteudo h2")) === "Crianças" && !!(await page.$(".form-perfil")));
  await page.screenshot({ path: path.join(OUT, "20-criar-perfil.png"), fullPage: true });

  await page.type(".form-perfil .campo", "Lia");
  await page.click('.avatar-opcao[aria-label="coruja"]');
  await clicarTexto("Criar perfil"); await espera(600);
  passo("perfil criado com o bicho escolhido", banco.perfis.length === 1 && banco.perfis[0].nome === "Lia" && banco.perfis[0].avatar === "coruja");
  passo("avisa que herdou o progresso do aparelho", (await texto("#torrada")).includes("agora é de Lia"));
  await espera(2500);
  passo("progresso enviado para a nuvem", banco.progresso_fases.some((f) => f.tema === "saudacoes" && f.rodadas === 3 && f.perfil_id === banco.perfis[0].id));
  passo("revisão enviada para a nuvem", banco.revisoes.some((r) => r.palavra === "oi" && r.caixa === 2));
  passo("relatório mostra a fase vencida", (await texto(".tabela tbody tr td")) === "1 de 6");
  passo("relatório lista palavra difícil", (await texto(".dificeis")).includes("bye (tchau)"));
  await page.screenshot({ path: path.join(OUT, "21-pais-logado.png"), fullPage: true });

  // outro aparelho: sem nada local, baixa da nuvem ao abrir
  banco.progresso_fases.push({ perfil_id: banco.perfis[0].id, idioma: "en", tema: "familia", rodadas: 5, melhor_acc: 0.95 });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.endsWith(":dados")) localStorage.removeItem(k); });
  await page.reload({ waitUntil: "networkidle0" }); await espera(800);
  await page.evaluate(() => document.querySelector('[data-idioma="en"]') && !document.getElementById("tela-inicio").hidden && document.querySelector('[data-idioma="en"]').click());
  await espera(300);
  if (await visivel("tela-mapa")) { await page.click("#mapa-inicio"); await page.click('[data-idioma="en"]'); }
  passo("progresso da nuvem aparece em aparelho novo", (await texto("#mapa-contagem")).startsWith("2 de 6 fases"));
  passo("avatar da criança no mapa", await page.$eval("#mapa-inicio img", (i) => i.src.endsWith("/img/coruja.svg")));
  await page.screenshot({ path: path.join(OUT, "22-mapa-logado.png") });

  // segunda criança: a capa passa a perguntar quem vai brincar
  await page.click("#mapa-inicio"); await page.click("#btn-pais"); await espera(200);
  if (await page.$("#portao-resposta")) await portao();
  await clicarTexto("Adicionar criança"); await page.type(".form-perfil .campo", "Tom"); await clicarTexto("Criar perfil"); await espera(600);
  passo("segundo perfil criado", banco.perfis.length === 2);
  await page.click("#pais-voltar");
  passo("capa pergunta quem vai brincar", (await page.$$eval("#quem .avatar-botao", (b) => b.length)) === 2);
  await page.screenshot({ path: path.join(OUT, "23-capa-quem.png") });
  await page.evaluate(() => [...document.querySelectorAll("#quem .avatar-botao")].find((b) => b.textContent === "Tom").click());
  await page.click('[data-idioma="en"]');
  passo("Tom começa do zero", (await texto("#mapa-contagem")).startsWith("0 de 6 fases"));

  // excluir a conta
  await page.click("#mapa-inicio"); await page.click("#btn-pais"); await espera(200);
  if (await page.$("#portao-resposta")) await portao();
  await clicarTexto("Excluir conta"); await espera(200);
  await page.screenshot({ path: path.join(OUT, "24-excluir.png") });
  await page.evaluate(() => document.querySelector("#dialogo .btn-perigo").click()); await espera(900);
  passo("chamou a exclusão no servidor", chamadas.includes("POST /rest/v1/rpc/excluir_minha_conta"));
  passo("voltou a ser visitante", (await texto("#pais-conteudo h2")) === "Conta da família");
  passo("dados locais dos perfis apagados", await page.evaluate(() => !Object.keys(localStorage).some((k) => /^pp:p\d/.test(k))));

  console.log(erros.length ? "AVISOS/ERROS:\n" + [...new Set(erros)].join("\n") : "sem erros no console");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
