// ui.js — utilidades de tela: criar elementos, trocar de tela, ícones e diálogos.

export function $(id) { return document.getElementById(id); }

// cria um elemento. attrs: class, text, html (só para SVG fixo do próprio app), on*, data-*, etc.
export function el(tag, attrs, filhos) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
  return e;
}

export function limpar(no) { while (no.firstChild) no.removeChild(no.firstChild); return no; }

const TELAS = ["carregando", "erro", "inicio", "mapa", "jogo", "fim", "aviso", "progresso", "pais"];
let ouvinteDeTela = null;
export function aoTrocarDeTela(fn) { ouvinteDeTela = fn; }
export function mostrarTela(nome) {
  if (ouvinteDeTela) ouvinteDeTela(nome);
  TELAS.forEach(function (t) { $("tela-" + t).hidden = (t !== nome); });
  window.scrollTo(0, 0);
}

// ---------------- ícones e bandeiras (SVG do próprio app) ----------------
const traco = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
export const ICONE = {
  mic: '<svg viewBox="0 0 24 24" ' + traco + ' aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none"/><path d="M6 11a6 6 0 0 0 12 0"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  certo: '<svg viewBox="0 0 24 24" ' + traco + ' stroke-width="3" aria-hidden="true"><polyline points="5 13 10 18 19 7"/></svg>',
  voltar: '<svg viewBox="0 0 24 24" ' + traco + ' aria-hidden="true"><line x1="20" y1="12" x2="5" y2="12"/><polyline points="11 6 5 12 11 18"/></svg>',
  cadeado: '<svg viewBox="0 0 24 24" ' + traco + ' aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5" fill="currentColor" stroke="none"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  trofeu: '<svg viewBox="0 0 100 100" aria-hidden="true"><g filter="url(#wc)"><path d="M30 18h40v22c0 13-9 22-20 22s-20-9-20-22z" fill="#E9B93F"/><path d="M30 24H16c0 14 6 22 16 23M70 24h14c0 14-6 22-16 23" fill="none" stroke="#D99A4E" stroke-width="6" stroke-linecap="round"/><rect x="45" y="60" width="10" height="14" fill="#D99A4E"/><rect x="32" y="74" width="36" height="9" rx="3" fill="#B9772C"/></g><path d="M40 26v12" stroke="#F8E3A0" stroke-width="5" stroke-linecap="round" opacity=".8"/></svg>'
};

export const BANDEIRA = {
  en: '<svg viewBox="0 0 42 28" aria-hidden="true"><g filter="url(#wc)"><rect width="42" height="28" fill="#EFE7D2"/><rect width="42" height="4" fill="#C0483B"/><rect y="8" width="42" height="4" fill="#C0483B"/><rect y="16" width="42" height="4" fill="#C0483B"/><rect y="24" width="42" height="4" fill="#C0483B"/><rect width="20" height="16" fill="#3B5486"/><g fill="#EFE7D2"><circle cx="6" cy="5" r="1.3"/><circle cx="14" cy="5" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="6" cy="13" r="1.3"/><circle cx="14" cy="13" r="1.3"/></g></g></svg>',
  de: '<svg viewBox="0 0 42 28" aria-hidden="true"><g filter="url(#wc)"><rect width="42" height="9.3" fill="#3A3A3A"/><rect y="9.3" width="42" height="9.3" fill="#C0483B"/><rect y="18.6" width="42" height="9.4" fill="#E3B23C"/></g></svg>',
  it: '<svg viewBox="0 0 42 28" aria-hidden="true"><g filter="url(#wc)"><rect width="14" height="28" fill="#5E9E6A"/><rect x="14" width="14" height="28" fill="#EFE7D2"/><rect x="28" width="14" height="28" fill="#C0483B"/></g></svg>'
};

export function estrela(cheia) {
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><path class="' + (cheia ? "st-cheia" : "st-vazia") +
    '" d="M50 6 L62 38 L96 40 L69 61 L79 94 L50 74 L21 94 L31 61 L4 40 L38 38 Z"/></svg>';
}
export function tresEstrelas(n, classe) {
  return el("span", { class: "estrelas " + (classe || ""), role: "img", "aria-label": n + " de 3 estrelas",
    html: estrela(n >= 1) + estrela(n >= 2) + estrela(n >= 3) });
}

// ---------------- diálogos ----------------
// confirmação simples. devolve uma promessa com true/false.
export function confirmar(titulo, texto, rotuloSim, perigoso) {
  return new Promise(function (resolver) {
    const d = $("dialogo");
    limpar(d);
    function fechar(v) { d.close(); resolver(v); }
    d.appendChild(el("h2", { text: titulo }));
    if (texto) d.appendChild(el("p", { text: texto }));
    d.appendChild(el("div", { class: "linha-botoes" }, [
      el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { fechar(false); } }),
      el("button", { class: "btn " + (perigoso ? "btn-perigo" : "btn-principal"), type: "button", text: rotuloSim || "Confirmar", onclick: function () { fechar(true); } })
    ]));
    d.oncancel = function () { resolver(false); };
    d.showModal();
  });
}

// "portão dos pais": uma conta que criança pequena não resolve. Vale por 10 minutos.
let liberadoAte = 0;
export function portaoDosPais() {
  if (Date.now() < liberadoAte) return Promise.resolve(true);
  return new Promise(function (resolver) {
    const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    const d = $("dialogo");
    limpar(d);
    const campo = el("input", { type: "text", inputmode: "numeric", autocomplete: "off", class: "campo", id: "portao-resposta", "aria-describedby": "portao-erro" });
    const erro = el("p", { class: "erro-campo", id: "portao-erro", role: "alert" });
    const form = el("form", { method: "dialog", onsubmit: function (ev) {
      ev.preventDefault();
      if (parseInt(campo.value, 10) === a * b) { liberadoAte = Date.now() + 10 * 60000; d.close(); resolver(true); }
      else { erro.textContent = "Resposta errada. Tente de novo."; campo.value = ""; campo.focus(); }
    } }, [
      el("h2", { text: "Área dos pais" }),
      el("p", { text: "Para continuar, um adulto precisa responder:" }),
      el("label", { for: "portao-resposta", class: "rotulo", text: "Quanto é " + a + " × " + b + "?" }),
      campo, erro,
      el("div", { class: "linha-botoes" }, [
        el("button", { class: "btn", type: "button", text: "Voltar", onclick: function () { d.close(); resolver(false); } }),
        el("button", { class: "btn btn-principal", type: "submit", text: "Continuar" })
      ])
    ]);
    d.appendChild(form);
    d.oncancel = function () { resolver(false); };
    d.showModal();
    campo.focus();
  });
}

// aviso passageiro no rodapé (ex.: "Progresso salvo")
let timerAviso = null;
export function avisar(texto) {
  const a = $("torrada");
  a.textContent = texto;
  a.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(function () { a.hidden = true; }, 3500);
}
