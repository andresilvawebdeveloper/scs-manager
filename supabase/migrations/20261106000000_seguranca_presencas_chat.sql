-- =====================================================================
-- SCS Manager — segurança dos dados, presenças em eventos e chat
-- =====================================================================
-- O que este script faz:
--   1. Liga a segurança por linha (RLS) em todas as tabelas: só os
--      treinadores (linhas na tabela "coaches") veem e alteram tudo.
--      Encarregados e alunos adultos só chegam aos SEUS dados, e apenas
--      depois de validarem o SMS (o telemóvel da sessão tem de coincidir
--      com o telemóvel da inscrição).
--   2. Cria as funções usadas no login por código, na leitura da ficha
--      e na edição da ficha pelos encarregados/adultos.
--   3. Separa a resposta do encarregado ("vai / não vai", coluna status)
--      da presença real marcada pelo treinador (nova coluna present).
--   4. Prepara a tabela de mensagens para o chat entre dispositivos.
--
-- IMPORTANTE: o passo 1 APAGA as políticas RLS que já existam nestas
-- tabelas (são substituídas pelas de baixo). Corra primeiro numa cópia /
-- branch do projeto, se possível. Pode ser executado mais do que uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Funções auxiliares
-- ---------------------------------------------------------------------

-- Normaliza um telemóvel para só dígitos com indicativo (ex.: 351912345678)
create or replace function public.scs_norm_phone(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) = 9 then '351' || regexp_replace(p, '\D', '', 'g')
    else regexp_replace(p, '\D', '', 'g')
  end
$$;

-- É treinador? (o utilizador autenticado tem linha na tabela coaches)
create or replace function public.scs_is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches c where c.id::text = auth.uid()::text)
$$;

-- Telemóvel validado por SMS da sessão atual
create or replace function public.scs_session_phone()
returns text language sql stable security definer set search_path = public, auth as $$
  select public.scs_norm_phone(u.phone) from auth.users u where u.id = auth.uid()
$$;

-- Ids das inscrições (atletas) cujo telemóvel coincide com o da sessão
create or replace function public.scs_my_registration_ids()
returns setof text language sql stable security definer set search_path = public as $$
  select r.id::text from public.registrations r
  where public.scs_session_phone() is not null
    and public.scs_norm_phone(r.phone) = public.scs_session_phone()
$$;

-- Emails (encarregado e/ou aluno adulto) associados ao telemóvel da sessão
create or replace function public.scs_my_emails()
returns setof text language sql stable security definer set search_path = public as $$
  select lower(r.email) from public.registrations r
    where public.scs_session_phone() is not null and r.email is not null
      and public.scs_norm_phone(r.phone) = public.scs_session_phone()
  union
  select lower(a.email) from public.adult_registrations a
    where public.scs_session_phone() is not null and a.email is not null
      and public.scs_norm_phone(a.phone) = public.scs_session_phone()
$$;

create or replace function public.scs_is_adult_student()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.adult_registrations a
    where public.scs_session_phone() is not null
      and public.scs_norm_phone(a.phone) = public.scs_session_phone()
      and coalesce(a.status, 'pending') = 'accepted'
  )
$$;

-- ---------------------------------------------------------------------
-- 1. Treinadores: todos os utilizadores com email (os encarregados entram
--    só por telemóvel) passam a constar da tabela coaches.
--    Confirme a lista depois de correr: select * from public.coaches;
-- ---------------------------------------------------------------------
insert into public.coaches (id, email)
select u.id, u.email from auth.users u
where u.email is not null
  and not exists (select 1 from public.coaches c where c.id::text = u.id::text);

-- ---------------------------------------------------------------------
-- 2. Ajustes de colunas
-- ---------------------------------------------------------------------

-- Colunas que a app usa. Algumas podem não existir na base de dados real
-- (ex.: event_attendances.status não existia, por isso as respostas e
-- presenças nunca chegavam a ser gravadas). Só cria as que faltam.
alter table public.event_attendances add column if not exists event_id text;
alter table public.event_attendances add column if not exists athlete_id text;
-- status = resposta do encarregado (vai / não vai)
alter table public.event_attendances add column if not exists status boolean;
-- present = presença real no evento (marcada pelo treinador)
alter table public.event_attendances add column if not exists present boolean;
alter table public.event_attendances alter column status drop not null;

