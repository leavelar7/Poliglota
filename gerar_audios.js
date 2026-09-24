// Gera o áudio (voz do Google) de TUDO: palavras e alfabeto.
// Só precisa do gtts:  npm install gtts   ->   node gerar_audios.js
// Busca os dados do Supabase pela internet (sem biblioteca extra). Pula o que já existe.
const gTTS = require('gtts');
const fs = require('fs');

const URL = 'https://alypvuijjtyddajtsvvb.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFseXB2dWlqanR5ZGRhanRzdnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDYyNzksImV4cCI6MjEwNTU4MjI3OX0.CnUCE3Hr9nDsqRMwviEntBd07uLaiJ5oyad40QEEWmQ';
const idiomas = ['en', 'de', 'it'];

function gerarUm(texto, lang, arquivo) {
  return new Promise(function (resolve) {
    if (fs.existsSync(arquivo)) return resolve(); // já existe -> pula
    new gTTS(texto, lang).save(arquivo, function (err) {
      if (err) console.log('ERRO em', arquivo, '->', err.message);
      else console.log('gerado:', arquivo);
      setTimeout(resolve, 300);
    });
  });
}

async function ler(tabela) {
  const res = await fetch(URL + '/rest/v1/' + tabela + '?select=*&order=id', {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
  });
  if (!res.ok) { console.log('erro ao ler', tabela, '->', res.status); return []; }
  return await res.json();
}

async function fazerPalavras() {
  const dados = await ler('palavras');
  console.log('Palavras:', dados.length);
  for (const p of dados) {
    for (const lang of idiomas) await gerarUm(p[lang], lang, p.id + '_' + lang + '.mp3');
  }
}

async function fazerAlfabeto() {
  const dados = await ler('alfabeto');
  console.log('Alfabeto:', dados.length, 'letras');
  for (const a of dados) {
    const base = 'alf_' + a.idioma + '_' + a.ordem;
    await gerarUm(a.letra, a.idioma, base + '_letra.mp3');     // a letra falada
    await gerarUm(a.exemplo, a.idioma, base + '_palavra.mp3'); // a palavra de exemplo
  }
}

async function main() {
  await fazerPalavras();
  await fazerAlfabeto();
  console.log('== pronto ==');
}

main();
