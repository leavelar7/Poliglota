// ============================================================
//  logica.js — lógica "pura" do Pequeno Poliglota
//  (sem tela, sem banco) — usada pelo app E pelos testes.
//  Separar daqui o que é cálculo torna possível testar
//  automaticamente, sem abrir o navegador.
// ============================================================
(function (raiz) {

  // deixa o texto "comparável": minúsculo, sem acento,
  // sem pontuação, sem espaço sobrando.
  function normalizar(s) {
    return String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // tira acentos
      .replace(/[^a-z ]/g, "")         // só letras e espaço
      .trim()
      .replace(/\s+/g, " ");
  }

  // distância de Levenshtein: quantas edições (trocar, inserir,
  // apagar uma letra) separam duas palavras. Usa programação
  // dinâmica — preenche uma tabela reaproveitando sub-resultados.
  function distancia(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, function () { return new Array(n + 1).fill(0); });
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    }
    return d[m][n];
  }

  // dá uma nota de 0 a 1 de quão perto o que foi dito está do alvo.
  // recebe VÁRIAS alternativas (o reconhecimento devolve até 5) e
  // fica com a melhor. 1 = igual (ou contém); menos = mais longe.
  function pontuar(textos, alvoBruto) {
    const alvo = normalizar(alvoBruto);
    let s = 0;
    textos.forEach(function (t) {
      const dito = normalizar(t);
      let x;
      if (dito === alvo || dito.includes(alvo) || alvo.includes(dito)) x = 1;
      else {
        const m = Math.max(alvo.length, dito.length) || 1;
        x = 1 - distancia(alvo, dito) / m;
      }
      if (x > s) s = x;
    });
    return s;
  }

  // a criança "dominou" uma palavra num idioma quando acertou
  // pelo menos `limiar` (85%) das vezes, com no mínimo `min`
  // tentativas. `acertos` é o mapa "idioma|palavra" -> {ok,total}.
  function dominou(acertos, pt, lang, limiar, min) {
    if (limiar === undefined) limiar = 0.85;
    if (min === undefined) min = 3;
    const r = acertos[lang + "|" + pt];
    if (!r || r.total < min) return false;
    return (r.ok / r.total) >= limiar;
  }

  const api = { normalizar: normalizar, distancia: distancia, pontuar: pontuar, dominou: dominou };

  // no Node (testes) vira módulo; no navegador (app) vira window.Logica
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Logica = api;

})(typeof window !== "undefined" ? window : globalThis);
