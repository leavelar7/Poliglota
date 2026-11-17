// dados.js — vocabulário (palavras, alfabeto, temas). Fica em cache no aparelho
// para abrir na hora e funcionar sem internet.
import { db, buscarTudo } from "./nuvem.js";

const CHAVE = "pp:vocab";
export const vocab = { palavras: [], letras: [], temas: [], frases: [], ptPorId: {}, palavraPorId: {} };

function nomeBonito(slug) {
  const s = String(slug).replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function aplicar(bruto) {
  vocab.palavras = bruto.palavras || [];
  vocab.letras = bruto.letras || [];
  vocab.frases = bruto.frases || [];
  vocab.ptPorId = {}; vocab.palavraPorId = {};
  vocab.palavras.forEach(function (w) { vocab.ptPorId[w.id] = w.pt; vocab.palavraPorId[w.id] = w; });
  let temas = (bruto.temas || []).filter(function (t) { return t.ativo !== false; })
    .sort(function (a, b) { return a.ordem - b.ordem; });
  if (!temas.length) {
    // sem a tabela de temas: deriva a ordem das próprias palavras (comportamento antigo)
    temas = window.Logica.ordemTemas(vocab.palavras).map(function (slug, i) {
      return { slug: slug, nome: nomeBonito(slug), ordem: i + 1, icone: null, gratis: i < 5 };
    });
  }
  temas.forEach(function (t) {
    if (!t.icone) {
      const w = vocab.palavras.find(function (x) { return x.tema === t.slug; });
      t.icone = w ? w.fig : null;
    }
  });
  vocab.temas = temas;
}

async function buscar() {
  const [palavras, letras, temas, frases] = await Promise.all([
    buscarTudo(function () { return db.from("palavras").select("id,pt,en,de,it,fig,tema").order("id"); }),
    buscarTudo(function () { return db.from("alfabeto").select("idioma,ordem,letra,exemplo,exemplo_pt,fig").order("idioma").order("ordem"); }),
    buscarTudo(function () { return db.from("temas").select("slug,nome,ordem,icone,gratis,ativo").order("ordem"); })
      .catch(function () { return []; }),
    buscarTudo(function () { return db.from("frases_aplicadas").select("palavra_id,nivel,pt,en,de,it").order("palavra_id").order("nivel"); })
      .catch(function () { return []; })
  ]);
  if (!palavras.length) throw new Error("vocabulário vazio");
  const bruto = { palavras: palavras, letras: letras, temas: temas, frases: frases, em: Date.now() };
  try { localStorage.setItem(CHAVE, JSON.stringify(bruto)); } catch (e) {}
  return bruto;
}

// usa o cache se existir (e atualiza por trás, valendo na próxima abertura);
// sem cache, espera a rede — e lança erro se não conseguir.
export async function carregarVocabulario() {
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) {}
  if (cache && cache.palavras && cache.palavras.length && cache.frases) {
    aplicar(cache);
    buscar().catch(function () {});
    return;
  }
  aplicar(await buscar());
}

export function slugsDosTemas() { return vocab.temas.map(function (t) { return t.slug; }); }
export function palavrasDoTema(slug) { return vocab.palavras.filter(function (w) { return w.tema === slug; }); }
export function letrasDoIdioma(lang) { return vocab.letras.filter(function (l) { return l.idioma === lang; }); }

export function figSrc(fig) {
  if (!fig) return "";
  return "/img/" + (fig.slice(-4) === ".svg" ? fig : fig + ".svg");
}
export function audioPalavra(w, lang) { return "/audio/" + w.id + "_" + lang + ".mp3"; }
export function audioFrase(f, lang) { return "/audio/f" + f.palavra_id + "_" + f.nivel + "_" + lang + ".mp3"; }
export function audioLetra(l, parte) { return "/audio/alf_" + l.idioma + "_" + l.ordem + "_" + parte + ".mp3"; }
