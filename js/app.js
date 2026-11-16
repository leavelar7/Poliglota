// app.js — ponto de entrada: carrega o vocabulário e a conta, liga as telas.
import { estado, ir, lerPref } from "./estado.js";
import { carregarVocabulario } from "./dados.js";
import { iniciarConta } from "./conta.js";
import { $, mostrarTela, aoTrocarDeTela, avisar } from "./ui.js";
import { iniciarMapa } from "./telas/mapa.js";
import { iniciarJogo } from "./telas/jogo.js";
import { iniciarPais } from "./telas/pais.js";

// ---- botão "voltar" do aparelho: desce um nível em vez de fechar o app ----
const NIVEL = { carregando: 0, erro: 0, inicio: 0, mapa: 1, jogo: 2, fim: 2, aviso: 2, progresso: 2, pais: 1 };
let telaAtual = "carregando";
aoTrocarDeTela(function (nome) {
  if (NIVEL[nome] > NIVEL[telaAtual]) history.pushState({ pp: nome }, "");
  telaAtual = nome;
});
window.addEventListener("popstate", function () {
  if (telaAtual === "jogo") ir("sair-do-jogo");
  else if (NIVEL[telaAtual] === 2) ir("mapa");
  else if (NIVEL[telaAtual] === 1) ir("inicio");
});

function aoMudarConta(evento) {
  if (evento === "recuperar") { ir("pais"); return; }
  if (evento === "entrou") avisar("Você entrou na conta");
  if (evento === "saiu") avisar("Você saiu da conta");
  if (telaAtual === "pais") ir("pais-atualizar");
  else if (evento === "entrou" && !estado.perfis.length) ir("pais");
  else if (telaAtual !== "jogo") ir("inicio");
}

let contaIniciada = false;
async function carregar() {
  mostrarTela("carregando");
  try { await carregarVocabulario(); }
  catch (e) { mostrarTela("erro"); return; }

  if (!contaIniciada) {
    contaIniciada = true;
    try { await iniciarConta(aoMudarConta); } catch (e) { console.warn("conta indisponível:", e); }
  }

  if (estado.recuperandoSenha || (estado.sessao && !estado.perfis.length)) { ir("pais"); return; }
  // quem já escolheu um idioma cai direto no mapa (menos toques para a criança)
  const ultimo = lerPref("idioma", null);
  if (ultimo && estado.perfis.length < 2) ir("mapa", ultimo);
  else ir("inicio");
}

iniciarMapa();
iniciarJogo();
iniciarPais();
$("btn-tentar").addEventListener("click", carregar);
carregar();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function (e) { console.warn("service worker:", e); });
  });
}
