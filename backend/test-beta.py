"""Local PostgreSQL integration tests. Run only against a disposable, empty test DB.
Not against a real Supabase project! Uses mock auth schema/roles for JWT identity.
Requires psycopg[binary]; TEST_DATABASE_URL must explicitly select the disposable DB.
"""
import os,uuid,concurrent.futures
from pathlib import Path
import psycopg
DSN=os.environ['TEST_DATABASE_URL'];db=psycopg.connect(DSN,autocommit=True);count=0

def check(label,value):
 global count
 assert value,label
 count+=1;print('PASS',label)

def user(name='Tester',confirmed=True,admin=False):
 uid=str(uuid.uuid4());db.execute('insert into auth.users(id,email_confirmed_at) values(%s,case when %s then now() else null end)',(uid,confirmed));db.execute('insert into public.player_profiles values(%s,%s)',(uid,name))
 if admin:db.execute("insert into public.creator_roles values(%s,'creator_admin')",(uid,))
 return uid

def rpc(uid,name,*args,role='authenticated'):
 with psycopg.connect(DSN) as c:
  with c.cursor() as cur:
   cur.execute('set local role '+role);cur.execute("select set_config('request.jwt.claim.sub',%s,true)",(uid or '',));cur.execute('select public.'+name+'('+','.join(['%s']*len(args))+')',args);return cur.fetchone()[0]

def denied(label,job):
 try:job()
 except psycopg.Error:check(label,True)
 else:check(label,False)

# Must be an empty test database: fail rather than destroy or rewrite existing auth.
db.execute('create schema auth');
for role in ['anon','authenticated']:
 if not db.execute('select 1 from pg_roles where rolname=%s',(role,)).fetchone():db.execute('create role '+role+' nologin')
db.execute('create table auth.users(id uuid primary key,email_confirmed_at timestamptz)');db.execute("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$")
db.execute('create table public.player_profiles(id uuid primary key references auth.users,username text)');db.execute('create table public.creator_roles(user_id uuid primary key references auth.users,role text)')
migration=Path(__file__).with_name('beta-access.sql').read_text();db.execute(migration);db.execute(migration);check('migration reruns safely',True)
owner=user('Owner',admin=True);fake=user('temka_play_official');a=user();b=user();unconfirmed=user(confirmed=False)
denied('local creator nickname cannot issue codes',lambda:rpc(fake,'beta_admin_issue','fantazia',True,1,72))
denied('ordinary user cannot list requests',lambda:rpc(a,'beta_admin_requests','fantazia'))
denied('ordinary user cannot list codes',lambda:rpc(a,'beta_admin_codes','fantazia'))
denied('unconfirmed email cannot redeem',lambda:rpc(unconfirmed,'beta_redeem','fantazia','TEMKA-00000000000000000000000000000000'))
denied('anonymous cannot read status',lambda:rpc(None,'beta_status','fantazia',role='anon'))
for table in ['beta_codes','beta_access','beta_rate_limits','beta_audit']:
 try:
  with psycopg.connect(DSN) as c:c.execute('set local role authenticated');c.execute('select * from public.'+table)
 except psycopg.Error:check('table inaccessible: '+table,True)
 else:check('table inaccessible: '+table,False)
manual=rpc(owner,'beta_admin_issue','fantazia',True,2,72);check('server creates random code',manual['code'].startswith('TEMKA-'))
r=rpc(a,'beta_redeem','fantazia',manual['code'].lower().replace('-',' '));check('valid manual code stays pending',r['ok'] and r['status']['state']=='pending');rid=r['status']['request_id']
check('retry idempotent',rpc(a,'beta_redeem','fantazia',manual['code'])['status']['request_id']==rid)
check('retry consumes no extra slot',db.execute('select uses from public.beta_codes where id=%s',(manual['id'],)).fetchone()[0]==1)
check('other user cannot see grant',rpc(b,'beta_status','fantazia')['state']=='none')
denied('ordinary user cannot approve own request',lambda:rpc(a,'beta_admin_decide',rid,'approved'))
rpc(owner,'beta_admin_decide',rid,'approved');check('owner approval persists',rpc(a,'beta_status','fantazia')['state']=='approved')
rpc(owner,'beta_admin_decide',rid,'revoked');check('owner revoke persists',rpc(a,'beta_status','fantazia')['state']=='revoked')
auto=rpc(owner,'beta_admin_issue','fantazia',False,1,72);check('revoked user cannot bypass with a new code',rpc(a,'beta_redeem','fantazia',auto['code'])['status']['state']=='revoked')
check('automatic code approves without manual decision',rpc(b,'beta_redeem','fantazia',auto['code'])['status']['state']=='approved')
check('quota exhaustion rejected',rpc(user(),'beta_redeem','fantazia',auto['code'])=={'ok':False,'error':'invalid_code'})
check('game binding enforced',rpc(user(),'beta_redeem','temkaworld',manual['code'])=={'ok':False,'error':'invalid_code'})
expired=rpc(owner,'beta_admin_issue','fantazia',False,1,1);db.execute("update public.beta_codes set expires_at=now()-interval '1 second' where id=%s",(expired['id'],));check('expired code rejected',rpc(user(),'beta_redeem','fantazia',expired['code'])['error']=='invalid_code')
revoked=rpc(owner,'beta_admin_issue','fantazia',False,1,72);rpc(owner,'beta_admin_revoke_code',revoked['id']);check('disabled code rejected',rpc(user(),'beta_redeem','fantazia',revoked['code'])['error']=='invalid_code')
limited=user();valid=rpc(owner,'beta_admin_issue','fantazia',False,1,72)
for i in range(5):check('invalid attempt counted '+str(i+1),rpc(limited,'beta_redeem','fantazia','TEMKA-'+('F'*32))['error']=='invalid_code')
check('sixth attempt rate limited even with valid code',rpc(limited,'beta_redeem','fantazia',valid['code'])['error']=='rate_limited')
db.execute("update public.beta_rate_limits set window_start=now()-interval '11 minutes' where user_id=%s",(limited,));check('window resets',rpc(limited,'beta_redeem','fantazia',valid['code'])['status']['state']=='approved')
concurrent_code=rpc(owner,'beta_admin_issue','temkaworld',False,1,72);players=[user() for _ in range(12)]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: results=list(pool.map(lambda u:rpc(u,'beta_redeem','temkaworld',concurrent_code['code']),players))
check('12 concurrent users cannot overspend 1 slot',sum(r.get('ok') is True for r in results)==1)
check('counter consistent',db.execute('select uses from public.beta_codes where id=%s',(concurrent_code['id'],)).fetchone()[0]==1)
check('hash never returned by admin listing',all('code_hash' not in x and 'code' not in x for x in rpc(owner,'beta_admin_codes','fantazia')))
check('audit actions recorded',db.execute('select count(*) from public.beta_audit').fetchone()[0]>=10)
print('ALL',count,'POSTGRESQL BETA CHECKS PASSED')
