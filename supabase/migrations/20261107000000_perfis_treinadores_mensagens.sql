-- =====================================================================
-- SCS Manager — perfis de treinador, mensagens privadas e notificações
-- Requer: 20261106000000_seguranca_presencas_chat.sql já aplicado.
-- Pode ser executado mais do que uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfil do treinador
-- ---------------------------------------------------------------------
alter table public.coaches add column if not exists name text;
alter table public.coaches add column if not exists bio text;
alter table public.coaches add column if not exists photo_url text;
alter table public.coaches add column if not exists classes text[] not null default '{}';
alter table public.coaches add column if not exists active boolean not null default true;
alter table public.coaches add column if not exists role text default 'coach';

create or replace function public.scs_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches c where c.id::text = auth.uid()::text and c.role = 'admin')
$$;

-- Só o administrador muda funções (role) ou ativa/desativa treinadores
create or replace function public.scs_coaches_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.scs_is_admin() then
    if new.role is distinct from old.role or new.active is distinct from old.active or new.id is distinct from old.id then
      raise exception 'Só o administrador pode alterar a função ou o estado de um treinador.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists scs_coaches_guard on public.coaches;
create trigger scs_coaches_guard before update on public.coaches
  for each row execute function public.scs_coaches_guard();

-- "Treinador" passa a exigir também que o perfil esteja ativo
create or replace function public.scs_is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches c where c.id::text = auth.uid()::text and coalesce(c.active, true))
$$;

-- Permissões da tabela coaches: todos os treinadores veem a equipa; cada um edita o seu
-- perfil; o administrador edita todos, acrescenta e remove.
drop policy if exists scs_coach_all on public.coaches;
drop policy if exists scs_coach_self on public.coaches;
drop policy if exists scs_coaches_select on public.coaches;
drop policy if exists scs_coaches_update_self on public.coaches;
drop policy if exists scs_coaches_admin on public.coaches;
create policy scs_coaches_select on public.coaches
  for select to authenticated using (public.scs_is_coach() or id::text = auth.uid()::text);
create policy scs_coaches_update_self on public.coaches
  for update to authenticated using (id::text = auth.uid()::text) with check (id::text = auth.uid()::text);
create policy scs_coaches_admin on public.coaches
  for all to authenticated using (public.scs_is_admin()) with check (public.scs_is_admin());

-- Lista pública de treinadores (para os pais escolherem com quem falar). Não inclui email.
create or replace function public.scs_list_coaches()
returns table (id text, name text, bio text, photo_url text, classes text[])
language sql stable security definer set search_path = public as $$
  select c.id::text, c.name, c.bio, c.photo_url, coalesce(c.classes, '{}')
  from public.coaches c
  where coalesce(c.active, true) and nullif(trim(coalesce(c.name, '')), '') is not null
  order by c.name
$$;

