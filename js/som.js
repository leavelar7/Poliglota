// som.js — áudio de pronúncia (arquivos pré-gerados) com a voz do navegador como reserva.
let tocando = null;

export function parar() {
  if (tocando) { try { tocando.pause(); } catch (e) {} tocando = null; }
  if ("speechSynthesis" in window) { try { speechSynthesis.cancel(); } catch (e) {} }
}

// toca um arquivo; a promessa rejeita se o arquivo faltar ou o navegador bloquear
export function tocar(src) {
  parar();
  const a = new Audio(src);
  tocando = a;
  return a.play();
}

export function falarNavegador(texto, locale) {
  if (!("speechSynthesis" in window)) return;
  const vozes = speechSynthesis.getVoices() || [];
  const voz = vozes.find(function (v) { return v.lang === locale; })
           || vozes.find(function (v) { return v.lang.slice(0, 2) === locale.slice(0, 2); });
  const fala = new SpeechSynthesisUtterance(texto);
  if (voz) fala.voice = voz;
  fala.lang = locale; fala.rate = 0.9;
  speechSynthesis.speak(fala);
}

// baixa por trás as imagens e áudios de uma fase, poucos por vez, para a rodada
// não engasgar (e para o service worker guardar tudo para uso offline)
let lote = 0;
export function preCarregar(urls) {
  const meu = ++lote;
  const fila = urls.slice();
  function proximo() {
    if (meu !== lote || !fila.length || !navigator.onLine) return;
    fetch(fila.shift()).catch(function () {}).then(proximo);
  }
  for (let i = 0; i < 4; i++) proximo();
}
