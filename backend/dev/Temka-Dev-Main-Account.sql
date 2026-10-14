-- Separate DEV project ONLY. Bridge for verified MAIN-account identity.
-- Requires initial Dev schema. Never run on the working launcher server.
-- Identity parameters below are trusted ONLY because RPC access is service_role-only.
-- Deploy the dev-gateway Edge Function; never put service_role in a launcher.
begin;
do $$ begin
 if to_regclass('public.dev_members') is null or to_regclass('public.dev_builds') is null
  or to_regclass('public.player_profiles') is not null then
  raise exception 'Open the separate existing Dev project, not the working launcher project.';
 end if;
end $$;
create table if not exists public.dev_main_members (
 user_id uuid primary key, -- MAIN Auth UID; deliberately NOT a foreign key to Dev Auth.
 slot text not null unique check(slot in ('owner','tester')),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.dev_main_invites (
 id uuid primary key default gen_random_uuid(),
 code_hash bytea not null unique,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 used_by uuid,
 used_at timestamptz,
 revoked boolean not null default false,
 check(expires_at>created_at)
);
create table if not exists public.dev_main_attempts (
 user_id uuid primary key, window_start timestamptz not null, attempts integer not null check(attempts>=1)
);
alter table public.dev_main_members enable row level security;
alter table public.dev_main_invites enable row level security;
alter table public.dev_main_attempts enable row level security;
revoke all on public.dev_main_members,public.dev_main_invites,public.dev_main_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.dev_main_members,public.dev_main_invites,public.dev_main_attempts to service_role;

-- Disable direct Dev-auth catalogue/storage access. Gateway validates MAIN token.
-- Restrictive policies block all old permissive policies for authenticated users.
drop policy if exists dev_gateway_catalogue_only on public.dev_builds;
create policy dev_gateway_catalogue_only on public.dev_builds as restrictive for all to authenticated using(false) with check(false);
drop policy if exists dev_gateway_storage_only on storage.objects;
create policy dev_gateway_storage_only on storage.objects as restrictive for all to authenticated
 using(bucket_id<>'temka-dev') with check(bucket_id<>'temka-dev');
update storage.buckets set public=false where id='temka-dev';
-- Old separate-Dev-account invites no longer admit users to this channel.
do $$ begin
 if to_regprocedure('public.dev_redeem_invite(text)') is not null then
  revoke execute on function public.dev_redeem_invite(text),public.dev_owner_issue_invite(integer),public.dev_owner_revoke_tester(),public.dev_owner_revoke_invite(uuid),public.dev_owner_list_invites() from authenticated;
 end if;
end $$;

create or replace function public._dev_main_issue(owner_uid uuid,hours integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare code text; item public.dev_main_invites;
begin
 if hours is null or hours not between 1 and 72 then raise exception 'Invalid lifetime.'; end if;
 lock table public.dev_main_members in share row exclusive mode;
 if not exists(select 1 from public.dev_main_members where user_id=owner_uid and slot='owner' and enabled) then
  return jsonb_build_object('ok',false,'error','owner_only');
 end if;
 if exists(select 1 from public.dev_main_members where slot='tester') then return jsonb_build_object('ok',false,'error','tester_slot_taken'); end if;
 update public.dev_main_invites set revoked=true where used_at is null and not revoked;
 code:='TEMKADEV-'||replace(upper(gen_random_uuid()::text),'-','')||replace(upper(gen_random_uuid()::text),'-','');
 insert into public.dev_main_invites(code_hash,created_by,expires_at)
 values(sha256(convert_to(replace(code,'-',''),'UTF8')),owner_uid,now()+make_interval(hours=>hours)) returning * into item;
 return jsonb_build_object('ok',true,'code',code,'id',item.id,'expires_at',item.expires_at);
end;
$$;
revoke all on function public._dev_main_issue(uuid,integer) from public,anon,authenticated,service_role;

create or replace function public.dev_main_action(p_uid uuid,p_email text,p_action text,p_code text default null,p_build_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member public.dev_main_members; invite public.dev_main_invites; normalized text; n integer; build public.dev_builds;
begin
 if p_uid is null or p_email is null or length(p_email)>254 then raise exception 'Verified main identity required.'; end if;
 -- One-time bootstrap only: both mailboxes were confirmed by their own Auth servers.
 -- Once linked, owner is identified by MAIN UID only; no nickname or client flag.
 lock table public.dev_main_members in share row exclusive mode;
 if not exists(select 1 from public.dev_main_members where slot='owner') and exists(
  select 1 from public.dev_members m join auth.users u on u.id=m.user_id
  where m.slot='owner' and m.enabled and u.email_confirmed_at is not null
   and lower(u.email)=lower(btrim(p_email))
 ) then
  insert into public.dev_main_members(user_id,slot) values(p_uid,'owner');
 end if;
 select * into member from public.dev_main_members where user_id=p_uid;
 if p_action='status' then
  return jsonb_build_object('ok',true,'allowed',coalesce(member.enabled,false),'owner',coalesce(member.enabled and member.slot='owner',false),'channel','dev');
 end if;
 if p_action='redeem' then
  if coalesce(member.enabled,false) then return jsonb_build_object('ok',true,'allowed',true,'owner',member.slot='owner','channel','dev'); end if;
  insert into public.dev_main_attempts(user_id,window_start,attempts) values(p_uid,now(),1)
  on conflict(user_id) do update set
   window_start=case when public.dev_main_attempts.window_start<=now()-interval '10 minutes' then now() else public.dev_main_attempts.window_start end,
   attempts=case when public.dev_main_attempts.window_start<=now()-interval '10 minutes' then 1 else least(public.dev_main_attempts.attempts+1,1000000) end returning attempts into n;
  if n>5 then return jsonb_build_object('ok',false,'error','rate_limited'); end if;
  if p_code is null or length(p_code)>100 then return jsonb_build_object('ok',false,'error','invalid_invite'); end if;
  normalized:=regexp_replace(upper(p_code),'[[:space:]-]','','g');
  if normalized !~ '^TEMKADEV[A-F0-9]{64}$' then return jsonb_build_object('ok',false,'error','invalid_invite'); end if;
  select * into invite from public.dev_main_invites where code_hash=sha256(convert_to(normalized,'UTF8')) for update;
  if not found or invite.revoked or invite.used_at is not null or invite.expires_at<=now() or not exists(
   select 1 from public.dev_main_members where user_id=invite.created_by and slot='owner' and enabled
  ) then return jsonb_build_object('ok',false,'error','invalid_invite'); end if;
  if exists(select 1 from public.dev_main_members where slot='tester') then return jsonb_build_object('ok',false,'error','tester_slot_taken'); end if;
  insert into public.dev_main_members(user_id,slot) values(p_uid,'tester');
  update public.dev_main_invites set used_at=now(),used_by=p_uid where id=invite.id;
  return jsonb_build_object('ok',true,'allowed',true,'owner',false,'channel','dev');
 end if;
 if not coalesce(member.enabled,false) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 if p_action='issue' then return public._dev_main_issue(p_uid,24); end if;
 if p_action='revoke_tester' then
  if member.slot<>'owner' then return jsonb_build_object('ok',false,'error','owner_only'); end if;
  delete from public.dev_main_members where slot='tester';
  update public.dev_main_invites set revoked=true where used_at is null;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='builds' then
  return jsonb_build_object('ok',true,'builds',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from
   (select * from public.dev_builds where published or member.slot='owner' order by created_at desc limit 100) b),'[]'::jsonb));
 end if;
 if p_action='download' then
  select * into build from public.dev_builds where id=p_build_id and (published or member.slot='owner');
  if not found then return jsonb_build_object('ok',false,'error','build_not_found'); end if;
  return jsonb_build_object('ok',true,'build',to_jsonb(build));
 end if;
 return jsonb_build_object('ok',false,'error','unknown_action');
end;
$$;
revoke all on function public.dev_main_action(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.dev_main_action(uuid,text,text,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
select 'TEMKA_DEV_MAIN_ACCOUNT_READY' as result;
