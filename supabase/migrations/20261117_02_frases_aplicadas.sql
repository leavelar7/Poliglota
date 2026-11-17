-- Frases aplicadas: uma frase simples (nivel 1) e uma completa (nivel 2) por palavra.
-- O conteúdo vem de conteudo/frases/*.txt (ver 20261117_03_frases_aplicadas_dados.sql).
create table if not exists public.frases_aplicadas (
  palavra_id bigint not null references public.palavras (id) on delete cascade,
  nivel      smallint not null check (nivel in (1, 2)),
  pt         text not null,
  en         text not null,
  de         text not null,
  it         text not null,
  primary key (palavra_id, nivel)
);

alter table public.frases_aplicadas enable row level security;
create policy "frases: leitura publica" on public.frases_aplicadas for select to anon, authenticated using (true);
revoke all on public.frases_aplicadas from anon, authenticated;
grant select on public.frases_aplicadas to anon, authenticated;
