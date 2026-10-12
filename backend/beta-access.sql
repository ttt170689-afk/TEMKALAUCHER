-- Run AFTER backend/supabase.sql in your Supabase SQL Editor. No client secrets.
-- Idempotent migration. All authority comes from auth.uid()/creator_roles, never a nickname.
begin;
create table if not exists public.beta_codes (
 id uuid primary key default gen_random_uuid(), game_id text not null check(game_id in ('temkaworld','fantazia')),
 code_hash bytea not null unique, require_approval boolean not null default true,
 max_uses integer not null check(max_uses between 1 and 1000), uses integer not null default 0 check(uses>=0 and uses<=max_uses),
 expires_at timestamptz not null, revoked boolean not null default false,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.beta_access (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null check(game_id in ('temkaworld','fantazia')), code_id uuid not null references public.beta_codes(id),
 state text not null check(state in ('pending','approved','rejected','revoked')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), decided_by uuid references auth.users(id),
 unique(user_id,game_id)
);
create table if not exists public.beta_rate_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null, attempts integer not null
);
create table if not exists public.beta_audit (
 id bigint generated always as identity primary key, actor uuid not null references auth.users(id),
 action text not null, subject uuid not null, created_at timestamptz not null default now()
);
alter table public.beta_codes enable row level security;
alter table public.beta_access enable row level security;
alter table public.beta_rate_limits enable row level security;
alter table public.beta_audit enable row level security;
revoke all on public.beta_codes,public.beta_access,public.beta_rate_limits,public.beta_audit from public,anon,authenticated;
-- No direct table policies/grants; access only through tightly scoped RPC functions.
create or replace function public._beta_user() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
 if me is null or not exists(select 1 from auth.users u where u.id=me and u.email_confirmed_at is not null) then raise exception 'Подтверди почту в онлайн-профиле.'; end if;
 return me;
end;$$;
create or replace function public._beta_admin() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public._beta_user();
begin
 if not exists(select 1 from public.creator_roles r where r.user_id=me and r.role='creator_admin') then raise exception 'Только владелец может управлять бета-тестом.'; end if;
 return me;
