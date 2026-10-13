-- Additive upgrade. Requires existing profiles/friends/beta schema. Run as project owner.
begin;
create table if not exists public.private_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.player_profiles(id) on delete cascade,
 receiver_id uuid not null references public.player_profiles(id) on delete cascade,
 body text not null check(length(btrim(body)) between 1 and 2000),
 client_nonce uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 check(sender_id<>receiver_id),unique(sender_id,client_nonce)
);
create index if not exists temka_dm_pair_time on public.private_messages(sender_id,receiver_id,created_at desc,id desc);
create index if not exists temka_dm_receiver_time on public.private_messages(receiver_id,created_at desc,id desc);
create table if not exists public.private_message_reads (
 user_id uuid references public.player_profiles(id) on delete cascade,
 peer_id uuid references public.player_profiles(id) on delete cascade,
 read_at timestamptz not null,read_id uuid not null,primary key(user_id,peer_id)
);
alter table public.private_messages enable row level security;
alter table public.private_message_reads enable row level security;
revoke all on public.private_messages,public.private_message_reads from public,anon,authenticated;

create or replace function public.dm_require_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
 if me is null or not exists(select 1 from auth.users u join public.player_profiles p on p.id=u.id where u.id=me and u.email_confirmed_at is not null) then raise exception 'Нужен подтверждённый онлайн-профиль.'; end if;
 return me;
end;
$$;
create or replace function public.dm_send(peer_id uuid,message_text text,nonce uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=public.dm_require_user(); prior public.private_messages; inserted public.private_messages;
begin
 if peer_id is null or peer_id=me or nonce is null or message_text is null or length(btrim(message_text)) not between 1 and 2000 then raise exception 'Сообщение: 1–2000 символов, только другому игроку.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text,190));
 select m.* into prior from public.private_messages m where m.sender_id=me and m.client_nonce=nonce;
 if found then
  if prior.receiver_id<>peer_id or prior.body<>btrim(message_text) then raise exception 'Повторный идентификатор другого сообщения.'; end if;
  return to_jsonb(prior)-'client_nonce';
 end if;
 if not exists(select 1 from auth.users u where u.id=peer_id and u.email_confirmed_at is not null) then raise exception 'Получатель недоступен.'; end if;
 perform f.id from public.friendships f where f.status='accepted' and ((f.requester_id=me and f.receiver_id=peer_id) or (f.requester_id=peer_id and f.receiver_id=me)) for share;
 if not found then raise exception 'Личные сообщения доступны только друзьям.'; end if;
 if (select count(*) from public.private_messages m where m.sender_id=me and m.created_at>clock_timestamp()-interval '1 minute')>=20 then raise exception 'Слишком много сообщений. Подожди минуту.'; end if;
 insert into public.private_messages(sender_id,receiver_id,body,client_nonce) values(me,peer_id,btrim(message_text),nonce) returning * into inserted;
 return to_jsonb(inserted)-'client_nonce';
end;
$$;
create or replace function public.dm_messages(peer_id uuid,before_time timestamptz default null,before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.dm_require_user(); result jsonb;
begin
 if peer_id is null or peer_id=me or (before_time is null)<>(before_id is null) then raise exception 'Некорректный диалог.'; end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]'::jsonb) into result from (
  select m.id,m.sender_id,m.receiver_id,m.body,m.created_at from public.private_messages m
  where ((m.sender_id=me and m.receiver_id=peer_id) or (m.sender_id=peer_id and m.receiver_id=me))
   and (before_time is null or (m.created_at,m.id)<(before_time,before_id))
  order by m.created_at desc,m.id desc limit 50
 ) t;
 return result;
