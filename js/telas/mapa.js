// telas/mapa.js — capa (escolha de idioma e de criança), mapa de fases, painel de progresso e avisos.
import { COBRANCA_ATIVA, IDIOMAS, NOME_IDIOMA } from "../config.js";
import { estado, ir, registrarRota, salvarPref } from "../estado.js";
import { vocab, slugsDosTemas, figSrc } from "../dados.js";
import * as guarda from "../guarda.js";
import * as conta from "../conta.js";
import { $, el, limpar, mostrarTela, ICONE, BANDEIRA, tresEstrelas, portaoDosPais } from "../ui.js";

const L = window.Logica;

// estrelas de cada fase de um idioma: { slug: 0..3 }
export function estrelasMapa(lang) {
  const prog = guarda.progresso(lang), m = {};
  slugsDosTemas().forEach(function (t) {
    const f = prog[t] || {};
    m[t] = L.estrelasFase(f.rodadas || 0, f.melhorAcc || 0);
  });
  return m;
}

// o que está para revisar hoje num idioma: palavras vencidas e frases liberadas e vencidas
export function pendentesRevisao(lang) {
  const agora = Date.now(), rev = guarda.revisao(lang);
  return {
    palavras: L.revisaoPendente(vocab.palavras, guarda.progresso(lang), rev, agora),
    frases: L.frasesPendentes(vocab.frases, vocab.ptPorId, rev, agora)
  };
}
export function totalPendente(lang) {
  const p = pendentesRevisao(lang);
  return p.palavras.length + p.frases.length;
}

function temaLiberado(t) { return L.faseLiberadaNoPlano(t.gratis, estado.plano, COBRANCA_ATIVA); }

// ---------------- capa ----------------
function abrirInicio() {
  // quem vai brincar? (só aparece quando a conta tem mais de uma criança)
  const quem = $("quem");
  limpar(quem);
  quem.hidden = estado.perfis.length < 2;
  if (!quem.hidden) {
    estado.perfis.forEach(function (p) {
      const atual = estado.perfil && estado.perfil.id === p.id;
      quem.appendChild(el("button", {
        class: "avatar-botao" + (atual ? " escolhido" : ""), type: "button", "aria-pressed": atual ? "true" : "false",
        onclick: function () { conta.usarPerfil(p); abrirInicio(); }
      }, [el("img", { src: figSrc(p.avatar), alt: "" }), el("span", { text: p.nome })]));
    });
  }
  mostrarTela("inicio");
}

// ---------------- mapa ----------------
function abrirMapa(lang) {
  estado.idioma = lang || estado.idioma;
  salvarPref("idioma", estado.idioma);
  mostrarTela("mapa");   // precisa estar visível antes de medir o caminho
  renderMapa();
}

