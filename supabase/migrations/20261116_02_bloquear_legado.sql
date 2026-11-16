-- =====================================================================
-- ETAPA 2 — rode SÓ DEPOIS que a versão nova estiver no ar (main).
-- Fecha a porta que o app antigo usava: tentativas sem perfil.
-- =====================================================================

-- (opcional) entregar o histórico antigo ao perfil do seu filho antes de fechar:
-- update public.tentativas set perfil_id = '<id do perfil>' where perfil_id is null;

drop policy if exists "legado: inserir sem perfil" on public.tentativas;
drop policy if exists "legado: ler sem perfil" on public.tentativas;
revoke all on public.tentativas from anon;