end;$$;
create or replace function public.beta_status(p_game text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public._beta_user(); a public.beta_access;
begin
 if p_game is null or p_game not in ('temkaworld','fantazia') then raise exception 'Неизвестная игра.'; end if;
 select * into a from public.beta_access where user_id=me and game_id=p_game;
 return jsonb_build_object('game_id',p_game,'state',coalesce(a.state,'none'),'request_id',a.id,'updated_at',a.updated_at);
end;$$;
create or replace function public.beta_redeem(p_game text,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=public._beta_user(); c public.beta_codes; a public.beta_access; n integer; code text;
begin
 if p_game is null or p_game not in ('temkaworld','fantazia') then raise exception 'Неизвестная игра.'; end if;
 -- Per-user row lock serializes concurrent requests. Failures RETURN, not RAISE:
 -- otherwise PostgreSQL would roll back the attempt counter.
 insert into public.beta_rate_limits(user_id,window_start,attempts) values(me,now(),1)
 on conflict(user_id) do update set
 window_start=case when public.beta_rate_limits.window_start<=now()-interval '10 minutes' then now() else public.beta_rate_limits.window_start end,
 attempts=case when public.beta_rate_limits.window_start<=now()-interval '10 minutes' then 1 else least(public.beta_rate_limits.attempts+1,1000000) end
 returning attempts into n;
 if n>5 then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
 select * into a from public.beta_access where user_id=me and game_id=p_game;
 if found then return jsonb_build_object('ok',true,'status',public.beta_status(p_game)); end if;
 if p_code is null or length(p_code)>100 then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 code:=regexp_replace(upper(p_code),'[[:space:]-]','','g');
 if code !~ '^[A-Z0-9]{16,64}$' then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 select * into c from public.beta_codes where code_hash=sha256(convert_to(code,'UTF8')) for update;
 if not found or c.game_id<>p_game or c.revoked or c.expires_at<=now() or c.uses>=c.max_uses then
  return jsonb_build_object('ok',false,'error','invalid_code');
 end if;
 insert into public.beta_access(user_id,game_id,code_id,state) values(me,p_game,c.id,case when c.require_approval then 'pending' else 'approved' end);
 update public.beta_codes set uses=uses+1 where id=c.id;
 insert into public.beta_audit(actor,action,subject) values(me,'redeem',c.id);
 return jsonb_build_object('ok',true,'status',public.beta_status(p_game));
end;$$;
create or replace function public.beta_admin_issue(p_game text,p_approval boolean,p_limit integer,p_hours integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=public._beta_admin(); code text; c public.beta_codes;
begin
 if p_game is null or p_game not in ('temkaworld','fantazia') or p_approval is null or p_limit is null or p_limit not between 1 and 1000 or p_hours is null or p_hours not between 1 and 720 then raise exception 'Проверь игру, режим, лимит 1–1000 и срок 1–720 часов.'; end if;
 code:='TEMKA-'||upper(gen_random_uuid()::text);
 insert into public.beta_codes(game_id,code_hash,require_approval,max_uses,expires_at,created_by)
 values(p_game,sha256(convert_to(replace(code,'-',''),'UTF8')),p_approval,p_limit,now()+make_interval(hours=>p_hours),me) returning * into c;
 insert into public.beta_audit(actor,action,subject) values(me,'issue',c.id);
 return jsonb_build_object('id',c.id,'code',code,'game_id',c.game_id,'require_approval',c.require_approval,'max_uses',c.max_uses,'expires_at',c.expires_at);
end;$$;
create or replace function public.beta_admin_requests(p_game text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public._beta_admin();
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
 select a.id,a.game_id,a.user_id,a.state,a.created_at,a.updated_at,coalesce(p.username,'Онлайн-игрок') as username
 from public.beta_access a left join public.player_profiles p on p.id=a.user_id where a.game_id=p_game order by a.created_at desc limit 200
 )q),'[]'::jsonb);
end;$$;
create or replace function public.beta_admin_codes(p_game text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public._beta_admin();
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
 select id,game_id,require_approval,max_uses,uses,expires_at,revoked,created_at from public.beta_codes where game_id=p_game order by created_at desc limit 200
 )q),'[]'::jsonb);
end;$$;
create or replace function public.beta_admin_decide(p_request uuid,p_state text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=public._beta_admin(); a public.beta_access;
begin
 if p_state is null or p_state not in ('approved','rejected','revoked') then raise exception 'Недопустимое решение.'; end if;
 select * into a from public.beta_access where id=p_request for update;
 if not found then raise exception 'Заявка не найдена.'; end if;
 update public.beta_access set state=p_state,updated_at=now(),decided_by=me where id=a.id;
 insert into public.beta_audit(actor,action,subject) values(me,p_state,a.id);
 return jsonb_build_object('id',a.id,'state',p_state);
end;$$;
create or replace function public.beta_admin_revoke_code(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=public._beta_admin();
begin
 update public.beta_codes set revoked=true where id=p_id;
 if not found then raise exception 'Код не найден.'; end if;
 insert into public.beta_audit(actor,action,subject) values(me,'revoke_code',p_id);
 -- This prevents NEW requests only. Existing grants are revoked separately.
end;$$;
revoke all on function public._beta_user(),public._beta_admin(),public.beta_status(text),public.beta_redeem(text,text),public.beta_admin_issue(text,boolean,integer,integer),public.beta_admin_requests(text),public.beta_admin_codes(text),public.beta_admin_decide(uuid,text),public.beta_admin_revoke_code(uuid) from public,anon,authenticated;
grant execute on function public.beta_status(text),public.beta_redeem(text,text),public.beta_admin_issue(text,boolean,integer,integer),public.beta_admin_requests(text),public.beta_admin_codes(text),public.beta_admin_decide(uuid,text),public.beta_admin_revoke_code(uuid) to authenticated;
commit;
