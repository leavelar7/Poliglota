// ============================================================
//  logica.test.js — testes automáticos da lógica pura.
//  Rodar com:  node --test
//  Usa só o que vem no Node (node:test + node:assert), sem instalar nada.
// ============================================================
const { test } = require("node:test");
const assert = require("node:assert");
const { normalizar, distancia, pontuar, dominou,
        ordemTemas, estrelasFase, progressoFase, faseDestravada, ganhouTrofeu,
        intervaloRevisao, agendarRevisao, revisaoVencida, temasJogados, revisaoPendente } = require("./logica.js");

const DIA = 86400000;

// ---------- normalizar ----------
test("normalizar tira acento, maiúscula e pontuação", function () {
  assert.strictEqual(normalizar("Água!"), "agua");
  assert.strictEqual(normalizar("CÃO"), "cao");
  assert.strictEqual(normalizar("  olá,   mundo  "), "ola mundo");
});

// ---------- distancia (Levenshtein) ----------
test("distancia é 0 para palavras iguais", function () {
  assert.strictEqual(distancia("gato", "gato"), 0);
});
test("distancia é 1 quando muda só uma letra", function () {
  assert.strictEqual(distancia("gato", "pato"), 1); // g -> p
  assert.strictEqual(distancia("sol", "sal"), 1);   // o -> a
});
test("distancia conta inserção e remoção", function () {
  assert.strictEqual(distancia("casa", "casaco"), 2); // + c + o
  assert.strictEqual(distancia("", "abc"), 3);        // três inserções
});

// ---------- pontuar (nota de 0 a 1) ----------
test("pontuar dá 1 quando a criança fala igual", function () {
  assert.strictEqual(pontuar(["water"], "water"), 1);
});
test("pontuar ignora acento e maiúscula", function () {
  assert.strictEqual(pontuar(["ÁGUA"], "água"), 1);
});
test("pontuar dá 1 quando o alvo está contido na fala", function () {
  assert.strictEqual(pontuar(["the water please"], "water"), 1);
});
test("pontuar escolhe a melhor entre várias alternativas", function () {
  // o reconhecimento devolve 3 tentativas; uma delas é certa
  assert.strictEqual(pontuar(["watah", "wotter", "water"], "water"), 1);
});
test("pontuar cai conforme a fala se afasta do alvo", function () {
  const quase = pontuar(["wster"], "water");  // 1 letra trocada em 5
  assert.ok(quase > 0.55, "um errinho ainda deve contar como acerto: " + quase);
  const longe = pontuar(["xyz"], "water");
  assert.ok(longe < 0.30, "palavra totalmente diferente deve reprovar: " + longe);
});

// ---------- dominou (regra dos 85%) ----------
test("não domina sem tentativas suficientes", function () {
  assert.strictEqual(dominou({ "en|agua": { ok: 2, total: 2 } }, "agua", "en"), false);
});
test("não domina abaixo de 85%", function () {
  assert.strictEqual(dominou({ "en|agua": { ok: 8, total: 10 } }, "agua", "en"), false);
});
test("domina em 85% ou mais", function () {
  assert.strictEqual(dominou({ "en|agua": { ok: 9, total: 10 } }, "agua", "en"), true);
  assert.strictEqual(dominou({ "en|agua": { ok: 85, total: 100 } }, "agua", "en"), true);
});
test("dominar num idioma não vale para outro", function () {
  const mapa = { "en|agua": { ok: 9, total: 10 } };
  assert.strictEqual(dominou(mapa, "agua", "en"), true);
  assert.strictEqual(dominou(mapa, "agua", "de"), false); // nunca praticou em alemão
});
test("palavra desconhecida não está dominada", function () {
  assert.strictEqual(dominou({}, "qualquer", "en"), false);
});

// ---------- fases: ordem dos temas ----------
test("ordemTemas segue a ordem de id e remove duplicados", function () {
  const palavras = [
    { id: 3, tema: "animais" }, { id: 1, tema: "corpo" },
    { id: 2, tema: "corpo" },   { id: 4, tema: "animais" },
    { id: 5, tema: "cores" },
  ];
  assert.deepStrictEqual(ordemTemas(palavras), ["corpo", "animais", "cores"]);
});
test("ordemTemas deixa 'frases' fora da trilha", function () {
  const palavras = [{ id: 1, tema: "animais" }, { id: 2, tema: "frases" }];
  assert.deepStrictEqual(ordemTemas(palavras), ["animais"]);
});

// ---------- fases: estrelas (rodadas + melhor rodada) ----------
test("sem terminar nenhuma rodada: 0 estrelas", function () {
  assert.strictEqual(estrelasFase(0, 0), 0);
});
test("jogou mas ainda não cumpriu o critério: 1 estrela", function () {
  assert.strictEqual(estrelasFase(1, 1), 1);     // rodada perfeita mas só 1 rodada
  assert.strictEqual(estrelasFase(2, 1), 1);     // perfeita mas só 2 rodadas
  assert.strictEqual(estrelasFase(3, 0.83), 1);  // 3 rodadas mas melhor rodada 83% (<90%)
});
test("3+ rodadas e melhor rodada 90%+: 2 estrelas (destrava a próxima)", function () {
  assert.strictEqual(estrelasFase(3, 0.90), 2);
  assert.strictEqual(estrelasFase(5, 0.94), 2);
});
test("3+ rodadas e uma rodada perfeita (100%): 3 estrelas", function () {
  assert.strictEqual(estrelasFase(3, 1), 3);
});
test("um erro antigo NÃO trava a 3ª estrela se houve rodada perfeita depois", function () {
  // melhor rodada = 1 (perfeita), mesmo que rodadas anteriores tenham tido erro
  assert.strictEqual(estrelasFase(7, 1), 3);
});

