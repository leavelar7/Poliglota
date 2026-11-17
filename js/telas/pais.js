// telas/pais.js — área dos pais: conta, crianças, evolução, preferências e dados (LGPD).
import { COBRANCA_ATIVA, AVATARES, MAX_PERFIS, IDIOMAS, NOME_IDIOMA, VERSAO } from "../config.js";
import { estado, ir, registrarRota, lerPref, salvarPref } from "../estado.js";
import { vocab, slugsDosTemas, figSrc } from "../dados.js";
import * as guarda from "../guarda.js";
import * as conta from "../conta.js";
import { temReconhecimento } from "../fala.js";
import { $, el, limpar, mostrarTela, confirmar, avisar } from "../ui.js";

const L = window.Logica;
let aba = "entrar";            // "entrar" | "criar"
let aguardandoEmail = "";      // e-mail que precisa ser confirmado
let perfilRelatorio = null;    // id da criança cujo relatório está aberto
let editando = null;           // id do perfil em edição, "novo" ou null

function secao(titulo, filhos, classe) {
  return el("section", { class: "bloco " + (classe || "") }, [el("h2", { text: titulo })].concat(filhos));
}

function campo(id, rotulo, attrs) {
  const input = el("input", Object.assign({ id: id, class: "campo" }, attrs));
  return { no: el("div", { class: "grupo" }, [el("label", { for: id, class: "rotulo", text: rotulo }), input]), input: input };
}

// roda uma ação assíncrona de botão: trava o botão, mostra erro legível
async function executar(botao, erroEl, fn) {
  if (erroEl) erroEl.textContent = "";
  const texto = botao.textContent;
  botao.disabled = true; botao.textContent = "Aguarde…";
  try { await fn(); }
  catch (e) { if (erroEl) erroEl.textContent = conta.mensagemDeErro(e); else avisar(conta.mensagemDeErro(e)); }
  finally { botao.disabled = false; botao.textContent = texto; }
}

function abrir() {
  render();
  mostrarTela("pais");
}

function render() {
  const raiz = limpar($("pais-conteudo"));
  if (estado.recuperandoSenha) { raiz.appendChild(blocoNovaSenha()); return; }
  if (!estado.sessao) {
    raiz.appendChild(aguardandoEmail ? blocoConfirmeEmail() : blocoEntrar());
    raiz.appendChild(blocoPreferencias());
    raiz.appendChild(blocoRodape());
    return;
  }
  raiz.appendChild(blocoCriancas());
  if (estado.perfis.length) raiz.appendChild(blocoEvolucao());
  raiz.appendChild(blocoPreferencias());
  raiz.appendChild(blocoPlano());
  raiz.appendChild(blocoConta());
  raiz.appendChild(blocoRodape());
}

// ---------------- sem conta ----------------
function blocoEntrar() {
  const criando = aba === "criar";
  const email = campo("conta-email", "E-mail", { type: "email", autocomplete: "email", required: true });
  const senha = campo("conta-senha", criando ? "Crie uma senha (8 ou mais caracteres)" : "Senha",
    { type: "password", autocomplete: criando ? "new-password" : "current-password", required: true, minlength: criando ? 8 : null });
  const erro = el("p", { class: "erro-campo", role: "alert" });
  const enviar = el("button", { class: "btn btn-principal btn-largo", type: "submit", text: criando ? "Criar conta" : "Entrar" });

  const aceite = el("input", { type: "checkbox", id: "conta-aceite", required: true });
  const linhaAceite = el("label", { class: "aceite", for: "conta-aceite" }, [aceite, el("span", {}, [
    "Sou o responsável legal pela criança e aceito os ",
    el("a", { href: "/termos", target: "_blank", rel: "noopener", text: "termos de uso" }), " e a ",
    el("a", { href: "/privacidade", target: "_blank", rel: "noopener", text: "política de privacidade" }), "."
  ])]);

  const form = el("form", { class: "form", onsubmit: function (ev) {
    ev.preventDefault();
    executar(enviar, erro, async function () {
      if (criando) {
        const r = await conta.criarConta(email.input.value.trim(), senha.input.value);
        if (r === "confirmar") { aguardandoEmail = email.input.value.trim(); render(); }
      } else {
        await conta.entrar(email.input.value.trim(), senha.input.value);
      }
    });
  } }, [email.no, senha.no, criando ? linhaAceite : null, erro, enviar]);

  const esqueci = el("button", { class: "link", type: "button", text: "Esqueci minha senha", onclick: function () {
    const e = email.input.value.trim();
    if (!e) { erro.textContent = "Digite seu e-mail acima e toque de novo em “Esqueci minha senha”."; email.input.focus(); return; }
    executar(esqueci, erro, async function () { await conta.pedirNovaSenha(e); avisar("Enviamos um link para " + e); });
  } });

  function botaoAba(nome, texto) {
    return el("button", { class: "aba" + (aba === nome ? " ativa" : ""), type: "button", role: "tab", "aria-selected": aba === nome ? "true" : "false",
      text: texto, onclick: function () { aba = nome; render(); } });
  }

  return secao("Conta da família", [
    el("p", { text: "Hoje o progresso fica guardado só neste aparelho. Com uma conta gratuita ele vai para a nuvem, e você pode:" }),
    el("ul", { class: "lista" }, [
      el("li", { text: "continuar de onde parou em outro celular ou tablet" }),
      el("li", { text: "ter um perfil para cada criança, até " + MAX_PERFIS }),
      el("li", { text: "ver em quais palavras cada uma tem mais dificuldade" })
    ]),
    el("div", { class: "abas", role: "tablist" }, [botaoAba("entrar", "Entrar"), botaoAba("criar", "Criar conta")]),
    form,
    criando ? null : esqueci
  ]);
}

