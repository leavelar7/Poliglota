// nuvem.js — cliente do Supabase (a biblioteca vem de /vendor, carregada antes dos módulos)
import { SUPABASE_URL, SUPABASE_CHAVE } from "./config.js";

// O link de "trocar senha" chega com type=recovery no endereço. A biblioteca lê e apaga
// esse trecho logo ao ser criada, antes de o app começar a escutar os eventos de login,
// então guardamos a informação aqui, antes de criar o cliente.
export const veioDeRecuperacao = /(^|[#&?])type=recovery(&|$)/.test(location.hash + "&" + location.search.slice(1));

export const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// o PostgREST devolve no máximo 1000 linhas por pedido: busca em páginas até acabar.
// `montar` recebe nada e devolve uma consulta nova (ainda sem range).
export async function buscarTudo(montar) {
  const TAM = 1000;
  let out = [];
  for (let de = 0; ; de += TAM) {
    const r = await montar().range(de, de + TAM - 1);
    if (r.error) throw r.error;
    out = out.concat(r.data || []);
    if (!r.data || r.data.length < TAM) return out;
  }
}
