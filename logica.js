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

  // ---------------- modelo de fases ----------------

  // ordem das fases = ordem em que os temas aparecem no banco (por id).
  // "frases" fica fora da trilha principal (tem regra própria de desbloqueio).
  function ordemTemas(palavras) {
    const vistos = {};
    const ordem = [];
    palavras.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (w) {
      if (w.tema === "frases") return;
      if (!vistos[w.tema]) { vistos[w.tema] = true; ordem.push(w.tema); }
    });
    return ordem;
  }

  // estrelas de uma fase, a partir de quantas vezes foi jogada (rodadas)
  // e do acerto acumulado (ok de total) nas palavras daquela fase:
  //   3 = jogou 3+ vezes e acertou tudo (100%)
  //   2 = jogou 3+ vezes e está com 90%+  -> destrava a próxima fase
  //   1 = já jogou ao menos uma vez, mas ainda não cumpriu o critério
  //   0 = nunca terminou a fase
  function estrelasFase(rodadas, ok, total) {
    if (rodadas < 1) return 0;
    const acc = total > 0 ? ok / total : 0;
    if (rodadas >= 3 && acc >= 0.999) return 3;
    if (rodadas >= 3 && acc >= 0.90) return 2;
    return 1;
  }

  // a fase i está destravada se é a primeira ou se a anterior já tem >= 2 estrelas.
  // `estrelas` é o mapa tema -> estrelas (de UM idioma).
  function faseDestravada(estrelas, temas, i) {
    if (i <= 0) return true;
    return (estrelas[temas[i - 1]] || 0) >= 2;
  }

  // troféu do idioma: todas as fases com pelo menos 2 estrelas (todas "avançadas").
  function ganhouTrofeu(estrelas, temas) {
    return temas.length > 0 && temas.every(function (t) { return (estrelas[t] || 0) >= 2; });
  }

  const api = {
    normalizar: normalizar, distancia: distancia, pontuar: pontuar, dominou: dominou,
    ordemTemas: ordemTemas, estrelasFase: estrelasFase,
    faseDestravada: faseDestravada, ganhouTrofeu: ganhouTrofeu
  };

  // no Node (testes) vira módulo; no navegador (app) vira window.Logica
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Logica = api;

})(typeof window !== "undefined" ? window : globalThis);