function blocoConfirmeEmail() {
  return secao("Confirme seu e-mail", [
    el("p", { text: "Enviamos um link para " + aguardandoEmail + ". Abra o e-mail e toque no link para ativar a conta. Depois é só voltar aqui e entrar." }),
    el("button", { class: "btn", type: "button", text: "Já confirmei, quero entrar", onclick: function () { aguardandoEmail = ""; aba = "entrar"; render(); } })
  ]);
}

function blocoNovaSenha() {
  const senha = campo("nova-senha", "Nova senha (8 ou mais caracteres)", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
  const erro = el("p", { class: "erro-campo", role: "alert" });
  const enviar = el("button", { class: "btn btn-principal btn-largo", type: "submit", text: "Salvar nova senha" });
  return secao("Escolha uma nova senha", [el("form", { class: "form", novalidate: true, onsubmit: function (ev) {
    ev.preventDefault();
    if (senha.input.value.length < 8) { erro.textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
    executar(enviar, erro, async function () { await conta.definirSenha(senha.input.value); avisar("Senha alterada"); render(); });
  } }, [senha.no, erro, enviar])]);
}

// ---------------- crianças ----------------
function blocoCriancas() {
  const lista = el("ul", { class: "criancas" });
  estado.perfis.forEach(function (p) {
    if (editando === p.id) { lista.appendChild(el("li", {}, [formPerfil(p)])); return; }
    lista.appendChild(el("li", { class: "crianca" }, [
      el("img", { src: figSrc(p.avatar), alt: "" }),
      el("span", { class: "crianca-nome", text: p.nome }),
      el("button", { class: "btn btn-pequeno", type: "button", text: "Editar", "aria-label": "Editar " + p.nome, onclick: function () { editando = p.id; render(); } })
    ]));
  });
  const filhos = [];
  if (!estado.perfis.length) filhos.push(el("p", { text: "Crie o perfil de quem vai brincar. O progresso já feito neste aparelho vai junto para o primeiro perfil." }));
  filhos.push(lista);
  if (editando === "novo" || !estado.perfis.length) filhos.push(formPerfil(null));
  else if (estado.perfis.length < MAX_PERFIS) {
    filhos.push(el("button", { class: "btn", type: "button", text: "Adicionar criança", onclick: function () { editando = "novo"; render(); } }));
  }
  return secao("Crianças", filhos);
}

function formPerfil(perfil) {
  let avatar = perfil ? perfil.avatar : AVATARES[estado.perfis.length % AVATARES.length];
  const idNome = "perfil-nome-" + (perfil ? perfil.id : "novo");
  const nome = campo(idNome, "Nome ou apelido", { type: "text", maxlength: 24, required: true, autocomplete: "off", value: perfil ? perfil.nome : "" });
  const erro = el("p", { class: "erro-campo", role: "alert" });
  const grade = el("div", { class: "avatares", role: "radiogroup", "aria-label": "Escolha um bicho" });
  AVATARES.forEach(function (a) {
    const b = el("button", { class: "avatar-opcao" + (a === avatar ? " escolhido" : ""), type: "button", role: "radio",
      "aria-checked": a === avatar ? "true" : "false", "aria-label": a }, [el("img", { src: figSrc(a), alt: "" })]);
    b.addEventListener("click", function () {
      avatar = a;
      grade.querySelectorAll(".avatar-opcao").forEach(function (x) { x.classList.remove("escolhido"); x.setAttribute("aria-checked", "false"); });
      b.classList.add("escolhido"); b.setAttribute("aria-checked", "true");
    });
    grade.appendChild(b);
  });
  const salvar = el("button", { class: "btn btn-principal", type: "submit", text: perfil ? "Salvar" : "Criar perfil" });
  const botoes = [salvar];
  if (perfil || estado.perfis.length) botoes.unshift(el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { editando = null; render(); } }));
  if (perfil) {
    botoes.unshift(el("button", { class: "btn btn-perigo-suave", type: "button", text: "Apagar perfil", onclick: async function (ev) {
      const sim = await confirmar("Apagar o perfil de " + perfil.nome + "?", "Todo o progresso desta criança será apagado e não dá para desfazer.", "Apagar perfil", true);
      if (!sim) return;
      executar(ev.target, erro, async function () { await conta.apagarPerfil(perfil.id); editando = null; avisar("Perfil apagado"); render(); });
    } }));
  }
  return el("form", { class: "form form-perfil", onsubmit: function (ev) {
    ev.preventDefault();
    const n = nome.input.value.trim();
    if (!n) { erro.textContent = "Digite um nome ou apelido."; nome.input.focus(); return; }
    executar(salvar, erro, async function () {
      if (perfil) { await conta.editarPerfil(perfil.id, n, avatar); avisar("Perfil salvo"); }
      else {
        const r = await conta.criarPerfil(n, avatar);
        avisar(r.herdou ? "Perfil criado. O progresso deste aparelho agora é de " + n + "." : "Perfil criado");
      }
      editando = null; render();
    });
  } }, [nome.no, grade, erro, el("div", { class: "linha-botoes" }, botoes)]);
}

