-- Temka1.8: additive public player cards and trusted game stats. Run as project owner.
-- Existing accounts, role grants, usernames, avatars, friendships and beta grants are preserved.
begin;
alter table public.player_profiles add column if not exists display_name text not null default '';
alter table public.player_profiles add column if not exists bio text not null default '';
alter table public.player_profiles add column if not exists avatar_style text not null default 'cube';
alter table public.player_profiles add column if not exists avatar_color text not null default '#63e6be';
create table if not exists public.player_game_stats (
 user_id uuid not null references public.player_profiles(id) on delete cascade,
 game_id text not null check(game_id in ('fantazia','temkaworld')),
 level integer check(level between 0 and 1000000),
 play_seconds bigint check(play_seconds between 0 and 3155760000),
 last_played_at timestamptz,
 achievements jsonb not null default '[]'::jsonb check(jsonb_typeof(achievements)='array' and jsonb_array_length(achievements)<=200),
 achievements_total integer check(achievements_total between 0 and 100000),
 updated_at timestamptz not null default now(),
 primary key(user_id,game_id)
);
alter table public.player_game_stats enable row level security;
revoke all on public.player_game_stats from public,anon,authenticated;
grant select,insert,update,delete on public.player_game_stats to service_role;
-- No client write RPC for levels, hours or achievements. Only trusted game backend writes stats.
create or replace function public.search_players(query_text text)
returns table(id uuid,username text,has_avatar boolean,avatar_version bigint,is_creator boolean)
language plpgsql stable security definer set search_path='' as $$
declare q text:=lower(ltrim(btrim(query_text),'@'));
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Сначала подтверди почту.'; end if;
 if q is null or q !~ '^[a-zа-яё0-9_]{2,25}$' then raise exception 'Введи от 2 до 25 букв, цифр или подчёркиваний.'; end if;
 return query select p.id,p.username,p.has_avatar,p.avatar_version,exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin')
 from public.player_profiles p join auth.users u on u.id=p.id and u.email_confirmed_at is not null
 where strpos(lower(p.username),q)>0
 order by (lower(p.username)=q) desc,(strpos(lower(p.username),q)=1) desc,lower(p.username),p.id limit 20;
end;
$$;
create or replace function public.get_player_card(player_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Сначала подтверди почту.'; end if;
 select jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'bio',p.bio,
 'has_avatar',p.has_avatar,'avatar_version',p.avatar_version,'avatar_style',p.avatar_style,'avatar_color',p.avatar_color,
 'is_creator',exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin'),
 'games',coalesce((select jsonb_agg(jsonb_build_object('game_id',g.game_id,'level',g.level,'play_seconds',g.play_seconds,
 'last_played_at',g.last_played_at,'achievements',g.achievements,'achievements_total',g.achievements_total,'updated_at',g.updated_at) order by g.game_id)
 from public.player_game_stats g where g.user_id=p.id),'[]'::jsonb)) into result
 from public.player_profiles p join auth.users u on u.id=p.id and u.email_confirmed_at is not null where p.id=player_id;
 return result;
end;
$$;
create or replace function public.save_player_card(new_display_name text,new_bio text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Сначала подтверди почту.'; end if;
 if new_display_name is null or length(btrim(new_display_name)) not between 1 and 25 or new_bio is null or length(new_bio)>160 then raise exception 'Имя: 1–25 символов, о себе: до 160.'; end if;
 if lower(btrim(new_display_name)) in ('temka_play','temka_play_official') and not exists(select 1 from public.creator_roles r where r.user_id=auth.uid() and r.role='creator_admin') then raise exception 'Это имя зарезервировано для создателя.'; end if;
 update public.player_profiles set display_name=btrim(new_display_name),bio=btrim(new_bio) where id=auth.uid();
 if not found then raise exception 'Сначала сохрани онлайн-юзернейм.'; end if;
 return public.get_player_card(auth.uid());
end;
$$;
create or replace function public.set_player_avatar_style(new_style text,new_color text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'Сначала подтверди почту.'; end if;
 if new_style is null or new_style not in ('cube','knight','mage','demon','bot','ghost','cat','crown') or new_color is null or new_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Некорректный аватар.'; end if;
 update public.player_profiles set avatar_style=new_style,avatar_color=new_color,has_avatar=false,avatar_version=avatar_version+1 where id=auth.uid();
 if not found then raise exception 'Сначала сохрани онлайн-юзернейм.'; end if;
end;
$$;
revoke all on function public.search_players(text),public.get_player_card(uuid),public.save_player_card(text,text),public.set_player_avatar_style(text,text) from public,anon;
grant execute on function public.search_players(text),public.get_player_card(uuid),public.save_player_card(text,text),public.set_player_avatar_style(text,text) to authenticated;
commit;
select 'TEMKA_PLAYER_PROFILES_READY' as result;