alter table public.messages add column if not exists sender text;
alter table public.messages add column if not exists sender_name text;
alter table public.messages add column if not exists recipient_email text;
alter table public.messages add column if not exists text text;
alter table public.messages add column if not exists "timestamp" text;
alter table public.messages add column if not exists date text;

alter table public.coaches add column if not exists email text;

alter table public.registrations add column if not exists status text;
alter table public.registrations add column if not exists phone text;
alter table public.registrations add column if not exists email text;
alter table public.registrations add column if not exists access_code text;
alter table public.adult_registrations add column if not exists status text;
alter table public.adult_registrations add column if not exists phone text;
alter table public.adult_registrations add column if not exists email text;
alter table public.adult_registrations add column if not exists access_code text;

-- Remover duplicados e garantir 1 linha por (evento, atleta) — o "upsert" precisa disto
delete from public.event_attendances a
using public.event_attendances b
where a.event_id::text = b.event_id::text
  and a.athlete_id::text = b.athlete_id::text
  and a.ctid < b.ctid;
create unique index if not exists event_attendances_event_athlete_uidx
  on public.event_attendances (event_id, athlete_id);

-- Mensagens: email de quem envia e data de criação para ordenar
alter table public.messages add column if not exists sender_email text;
alter table public.messages add column if not exists created_at timestamptz not null default now();

-- Tempo real para o chat
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. RLS: apagar políticas antigas e ligar RLS
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['registrations','adult_registrations','attendances','event_attendances',
                           'events','adult_classes','coaches','coach_attendances','parent_attendances','messages']
  loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    -- Treinadores: acesso total
    execute format('create policy scs_coach_all on public.%I for all to authenticated using (public.scs_is_coach()) with check (public.scs_is_coach())', t);
  end loop;
end $$;

-- Novas inscrições (formulários públicos): só inserir, e sempre como pendente
create policy scs_public_insert on public.registrations
  for insert to anon, authenticated with check (status = 'pending');
create policy scs_public_insert on public.adult_registrations
  for insert to anon, authenticated with check (status = 'pending');

-- Treinador lê o seu próprio perfil
create policy scs_coach_self on public.coaches
  for select to authenticated using (id::text = auth.uid()::text);

-- Eventos: informação pública do clube
create policy scs_events_read on public.events
  for select to anon, authenticated using (true);

-- Respostas aos eventos: o encarregado lê e responde pelos seus atletas
create policy scs_ea_parent_select on public.event_attendances
  for select to authenticated using (athlete_id::text in (select public.scs_my_registration_ids()));
create policy scs_ea_parent_insert on public.event_attendances
  for insert to authenticated with check (athlete_id::text in (select public.scs_my_registration_ids()));
create policy scs_ea_parent_update on public.event_attendances
  for update to authenticated
  using (athlete_id::text in (select public.scs_my_registration_ids()))
  with check (athlete_id::text in (select public.scs_my_registration_ids()));

-- Aulas de adultos: alunos aceites veem as aulas e reservam vaga
create policy scs_classes_adult_select on public.adult_classes
  for select to authenticated using (public.scs_is_adult_student());
create policy scs_classes_adult_update on public.adult_classes
  for update to authenticated using (public.scs_is_adult_student()) with check (public.scs_is_adult_student());

-- Mensagens: o encarregado/adulto vê comunicados gerais e as suas conversas
create policy scs_msg_parent_select on public.messages
  for select to authenticated using (
    recipient_email = 'all'
    or lower(recipient_email) in (select public.scs_my_emails())
    or lower(sender_email) in (select public.scs_my_emails())
  );
create policy scs_msg_parent_insert on public.messages
  for insert to authenticated with check (
    sender <> 'Coach' and lower(sender_email) in (select public.scs_my_emails())
  );

-- ---------------------------------------------------------------------
-- 4. Funções de login e ficha (encarregados e adultos)
-- ---------------------------------------------------------------------

