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
  // palavras que o reconhecimento de voz escreve de outro jeito porque SOAM
  // iguais (ex.: a criança diz "eye" e o Chrome escreve "I"). Sem isso a
  // palavra nunca conta como certa e a fase pode não passar dos 90%.
  const SOA_IGUAL = {
    eye: ["i", "aye", "ai", "eye"], ear: ["here", "hear", "year"], hair: ["here", "hear", "hare", "air"],
    knee: ["need", "nee", "neat"], two: ["to", "too"], one: ["won", "wan"], four: ["for", "fore"],
    eight: ["ate"], sea: ["see", "c"], bee: ["be", "b"], tea: ["tee", "t"], sew: ["so", "sow"],
    row: ["roe", "rho"], bye: ["by", "buy", "bi"], new: ["knew", "nu"], pear: ["pair", "pare"],
    ice: ["eyes"], owl: ["al", "owls"], son: ["sun"], flower: ["flour"], night: ["knight"]
  };

  function soaIgual(alvo, dito) {
    // o alvo pode trazer artigo ("das Ohr"): olha a última palavra
    const ultima = alvo.split(" ").pop();
    const lista = SOA_IGUAL[alvo] || SOA_IGUAL[ultima];
    return !!lista && lista.indexOf(dito) !== -1;
  }

  function pontuar(textos, alvoBruto) {
    const alvo = normalizar(alvoBruto);
    let s = 0;
    textos.forEach(function (t) {
      const dito = normalizar(t);
      let x;
      if (dito === alvo || dito.includes(alvo) || alvo.includes(dito) || soaIgual(alvo, dito)) x = 1;
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
  // e do MELHOR acerto de uma rodada (acc, de 0 a 1) — não do acumulado,
  // pra um erro antigo não travar a estrela pra sempre:
  //   3 = jogou 3+ vezes e teve uma rodada perfeita (100%)
  //   2 = jogou 3+ vezes e a melhor rodada chegou a 90%+  -> destrava a próxima
  //   1 = já jogou ao menos uma vez, mas ainda não cumpriu o critério
  //   0 = nunca terminou a fase
  function estrelasFase(rodadas, acc) {
    if (rodadas < 1) return 0;
    if (rodadas >= 3 && acc >= 0.999) return 3;
    if (rodadas >= 3 && acc >= 0.90) return 2;
    return 1;
  }

  // quão perto de PASSAR a fase (0 a 1). passar = 3 rodadas E 90% de acerto.
  // junta as duas metades: metade "rodadas" + metade "acerto". chega a 1
  // exatamente quando as duas condições são cumpridas.
  function progressoFase(rodadas, acc) {
    const parteRodadas = Math.min(rodadas, 3) / 3;
    const parteAcc = Math.min(acc / 0.90, 1);
    return 0.5 * parteRodadas + 0.5 * parteAcc;
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

  // ---------------- revisão espaçada (método Leitner) ----------------
  // cada palavra vive numa "caixa" (1 a 5). quanto maior a caixa, mais
  // tempo até rever de novo. acertou -> sobe de caixa; errou -> volta pra 1.
  const DIA_MS = 86400000;
  const INTERVALOS = [1, 3, 7, 16, 35]; // dias de espera da caixa 1..5

  // dias de espera de uma caixa (1..5).
  function intervaloRevisao(caixa) {
    const c = Math.max(1, Math.min(5, caixa));
    return INTERVALOS[c - 1];
  }

  // novo estado {caixa, prox} de uma palavra depois de uma revisão.
  // `atual` pode ser indefinido (primeira vez). `agora` em ms.
  function agendarRevisao(atual, acertou, agora) {
    const caixaAnterior = (atual && atual.caixa) || 1;
    const caixa = acertou ? Math.min(caixaAnterior + 1, 5) : 1;
    return { caixa: caixa, prox: agora + intervaloRevisao(caixa) * DIA_MS };
  }

  // uma palavra está "vencida" (pra rever) se nunca foi revisada
  // ou se já passou da data marcada.
  function revisaoVencida(estado, agora) {
    if (!estado || !estado.prox) return true;
    return estado.prox <= agora;
  }

  // temas que a criança já jogou ao menos uma vez (rodadas >= 1), num idioma.
  // `progressoLang` é o mapa tema -> {rodadas, melhorAcc} de UM idioma.
  function temasJogados(progressoLang) {
    const out = [];
    if (!progressoLang) return out;
    for (const t in progressoLang) {
      if ((progressoLang[t] && progressoLang[t].rodadas) >= 1) out.push(t);
    }
    return out;
  }

  // palavras pendentes de revisão: das fases já jogadas, as que estão vencidas.
  // `palavras` = todas as palavras; `progressoLang` = progresso do idioma;
  // `revisaoLang` = mapa pt -> {caixa, prox} do idioma; `agora` em ms.
  // devolve os objetos-palavra, ordenados pela data mais antiga primeiro.
  function revisaoPendente(palavras, progressoLang, revisaoLang, agora) {
    const jogados = {};
    temasJogados(progressoLang).forEach(function (t) { jogados[t] = true; });
    const rev = revisaoLang || {};
    const vistas = {};   // a mesma palavra em duas fases (ex.: "pão") entra uma vez só
    const pend = palavras.filter(function (w) {
      if (w.tema === "frases" || !jogados[w.tema] || vistas[w.pt]) return false;
      if (!revisaoVencida(rev[w.pt], agora)) return false;
      vistas[w.pt] = true;
      return true;
    });
    pend.sort(function (a, b) {
      const pa = (rev[a.pt] && rev[a.pt].prox) || 0;
      const pb = (rev[b.pt] && rev[b.pt].prox) || 0;
      return pa - pb;
    });
    return pend;
  }

  // ---------------- frases aplicadas ----------------
  // depois de aprender uma palavra, a criança a encontra numa frase simples;
  // depois de aprender a simples, numa frase completa. Cada frase tem a sua
  // própria caixa de Leitner, guardada na revisão com a chave "frase:<id>:<nível>".
  const CAIXA_APRENDIDA = 3;   // acertou duas revisões seguidas

  function chaveFrase(palavraId, nivel) { return "frase:" + palavraId + ":" + nivel; }

  // a frase está liberada?  nível 1: a palavra chegou à caixa 3.
  //                         nível 2: a frase simples chegou à caixa 3.
  function fraseLiberada(frase, ptDaPalavra, revisaoLang) {
    const rev = revisaoLang || {};
    const base = frase.nivel === 1 ? rev[ptDaPalavra] : rev[chaveFrase(frase.palavra_id, 1)];
    return !!base && (base.caixa || 0) >= CAIXA_APRENDIDA;
  }

  // frases liberadas e vencidas, das mais atrasadas para as mais recentes.
  // `frases` = [{palavra_id, nivel, ...}]; `ptPorId` = mapa id da palavra -> pt.
  function frasesPendentes(frases, ptPorId, revisaoLang, agora) {
    const rev = revisaoLang || {};
    const pend = (frases || []).filter(function (f) {
      const pt = ptPorId[f.palavra_id];
      if (!pt || !fraseLiberada(f, pt, rev)) return false;
      return revisaoVencida(rev[chaveFrase(f.palavra_id, f.nivel)], agora);
    });
    pend.sort(function (a, b) {
      const ea = rev[chaveFrase(a.palavra_id, a.nivel)], eb = rev[chaveFrase(b.palavra_id, b.nivel)];
      return ((ea && ea.prox) || 0) - ((eb && eb.prox) || 0);
    });
    return pend;
  }

  // monta uma rodada de revisão com no máximo `max` cartões, reservando até
  // `cotaFrases` lugares para frases. Se faltar de um tipo, completa com o outro.
  function montarRevisao(palavrasPend, frasesPend, max, cotaFrases) {
    if (max === undefined) max = 10;
    if (cotaFrases === undefined) cotaFrases = 4;
    const pw = palavrasPend || [], pf = frasesPend || [];
    let nf = Math.min(pf.length, cotaFrases);
    const nw = Math.min(pw.length, max - nf);
    nf = Math.min(pf.length, max - nw);
    return {
      palavras: pw.slice(0, nw),
      frases: pf.slice(0, nf)
    };
  }

  // quantas frases (de cada nível) a criança já aprendeu num idioma
  function frasesAprendidas(revisaoLang) {
    const out = { simples: 0, completas: 0 };
    const rev = revisaoLang || {};
    for (const k in rev) {
      if (k.indexOf("frase:") !== 0 || (rev[k].caixa || 0) < CAIXA_APRENDIDA) continue;
      if (k.slice(-2) === ":1") out.simples++; else out.completas++;
    }
    return out;
  }

  // separa uma frase em palavras comparáveis ("dell'aereo" -> "dell", "aereo"; ß -> ss)
  function palavrasDaFrase(s) {
    return normalizar(String(s).replace(/ß/g, "ss").replace(/['’\-]/g, " ")).split(" ").filter(Boolean);
  }

  // nota de 0 a 1 para uma frase dita: a fração das palavras do alvo que
  // apareceram (com tolerância a pronúncia de criança) no que foi reconhecido.
  // Dizer só uma palavra da frase não basta, ao contrário de pontuar().
  function pontuarFrase(textos, alvoBruto) {
    const alvo = palavrasDaFrase(alvoBruto);
    if (!alvo.length) return 0;
    let melhor = 0;
    (textos || []).forEach(function (t) {
      const dito = palavrasDaFrase(t);
      if (!dito.length) return;
      let acertos = 0;
      alvo.forEach(function (a) {
        let s = 0;
        dito.forEach(function (d) {
          const m = Math.max(a.length, d.length) || 1;
          const x = soaIgual(a, d) ? 1 : 1 - distancia(a, d) / m;
          if (x > s) s = x;
        });
        if (s >= 0.7) acertos++;
      });
      const nota = acertos / alvo.length;
      if (nota > melhor) melhor = nota;
    });
    return melhor;
  }

  // ---------------- sincronização entre aparelhos ----------------
  // junta o progresso de dois lugares (este aparelho + nuvem) sem perder nada:
  // fica com o MAIOR número de rodadas e a MELHOR acurácia de cada fase.
  // formato: { idioma: { tema: { rodadas, melhorAcc } } }
  function mesclarProgresso(a, b) {
    const out = {};
    [a || {}, b || {}].forEach(function (fonte) {
      for (const lang in fonte) {
        if (!out[lang]) out[lang] = {};
        for (const tema in fonte[lang]) {
          const x = fonte[lang][tema] || {};
          const y = out[lang][tema] || { rodadas: 0, melhorAcc: 0 };
          out[lang][tema] = {
            rodadas: Math.max(y.rodadas || 0, x.rodadas || 0),
            melhorAcc: Math.max(y.melhorAcc || 0, x.melhorAcc || 0)
          };
        }
      }
    });
    return out;
  }

  // junta as caixas de revisão: para cada palavra vale o registro MAIS RECENTE
  // (campo `em`, em ms). formato: { idioma: { pt: { caixa, prox, em } } }
  function mesclarRevisao(a, b) {
    const out = {};
    [a || {}, b || {}].forEach(function (fonte) {
      for (const lang in fonte) {
        if (!out[lang]) out[lang] = {};
        for (const pt in fonte[lang]) {
          const x = fonte[lang][pt];
          const y = out[lang][pt];
          if (!x) continue;
          if (!y || (x.em || 0) > (y.em || 0)) out[lang][pt] = x;
        }
      }
    });
    return out;
  }

  // ---------------- plano grátis / premium ----------------
  // uma fase está liberada se a cobrança está desligada, se o plano é premium
  // ou se o tema faz parte da amostra grátis.
  function faseLiberadaNoPlano(temaGratis, plano, cobrancaAtiva) {
    if (!cobrancaAtiva) return true;
    if (plano === "premium") return true;
    return !!temaGratis;
  }

  // resumo de um idioma: total de estrelas, fases vencidas (2+ estrelas) e troféu.
  function resumoIdioma(estrelas, temas) {
    let total = 0, vencidas = 0;
    temas.forEach(function (t) {
      const n = estrelas[t] || 0;
      total += n;
      if (n >= 2) vencidas++;
    });
    return { estrelas: total, vencidas: vencidas, fases: temas.length, trofeu: ganhouTrofeu(estrelas, temas) };
  }

  // as palavras em que a criança mais tropeça, a partir do registro de tentativas
  // ([{palavras, idioma, resultado}]). só entra quem tem `min`+ tentativas.
  function palavrasDificeis(tentativas, limite, min) {
    if (limite === undefined) limite = 5;
    if (min === undefined) min = 3;
    const mapa = {};
    (tentativas || []).forEach(function (t) {
      const k = t.idioma + "|" + t.palavras;
      if (!mapa[k]) mapa[k] = { palavra: t.palavras, idioma: t.idioma, ok: 0, total: 0 };
      mapa[k].total++;
      if (t.resultado === "acertou" || t.resultado === "quase") mapa[k].ok++;
    });
    return Object.keys(mapa).map(function (k) {
      const m = mapa[k];
      m.taxa = m.ok / m.total;
      return m;
    }).filter(function (m) { return m.total >= min && m.taxa < 0.7; })
      .sort(function (x, y) { return x.taxa - y.taxa || y.total - x.total; })
      .slice(0, limite);
  }

  const api = {
    normalizar: normalizar, distancia: distancia, pontuar: pontuar, dominou: dominou,
    ordemTemas: ordemTemas, estrelasFase: estrelasFase, progressoFase: progressoFase,
    faseDestravada: faseDestravada, ganhouTrofeu: ganhouTrofeu,
    intervaloRevisao: intervaloRevisao, agendarRevisao: agendarRevisao,
    revisaoVencida: revisaoVencida, temasJogados: temasJogados,
    revisaoPendente: revisaoPendente,
    mesclarProgresso: mesclarProgresso, mesclarRevisao: mesclarRevisao,
    faseLiberadaNoPlano: faseLiberadaNoPlano, resumoIdioma: resumoIdioma,
    palavrasDificeis: palavrasDificeis,
    chaveFrase: chaveFrase, fraseLiberada: fraseLiberada, frasesPendentes: frasesPendentes,
    montarRevisao: montarRevisao, frasesAprendidas: frasesAprendidas, pontuarFrase: pontuarFrase
  };

  // no Node (testes) vira módulo; no navegador (app) vira window.Logica
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Logica = api;

})(typeof window !== "undefined" ? window : globalThis);