-- Administrador acrescenta um treinador pelo email de uma conta já criada no Supabase
-- (Authentication → Users → Add user).
create or replace function public.scs_add_coach(p_email text, p_name text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, auth as $$
declare
  v_user auth.users%rowtype;
begin
  if not public.scs_is_admin() then
    raise exception 'Só o administrador pode acrescentar treinadores.' using errcode = '42501';
  end if;
  select * into v_user from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_user.id is null then
    raise exception 'Não existe nenhuma conta com o email %. Crie-a primeiro no Supabase (Authentication → Users).', p_email;
  end if;
  insert into public.coaches (id, email, name, role, active)
  values (v_user.id, v_user.email, nullif(trim(coalesce(p_name, '')), ''), 'coach', true)
  on conflict (id) do update set active = true,
    name = coalesce(public.coaches.name, excluded.name), email = excluded.email;
  return (select to_jsonb(c) from public.coaches c where c.id::text = v_user.id::text);
end $$;

-- ---------------------------------------------------------------------
-- 2. Mensagens: conversas por família e por treinador
--    family_email = email da família (encarregado ou aluno adulto), 'all' = comunicado geral
--    coach_id     = treinador da conversa privada; NULL = caixa do clube (todos os treinadores)
--    sender_coach_id = treinador que escreveu (quando sender = 'Coach')
-- ---------------------------------------------------------------------
alter table public.messages add column if not exists family_email text;
alter table public.messages add column if not exists coach_id uuid;
alter table public.messages add column if not exists sender_coach_id uuid;
alter table public.messages add column if not exists notified_at timestamptz;

update public.messages
set family_email = lower(case when sender = 'Coach' then recipient_email else sender_email end)
where family_email is null
  and (case when sender = 'Coach' then recipient_email else sender_email end) is not null;

create index if not exists messages_family_idx on public.messages (family_email, coach_id, created_at);

drop policy if exists scs_coach_all on public.messages;
drop policy if exists scs_msg_parent_select on public.messages;
drop policy if exists scs_msg_parent_insert on public.messages;
drop policy if exists scs_msg_coach_select on public.messages;
drop policy if exists scs_msg_coach_insert on public.messages;
drop policy if exists scs_msg_admin_delete on public.messages;
drop policy if exists scs_msg_family_select on public.messages;
drop policy if exists scs_msg_family_insert on public.messages;

-- Treinador: caixa do clube + as suas conversas privadas (não vê as privadas dos colegas)
create policy scs_msg_coach_select on public.messages
  for select to authenticated using (
    public.scs_is_coach() and (coach_id is null or coach_id::text = auth.uid()::text)
  );
create policy scs_msg_coach_insert on public.messages
  for insert to authenticated with check (
    public.scs_is_coach()
    and sender = 'Coach'
    and sender_coach_id::text = auth.uid()::text
    and family_email is not null
    and (coach_id is null or coach_id::text = auth.uid()::text)
  );
create policy scs_msg_admin_delete on public.messages
  for delete to authenticated using (public.scs_is_admin());

-- Treinador existe e está ativo (as famílias não leem a tabela coaches)
create or replace function public.scs_coach_is_active(p_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches c where c.id::text = p_id and coalesce(c.active, true))
$$;

-- Família: comunicados gerais + as suas conversas
create policy scs_msg_family_select on public.messages
  for select to authenticated using (
    family_email = 'all' or lower(family_email) in (select public.scs_my_emails())
  );
create policy scs_msg_family_insert on public.messages
  for insert to authenticated with check (
    sender <> 'Coach'
    and sender_coach_id is null
    and notified_at is null
    and lower(sender_email) in (select public.scs_my_emails())
    and lower(family_email) = lower(sender_email)
    and (coach_id is null or public.scs_coach_is_active(coach_id::text))
  );

-- ---------------------------------------------------------------------
-- 3. Destinatários das notificações de uma mensagem (usado só pelo servidor)
--    Devolve user_id (para push OneSignal) e email (para aviso por email).
-- ---------------------------------------------------------------------
create or replace function public.scs_message_recipients(p_message_id text)
returns table (user_id text, email text, kind text)
language plpgsql stable security definer set search_path = public, auth as $$
declare
  m record;
begin
  select * into m from public.messages where id::text = p_message_id;
  if m is null then return; end if;

  if m.sender = 'Coach' then
    -- para famílias: contas (por telemóvel) cujas inscrições aceites têm esse email
    return query
      with fams as (
        select r.email, r.phone from public.registrations r
          where r.status = 'accepted' and (m.family_email = 'all' or lower(r.email) = lower(m.family_email))
        union
        select a.email, a.phone from public.adult_registrations a
          where coalesce(a.status, 'pending') = 'accepted' and (m.family_email = 'all' or lower(a.email) = lower(m.family_email))
      ),
      emails as (select distinct lower(f.email) as email from fams f where f.email is not null),
      users_ as (
        select distinct u.id::text as user_id from auth.users u
        join fams f on public.scs_norm_phone(u.phone) = public.scs_norm_phone(f.phone)
        where u.phone is not null
      )
      select u.user_id, null::text, 'push'::text from users_ u
      union all
      select null::text, e.email, 'email'::text from emails e;
  else
    -- para treinadores: o treinador da conversa privada ou todos os treinadores ativos
    return query
      select c.id::text, c.email, 'both'::text from public.coaches c
      where coalesce(c.active, true)
        and (m.coach_id is null or c.id::text = m.coach_id::text)
        and c.id::text is distinct from m.sender_coach_id::text;
  end if;
end $$;

revoke all on function public.scs_message_recipients(text) from public, anon, authenticated;
revoke all on function public.scs_add_coach(text, text) from public, anon;
grant execute on function public.scs_add_coach(text, text) to authenticated;
grant execute on function public.scs_list_coaches() to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.scs_message_recipients(text) to service_role';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Funções existentes: a app considerava administradora a conta
--    joana.meireles@gmail.com mesmo sem role na tabela. Passa a ficar gravado.
-- ---------------------------------------------------------------------
update public.coaches set role = 'admin'
  where lower(email) = 'joana.meireles@gmail.com' and coalesce(role, '') <> 'admin';
update public.coaches set role = 'coach' where role is null;