// ---------------- evolução ----------------
function estrelasDe(dados, lang) {
  const prog = dados.progresso[lang] || {}, m = {};
  slugsDosTemas().forEach(function (t) { const f = prog[t] || {}; m[t] = L.estrelasFase(f.rodadas || 0, f.melhorAcc || 0); });
  return m;
}

function blocoEvolucao() {
  if (!estado.perfis.some(function (p) { return p.id === perfilRelatorio; })) {
    perfilRelatorio = (estado.perfil || estado.perfis[0]).id;
  }
  const perfil = estado.perfis.find(function (p) { return p.id === perfilRelatorio; });
  const dados = guarda.dadosDoPerfil(perfil.id);
  const slugs = slugsDosTemas(), agora = Date.now();

  const seletor = estado.perfis.length > 1 ? el("div", { class: "abas", role: "tablist" }, estado.perfis.map(function (p) {
    return el("button", { class: "aba" + (p.id === perfil.id ? " ativa" : ""), type: "button", role: "tab",
      "aria-selected": p.id === perfil.id ? "true" : "false", text: p.nome, onclick: function () { perfilRelatorio = p.id; render(); } });
  })) : null;

  const tabela = el("table", { class: "tabela" }, [
    el("thead", {}, [el("tr", {}, [
      el("th", { scope: "col", text: "Idioma" }), el("th", { scope: "col", text: "Fases" }),
      el("th", { scope: "col", text: "Estrelas" }), el("th", { scope: "col", text: "A revisar" })
    ])]),
    el("tbody", {}, IDIOMAS.map(function (l) {
      const r = L.resumoIdioma(estrelasDe(dados, l), slugs);
      const pend = L.revisaoPendente(vocab.palavras, dados.progresso[l] || {}, dados.revisao[l] || {}, agora).length;
      return el("tr", {}, [
        el("th", { scope: "row", text: NOME_IDIOMA[l] }), el("td", { text: r.vencidas + " de " + r.fases }),
        el("td", { text: String(r.estrelas) }), el("td", { text: String(pend) })
      ]);
    }))
  ]);

  const dificeis = el("div", { class: "dificeis" }, [el("p", { class: "nota", text: "Buscando as palavras mais difíceis…" })]);
  const idPedido = perfil.id;
  conta.tentativasDoPerfil(perfil.id).then(function (ts) {
    if (perfilRelatorio !== idPedido || !dificeis.isConnected) return;
    limpar(dificeis);
    const lista = L.palavrasDificeis(ts, 6, 3);
    if (!ts.length) { dificeis.appendChild(el("p", { class: "nota", text: "As palavras mais difíceis aparecem aqui depois de algumas rodadas com o microfone." })); return; }
    if (!lista.length) { dificeis.appendChild(el("p", { class: "nota", text: "Nenhuma palavra está dando trabalho no momento." })); return; }
    dificeis.appendChild(el("h3", { text: "Palavras que mais dão trabalho" }));
    dificeis.appendChild(el("ul", { class: "lista" }, lista.map(function (d) {
      const w = vocab.palavras.find(function (x) { return x.pt === d.palavra; });
      const estrangeira = w ? w[d.idioma] + " (" + d.palavra + ")" : d.palavra;
      return el("li", { text: estrangeira + ", " + NOME_IDIOMA[d.idioma] + ": acertou " + d.ok + " de " + d.total + " tentativas" });
    })));
  }).catch(function () {
    if (dificeis.isConnected) { limpar(dificeis); dificeis.appendChild(el("p", { class: "nota", text: "Sem internet: as palavras mais difíceis não puderam ser carregadas." })); }
  });

  return secao("Evolução de " + perfil.nome, [seletor, el("div", { class: "rolagem" }, [tabela]), dificeis]);
}

