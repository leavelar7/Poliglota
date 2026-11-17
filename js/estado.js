// estado.js — o que o app "sabe" neste momento, compartilhado entre as telas.
export const estado = {
  idioma: "en",
  sessao: null,        // sessão do Supabase (responsável logado) ou null
  perfis: [],          // perfis de criança da conta
  perfil: null,        // perfil em uso (objeto) ou null = visitante neste aparelho
  plano: "gratis",
  semMic: false,       // preferência: jogar sem microfone
  recuperandoSenha: false
};

// ---- navegação entre telas, sem os módulos precisarem se importar em círculo ----
const rotas = {};
export function registrarRota(nome, fn) { rotas[nome] = fn; }
export function ir(nome, ...args) {
  if (!rotas[nome]) throw new Error("rota desconhecida: " + nome);
  return rotas[nome](...args);
}

// ---- preferências simples deste aparelho ----
export function lerPref(chave, padrao) {
  try { const v = localStorage.getItem("pp:pref:" + chave); return v === null ? padrao : JSON.parse(v); }
  catch (e) { return padrao; }
}
export function salvarPref(chave, valor) {
  try { localStorage.setItem("pp:pref:" + chave, JSON.stringify(valor)); } catch (e) {}
}
