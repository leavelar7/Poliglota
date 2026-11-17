// conta.js — conta do responsável, perfis de criança e plano.
import { db, veioDeRecuperacao } from "./nuvem.js";
import { estado, lerPref, salvarPref } from "./estado.js";
import * as guarda from "./guarda.js";

const CACHE = "pp:conta";   // perfis e plano guardados para abrir sem internet

function lerCache() { try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) { return null; } }
function gravarCache() {
  try {
    localStorage.setItem(CACHE, JSON.stringify({
      usuario: estado.sessao ? estado.sessao.user.id : null, perfis: estado.perfis, plano: estado.plano
    }));
  } catch (e) {}
}

// traduz os erros mais comuns do login para algo que um pai entende
export function mensagemDeErro(e) {
  const m = String((e && e.message) || e || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("not confirmed")) return "Confirme seu e-mail antes de entrar. Enviamos um link para a sua caixa de entrada.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Já existe uma conta com este e-mail. Use a aba Entrar.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (m.includes("password") && (m.includes("least") || m.includes("weak") || m.includes("short"))) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("limite de 4")) return "Cada conta pode ter até 4 crianças.";
  if (m.includes("sending") && m.includes("email")) return "Não conseguimos enviar o e-mail de confirmação agora. Tente de novo mais tarde.";
  if (m.includes("email") && m.includes("invalid")) return "Este e-mail não parece válido. Confira e tente de novo.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com a internet. Tente de novo em instantes.";
  return "Não deu certo agora. Tente de novo em instantes.";
}

function escolherPerfil() {
  const ultimo = lerPref("perfil", null);
  estado.perfil = estado.perfis.find(function (p) { return p.id === ultimo; }) || estado.perfis[0] || null;
  guarda.usarPerfil(estado.perfil ? estado.perfil.id : null);
}

export function usarPerfil(perfil) {
  estado.perfil = perfil || null;
  guarda.usarPerfil(perfil ? perfil.id : null);
  if (perfil) { salvarPref("perfil", perfil.id); guarda.sincronizar(perfil.id); }
}

// carrega perfis e plano da conta logada (da nuvem; se não der, do cache)
export async function carregarConta() {
  if (!estado.sessao) { estado.perfis = []; estado.plano = "gratis"; usarPerfil(null); return; }
  const uid = estado.sessao.user.id;
  try {
    const [rp, rr] = await Promise.all([
      db.from("perfis").select("id,nome,avatar,criado_em").order("criado_em"),
      db.from("responsaveis").select("plano").eq("id", uid).maybeSingle()
    ]);
    if (rp.error) throw rp.error;
    estado.perfis = rp.data || [];
    estado.plano = (rr.data && rr.data.plano) || "gratis";
    gravarCache();
  } catch (e) {
    const c = lerCache();
    if (c && c.usuario === uid) { estado.perfis = c.perfis || []; estado.plano = c.plano || "gratis"; }
  }
  escolherPerfil();
  if (estado.perfil) guarda.sincronizar(estado.perfil.id);
}

// chamado uma vez ao abrir o app. `aoMudar(evento)` avisa a interface.
export async function iniciarConta(aoMudar) {
  const r = await db.auth.getSession();
  estado.sessao = (r.data && r.data.session) || null;
  if (veioDeRecuperacao && estado.sessao) estado.recuperandoSenha = true;
  await carregarConta();

  db.auth.onAuthStateChange(function (evento, sessao) {
    // nunca chamar o Supabase direto daqui de dentro (trava a biblioteca): adia.
    setTimeout(async function () {
      const antes = estado.sessao ? estado.sessao.user.id : null;
      const agora = sessao ? sessao.user.id : null;
      estado.sessao = sessao || null;
      if (evento === "PASSWORD_RECOVERY") { estado.recuperandoSenha = true; aoMudar("recuperar"); return; }
      if (antes === agora) return;            // só renovou o token
      await carregarConta();
      aoMudar(agora ? "entrou" : "saiu");
    }, 0);
  });
}

export async function entrar(email, senha) {
  const r = await db.auth.signInWithPassword({ email: email, password: senha });
  if (r.error) throw r.error;
}

