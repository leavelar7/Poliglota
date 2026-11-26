// fala.js — reconhecimento de voz (Web Speech API).
// No iPhone/iPad o reconhecimento do navegador não é confiável: o app usa o modo "ouvir e repetir".
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const temReconhecimento = !!Rec && !ehIOS;

let ativo = null;

// escuta uma fala. chama aoOuvir([alternativas]) ou aoFalhar("erro" | "silencio" | "bloqueado")
export function escutar(locale, aoOuvir, aoFalhar) {
  // uma escuta antiga que nunca terminou (alguns Androids não disparam onend)
  // não pode travar o botão: descarta e começa de novo.
  if (ativo) cancelarEscuta();
  const r = new Rec();
  r.lang = locale; r.interimResults = false; r.maxAlternatives = 5;
  let resolvido = false;
  const limite = setTimeout(function () { try { r.stop(); } catch (e) {} }, 6000);
  // rede de segurança: se nem o stop() fizer o navegador responder, desiste sozinho
  const socorro = setTimeout(function () {
    if (resolvido) return;
    resolvido = true;
    if (ativo === r) cancelarEscuta();
    aoFalhar("silencio");
  }, 9000);
  r.onresult = function (ev) {
    resolvido = true; clearTimeout(socorro);
    const alts = [];
    for (let i = 0; i < ev.results[0].length; i++) alts.push(ev.results[0][i].transcript);
    aoOuvir(alts);
  };
  r.onerror = function (ev) {
    if (resolvido) return;
    resolvido = true; clearTimeout(socorro);
    const bloqueado = ev && (ev.error === "not-allowed" || ev.error === "service-not-allowed");
    aoFalhar(bloqueado ? "bloqueado" : (ev && ev.error === "no-speech" ? "silencio" : "erro"));
  };
  r.onend = function () {
    clearTimeout(limite);
    if (ativo === r) ativo = null;
    if (!resolvido) { resolvido = true; clearTimeout(socorro); aoFalhar("silencio"); }
  };
  ativo = r;
  try { r.start(); } catch (e) { ativo = null; clearTimeout(limite); clearTimeout(socorro); resolvido = true; aoFalhar("erro"); }
}

// interrompe sem avisar ninguém (a criança saiu da fase)
export function cancelarEscuta() {
  if (!ativo) return;
  const r = ativo; ativo = null;
  r.onresult = r.onerror = r.onend = null;
  try { r.abort(); } catch (e) {}
}
