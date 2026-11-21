// site.js — página de apresentação, privacidade e termos: cartão de demonstração e dados de contato.
import { CONTATO_EMAIL, RESPONSAVEL_NOME } from "./config.js";

// ---- contato e ano (vêm de config.js) ----
document.querySelectorAll("[data-ano]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
document.querySelectorAll("[data-contato]").forEach(function (e) {
  if (CONTATO_EMAIL) { const a = document.createElement("a"); a.href = "mailto:" + CONTATO_EMAIL; a.textContent = CONTATO_EMAIL; e.replaceChildren(a); e.classList.remove("pendente"); }
});
document.querySelectorAll("[data-contato-link]").forEach(function (a) {
  if (CONTATO_EMAIL) { a.href = "mailto:" + CONTATO_EMAIL; a.hidden = false; }
});
document.querySelectorAll("[data-responsavel]").forEach(function (e) {
  if (RESPONSAVEL_NOME) { e.textContent = RESPONSAVEL_NOME; e.classList.remove("pendente"); }
});

// ---- cartão de demonstração: palavras e áudios reais do app ----
const PALAVRAS = [
  { id: 44, fig: "gato", alt: "um gato", pt: "gato", en: "cat", de: "die Katze", it: "gatto" },
  { id: 93, fig: "flor", alt: "uma flor", pt: "flor", en: "flower", de: "die Blume", it: "fiore" },
  { id: 103, fig: "apple", alt: "uma maçã", pt: "maçã", en: "apple", de: "der Apfel", it: "mela" },
  { id: 344, fig: "borboleta", alt: "uma borboleta", pt: "borboleta", en: "butterfly", de: "der Schmetterling", it: "farfalla" }
];
const demo = document.getElementById("demo");
if (demo) {
  let qual = 0, lang = "en", som = null;
  const figura = document.getElementById("demo-figura"), palavra = document.getElementById("demo-palavra"),
        traducao = document.getElementById("demo-traducao"), botoes = demo.querySelectorAll("[data-demo]");

  function mostrar(tocar) {
    const w = PALAVRAS[qual];
    figura.src = "/img/" + w.fig + ".svg";
    figura.alt = "Ilustração em aquarela de " + w.alt;
    palavra.textContent = w[lang]; palavra.lang = lang;
    traducao.textContent = w.pt;
    botoes.forEach(function (b) {
      const ativo = b.getAttribute("data-demo") === lang;
      b.classList.toggle("ativo", ativo); b.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
    if (tocar) {
      if (som) som.pause();
      som = new Audio("/audio/" + w.id + "_" + lang + ".mp3");
      som.play().catch(function () {});
    }
  }
  botoes.forEach(function (b) { b.addEventListener("click", function () { lang = b.getAttribute("data-demo"); mostrar(true); }); });
  document.getElementById("demo-outra").addEventListener("click", function () { qual = (qual + 1) % PALAVRAS.length; mostrar(true); });
  figura.addEventListener("click", function () { mostrar(true); });
}
