"""LOCAL ONLY: requires an EMPTY disposable PostgreSQL DB; never run in Supabase.
Run using pg_virtualenv /usr/bin/python3 ... after creating a disposable database.
TEMKA_SETUP_SQL must point to the baseline Temka-Launcher-Server-Setup.sql.
"""
import os, uuid
from pathlib import Path
import psycopg2
conn=psycopg2.connect(dbname=os.environ['TEMKA_TEST_DB']);conn.autocommit=True
cur=conn.cursor();count=0

def ok(msg,result):
 global count
 assert result,msg
 count+=1;print('PASS',msg)
def sql(text,args=None):cur.execute(text,args);return cur.fetchall() if cur.description else cur.rowcount
def as_user(uid,text,args=None,role='authenticated'):
 c=conn.cursor()
 try:
  c.execute('begin');c.execute('set local role '+role);c.execute("select set_config('request.jwt.claim.sub',%s,true)",(uid or '',));c.execute(text,args)
  result=c.fetchall() if c.description else c.rowcount;c.execute('commit');return result
 except: c.execute('rollback');raise
 finally:c.close()
def denied(msg,action):
 try:action()
 except psycopg2.Error:ok(msg,True)
 else:ok(msg,False)
# Refuse an existing schema: no destructive test setup.
sql('create schema auth;create schema storage;')
for role in ['anon','authenticated']:
 if not sql('select 1 from pg_roles where rolname=%s',(role,)):sql('create role '+role+' nologin')
sql('create table auth.users(id uuid primary key,email_confirmed_at timestamptz);')
sql("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;")
sql('grant usage on schema auth,public,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;')
sql('alter default privileges in schema public revoke execute on functions from public;')
sql('create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;')
sql(Path(os.environ['TEMKA_SETUP_SQL']).read_text())
migration=Path(__file__).with_name('friend-notifications.sql').read_text();sql(migration);sql(migration);ok('verified-friends migration can run twice',True)
a,b,c=[str(uuid.uuid4()) for _ in range(3)]
for uid,name in [(a,'TesterA'),(b,'TesterB'),(c,'TesterC')]:
 sql('insert into auth.users values(%s,now())',(uid,));as_user(uid,'select public.set_username(%s)',(name,))
ok('confirmed account can create online profile',as_user(a,'select username from public.my_profile()')==[('TesterA',)])
ok('confirmed account can find friend',as_user(a,"select username from public.find_player('TesterB')")==[('TesterB',)])
rid=as_user(a,"insert into public.friendships(requester_id,receiver_id,status) values(%s,%s,'pending') returning id",(a,b))[0][0]
rows=as_user(b,'select requester_id,receiver_id,status,username from public.list_my_friends()');ok('recipient sees real sender and pending request',rows==[(a,b,'pending','TesterA')])
ok('unrelated user cannot read request',as_user(c,'select * from public.friendships')==[])
ok('sender cannot accept own request',as_user(a,"update public.friendships set status='accepted' where id=%s returning id",(rid,))==[])
ok('unrelated user cannot accept request',as_user(c,"update public.friendships set status='accepted' where id=%s returning id",(rid,))==[])
ok('unrelated user cannot delete request',as_user(c,'delete from public.friendships where id=%s returning id',(rid,))==[])
sql('update auth.users set email_confirmed_at=null where id=%s',(b,))
ok('unconfirmed account sees no own profile',as_user(b,'select * from public.my_profile()')==[])
denied('unconfirmed cannot use friends RPC',lambda:as_user(b,'select * from public.list_my_friends()'))
denied('unconfirmed cannot search players',lambda:as_user(b,"select * from public.find_player('TesterA')"))
ok('unconfirmed profile excluded from search',as_user(a,"select * from public.find_player('TesterB')")==[])
ok('direct table read blocked without confirmed email',as_user(b,'select * from public.friendships')==[])
ok('direct accept blocked without confirmed email',as_user(b,"update public.friendships set status='accepted' where id=%s returning id",(rid,))==[])
ok('direct reject blocked without confirmed email',as_user(b,'delete from public.friendships where id=%s returning id',(rid,))==[])
denied('direct invite blocked without confirmed email',lambda:as_user(b,"insert into public.friendships(requester_id,receiver_id,status) values(%s,%s,'pending')",(b,c)))
sql('update auth.users set email_confirmed_at=now() where id=%s',(b,))
ok('recipient accepts once after email confirmation',len(as_user(b,"update public.friendships set status='accepted' where id=%s and status='pending' returning id",(rid,)))==1)
ok('both see accepted friendship',as_user(a,'select status from public.list_my_friends()')==[('accepted',)] and as_user(b,'select status from public.list_my_friends()')==[('accepted',)])
ok('stale pending rejection cannot remove accepted friendship',as_user(b,"delete from public.friendships where id=%s and status='pending' returning id",(rid,))==[])
rid2=as_user(a,"insert into public.friendships(requester_id,receiver_id,status) values(%s,%s,'pending') returning id",(a,c))[0][0]
ok('recipient can reject pending request',len(as_user(c,"delete from public.friendships where id=%s and status='pending' returning id",(rid2,)))==1)
ok('rejection really removes notification',as_user(c,'select * from public.list_my_friends()')==[])
rid3=as_user(c,"insert into public.friendships(requester_id,receiver_id,status) values(%s,%s,'pending') returning id",(c,b))[0][0]
ok('sender can cancel outgoing request',len(as_user(c,"delete from public.friendships where id=%s and status='pending' returning id",(rid3,)))==1)
sql(migration);ok('rerun preserves accepted friendship',as_user(b,'select status from public.list_my_friends()')==[('accepted',)])
denied('anonymous cannot use list RPC',lambda:as_user(None,'select * from public.list_my_friends()',role='anon'))
denied('ordinary user cannot assign admin role',lambda:as_user(a,"insert into public.creator_roles values(%s,'creator_admin')",(a,)))
print('ALL',count,'LOCAL FRIENDS SQL CHECKS PASSED')