function renderMapa() {
  const lang = estado.idioma, temas = vocab.temas, slugs = slugsDosTemas();
  const estr = estrelasMapa(lang);
  const resumo = L.resumoIdioma(estr, slugs);

  $("mapa-bandeira").innerHTML = BANDEIRA[lang];
  $("mapa-nome").textContent = NOME_IDIOMA[lang];
  $("mapa-contagem").textContent = resumo.vencidas + " de " + resumo.fases + " fases, " + resumo.estrelas + " estrelas";

  const casa = $("mapa-inicio");
  limpar(casa);
  if (estado.perfil) casa.appendChild(el("img", { src: figSrc(estado.perfil.avatar), alt: "" }));
  else casa.innerHTML = ICONE.voltar;
  casa.setAttribute("aria-label", estado.perfil ? "Trocar de criança ou idioma" : "Voltar para a capa");

  const troca = limpar($("mapa-trocar"));
  IDIOMAS.forEach(function (l) {
    if (l === lang) return;
    troca.appendChild(el("button", { class: "btn-bandeira", type: "button", "aria-label": "Mudar para " + NOME_IDIOMA[l],
      html: BANDEIRA[l], onclick: function () { abrirMapa(l); } }));
  });

  const nRev = totalPendente(lang);
  $("btn-revisao-txt").textContent = nRev > 0 ? "Revisão (" + nRev + ")" : "Revisão";
  $("btn-revisao").classList.toggle("tem-pendencia", nRev > 0);
  $("btn-abc").hidden = !vocab.letras.some(function (x) { return x.idioma === lang; });

  const trilha = limpar($("trilha"));
  temas.forEach(function (t, i) {
    const n = estr[t.slug];
    const destravada = L.faseDestravada(estr, slugs, i);
    const noPlano = temaLiberado(t);
    const aberta = destravada && noPlano;
    const ehAtual = aberta && n < 2;
    const fase = el("div", { class: "fase " + (i % 2 === 0 ? "esq" : "dir") + " " + (!aberta ? "travada" : (ehAtual ? "atual" : "aberta")) });
    if (aberta) fase.appendChild(tresEstrelas(n));
    else fase.appendChild(el("span", { class: "estrelas cadeado", html: ICONE.cadeado }));
    const rotulo = t.nome + (aberta ? ", " + n + " de 3 estrelas" : (noPlano ? ", fase trancada" : ", fase do plano completo"));
    const bolha = el("button", { class: "bolha", type: "button", "aria-label": rotulo, "aria-disabled": aberta ? null : "true" },
      [t.icone ? el("img", { src: figSrc(t.icone), alt: "" }) : null]);
    bolha.addEventListener("click", function () {
      if (aberta) ir("fase", t.slug);
      else if (!noPlano) avisoPlano();
      else { bolha.classList.remove("nega"); void bolha.offsetWidth; bolha.classList.add("nega"); }
    });
    fase.appendChild(bolha);
    fase.appendChild(el("div", { class: "nome", text: t.nome }));
    trilha.appendChild(fase);
  });

  trilha.appendChild(el("div", { class: "trofeu-fase" + (resumo.trofeu ? "" : " travado") }, [
    el("div", { class: "trofeu-bolha", html: ICONE.trofeu }),
    el("div", { class: "nome", text: "Troféu do " + NOME_IDIOMA[lang] })
  ]));

  desenharCaminho();
}

// tracejado ligando uma fase à outra, de borda a borda (nunca por cima da figura)
function desenharCaminho() {
  const trilha = $("trilha");
  if (!trilha || $("tela-mapa").hidden) return;
  const base = trilha.getBoundingClientRect();
  const bolhas = trilha.querySelectorAll(".bolha, .trofeu-bolha");
  const velho = trilha.querySelector("svg.caminho");
  if (velho) velho.remove();
  if (bolhas.length < 2) return;
  const pts = [], raio = [];
  bolhas.forEach(function (b) {
    const r = b.getBoundingClientRect();
    pts.push([r.left - base.left + r.width / 2, r.top - base.top + r.height / 2]);
    raio.push(r.width / 2 + 6);
  });
  let d = "";
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
    d += " M " + (pts[i - 1][0] + ux * raio[i - 1]).toFixed(1) + " " + (pts[i - 1][1] + uy * raio[i - 1]).toFixed(1) +
         " L " + (pts[i][0] - ux * raio[i]).toFixed(1) + " " + (pts[i][1] - uy * raio[i]).toFixed(1);
  }
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "caminho");
  svg.setAttribute("width", trilha.offsetWidth);
  svg.setAttribute("height", trilha.offsetHeight);
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  trilha.insertBefore(svg, trilha.firstChild);
}
let timerRedesenho = null;
window.addEventListener("resize", function () { clearTimeout(timerRedesenho); timerRedesenho = setTimeout(desenharCaminho, 150); });

