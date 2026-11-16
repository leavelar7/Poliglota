-- =====================================================================
-- Pequeno Poliglota — base profissional (ETAPA 1, segura)
-- Cria temas, contas, perfis e progresso na nuvem, e liga a proteção
-- por linha (RLS). O app antigo continua funcionando depois desta etapa.
-- =====================================================================

-- ---------- temas (nome bonito, ordem, grátis/premium) ----------
create table if not exists public.temas (
  slug   text primary key,
  nome   text not null,
  ordem  integer not null,
  icone  text,
  gratis boolean not null default false,
  ativo  boolean not null default true
);

insert into public.temas (slug, nome, ordem, icone, ativo)
select tema, tema,
       row_number() over (order by min(id)),
       (array_agg(fig order by id))[1],
       tema <> 'frases'
from public.palavras
group by tema
on conflict (slug) do nothing;

update public.temas t set nome = v.nome
from (values
  ('saudacoes','Saudações'), ('familia','Família'), ('corpo','Corpo'), ('casa','Casa'),
  ('animais','Animais'), ('roupas','Roupas'), ('natureza','Natureza'), ('comida','Comida'),
  ('brinquedos','Brinquedos'), ('cores_formas','Cores e formas'), ('verbos','Ações'),
  ('numeros','Números'), ('veiculos','Veículos'), ('sentimentos','Sentimentos'),
  ('escola','Escola'), ('profissoes','Profissões'), ('instrumentos','Instrumentos'),
  ('frases','Frases'), ('conceitos','Conceitos'), ('bichos','Bichos'), ('esportes','Esportes'),
  ('lugares','Lugares'), ('festa','Festa'), ('ferramentas','Ferramentas'),
  ('banheiro','Banheiro'), ('dias_semana','Dias da semana'), ('comodos','Cômodos'),
  ('opostos','Opostos'), ('cozinha','Cozinha')
) as v(slug, nome)
where t.slug = v.slug;

-- as 5 primeiras fases são a amostra grátis (só vale quando a cobrança for ligada no app)
update public.temas set gratis = (ordem <= 5);

-- ---------- responsáveis (1 linha por conta; guarda o plano) ----------
create table if not exists public.responsaveis (
  id        uuid primary key references auth.users (id) on delete cascade,
  plano     text not null default 'gratis' check (plano in ('gratis', 'premium')),
  criado_em timestamptz not null default now()
);

create or replace function public.criar_responsavel()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.responsaveis (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.criar_responsavel() from public, anon, authenticated;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_responsavel();

-- ---------- perfis de criança ----------
create table if not exists public.perfis (
  id             uuid primary key default gen_random_uuid(),
  responsavel_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 1 and 24),
  avatar         text not null default 'tartaruga',
  criado_em      timestamptz not null default now()
);
create index if not exists perfis_responsavel_idx on public.perfis (responsavel_id);

create or replace function public.limitar_perfis()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.perfis where responsavel_id = new.responsavel_id) >= 4 then
    raise exception 'limite de 4 perfis por conta';
  end if;
  return new;
end;
$$;
drop trigger if exists antes_de_criar_perfil on public.perfis;
create trigger antes_de_criar_perfil before insert on public.perfis
  for each row execute function public.limitar_perfis();

-- ---------- progresso por fase ----------
create table if not exists public.progresso_fases (
  perfil_id     uuid not null references public.perfis (id) on delete cascade,
  idioma        text not null check (idioma in ('en', 'de', 'it')),
  tema          text not null,
  rodadas       integer not null default 0 check (rodadas >= 0),
  melhor_acc    real not null default 0 check (melhor_acc between 0 and 1),
  atualizado_em timestamptz not null default now(),
  primary key (perfil_id, idioma, tema)
);

-- ---------- revisão espaçada (caixas de Leitner) ----------
create table if not exists public.revisoes (
  perfil_id     uuid not null references public.perfis (id) on delete cascade,
  idioma        text not null check (idioma in ('en', 'de', 'it')),
  palavra       text not null,
  caixa         smallint not null check (caixa between 1 and 5),
  proxima       timestamptz not null,
  atualizado_em timestamptz not null default now(),
  primary key (perfil_id, idioma, palavra)
);

-- ---------- tentativas: passa a saber de qual perfil é ----------
alter table public.tentativas
  add column if not exists perfil_id uuid references public.perfis (id) on delete cascade;
create index if not exists tentativas_perfil_idx on public.tentativas (perfil_id);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.palavras        enable row level security;
alter table public.alfabeto        enable row level security;
alter table public.temas           enable row level security;
alter table public.responsaveis    enable row level security;
alter table public.perfis          enable row level security;
alter table public.progresso_fases enable row level security;
alter table public.revisoes        enable row level security;
alter table public.tentativas      enable row level security;

-- vocabulário: qualquer um lê, ninguém escreve pela API (só pelo painel/SQL)
create policy "vocabulario: leitura publica" on public.palavras for select to anon, authenticated using (true);
create policy "alfabeto: leitura publica"    on public.alfabeto for select to anon, authenticated using (true);
create policy "temas: leitura publica"       on public.temas    for select to anon, authenticated using (true);

-- responsável: só enxerga a própria linha; o plano não é editável pelo app
create policy "responsavel: ver o proprio" on public.responsaveis
  for select to authenticated using (id = (select auth.uid()));

-- perfis: só os do próprio responsável
create policy "perfis: do responsavel" on public.perfis
  for all to authenticated
  using (responsavel_id = (select auth.uid()))
  with check (responsavel_id = (select auth.uid()));

-- progresso, revisões: só de perfis do próprio responsável
create policy "progresso: do responsavel" on public.progresso_fases
  for all to authenticated
  using (perfil_id in (select id from public.perfis where responsavel_id = (select auth.uid())))
  with check (perfil_id in (select id from public.perfis where responsavel_id = (select auth.uid())));

create policy "revisoes: do responsavel" on public.revisoes
  for all to authenticated
  using (perfil_id in (select id from public.perfis where responsavel_id = (select auth.uid())))
  with check (perfil_id in (select id from public.perfis where responsavel_id = (select auth.uid())));

create policy "tentativas: do responsavel" on public.tentativas
  for all to authenticated
  using (perfil_id in (select id from public.perfis where responsavel_id = (select auth.uid())))
  with check (perfil_id in (select id from public.perfis where responsavel_id = (select auth.uid())));

-- LEGADO (removido na etapa 2): o app antigo grava e lê tentativas sem perfil.
-- Já não permite alterar nem apagar nada.
create policy "legado: inserir sem perfil" on public.tentativas
  for insert to anon, authenticated with check (perfil_id is null);
create policy "legado: ler sem perfil" on public.tentativas
  for select to anon, authenticated using (perfil_id is null);

-- =====================================================================
-- Permissões de tabela (o RLS acima decide as linhas)
-- =====================================================================
revoke all on public.palavras, public.alfabeto, public.temas, public.responsaveis from anon, authenticated;
grant select on public.palavras, public.alfabeto, public.temas to anon, authenticated;
grant select on public.responsaveis to authenticated;
grant select, insert, update, delete on public.perfis, public.progresso_fases, public.revisoes to authenticated;
revoke all on public.perfis, public.progresso_fases, public.revisoes from anon;
revoke all on public.tentativas from anon, authenticated;
grant select, insert on public.tentativas to anon;
grant select, insert, delete on public.tentativas to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- =====================================================================
-- LGPD: o responsável apaga a própria conta (e tudo dela, em cascata)
-- =====================================================================
create or replace function public.excluir_minha_conta()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