end;
$$;
create or replace function public.dm_mark_read(peer_id uuid,message_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=public.dm_require_user(); stamp timestamptz;
begin
 select m.created_at into stamp from public.private_messages m where m.id=message_id and m.sender_id=peer_id and m.receiver_id=me;
 if not found then raise exception 'Сообщение не принадлежит этому диалогу.'; end if;
 insert into public.private_message_reads(user_id,peer_id,read_at,read_id) values(me,peer_id,stamp,message_id)
 on conflict on constraint private_message_reads_pkey do update set read_at=excluded.read_at,read_id=excluded.read_id
 where (public.private_message_reads.read_at,public.private_message_reads.read_id)<(excluded.read_at,excluded.read_id);
end;
$$;
create or replace function public.dm_threads() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.dm_require_user(); result jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(t) order by t.last_at desc nulls last,t.username),'[]'::jsonb) into result from (
  select p.id as peer_id,p.username,p.has_avatar,p.avatar_version,
   exists(select 1 from public.creator_roles r where r.user_id=p.id and r.role='creator_admin') as is_creator,
   exists(select 1 from public.friendships f join auth.users u on u.id=p.id and u.email_confirmed_at is not null where f.status='accepted' and ((f.requester_id=me and f.receiver_id=p.id) or(f.receiver_id=me and f.requester_id=p.id))) as can_send,
   left(lastmsg.body,180) as last_message,lastmsg.created_at as last_at,
   (select count(*) from public.private_messages m where m.sender_id=p.id and m.receiver_id=me and (reads.user_id is null or (m.created_at,m.id)>(reads.read_at,reads.read_id))) as unread
  from public.player_profiles p
  left join public.private_message_reads reads on reads.user_id=me and reads.peer_id=p.id
  left join lateral(select m.body,m.created_at from public.private_messages m where (m.sender_id=me and m.receiver_id=p.id) or (m.sender_id=p.id and m.receiver_id=me) order by m.created_at desc,m.id desc limit 1) lastmsg on true
  where p.id<>me and (lastmsg.created_at is not null or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=me and f.receiver_id=p.id) or(f.receiver_id=me and f.requester_id=p.id))))
  order by lastmsg.created_at desc nulls last,p.username limit 100
 ) t;
 return result;
end;
$$;

-- Activity is launcher-reported session state, NOT authoritative level/XP/playtime.
-- Both games remain disabled (Soon). Owner enables only with a genuinely tracked launch.
create table if not exists public.activity_catalog (
 game_id text primary key check(game_id in ('fantazia','temkaworld')),
 enabled boolean not null default false,requires_beta boolean not null default true
);
insert into public.activity_catalog(game_id) values('fantazia'),('temkaworld') on conflict do nothing;
create table if not exists public.game_activity_sessions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.player_profiles(id) on delete cascade,
 game_id text not null references public.activity_catalog(game_id),platform text not null check(platform in ('windows','linux','android','ios')),
 client_session uuid not null,started_at timestamptz not null default clock_timestamp(),last_seen_at timestamptz not null default clock_timestamp(),ended_at timestamptz,
 unique(user_id,client_session)
);
create index if not exists temka_activity_user_time on public.game_activity_sessions(user_id,started_at desc);
alter table public.activity_catalog enable row level security;
alter table public.game_activity_sessions enable row level security;
revoke all on public.activity_catalog,public.game_activity_sessions from public,anon,authenticated;
create or replace function public.activity_allowed(player_id uuid,game text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activity_catalog c join auth.users u on u.id=player_id and u.email_confirmed_at is not null where c.game_id=game and c.enabled and (
 not c.requires_beta or exists(select 1 from public.creator_roles r where r.user_id=player_id and r.role='creator_admin') or exists(select 1 from public.beta_access b where b.user_id=player_id and b.game_id=game and b.state='approved')));