// ---------------- painel de progresso ----------------
function abrirProgresso(lang) {
  lang = lang || estado.idioma;
  const slugs = slugsDosTemas();
  const cards = limpar($("progresso-cards"));
  IDIOMAS.forEach(function (l) {
    const r = L.resumoIdioma(estrelasMapa(l), slugs);
    cards.appendChild(el("button", { class: "card-idioma" + (l === lang ? " sel" : ""), type: "button",
      "aria-pressed": l === lang ? "true" : "false", onclick: function () { abrirProgresso(l); } }, [
      el("span", { class: "ci-bandeira", html: BANDEIRA[l] }),
      el("span", { class: "ci-nome", text: NOME_IDIOMA[l] }),
      el("span", { class: "ci-num", text: r.vencidas + " de " + r.fases + " fases" }),
      el("span", { class: "ci-num", text: r.estrelas + " estrelas" }),
      el("span", { class: "ci-num", text: r.trofeu ? "Troféu conquistado" : "" })
    ]));
  });
  $("progresso-titulo").textContent = "Fases de " + NOME_IDIOMA[lang];
  const lista = limpar($("progresso-temas"));
  const estr = estrelasMapa(lang);
  vocab.temas.forEach(function (t) {
    const n = estr[t.slug];
    lista.appendChild(el("li", { class: "linha-tema" + (n >= 2 ? " venceu" : "") }, [
      t.icone ? el("img", { src: figSrc(t.icone), alt: "" }) : null,
      el("span", { class: "lt-nome", text: t.nome }),
      tresEstrelas(n)
    ]));
  });
  mostrarTela("progresso");
}

// ---------------- tela de aviso (troféu, revisão em dia, fim de revisão...) ----------------
// opcoes: { arte: html de SVG do app | null, figura: caminho de imagem | null, titulo, texto, botoes: [{rotulo, principal, acao}] }
function abrirAviso(o) {
  const arte = limpar($("aviso-arte"));
  if (o.figura) arte.appendChild(el("img", { src: o.figura, alt: "" }));
  else if (o.arte) arte.innerHTML = o.arte;
  $("aviso-titulo").textContent = o.titulo || "";
  $("aviso-texto").textContent = o.texto || "";
  $("aviso-texto").hidden = !o.texto;
  const botoes = limpar($("aviso-botoes"));
  (o.botoes || []).forEach(function (b) {
    botoes.appendChild(el("button", { class: "btn btn-grande" + (b.principal ? " btn-brincar" : ""), type: "button", text: b.rotulo, onclick: b.acao }));
  });
  mostrarTela("aviso");
  const primeiro = botoes.querySelector("button");
  if (primeiro) primeiro.focus();
}

function avisoPlano() {
  abrirAviso({
    arte: ICONE.cadeado, titulo: "Fase do plano completo",
    texto: "Chame um adulto para liberar esta fase.",
    botoes: [
      { rotulo: "Voltar ao mapa", principal: true, acao: function () { abrirMapa(); } },
      { rotulo: "Sou adulto", acao: function () { portaoDosPais().then(function (ok) { if (ok) ir("pais"); }); } }
    ]
  });
}

export function iniciarMapa() {
  window.addEventListener("pp:sincronizado", function () { if (!$("tela-mapa").hidden) renderMapa(); });
  registrarRota("inicio", abrirInicio);
  registrarRota("mapa", abrirMapa);
  registrarRota("progresso", abrirProgresso);
  registrarRota("aviso", abrirAviso);

  document.querySelectorAll("[data-idioma]").forEach(function (b) {
    b.addEventListener("click", function () { abrirMapa(b.getAttribute("data-idioma")); });
  });
  $("btn-pais").addEventListener("click", function () { portaoDosPais().then(function (ok) { if (ok) ir("pais"); }); });
  $("mapa-inicio").addEventListener("click", abrirInicio);
  $("btn-progresso").addEventListener("click", function () { abrirProgresso(); });
  $("btn-revisao").addEventListener("click", function () { ir("revisao"); });
  $("btn-abc").addEventListener("click", function () { ir("alfabeto"); });
  $("progresso-voltar").addEventListener("click", function () { abrirMapa(); });
}
