// Gera algumas amostras de voz do Google (gTTS) pra você julgar a qualidade.
// Rodar: npm install gtts   ->   node teste_voz.js
const gTTS = require('gtts');

const amostras = [
  ['ciao', 'it', 'teste_ciao_it.mp3'],
  ['grazie', 'it', 'teste_grazie_it.mp3'],
  ['per favore', 'it', 'teste_perfavore_it.mp3'],
  ['hallo', 'de', 'teste_hallo_de.mp3'],
  ['danke', 'de', 'teste_danke_de.mp3'],
  ['guten Morgen', 'de', 'teste_gutenmorgen_de.mp3'],
  ['thank you', 'en', 'teste_thankyou_en.mp3'],
];

amostras.forEach(function (a) {
  const texto = a[0], lang = a[1], arquivo = a[2];
  new gTTS(texto, lang).save(arquivo, function (err) {
    if (err) { console.log('ERRO em', arquivo, '->', err.message); return; }
    console.log('gerado:', arquivo);
  });
});