$$;
create or replace function public.activity_start(game text,device_platform text,launch_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=public.dm_require_user(); row public.game_activity_sessions;
begin
 if launch_id is null or device_platform not in ('windows','linux','android','ios') or device_platform is null then raise exception 'Некорректный запуск.'; end if;
 if not public.activity_allowed(me,game) then raise exception 'Игра ещё недоступна или нет бета-доступа.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me::text,191));
 select s.* into row from public.game_activity_sessions s where s.user_id=me and s.client_session=launch_id;
 if found then
  if row.game_id<>game or row.platform<>device_platform then raise exception 'Запуск уже связан с другой игрой.'; end if;
  return to_jsonb(row)-'user_id'-'client_session';
 end if;
 if (select count(*) from public.game_activity_sessions s where s.user_id=me and s.started_at>now()-interval '1 minute')>=6 then raise exception 'Слишком частые запуски.'; end if;
 update public.game_activity_sessions set ended_at=least(clock_timestamp(),last_seen_at+interval '90 seconds') where user_id=me and ended_at is null;
 insert into public.game_activity_sessions(user_id,game_id,platform,client_session) values(me,game,device_platform,launch_id) returning * into row;
 return to_jsonb(row)-'user_id'-'client_session';
end;
$$;
create or replace function public.activity_touch(session_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare me uuid:=public.dm_require_user(); row public.game_activity_sessions;
begin
 select s.* into row from public.game_activity_sessions s where s.id=session_id and s.user_id=me and s.ended_at is null for update;
 if not found then return false; end if;
 if row.last_seen_at<clock_timestamp()-interval '90 seconds' or not public.activity_allowed(me,row.game_id) then
  update public.game_activity_sessions set ended_at=least(clock_timestamp(),last_seen_at+interval '90 seconds') where id=row.id;return false;
 end if;
 update public.game_activity_sessions set last_seen_at=clock_timestamp() where id=row.id;return true;
end;
$$;
create or replace function public.activity_stop(session_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare me uuid:=public.dm_require_user();
begin
 update public.game_activity_sessions s set ended_at=least(clock_timestamp(),s.last_seen_at+interval '90 seconds') where s.id=session_id and s.user_id=me and s.ended_at is null;
 return found;
end;
$$;
create or replace function public.get_player_activity(player_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.dm_require_user(); playing jsonb; history jsonb;
begin
 if not exists(select 1 from auth.users u join public.player_profiles p on p.id=u.id where u.id=player_id and u.email_confirmed_at is not null) then raise exception 'Игрок недоступен.'; end if;
 select jsonb_build_object('id',s.id,'game_id',s.game_id,'platform',s.platform,'started_at',s.started_at,'last_seen_at',s.last_seen_at) into playing from public.game_activity_sessions s
 where s.user_id=player_id and s.ended_at is null and s.last_seen_at>now()-interval '90 seconds' and public.activity_allowed(player_id,s.game_id)
 order by s.started_at desc limit 1;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at desc),'[]'::jsonb) into history from (
 select s.id,s.game_id,s.platform,s.started_at,s.last_seen_at,
  case when s.ended_at is not null then s.ended_at when s.last_seen_at<=now()-interval '90 seconds' then s.last_seen_at+interval '90 seconds' when not public.activity_allowed(player_id,s.game_id) then s.last_seen_at else null end as ended_at
 from public.game_activity_sessions s where s.user_id=player_id order by s.started_at desc limit 20) t;
 return jsonb_build_object('playing',playing,'history',history);
end;
$$;
revoke all on function public.dm_require_user(),public.activity_allowed(uuid,text) from public,anon,authenticated;
revoke all on function public.dm_send(uuid,text,uuid),public.dm_messages(uuid,timestamptz,uuid),public.dm_mark_read(uuid,uuid),public.dm_threads(),public.activity_start(text,text,uuid),public.activity_touch(uuid),public.activity_stop(uuid),public.get_player_activity(uuid) from public,anon;
grant execute on function public.dm_send(uuid,text,uuid),public.dm_messages(uuid,timestamptz,uuid),public.dm_mark_read(uuid,uuid),public.dm_threads(),public.activity_start(text,text,uuid),public.activity_touch(uuid),public.activity_stop(uuid),public.get_player_activity(uuid) to authenticated;
commit;
notify pgrst, 'reload schema';
select 'TEMKA_CHAT_ACTIVITY_READY' as result;
