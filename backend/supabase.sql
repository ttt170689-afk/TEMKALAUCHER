-- Temka Friends v1. Run once in your OWN new Supabase project's SQL Editor.
-- No secrets or email addresses belong in this file. Requires Supabase Auth + Storage.
begin;
create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-zA-Zа-яА-ЯёЁ0-9_]{3,25}$'),
  has_avatar boolean not null default false,
  avatar_version bigint not null default 0
);
create unique index if not exists player_username_unique on public.player_profiles (lower(username));
create table if not exists public.creator_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'creator_admin')
);
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.player_profiles(id) on delete cascade,
  receiver_id uuid not null references public.player_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> receiver_id)
);
create unique index if not exists friendship_pair_unique on public.friendships (least(requester_id,receiver_id), greatest(requester_id,receiver_id));
alter table public.player_profiles enable row level security;
alter table public.creator_roles enable row level security;
alter table public.friendships enable row level security;
-- Clients cannot read the whole directory, write role badges, or change profile IDs.
revoke all on public.player_profiles, public.creator_roles, public.friendships from anon, authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant update(status) on public.friendships to authenticated;
create policy friends_read on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, receiver_id));
create policy friends_invite on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and receiver_id <> auth.uid() and status = 'pending');
create policy friends_accept on public.friendships for update to authenticated
  using (receiver_id = auth.uid() and status = 'pending')
  with check (receiver_id = auth.uid() and status = 'accepted');
create policy friends_remove on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, receiver_id));

create or replace function public.set_username(new_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); name text := btrim(new_username);
begin
  if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null) then
    raise exception 'Сначала подтверди электронную почту.';
  end if;
  if name is null or name !~ '^[a-zA-Zа-яА-ЯёЁ0-9_]{3,25}$' then raise exception 'Юзернейм: 3–25 букв, цифр или подчёркиваний.'; end if;
  if lower(name) in ('temka_play_official','temka_play') and not exists(select 1 from public.creator_roles where user_id=me and role='creator_admin') then
    raise exception 'Этот юзернейм зарезервирован для создателя.';
  end if;
  insert into public.player_profiles(id,username) values(me,name)
    on conflict(id) do update set username=excluded.username;
exception when unique_violation then raise exception 'Этот онлайн-юзернейм уже занят.';
end;
$$;
create or replace function public.my_profile()
returns table(id uuid,username text,has_avatar boolean,avatar_version bigint,is_creator boolean)
language sql stable security definer set search_path='' as $$
  select p.id,p.username,p.has_avatar,p.avatar_version,exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin')
  from public.player_profiles p where p.id=auth.uid();
$$;
create or replace function public.find_player(exact_username text)
returns table(id uuid,username text,has_avatar boolean,avatar_version bigint,is_creator boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.player_profiles p where p.id=auth.uid()) then raise exception 'Сначала создай онлайн-профиль.'; end if;
  if exact_username is null or exact_username !~ '^[a-zA-Zа-яА-ЯёЁ0-9_]{3,25}$' then raise exception 'Нужен полный юзернейм.'; end if;
  return query select p.id,p.username,p.has_avatar,p.avatar_version,exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin')
    from public.player_profiles p where lower(p.username)=lower(exact_username) limit 1;
end;
$$;
create or replace function public.list_my_friends()
returns table(request_id uuid,requester_id uuid,receiver_id uuid,status text,other_id uuid,username text,has_avatar boolean,avatar_version bigint,is_creator boolean)
language sql stable security definer set search_path='' as $$
  select f.id,f.requester_id,f.receiver_id,f.status,p.id,p.username,p.has_avatar,p.avatar_version,
    exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin')
  from public.friendships f join public.player_profiles p on p.id=case when f.requester_id=auth.uid() then f.receiver_id else f.requester_id end
  where auth.uid() in (f.requester_id,f.receiver_id) order by f.created_at desc;
$$;
create or replace function public.set_avatar_visible(visible boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.player_profiles where id=auth.uid()) then raise exception 'Сначала создай онлайн-профиль.'; end if;
  if visible and not exists(select 1 from storage.objects where bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp') then raise exception 'Сначала загрузи изображение.'; end if;
  update public.player_profiles set has_avatar=visible, avatar_version=avatar_version+1 where id=auth.uid();
end;
$$;
revoke all on function public.set_username(text),public.my_profile(),public.find_player(text),public.list_my_friends(),public.set_avatar_visible(boolean) from public,anon;
grant execute on function public.set_username(text),public.my_profile(),public.find_player(text),public.list_my_friends(),public.set_avatar_visible(boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,1048576,array['image/webp'])
on conflict(id) do nothing;
-- Only the authenticated owner can upload, replace or delete this canonical file.
create policy temka_avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp' and exists(select 1 from public.my_profile()));
create policy temka_avatar_update on storage.objects for update to authenticated
  using (bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp')
  with check (bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
create policy temka_avatar_read_own on storage.objects for select to authenticated
  using (bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
create policy temka_avatar_delete on storage.objects for delete to authenticated
  using (bucket_id='avatars' and name=auth.uid()::text||'/avatar.webp');
commit;

-- Creator badge is provisioned ONLY in the privileged SQL Editor after you verify
-- your own email in the launcher. Never expose a service_role/sb_secret key.
-- Use the authenticated user's UUID obtained from Auth -> Users, NOT their nickname.
-- Example with a deliberately NON-executable placeholder:
-- insert into public.creator_roles(user_id,role) values ('YOUR_VERIFIED_AUTH_USER_UUID','creator_admin');
-- Then save the online username temka_play_official in the launcher.
-- Existing local profiles/passwords are NOT uploaded or silently migrated.
