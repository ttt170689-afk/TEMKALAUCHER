-- Temka: подтверждённая почта для друзей и уведомлений.
-- Выполнить целиком в SQL Editor своего уже настроенного проекта, роль postgres.
-- Сначала должен быть выполнен Temka-Launcher-Server-Setup.sql.
-- Не удаляет пользователей, друзей, заявки или бета-коды. Можно выполнить повторно.
-- Не включает отправку писем: SMTP и шаблоны OTP настраиваются отдельно.
begin;
create or replace function public.temka_email_verified() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function public.temka_email_verified() from public,anon;
grant execute on function public.temka_email_verified() to authenticated;
-- Restrictive policy applies in addition to the existing per-user friendship policies.
do $temka$
begin
  if not exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='friendships' and policyname='temka_friends_verified_only') then
    create policy temka_friends_verified_only on public.friendships as restrictive for all to authenticated
      using(public.temka_email_verified()) with check(public.temka_email_verified());
  end if;
end;
$temka$;
create or replace function public.my_profile()
returns table(id uuid,username text,has_avatar boolean,avatar_version bigint,is_creator boolean)
language sql stable security definer set search_path='' as $$
  select p.id,p.username,p.has_avatar,p.avatar_version,exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin')
  from public.player_profiles p where p.id=auth.uid() and public.temka_email_verified();
$$;
create or replace function public.find_player(exact_username text)
returns table(id uuid,username text,has_avatar boolean,avatar_version bigint,is_creator boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.temka_email_verified() then raise exception 'Сначала подтверди почту.'; end if;
  if not exists(select 1 from public.player_profiles p where p.id=auth.uid()) then raise exception 'Сначала создай онлайн-профиль.'; end if;
  if exact_username is null or exact_username !~ '^[a-zA-Zа-яА-ЯёЁ0-9_]{3,25}$' then raise exception 'Нужен полный юзернейм.'; end if;
  return query select p.id,p.username,p.has_avatar,p.avatar_version,exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin')
    from public.player_profiles p join auth.users u on u.id=p.id
    where lower(p.username)=lower(exact_username) and u.email_confirmed_at is not null limit 1;
end;
$$;
create or replace function public.list_my_friends()
returns table(request_id uuid,requester_id uuid,receiver_id uuid,status text,other_id uuid,username text,has_avatar boolean,avatar_version bigint,is_creator boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.temka_email_verified() then raise exception 'Сначала подтверди почту.'; end if;
  return query select f.id,f.requester_id,f.receiver_id,f.status,p.id,p.username,p.has_avatar,p.avatar_version,
    exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin')
  from public.friendships f join public.player_profiles p on p.id=case when f.requester_id=auth.uid() then f.receiver_id else f.requester_id end
  where auth.uid() in (f.requester_id,f.receiver_id) order by f.created_at desc;
end;
$$;
revoke all on function public.my_profile(),public.find_player(text),public.list_my_friends() from public,anon;
grant execute on function public.my_profile(),public.find_player(text),public.list_my_friends() to authenticated;
notify pgrst,'reload schema';
commit;
select 'TEMKA_NOTIFICATIONS_READY' as result;