// devolve "entrou" ou "confirmar" (quando o projeto exige confirmar o e-mail)
export async function criarConta(email, senha) {
  const r = await db.auth.signUp({
    email: email, password: senha,
    options: { emailRedirectTo: location.origin + "/app", data: { aceitou_termos_em: new Date().toISOString() } }
  });
  if (r.error) throw r.error;
  if (r.data.user && r.data.user.identities && r.data.user.identities.length === 0) throw new Error("already registered");
  return r.data.session ? "entrou" : "confirmar";
}

export async function pedirNovaSenha(email) {
  const r = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/app" });
  if (r.error) throw r.error;
}

export async function definirSenha(senha) {
  const r = await db.auth.updateUser({ password: senha });
  if (r.error) throw r.error;
  estado.recuperandoSenha = false;
}

export async function sair() {
  await db.auth.signOut();
  try { localStorage.removeItem(CACHE); } catch (e) {}
}

// ---------------- perfis ----------------
export async function criarPerfil(nome, avatar) {
  const primeiro = estado.perfis.length === 0;
  const r = await db.from("perfis").insert({ nome: nome.trim(), avatar: avatar }).select("id,nome,avatar,criado_em").single();
  if (r.error) throw r.error;
  estado.perfis.push(r.data);
  gravarCache();
  // o primeiro perfil da conta herda o que já foi jogado neste aparelho
  let herdou = false;
  if (primeiro && guarda.visitanteTemProgresso()) { guarda.importarVisitantePara(r.data.id); herdou = true; }
  usarPerfil(r.data);
  return { perfil: r.data, herdou: herdou };
}

export async function editarPerfil(id, nome, avatar) {
  const r = await db.from("perfis").update({ nome: nome.trim(), avatar: avatar }).eq("id", id).select("id,nome,avatar,criado_em").single();
  if (r.error) throw r.error;
  const i = estado.perfis.findIndex(function (p) { return p.id === id; });
  if (i >= 0) estado.perfis[i] = r.data;
  if (estado.perfil && estado.perfil.id === id) estado.perfil = r.data;
  gravarCache();
}

export async function apagarPerfil(id) {
  const r = await db.from("perfis").delete().eq("id", id);
  if (r.error) throw r.error;
  estado.perfis = estado.perfis.filter(function (p) { return p.id !== id; });
  guarda.apagarLocal(id);
  gravarCache();
  if (estado.perfil && estado.perfil.id === id) usarPerfil(estado.perfis[0] || null);
}

// últimas tentativas de um perfil (para o relatório dos pais)
export async function tentativasDoPerfil(id) {
  const r = await db.from("tentativas").select("palavras,idioma,resultado,created_at")
    .eq("perfil_id", id).order("created_at", { ascending: false }).limit(1000);
  if (r.error) throw r.error;
  return r.data || [];
}

// registra uma tentativa de fala (só com conta; visitante não gera registro)
export function registrarTentativa(rotulo, idioma, resultado) {
  if (!estado.sessao || !estado.perfil || !navigator.onLine) return;
  db.from("tentativas").insert({ perfil_id: estado.perfil.id, palavras: rotulo, idioma: idioma, resultado: resultado })
    .then(function (r) { if (r.error) console.warn("tentativa não registrada:", r.error.message); });
}

// LGPD: tudo o que guardamos sobre a conta, em um arquivo
export async function exportarDados() {
  const out = { exportado_em: new Date().toISOString(), conta: { email: estado.sessao.user.email, plano: estado.plano }, criancas: [] };
  for (const p of estado.perfis) {
    await guarda.sincronizar(p.id);
    const d = guarda.dadosDoPerfil(p.id);
    let tentativas = [];
    try { tentativas = await tentativasDoPerfil(p.id); } catch (e) {}
    out.criancas.push({ nome: p.nome, avatar: p.avatar, criado_em: p.criado_em, progresso: d.progresso, revisao: d.revisao, tentativas: tentativas });
  }
  return out;
}

// LGPD: apaga a conta e tudo o que pertence a ela
export async function excluirConta() {
  const ids = estado.perfis.map(function (p) { return p.id; });
  const r = await db.rpc("excluir_minha_conta");
  if (r.error) throw r.error;
  ids.forEach(guarda.apagarLocal);
  try { localStorage.removeItem(CACHE); } catch (e) {}
  await db.auth.signOut({ scope: "local" });
}
