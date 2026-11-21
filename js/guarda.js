// guarda.js — progresso e revisão de UM perfil.
// Grava primeiro no aparelho (funciona offline) e depois envia para a nuvem
// quando há conta. Ao abrir em outro aparelho, junta os dois lados sem perder nada.
import { db, buscarTudo } from "./nuvem.js";

const L = window.Logica;
const VISITANTE = "local";
let perfilId = VISITANTE;

function chave(id) { return "pp:" + id + ":dados"; }
function vazio() { return { progresso: {}, revisao: {}, sujo: { fases: {}, revs: {} } }; }

function ler(id) {
  try {
    const d = JSON.parse(localStorage.getItem(chave(id)) || "null");
    if (d && d.progresso) {
      if (!d.revisao) d.revisao = {};
      if (!d.sujo) d.sujo = { fases: {}, revs: {} };
      return d;
    }
  } catch (e) {}
  return vazio();
}
function gravar(id, d) {
  try { localStorage.setItem(chave(id), JSON.stringify(d)); } catch (e) {}
}

// traz o progresso salvo pela versão antiga do app (chaves poliglota_*) para o
// perfil visitante, uma única vez. As chaves antigas ficam intactas.
(function migrarLegado() {
  try {
    if (localStorage.getItem(chave(VISITANTE))) return;
    const d = vazio();
    if (localStorage.getItem("poliglota_versao") === "2") {
      d.progresso = JSON.parse(localStorage.getItem("poliglota_progresso") || "{}");
    }
    d.revisao = JSON.parse(localStorage.getItem("poliglota_revisao") || "{}");
    if (Object.keys(d.progresso).length || Object.keys(d.revisao).length) gravar(VISITANTE, d);
  } catch (e) {}
})();

export function usarPerfil(id) { perfilId = id || VISITANTE; }

export function progresso(lang) { return ler(perfilId).progresso[lang] || {}; }
export function revisao(lang) { return ler(perfilId).revisao[lang] || {}; }
export function dadosDoPerfil(id) { const d = ler(id); return { progresso: d.progresso, revisao: d.revisao }; }

export function visitanteTemProgresso() {
  const d = ler(VISITANTE);
  return Object.keys(d.progresso).some(function (l) { return Object.keys(d.progresso[l]).length > 0; });
}

// registra uma rodada concluída: +1 rodada e guarda a MELHOR acurácia
export function registrarRodada(lang, tema, acc) {
  const d = ler(perfilId);
  if (!d.progresso[lang]) d.progresso[lang] = {};
  const f = d.progresso[lang][tema] || { rodadas: 0, melhorAcc: 0 };
  f.rodadas++;
  if (acc > (f.melhorAcc || 0)) f.melhorAcc = acc;
  d.progresso[lang][tema] = f;
  d.sujo.fases[lang + "|" + tema] = 1;
  gravar(perfilId, d);
  agendarEnvio();
}

// resultado de uma palavra revisada: sobe ou volta de caixa (Leitner)
export function agendarPalavra(lang, pt, acertou) {
  const d = ler(perfilId);
  if (!d.revisao[lang]) d.revisao[lang] = {};
  const agora = Date.now();
  const novo = L.agendarRevisao(d.revisao[lang][pt], acertou, agora);
  novo.em = agora;
  d.revisao[lang][pt] = novo;
  d.sujo.revs[lang + "|" + pt] = 1;
  gravar(perfilId, d);
  agendarEnvio();
}

// leva o progresso do visitante (deste aparelho) para um perfil recém-criado
export function importarVisitantePara(id) {
  const origem = ler(VISITANTE), destino = ler(id);
  destino.progresso = L.mesclarProgresso(destino.progresso, origem.progresso);
  destino.revisao = L.mesclarRevisao(destino.revisao, origem.revisao);
  marcarTudoSujo(destino);
  gravar(id, destino);
}

export function apagarLocal(id) {
  try { localStorage.removeItem(chave(id)); } catch (e) {}
}

function marcarTudoSujo(d) {
  for (const l in d.progresso) for (const t in d.progresso[l]) d.sujo.fases[l + "|" + t] = 1;
  for (const l in d.revisao) for (const p in d.revisao[l]) d.sujo.revs[l + "|" + p] = 1;
}

// ---------------- nuvem ----------------
let timer = null, enviando = false;

function agendarEnvio() {
  if (perfilId === VISITANTE) return;
  clearTimeout(timer);
  timer = setTimeout(function () { enviar(perfilId); }, 1500);
}

