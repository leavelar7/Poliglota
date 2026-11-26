// telas/jogo.js — a rodada: cartões de palavra e de letra, fala, revisão e fim de rodada.
import { COBRANCA_ATIVA, LOCALE, NOME_IDIOMA, MAX_REVISAO, NOTA_ACERTOU, NOTA_QUASE } from "../config.js";
import { estado, ir, registrarRota } from "../estado.js";
import { vocab, slugsDosTemas, palavrasDoTema, letrasDoIdioma, figSrc, audioPalavra, audioLetra, audioFrase } from "../dados.js";
import * as guarda from "../guarda.js";
import { registrarTentativa } from "../conta.js";
import { tocar, parar, falarNavegador, preCarregar } from "../som.js";
import { temReconhecimento, escutar, cancelarEscuta } from "../fala.js";
import { $, mostrarTela, ICONE, estrela } from "../ui.js";
import { estrelasMapa, pendentesRevisao } from "./mapa.js";

const L = window.Logica;

let modo = "fase";       // "fase" | "revisao" | "alfabeto"
let tema = null;         // slug da fase em jogo
let itens = [];          // [{tipo: "palavra" | "letra" | "frase", dados, palavra?}]
let fila = [];           // índices de itens nesta passada
let p = 0;
let atual = null;
let errados = [];        // índices para repetir no fim (uma vez)
let repassando = false;
let ok = {};             // palavras acertadas nesta rodada (pt -> true)
let falhas = 0;          // tentativas falhas no item atual
let vez = 0;             // muda a cada item/saída: invalida timers antigos
let ocupado = false;     // esperando o reconhecimento ou a troca de cartão

