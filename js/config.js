// ============================================================
//  config.js — tudo que é "ajuste" do produto fica aqui.
// ============================================================

// Supabase: URL e chave pública (anon). São públicas por natureza —
// quem protege os dados é o RLS do banco, não o segredo desta chave.
export const SUPABASE_URL = "https://alypvuijjtyddajtsvvb.supabase.co";
export const SUPABASE_CHAVE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFseXB2dWlqanR5ZGRhanRzdnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDYyNzksImV4cCI6MjEwNTU4MjI3OX0.CnUCE3Hr9nDsqRMwviEntBd07uLaiJ5oyad40QEEWmQ";

// Cobrança. Enquanto for false, TODAS as fases ficam liberadas para todo mundo.
// Ao ligar, quem não é premium só joga os temas marcados como grátis no banco
// (tabela temas, coluna gratis). O pagamento em si ainda não existe.
export const COBRANCA_ATIVA = false;

// Aparecem na política de privacidade, nos termos e no rodapé. PREENCHA antes de divulgar.
export const CONTATO_EMAIL = "";
export const RESPONSAVEL_NOME = "Leslie Avelar";

export const VERSAO = "3.0.2";

export const IDIOMAS = ["en", "de", "it"];
export const NOME_IDIOMA = { en: "Inglês", de: "Alemão", it: "Italiano" };
export const LOCALE = { en: "en-US", de: "de-DE", it: "it-IT" };

// bichos que a criança pode escolher como "carinha" do perfil (arquivos em /img)
export const AVATARES = ["tartaruga", "gato", "cachorro", "coelho", "leao", "coruja", "raposa", "pinguim", "elefante", "girafa"];

export const MAX_PERFIS = 4;
export const MAX_REVISAO = 10;       // palavras por rodada de revisão
export const NOTA_ACERTOU = 0.55;    // quão parecido precisa soar para "acertou"
export const NOTA_QUASE = 0.30;      // ... e para "quase"