// envia só o que mudou desde o último envio bem-sucedido
async function enviar(id) {
  if (id === VISITANTE || enviando || !navigator.onLine) return false;
  enviando = true;
  try {
    const d = ler(id);
    const chavesFases = Object.keys(d.sujo.fases), chavesRevs = Object.keys(d.sujo.revs);
    if (!chavesFases.length && !chavesRevs.length) return true;
    const agoraIso = new Date().toISOString();

    const linhasFases = chavesFases.map(function (k) {
      const i = k.indexOf("|"), lang = k.slice(0, i), tema = k.slice(i + 1);
      const f = (d.progresso[lang] || {})[tema];
      return f ? { perfil_id: id, idioma: lang, tema: tema, rodadas: f.rodadas, melhor_acc: f.melhorAcc || 0, atualizado_em: agoraIso } : null;
    }).filter(Boolean);
    const linhasRevs = chavesRevs.map(function (k) {
      const i = k.indexOf("|"), lang = k.slice(0, i), pt = k.slice(i + 1);
      const r = (d.revisao[lang] || {})[pt];
      return r ? { perfil_id: id, idioma: lang, palavra: pt, caixa: r.caixa, proxima: new Date(r.prox).toISOString(),
                   atualizado_em: new Date(r.em || Date.now()).toISOString() } : null;
    }).filter(Boolean);

    for (let i = 0; i < linhasFases.length; i += 500) {
      const r = await db.from("progresso_fases").upsert(linhasFases.slice(i, i + 500));
      if (r.error) throw r.error;
    }
    for (let i = 0; i < linhasRevs.length; i += 500) {
      const r = await db.from("revisoes").upsert(linhasRevs.slice(i, i + 500));
      if (r.error) throw r.error;
    }
    // limpa só o que foi enviado (algo novo pode ter sido marcado no meio do caminho)
    const depois = ler(id);
    chavesFases.forEach(function (k) { delete depois.sujo.fases[k]; });
    chavesRevs.forEach(function (k) { delete depois.sujo.revs[k]; });
    gravar(id, depois);
    return true;
  } catch (e) {
    console.warn("não foi possível enviar o progresso agora:", e.message || e);
    return false;
  } finally {
    enviando = false;
  }
}

// baixa o que está na nuvem, junta com o aparelho e envia a diferença
export async function sincronizar(id) {
  id = id || perfilId;
  if (id === VISITANTE || !navigator.onLine) return false;
  try {
    const [fases, revs] = await Promise.all([
      buscarTudo(function () { return db.from("progresso_fases").select("idioma,tema,rodadas,melhor_acc").eq("perfil_id", id).order("tema"); }),
      buscarTudo(function () { return db.from("revisoes").select("idioma,palavra,caixa,proxima,atualizado_em").eq("perfil_id", id).order("palavra"); })
    ]);
    const nProg = {}, nRev = {};
    fases.forEach(function (f) {
      if (!nProg[f.idioma]) nProg[f.idioma] = {};
      nProg[f.idioma][f.tema] = { rodadas: f.rodadas, melhorAcc: f.melhor_acc };
    });
    revs.forEach(function (r) {
      if (!nRev[r.idioma]) nRev[r.idioma] = {};
      nRev[r.idioma][r.palavra] = { caixa: r.caixa, prox: Date.parse(r.proxima), em: Date.parse(r.atualizado_em) };
    });

    const d = ler(id);
    d.progresso = L.mesclarProgresso(d.progresso, nProg);
    d.revisao = L.mesclarRevisao(d.revisao, nRev);
    // o que ficou diferente da nuvem precisa subir
    for (const l in d.progresso) for (const t in d.progresso[l]) {
      const a = d.progresso[l][t], b = (nProg[l] || {})[t];
      if (!b || b.rodadas !== a.rodadas || Math.abs((b.melhorAcc || 0) - (a.melhorAcc || 0)) > 1e-6) d.sujo.fases[l + "|" + t] = 1;
    }
    for (const l in d.revisao) for (const p in d.revisao[l]) {
      const a = d.revisao[l][p], b = (nRev[l] || {})[p];
      if (!b || (a.em || 0) > (b.em || 0)) d.sujo.revs[l + "|" + p] = 1;
    }
    gravar(id, d);
    // as telas abertas (mapa) se redesenham com o que veio da nuvem
    window.dispatchEvent(new CustomEvent("pp:sincronizado", { detail: { perfil: id } }));
    return await enviar(id);
  } catch (e) {
    console.warn("não foi possível sincronizar agora:", e.message || e);
    return false;
  }
}

window.addEventListener("online", function () { if (perfilId !== VISITANTE) sincronizar(perfilId); });
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden" && perfilId !== VISITANTE) { clearTimeout(timer); enviar(perfilId); }
});