function embaralhar(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function usaMic() { return temReconhecimento && !estado.semMic; }
function lang() { return estado.idioma; }
function alvo() { return atual.tipo === "letra" ? atual.dados.exemplo : atual.dados[lang()]; }
// chave da revisão: a palavra em português, ou "frase:<id>:<nível>"
function chave(it) { return it.tipo === "frase" ? L.chaveFrase(it.dados.palavra_id, it.dados.nivel) : it.dados.pt; }

// depois de `ms`, roda fn — a não ser que o cartão já tenha mudado
function depois(ms, fn) {
  const minha = vez;
  setTimeout(function () { if (minha === vez) fn(); }, ms);
}

// ---------------- começar ----------------
function comecar(novoModo, novosItens) {
  modo = novoModo; itens = novosItens;
  fila = itens.map(function (_, i) { return i; });
  p = 0; errados = []; repassando = false; ok = {};
  const l = lang(), urls = [];
  itens.forEach(function (it) {
    if (it.tipo === "palavra") { urls.push(figSrc(it.dados.fig), audioPalavra(it.dados, l)); }
    else if (it.tipo === "frase") { urls.push(figSrc(it.palavra.fig), audioFrase(it.dados, l)); }
    else { urls.push(audioLetra(it.dados, "letra"), audioLetra(it.dados, "palavra")); if (it.dados.fig) urls.push(figSrc(it.dados.fig)); }
  });
  preCarregar(urls);
  mostrarTela("jogo");
  mostrarItem();
}

function jogarFase(slug) {
  const ws = palavrasDoTema(slug);
  if (!ws.length) return;
  tema = slug;
  comecar("fase", embaralhar(ws).map(function (w) { return { tipo: "palavra", dados: w }; }));
}

function iniciarRevisao() {
  const p = pendentesRevisao(lang());
  const sel = L.montarRevisao(p.palavras, p.frases, MAX_REVISAO, 4);
  const pend = sel.palavras.map(function (w) { return { tipo: "palavra", dados: w }; })
    .concat(sel.frases.map(function (f) { return { tipo: "frase", dados: f, palavra: vocab.palavraPorId[f.palavra_id] }; }));
  if (!pend.length) {
    ir("aviso", { figura: "/img/estrela.svg", titulo: "Revisão em dia!", texto: "Nada para revisar agora. Volte depois de brincar mais um pouco.",
      botoes: [{ rotulo: "Voltar ao mapa", principal: true, acao: function () { ir("mapa"); } }] });
    return;
  }
  comecar("revisao", embaralhar(pend));
}

function iniciarAlfabeto() {
  const ls = letrasDoIdioma(lang());
  if (!ls.length) return;
  comecar("alfabeto", ls.map(function (x) { return { tipo: "letra", dados: x }; }));
}

// ---------------- cartão ----------------
function mostrarItem() {
  vez++; falhas = 0; ocupado = false; cancelarEscuta();
  atual = itens[fila[p]];
  const feito = repassando ? 1 : p / fila.length;
  $("jogo-barra").style.width = Math.round(feito * 100) + "%";
  $("jogo-barra").parentNode.setAttribute("aria-valuenow", Math.round(feito * 100));
  falar("", "");
  $("btn-pular").hidden = true;
  const cartao = $("cartao");
  cartao.classList.remove("entra"); void cartao.offsetWidth; cartao.classList.add("entra");

  const principal = $("btn-falar");
  principal.classList.remove("ouvindo");
  if (usaMic()) { principal.innerHTML = ICONE.mic; principal.setAttribute("aria-label", "Falar a palavra"); }
  else { principal.innerHTML = ICONE.certo; principal.setAttribute("aria-label", "Já repeti, próxima palavra"); }

  $("selo-frase").hidden = atual.tipo !== "frase";
  $("palavra").classList.toggle("frase", atual.tipo === "frase");
  if (atual.tipo === "letra") mostrarLetra();
  else if (atual.tipo === "frase") mostrarFrase();
  else mostrarPalavra();
}

function mostrarPalavra() {
  const w = atual.dados;
  $("letra-grande").hidden = true;
  $("cartao-corpo").hidden = false;
  const fig = $("figura");
  fig.hidden = false; fig.src = figSrc(w.fig);
  $("palavra").textContent = w[lang()];
  $("palavra").lang = lang();
  $("traducao").textContent = w.pt;
  tocarAtual();
}

// frase aplicada: a figura da palavra que a criança já aprendeu, e a frase que a usa
function mostrarFrase() {
  const f = atual.dados, w = atual.palavra;
  $("letra-grande").hidden = true;
  $("cartao-corpo").hidden = false;
  const fig = $("figura");
  if (w && w.fig) { fig.src = figSrc(w.fig); fig.hidden = false; } else fig.hidden = true;
  const selo = $("selo-frase");
  selo.className = "selo-frase nivel-" + f.nivel;
  selo.setAttribute("aria-label", f.nivel === 1 ? "Frase simples" : "Frase completa");
  $("palavra").textContent = f[lang()];
  $("palavra").lang = lang();
  $("traducao").textContent = f.pt;
  tocarAtual();
}

// letra: primeiro mostra e fala a letra; logo depois revela e fala a palavra de exemplo
function mostrarLetra() {
  const a = atual.dados;
  $("letra-grande").textContent = a.letra;
  $("letra-grande").hidden = false;
  $("cartao-corpo").hidden = true;
  ocupado = true;   // os botões só valem depois que a palavra aparece
  tocar(audioLetra(a, "letra")).catch(function () { falarNavegador(a.letra, LOCALE[lang()]); });
  depois(2400, function () {
    const fig = $("figura");
    if (a.fig) { fig.src = figSrc(a.fig); fig.hidden = false; } else fig.hidden = true;
    $("palavra").textContent = a.exemplo;
    $("palavra").lang = lang();
    $("traducao").textContent = a.exemplo_pt || "";
    $("letra-grande").hidden = true;
    $("cartao-corpo").hidden = false;
    ocupado = false;
    tocarAtual();
  });
}

function tocarAtual() {
  if (!atual) return;
  const texto = alvo(), l = lang();
  const src = atual.tipo === "letra" ? audioLetra(atual.dados, "palavra")
    : atual.tipo === "frase" ? audioFrase(atual.dados, l) : audioPalavra(atual.dados, l);
  tocar(src).catch(function () { falarNavegador(texto, LOCALE[l]); });
}

function falar(texto, classe) {
  const f = $("feedback");
  f.textContent = texto;
  f.className = "feedback" + (classe ? " " + classe : "");
}

function marcarOk() {
  if (atual.tipo !== "letra") ok[chave(atual)] = true;
}

function rotulo() {
  if (atual.tipo === "letra") return "letra " + atual.dados.letra;
  if (atual.tipo === "frase") return atual.dados.pt;
  return atual.dados.pt;
}

// ---------------- botão principal: falar (ou "já repeti") ----------------
function aoApertarPrincipal() {
  if (ocupado || !atual) return;
  if (!usaMic()) {              // modo ouvir e repetir: a criança repete e confirma
    ocupado = true; marcarOk();
    falar("Muito bem!", "boa");
    depois(650, proximo);
    return;
  }
  ocupado = true;
  parar();
  $("btn-falar").classList.add("ouvindo");
  falar("Estou ouvindo…", "ouvindo");
  const minha = vez;
  escutar(LOCALE[lang()], function (alts) {
    if (minha !== vez) return;
    $("btn-falar").classList.remove("ouvindo");
    avaliar(alts);
  }, function (motivo) {
    if (minha !== vez) return;
    $("btn-falar").classList.remove("ouvindo");
    if (motivo === "bloqueado") {
      // sem permissão de microfone: segue no modo ouvir e repetir até o fim da sessão
      estado.semMic = true; ocupado = false;
      $("btn-falar").innerHTML = ICONE.certo;
      $("btn-falar").setAttribute("aria-label", "Já repeti, próxima palavra");
      falar("Microfone desligado. Repita e toque no botão.", "");
      return;
    }
    registrarFalha(motivo === "silencio" ? "Não ouvi. Tente de novo." : "Não consegui ouvir. Toque no microfone.");
  });
}

function avaliar(alts) {
  // frase: conta as palavras ditas; a nota de corte é mais baixa porque a frase é longa
  const ehFrase = atual.tipo === "frase";
  const nota = ehFrase ? L.pontuarFrase(alts, alvo()) : L.pontuar(alts, alvo());
  const corteAcertou = ehFrase ? 0.6 : NOTA_ACERTOU, corteQuase = ehFrase ? 0.4 : NOTA_QUASE;
  if (nota >= corteAcertou) { registrarTentativa(rotulo(), lang(), "acertou"); marcarOk(); falar("Boa!", "boa"); depois(1000, proximo); }
  else if (nota >= corteQuase) { registrarTentativa(rotulo(), lang(), "quase"); marcarOk(); falar("Quase! Valeu.", "boa"); depois(1100, proximo); }
  else { registrarTentativa(rotulo(), lang(), "errou"); registrarFalha("Tente de novo."); }
}

function registrarFalha(msg) {
  falhas++;
  if (falhas >= 3) {
    if (!repassando && errados.indexOf(fila[p]) === -1) errados.push(fila[p]);
    falar("Tudo bem, vamos para a próxima.", "");
    depois(1000, proximo);
    return;
  }
  ocupado = false;
  falar(msg, "tente");
  $("btn-pular").hidden = false;
  tocarAtual();
}

function pular() {
  if (!atual) return;
  if (usaMic()) registrarTentativa(rotulo(), lang(), "pulou");
  if (!repassando && errados.indexOf(fila[p]) === -1) errados.push(fila[p]);
  cancelarEscuta();
  proximo();
}

function proximo() {
  if (p + 1 < fila.length) { p++; mostrarItem(); return; }
  if (!repassando && errados.length) {
    repassando = true; fila = errados.slice(); errados = []; p = 0; mostrarItem(); return;
  }
  terminar();
}

function sair() {
  vez++; atual = null;
  parar(); cancelarEscuta();
  ir("mapa");
}

// ---------------- fim ----------------
function terminar() {
  vez++; parar(); cancelarEscuta();
  if (modo === "revisao") return fimRevisao();
  if (modo === "alfabeto") return fimAlfabeto();
  fimDeFase();
}

function fimDeFase() {
  const l = lang(), slugs = slugsDosTemas();
  const antes = estrelasMapa(l);
  const tinhaTrofeu = L.ganhouTrofeu(antes, slugs);
  let acertos = 0;
  for (const k in ok) if (ok[k]) acertos++;
  guarda.registrarRodada(l, tema, acertos / (itens.length || 1));
  const agora = estrelasMapa(l);
  const n = agora[tema], era = antes[tema];
  const f = guarda.progresso(l)[tema] || { rodadas: 0, melhorAcc: 0 };

  const caixa = $("fim-estrelas");
  caixa.innerHTML = [1, 2, 3].map(function (i) { return '<span class="' + (n >= i ? "pop" : "") + '">' + estrela(n >= i) + "</span>"; }).join("");
  caixa.setAttribute("aria-label", n + " de 3 estrelas");
  $("fim-titulo").textContent = (n >= 2 && era < 2) ? "Fase vencida!" : (n > era ? "Nova estrela!" : "Boa! Continue assim.");
  const barra = $("fim-barra");
  barra.style.width = "0%";
  setTimeout(function () { barra.style.width = Math.round(L.progressoFase(f.rodadas, f.melhorAcc) * 100) + "%"; }, 80);

  const i = slugs.indexOf(tema), prox = $("btn-proxima");
  const temProxima = i + 1 < slugs.length && L.faseDestravada(agora, slugs, i + 1) &&
    L.faseLiberadaNoPlano(vocab.temas[i + 1].gratis, estado.plano, COBRANCA_ATIVA);
  prox.hidden = !temProxima;
  prox.onclick = temProxima ? function () { jogarFase(slugs[i + 1]); } : null;

  mostrarTela("fim");
  (temProxima ? prox : $("btn-denovo")).focus();

  if (!tinhaTrofeu && L.ganhouTrofeu(agora, slugs)) {
    setTimeout(function () {
      if ($("tela-fim").hidden) return;
      ir("aviso", { arte: ICONE.trofeu, titulo: "Você conquistou o troféu do " + NOME_IDIOMA[l] + "!",
        botoes: [{ rotulo: "Voltar ao mapa", principal: true, acao: function () { ir("mapa"); } }] });
    }, 1600);
  }
}

function fimRevisao() {
  const l = lang();
  let acertou = 0;
  let frases = 0;
  itens.forEach(function (it) {
    const k = chave(it), certo = !!ok[k];
    if (certo) acertou++;
    if (it.tipo === "frase") frases++;
    guarda.agendarPalavra(l, k, certo);
  });
  const p = pendentesRevisao(l);
  const resta = p.palavras.length + p.frases.length > 0;
  const botoes = [{ rotulo: "Voltar ao mapa", principal: !resta, acao: function () { ir("mapa"); } }];
  if (resta) botoes.unshift({ rotulo: "Revisar mais", principal: true, acao: iniciarRevisao });
  ir("aviso", { figura: "/img/estrela.svg",
    titulo: "Você revisou " + itens.length + (itens.length > 1 ? " cartões" : " cartão") + " e acertou " + acertou + "!",
    texto: frases ? (frases > 1 ? frases + " deles eram frases." : "Um deles era uma frase.") : "",
    botoes: botoes });
}

function fimAlfabeto() {
  ir("aviso", { figura: "/img/medalha.svg", titulo: "Alfabeto completo!",
    botoes: [
      { rotulo: "Voltar ao mapa", principal: true, acao: function () { ir("mapa"); } },
      { rotulo: "Ouvir de novo", acao: iniciarAlfabeto }
    ] });
}

export function iniciarJogo() {
  registrarRota("fase", jogarFase);
  registrarRota("revisao", iniciarRevisao);
  registrarRota("alfabeto", iniciarAlfabeto);
  registrarRota("sair-do-jogo", sair);

  $("btn-falar").addEventListener("click", aoApertarPrincipal);
  $("btn-som").addEventListener("click", tocarAtual);
  $("btn-pular").addEventListener("click", pular);
  $("btn-sair").addEventListener("click", sair);
  $("btn-denovo").addEventListener("click", function () { jogarFase(tema); });
  $("btn-fim-mapa").addEventListener("click", function () { ir("mapa"); });
}

