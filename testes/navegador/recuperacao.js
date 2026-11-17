// teste do link "trocar senha" que chega por e-mail (Supabase simulado)
const puppeteer = require("puppeteer-core");
const BASE = "http://localhost:4173";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const USER = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "pai@exemplo.com", app_metadata: {}, user_metadata: {} };
const exp = Math.floor(Date.now() / 1000) + 3600;
const JWT = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: USER.id, exp: exp, role: "authenticated", email: USER.email }) + ".assinatura";
const dados = require("./dados.json");

(async function () {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const erros = [];
  let senhaNova = null;
  page.on("pageerror", (e) => erros.push(e.message));
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (!u.includes("supabase.co")) return req.continue();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    const ok = (corpo) => req.respond({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(corpo) });
    if (req.method() === "OPTIONS") return ok({});
    if (u.includes("/auth/v1/user")) { if (req.method() === "PUT") senhaNova = JSON.parse(req.postData()).password; return ok(USER); }
    const tabela = (/rest\/v1\/(\w+)/.exec(u) || [])[1];
    if (dados[tabela]) return ok(dados[tabela]);
    if (tabela === "responsaveis") return ok({ plano: "gratis" });
    return ok([]);
  });
  const passo = (n, c) => { console.log((c ? "OK   " : "FALHA") + " " + n); if (!c) process.exitCode = 1; };

  await page.goto(BASE + "/app#access_token=" + JWT + "&expires_at=" + exp + "&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery", { waitUntil: "networkidle0" });
  await espera(800);
  passo("abre direto na área dos pais", await page.$eval("#tela-pais", (e) => !e.hidden));
  passo("pede a nova senha (e não o perfil)", (await page.$eval("#pais-conteudo h2", (e) => e.textContent)) === "Escolha uma nova senha");
  passo("o endereço não guarda mais o token", !(await page.evaluate(() => location.hash.includes("access_token"))));
  await page.type("#nova-senha", "curta");
  await page.keyboard.press("Enter"); await espera(300);
  passo("recusa senha curta", (await page.$eval("#pais-conteudo .erro-campo", (e) => e.textContent)).includes("8 caracteres"));
  await page.$eval("#nova-senha", (e) => (e.value = ""));
  await page.type("#nova-senha", "senha-nova-segura");
  await page.keyboard.press("Enter"); await espera(1000);
  passo("salvou a senha nova", senhaNova === "senha-nova-segura");
  passo("depois segue para criar o perfil", (await page.$eval("#pais-conteudo h2", (e) => e.textContent)) === "Crianças");

  // um link de confirmação de cadastro (type=signup) não deve pedir senha
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + "/app#access_token=" + JWT + "&expires_at=" + exp + "&expires_in=3600&refresh_token=r&token_type=bearer&type=signup", { waitUntil: "networkidle0" });
  await page.reload({ waitUntil: "networkidle0" }); await espera(800);
  passo("confirmação de cadastro vai para criar perfil", (await page.$eval("#pais-conteudo h2", (e) => e.textContent)) === "Crianças");

  console.log(erros.length ? "ERROS: " + erros.join(" | ") : "sem erros no console");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