// ---------- fases: barra de progresso ----------
test("progressoFase é 0 no começo e 1 ao passar (3 rodadas + melhor rodada 90%)", function () {
  assert.strictEqual(progressoFase(0, 0), 0);
  assert.strictEqual(progressoFase(3, 0.90), 1); // exatamente no critério
});
test("progressoFase enche bem depois de 1 rodada com 90%", function () {
  const v = progressoFase(1, 0.90); // metade acerto cheia + 1/3 das rodadas
  assert.ok(v > 0.6 && v < 0.7, "esperado ~0.667, veio " + v);
});
test("progressoFase não chega a 1 se o acerto está baixo", function () {
  const v = progressoFase(3, 0.70); // 3 rodadas mas melhor rodada 70%
  assert.ok(v < 1, "não deve completar com acerto baixo: " + v);
});

// ---------- fases: desbloqueio (precisa de 2 estrelas) ----------
test("a primeira fase está sempre destravada", function () {
  assert.strictEqual(faseDestravada({}, ["corpo", "animais"], 0), true);
});
test("fase destrava só quando a anterior tem 2 estrelas", function () {
  const temas = ["corpo", "animais", "cores"];
  assert.strictEqual(faseDestravada({ corpo: 1 }, temas, 1), false);  // 1 estrela não basta
  assert.strictEqual(faseDestravada({ corpo: 2 }, temas, 1), true);   // 2 estrelas -> animais abre
  assert.strictEqual(faseDestravada({ corpo: 2 }, temas, 2), false);  // animais ainda não -> cores travada
});

// ---------- fases: troféu (todas com 2+ estrelas) ----------
test("troféu só quando todas as fases têm pelo menos 2 estrelas", function () {
  const temas = ["corpo", "animais"];
  assert.strictEqual(ganhouTrofeu({ corpo: 3, animais: 2 }, temas), true);
  assert.strictEqual(ganhouTrofeu({ corpo: 3, animais: 1 }, temas), false);
  assert.strictEqual(ganhouTrofeu({}, []), false);
});

// ---------- revisão espaçada (Leitner) ----------
test("intervaloRevisao cresce com a caixa e satura em 1..5", function () {
  assert.strictEqual(intervaloRevisao(1), 1);
  assert.strictEqual(intervaloRevisao(3), 7);
  assert.strictEqual(intervaloRevisao(5), 35);
  assert.strictEqual(intervaloRevisao(9), 35); // acima de 5 trava em 5
  assert.strictEqual(intervaloRevisao(0), 1);  // abaixo de 1 trava em 1
});
test("agendarRevisao sobe de caixa ao acertar e marca a próxima data", function () {
  const agora = 1000;
  const r = agendarRevisao({ caixa: 2 }, true, agora);
  assert.strictEqual(r.caixa, 3);
  assert.strictEqual(r.prox, agora + 7 * DIA);
});
test("agendarRevisao começa na caixa 1 quando é a primeira vez e acerta", function () {
  const r = agendarRevisao(undefined, true, 0);
  assert.strictEqual(r.caixa, 2);          // 1 -> 2
  assert.strictEqual(r.prox, 3 * DIA);
});
test("agendarRevisao volta pra caixa 1 ao errar", function () {
  const r = agendarRevisao({ caixa: 5 }, false, 0);
  assert.strictEqual(r.caixa, 1);
  assert.strictEqual(r.prox, 1 * DIA);
});
test("agendarRevisao não passa da caixa 5", function () {
  const r = agendarRevisao({ caixa: 5 }, true, 0);
  assert.strictEqual(r.caixa, 5);
});
test("revisaoVencida: sem estado está vencida; com data futura não", function () {
  assert.strictEqual(revisaoVencida(undefined, 1000), true);
  assert.strictEqual(revisaoVencida({ caixa: 1, prox: 500 }, 1000), true);   // passou
  assert.strictEqual(revisaoVencida({ caixa: 1, prox: 1500 }, 1000), false); // ainda não
});
test("temasJogados devolve só temas com rodadas >= 1", function () {
  const prog = { corpo: { rodadas: 2 }, cores: { rodadas: 0 }, comida: { rodadas: 1 } };
  assert.deepStrictEqual(temasJogados(prog).sort(), ["comida", "corpo"]);
  assert.deepStrictEqual(temasJogados(undefined), []);
});
test("revisaoPendente: só palavras de fases jogadas e vencidas, mais antigas primeiro", function () {
  const palavras = [
    { pt: "mao", tema: "corpo" },
    { pt: "pe", tema: "corpo" },
    { pt: "gato", tema: "animais" },   // tema não jogado -> fora
    { pt: "oi", tema: "frases" },       // frases nunca entra
  ];
  const progresso = { corpo: { rodadas: 1 } };   // só 'corpo' foi jogado
  const agora = 10000;
  const revisao = {
    mao: { caixa: 1, prox: 5000 },   // vencida (passou)
    pe:  { caixa: 2, prox: 50000 },  // ainda não vence
  };
  const pend = revisaoPendente(palavras, progresso, revisao, agora);
  assert.deepStrictEqual(pend.map(function (w) { return w.pt; }), ["mao"]);
});
test("revisaoPendente: palavra nunca revisada de fase jogada já está pendente", function () {
  const palavras = [{ pt: "mao", tema: "corpo" }];
  const pend = revisaoPendente(palavras, { corpo: { rodadas: 1 } }, {}, 0);
  assert.deepStrictEqual(pend.map(function (w) { return w.pt; }), ["mao"]);
});
