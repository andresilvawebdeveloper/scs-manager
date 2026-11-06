-- =====================================================================
-- SCS Manager — fotografias privadas
-- Antes: as pastas athlete-photos e avatars eram públicas e qualquer pessoa
-- podia listar e descarregar as fotografias (incluindo de menores).
-- Depois: pastas privadas; cada fotografia só é vista por:
--   • treinadores ativos (todas);
--   • o encarregado do atleta (athlete-photos/photos/<id da inscrição>_...);
--   • o próprio aluno adulto (avatars/adult-photos/<id do adulto>_...);
--   • fotografias dos treinadores (avatars/coach-photos/...): qualquer pessoa com sessão.
-- Requer a nova versão da app (pede endereços temporários às fotografias).
-- Pode ser executado mais do que uma vez.
-- =====================================================================

-- Ids das inscrições de adultos cujo telemóvel coincide com o da sessão
create or replace function public.scs_my_adult_ids()
returns setof text language sql stable security definer set search_path = public as $$
  select a.id::text from public.adult_registrations a
  where public.scs_session_phone() is not null
    and public.scs_norm_phone(a.phone) = public.scs_session_phone()
$$;

-- A fotografia pertence à família/aluno/treinador com sessão?
create or replace function public.scs_can_access_photo(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.scs_is_coach() then true
    when p_bucket = 'athlete-photos' then exists (
      select 1 from public.scs_my_registration_ids() rid where starts_with(p_name, 'photos/' || rid || '_'))
    when p_bucket = 'avatars' and starts_with(p_name, 'adult-photos/') then exists (
      select 1 from public.scs_my_adult_ids() aid where starts_with(p_name, 'adult-photos/' || aid || '_'))
    else false
  end
$$;

-- Pode enviar/alterar esta fotografia?
create or replace function public.scs_can_write_photo(p_bucket text, p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when p_bucket = 'avatars' and starts_with(p_name, 'coach-photos/') then
      public.scs_is_coach() and starts_with(p_name, 'coach-photos/' || auth.uid()::text || '_')
    else public.scs_can_access_photo(p_bucket, p_name)
  end
$$;

-- 1. Pastas privadas
update storage.buckets set public = false where id in ('athlete-photos', 'avatars');

-- 2. Apagar as regras antigas destas pastas (e regras genéricas sem pasta definida)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (
        coalesce(qual, '') || coalesce(with_check, '') ilike '%athlete-photos%'
        or coalesce(qual, '') || coalesce(with_check, '') ilike '%avatars%'
        or coalesce(qual, '') || coalesce(with_check, '') not ilike '%bucket_id%'
      )
  loop
    raise notice 'A remover regra antiga: %', pol.policyname;
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- 3. Regras novas
create policy scs_photos_select on storage.objects
  for select to authenticated using (
    (bucket_id = 'avatars' and starts_with(name, 'coach-photos/'))
    or (bucket_id in ('athlete-photos', 'avatars') and public.scs_can_access_photo(bucket_id, name))
  );
create policy scs_photos_insert on storage.objects
  for insert to authenticated with check (
    bucket_id in ('athlete-photos', 'avatars') and public.scs_can_write_photo(bucket_id, name)
  );
create policy scs_photos_update on storage.objects
  for update to authenticated
  using (bucket_id in ('athlete-photos', 'avatars') and public.scs_can_write_photo(bucket_id, name))
  with check (bucket_id in ('athlete-photos', 'avatars') and public.scs_can_write_photo(bucket_id, name));
create policy scs_photos_delete on storage.objects
  for delete to authenticated using (
    bucket_id in ('athlete-photos', 'avatars') and public.scs_can_write_photo(bucket_id, name)
  );

-- 4. Funções de apoio: só para quem tem sessão
revoke all on function public.scs_my_adult_ids() from public, anon;
revoke all on function public.scs_can_access_photo(text, text) from public, anon;
revoke all on function public.scs_can_write_photo(text, text) from public, anon;
grant execute on function public.scs_my_adult_ids() to authenticated;
grant execute on function public.scs_can_access_photo(text, text) to authenticated;
grant execute on function public.scs_can_write_photo(text, text) to authenticated;