-- Passo 1 do login: confirma o código e devolve só o estado e o telemóvel
-- (necessário para enviar o SMS). Não devolve mais nenhum dado.
create or replace function public.scs_lookup_access_code(p_code text, p_kind text)
returns table (status text, phone text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if length(v_code) < 6 then return; end if;
  if p_kind = 'adult' then
    return query select a.status::text, a.phone::text from public.adult_registrations a
      where upper(regexp_replace(coalesce(a.access_code, ''), '[^A-Za-z0-9]', '', 'g')) = v_code limit 1;
  else
    return query select r.status::text, r.phone::text from public.registrations r
      where upper(regexp_replace(coalesce(r.access_code, ''), '[^A-Za-z0-9]', '', 'g')) = v_code limit 1;
  end if;
end $$;

-- Passo 2 (depois do SMS): devolve a ficha completa, só se o código for
-- válido, a inscrição estiver aceite e o telemóvel da sessão coincidir.
create or replace function public.scs_get_my_registration(p_code text, p_kind text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_phone text := public.scs_session_phone();
  v_row jsonb;
begin
  if v_phone is null or length(v_code) < 6 then return null; end if;
  if p_kind = 'adult' then
    select to_jsonb(a) into v_row from public.adult_registrations a
      where upper(regexp_replace(coalesce(a.access_code, ''), '[^A-Za-z0-9]', '', 'g')) = v_code
        and coalesce(a.status, 'pending') = 'accepted'
        and public.scs_norm_phone(a.phone) = v_phone
      limit 1;
  else
    select to_jsonb(r) into v_row from public.registrations r
      where upper(regexp_replace(coalesce(r.access_code, ''), '[^A-Za-z0-9]', '', 'g')) = v_code
        and r.status = 'accepted'
        and public.scs_norm_phone(r.phone) = v_phone
      limit 1;
  end if;
  return v_row;
end $$;

-- Edição da ficha pelo encarregado/adulto: só campos permitidos, só a
-- própria inscrição. Campos que não existam na tabela são ignorados.
-- Devolve a ficha atualizada.
create or replace function public.scs_update_my_registration(p_id text, p_kind text, p_changes jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_table text := case when p_kind = 'adult' then 'adult_registrations' else 'registrations' end;
  v_allowed text[] := case when p_kind = 'adult'
    then array['full_name','phone','address','city','postal_code','nif','cc','payment_mode','photo_url']
    else array['athlete_name','athlete_nif','athlete_cc','parent_name','phone','address','city','postal_code',
               'photo_url','tracksuit_size','official_tshirt_size','red_tshirt_size','yellow_tshirt_size'] end;
  v_phone text := public.scs_session_phone();
  v_sets text[] := '{}';
  v_key text;
  v_owner boolean;
  v_row jsonb;
begin
  if v_phone is null then raise exception 'Sessão inválida. Entre novamente.' using errcode = '42501'; end if;

  execute format('select exists (select 1 from public.%I where id::text = $1 and public.scs_norm_phone(phone) = $2)', v_table)
    into v_owner using p_id, v_phone;
  if not v_owner then raise exception 'Sem permissão para alterar esta ficha.' using errcode = '42501'; end if;

  for v_key in select jsonb_object_keys(coalesce(p_changes, '{}'::jsonb)) loop
    if v_key = any (v_allowed) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = v_table and column_name = v_key
    ) then
      v_sets := v_sets || format('%I = (jsonb_populate_record(null::public.%I, $1)).%I', v_key, v_table, v_key);
    end if;
  end loop;

  if array_length(v_sets, 1) > 0 then
    execute format('update public.%I set %s where id::text = $2', v_table, array_to_string(v_sets, ', '))
      using p_changes, p_id;
  end if;

  execute format('select to_jsonb(t) from public.%I t where id::text = $1', v_table) into v_row using p_id;
  return v_row;
end $$;

revoke all on function public.scs_lookup_access_code(text, text) from public;
revoke all on function public.scs_get_my_registration(text, text) from public;
revoke all on function public.scs_update_my_registration(text, text, jsonb) from public;
grant execute on function public.scs_lookup_access_code(text, text) to anon, authenticated;
grant execute on function public.scs_get_my_registration(text, text) to authenticated;
grant execute on function public.scs_update_my_registration(text, text, jsonb) to authenticated;
