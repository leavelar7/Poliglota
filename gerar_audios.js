// Gera o áudio (voz do Google) de TUDO: palavras, alfabeto e frases aplicadas.
// Só precisa do gtts:  npm install gtts   ->   node gerar_audios.js
// Busca os dados do Supabase pela internet (sem biblioteca extra). Pula o que já existe.
// Roda sozinho no GitHub pelo workflow .github/workflows/audios.yml.
const gTTS = require('gtts');
const fs = require('fs');

const URL = 'https://alypvuijjtyddajtsvvb.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFseXB2dWlqanR5ZGRhanRzdnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDYyNzksImV4cCI6MjEwNTU4MjI3OX0.CnUCE3Hr9nDsqRMwviEntBd07uLaiJ5oyad40QEEWmQ';
const idiomas = ['en', 'de', 'it'];

// texto de cada áudio de frase já gerado: se a frase for editada, o áudio é refeito
const MANIFESTO = 'audio/frases.json';
let manifesto = {};
try { manifesto = JSON.parse(fs.readFileSync(MANIFESTO, 'utf8')); } catch (e) {}

let gerados = 0, falhas = 0;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function salvar(texto, lang, arquivo) {
  return new Promise(function (resolve, reject) {
    new gTTS(texto, lang).save(arquivo, function (err) { err ? reject(err) : resolve(); });
  });
}

// gera um arquivo, tentando de novo com pausas crescentes se o Google recusar
async function gerarUm(texto, lang, arquivo, refazer) {
  if (!refazer && fs.existsSync(arquivo)) return true; // já existe -> pula
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      await salvar(texto, lang, arquivo);
      gerados++;
      console.log('gerado:', arquivo);
      await espera(350);
      return true;
    } catch (err) {
      console.log('tentativa', tentativa, 'falhou em', arquivo, '->', err.message);
      try { fs.unlinkSync(arquivo); } catch (e) {}
      await espera(2000 * tentativa * tentativa);
    }
  }
  falhas++;
  return false;
}

// lê uma tabela inteira (o Supabase devolve no máximo 1000 linhas por pedido)
async function ler(tabela, ordem) {
  let tudo = [];
  for (let de = 0; ; de += 1000) {
    const res = await fetch(URL + '/rest/v1/' + tabela + '?select=*&order=' + (ordem || 'id'), {
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: de + '-' + (de + 999) }
    });
    if (!res.ok) { console.log('erro ao ler', tabela, '->', res.status); return tudo; }
    const pagina = await res.json();
    tudo = tudo.concat(pagina);
    if (pagina.length < 1000) return tudo;
  }
}

async function fazerPalavras() {
  const dados = await ler('palavras');
  console.log('Palavras:', dados.length);
  for (const p of dados) {
    for (const lang of idiomas) await gerarUm(p[lang], lang, 'audio/' + p.id + '_' + lang + '.mp3');
  }
}

async function fazerAlfabeto() {
  const dados = await ler('alfabeto');
  console.log('Alfabeto:', dados.length, 'letras');
  for (const a of dados) {
    const base = 'audio/alf_' + a.idioma + '_' + a.ordem;
    await gerarUm(a.letra, a.idioma, base + '_letra.mp3');     // a letra falada
    await gerarUm(a.exemplo, a.idioma, base + '_palavra.mp3'); // a palavra de exemplo
  }
}

// frases aplicadas: audio/f<palavra>_<nivel>_<idioma>.mp3
async function fazerFrases() {
  const dados = await ler('frases_aplicadas', 'palavra_id,nivel');
  console.log('Frases aplicadas:', dados.length);
  let n = 0;
  for (const f of dados) {
    for (const lang of idiomas) {
      const nome = 'f' + f.palavra_id + '_' + f.nivel + '_' + lang + '.mp3';
      const mudou = manifesto[nome] !== undefined && manifesto[nome] !== f[lang];
      const ok = await gerarUm(f[lang], lang, 'audio/' + nome, mudou);
      if (ok) manifesto[nome] = f[lang];
    }
    // guarda o progresso de tempos em tempos (se o processo cair, não perde tudo)
    if (++n % 50 === 0) fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 0));
  }
  fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 0));
}

async function main() {
  if (!fs.existsSync('audio')) fs.mkdirSync('audio'); // garante a pasta de áudio
  await fazerPalavras();
  await fazerAlfabeto();
  await fazerFrases();
  console.log('== pronto ==', gerados, 'gerados,', falhas, 'falhas');
  if (falhas) process.exitCode = 1;
}

main();
