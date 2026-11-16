// Quem já usa o app (instalado na tela inicial ou com progresso neste aparelho)
// vai direto para ele. "/?site" mostra a página de apresentação mesmo assim.
(function () {
  try {
    if (location.pathname !== "/" || location.search.indexOf("site") !== -1) return;
    var instalado = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    var jaUsa = localStorage.getItem("pp:pref:idioma") || localStorage.getItem("pp:local:dados") ||
                localStorage.getItem("poliglota_progresso") || localStorage.getItem("poliglota_revisao");
    if (instalado || jaUsa) location.replace("/app");
  } catch (e) {}
})();