// ---------------- preferências, plano, conta ----------------
function blocoPreferencias() {
  const caixa = el("input", { type: "checkbox", id: "pref-semmic", checked: estado.semMic ? true : null });
  caixa.addEventListener("change", function () { estado.semMic = caixa.checked; salvarPref("semMic", caixa.checked); });
  const filhos = [];
  if (temReconhecimento) {
    filhos.push(el("label", { class: "aceite", for: "pref-semmic" }, [caixa, el("span", {}, [
      el("strong", { text: "Jogar sem microfone. " }),
      "A criança ouve, repete e toca no botão para seguir. Útil em lugares barulhentos."
    ])]));
    filhos.push(el("p", { class: "nota", text: "Com o microfone ligado, o reconhecimento de fala é feito pelo próprio navegador, que pode enviar o áudio ao fabricante (Google, no Chrome) para transcrever. O Pequeno Poliglota não grava nem guarda a voz da criança." }));
  } else {
    filhos.push(el("p", { text: "Este aparelho não tem reconhecimento de fala no navegador. O app funciona no modo ouvir e repetir: a criança ouve, repete em voz alta e toca no botão para seguir." }));
  }
  return secao("Preferências", filhos);
}

function blocoPlano() {
  const texto = !COBRANCA_ATIVA
    ? "Durante o lançamento, todas as fases estão liberadas gratuitamente."
    : (estado.plano === "premium" ? "Plano completo: todas as fases liberadas." : "Plano gratuito: as primeiras fases de cada idioma estão liberadas.");
  return secao("Plano", [el("p", { text: texto })]);
}

function blocoConta() {
  const erro = el("p", { class: "erro-campo", role: "alert" });
  const exportar = el("button", { class: "btn", type: "button", text: "Baixar meus dados", onclick: function () {
    executar(exportar, erro, async function () {
      const dados = await conta.exportarDados();
      const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }));
      const a = el("a", { href: url, download: "pequeno-poliglota-meus-dados.json" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  } });
  const sair = el("button", { class: "btn", type: "button", text: "Sair da conta", onclick: function () {
    executar(sair, erro, async function () { await conta.sair(); });
  } });
  const excluir = el("button", { class: "btn btn-perigo-suave", type: "button", text: "Excluir conta", onclick: async function () {
    const sim = await confirmar("Excluir a conta?", "A conta, os perfis das crianças e todo o progresso serão apagados de forma definitiva.", "Excluir conta", true);
    if (!sim) return;
    executar(excluir, erro, async function () { await conta.excluirConta(); avisar("Conta excluída"); });
  } });
  return secao("Conta", [
    el("p", { text: "Você entrou como " + estado.sessao.user.email + "." }),
    erro,
    el("div", { class: "linha-botoes esquerda" }, [exportar, sair, excluir])
  ]);
}

function blocoRodape() {
  return el("nav", { class: "rodape-pais", "aria-label": "Sobre o app" }, [
    el("a", { href: "/privacidade", target: "_blank", rel: "noopener", text: "Privacidade" }),
    el("a", { href: "/termos", target: "_blank", rel: "noopener", text: "Termos de uso" }),
    el("a", { href: "/?site", text: "Sobre o app" }),
    el("span", { text: "Versão " + VERSAO })
  ]);
}

export function iniciarPais() {
  estado.semMic = lerPref("semMic", false);
  registrarRota("pais", abrir);
  registrarRota("pais-atualizar", function () { if (!$("tela-pais").hidden) render(); });
  $("pais-voltar").addEventListener("click", function () { editando = null; ir("inicio"); });
}
