// ============================================================
//  logica.test.js — testes automáticos da lógica pura.
//  Rodar com:  node --test
//  Usa só o que vem no Node (node:test + node:assert), sem instalar nada.
// ============================================================
const { test } = require("node:test");
const assert = require("node:assert");
const { normalizar, distancia, pontuar, dominou } = require("./logica.js");

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
