"""LOCAL ONLY. Empty disposable PostgreSQL DB. Never production."""
import os,uuid,json
from pathlib import Path
import psycopg2
conn=psycopg2.connect(dbname=os.environ['TEMKA_TEST_DB']);conn.autocommit=True;c=conn.cursor();count=0
base=Path(__file__).parent

def sql(s,args=None):c.execute(s,args);return c.fetchall() if c.description else c.rowcount
def ok(label,condition=True):
 global count
 assert condition,label
 count+=1;print('PASS',label)
def user(uid,s,args=None,role='authenticated'):
 t=conn.cursor()
 try:
  t.execute('begin');t.execute('set local role '+role);t.execute("select set_config('request.jwt.claim.sub',%s,true)",(uid or '',));t.execute(s,args);rows=t.fetchall() if t.description else t.rowcount;t.execute('commit');return rows
 except: t.execute('rollback');raise
 finally:t.close()
def denied(label,fn):
 try:fn()
 except psycopg2.Error:ok(label)
 else:raise AssertionError(label)
sql('create schema auth;create schema storage;')
for r in ['anon','authenticated','service_role']:
 if not sql('select 1 from pg_roles where rolname=%s',(r,)):sql('create role '+r+' nologin'+(' bypassrls' if r=='service_role' else ''))
sql('create table auth.users(id uuid primary key,email_confirmed_at timestamptz);')
sql("create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;")
sql('grant usage on schema auth,public,storage to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated;')
sql('create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;')
sql((base/'supabase.sql').read_text());sql((base/'friend-notifications.sql').read_text())
a,b,hidden=[str(uuid.uuid4()) for _ in range(3)]
for uid,name in [(a,'Alpha'),(b,'Alpha_Brother'),(hidden,'Alpha_Hidden')]:
 sql('insert into auth.users values(%s,now())',(uid,));user(uid,'select public.set_username(%s)',(name,))
sql('insert into public.creator_roles values(%s,\'creator_admin\')',(a,))
friend=user(a,"insert into public.friendships(requester_id,receiver_id,status) values(%s,%s,'pending') returning id",(a,b))[0][0]
sql('update auth.users set email_confirmed_at=null where id=%s',(hidden,))
text=(base/'player-profiles.sql').read_text();sql(text);sql(text);ok('migration runs twice without losing accounts/role/friend request',sql('select count(*) from public.player_profiles')[0][0]==3 and sql('select count(*) from public.creator_roles')[0][0]==1 and sql('select id from public.friendships')[0][0]==friend)

sql((base/'beta-access.sql').read_text())
text=(base/'chat-activity.sql').read_text();sql(text);sql(text)
ok('chat migration idempotent, existing pending friendship preserved',sql('select id from public.friendships')[0][0]==friend)
outsider=str(uuid.uuid4());sql('insert into auth.users values(%s,now())',(outsider,));user(outsider,"select public.set_username('Outsider')")
def send(uid,peer,body='Привет!',nonce=None):return user(uid,'select public.dm_send(%s,%s,%s)',(peer,body,nonce or str(uuid.uuid4())))[0][0]
def threads(uid):return user(uid,'select public.dm_threads()')[0][0]
def messages(uid,peer,stamp=None,mid=None):return user(uid,'select public.dm_messages(%s,%s,%s)',(peer,stamp,mid))[0][0]
def activity(uid,target=None):return user(uid,'select public.get_player_activity(%s)',(target or uid,))[0][0]
def start(uid,game='fantazia',platform='android',nonce=None):return user(uid,'select public.activity_start(%s,%s,%s)',(game,platform,nonce or str(uuid.uuid4())))[0][0]
denied('pending friendship cannot send',lambda:send(a,b))
sql("update public.friendships set status='accepted' where id=%s",(friend,))
for uid,role in [(None,'anon'),(hidden,'authenticated')]:
 denied('unconfirmed/anonymous cannot read messages',lambda uid=uid,role=role:user(uid,'select public.dm_messages(%s)',(a,),role=role))
 denied('unconfirmed/anonymous cannot read activity',lambda uid=uid,role=role:user(uid,'select public.get_player_activity(%s)',(a,),role=role))
for table in ['private_messages','private_message_reads','activity_catalog','game_activity_sessions']:
 denied('raw table denied '+table,lambda table=table:user(a,'select * from public.'+table))
 denied('raw insert denied '+table,lambda table=table:user(a,'insert into public.'+table+' default values'))
nonce=str(uuid.uuid4());first=send(a,b,' <script>пример</script> ',nonce)
ok('literal text stored, no email or client nonce in response',first['body']=='<script>пример</script>' and set(first)=={'id','sender_id','receiver_id','body','created_at'})
ok('safe retry returns same ID',send(a,b,'<script>пример</script>',nonce)['id']==first['id'])
denied('nonce cannot target another user',lambda:send(a,outsider,'<script>пример</script>',nonce))
denied('nonce cannot change body',lambda:send(a,b,'Другой текст',nonce))
denied('self-chat forbidden',lambda:send(a,a))
denied('nonfriend cannot send',lambda:send(a,outsider))
for body in ['', '   ', 'x'*2001]:denied('invalid message length',lambda body=body:send(a,b,body))
ok('receiver sees the message',messages(b,a)[0]['id']==first['id'])
ok('outsider cannot read another pair',messages(outsider,a)==[] and threads(outsider)==[])
ok('incoming unread count',threads(b)[0]['unread']==1 and threads(a)[0]['unread']==0)
denied('outsider cannot mark someone else read',lambda:user(outsider,'select public.dm_mark_read(%s,%s)',(a,first['id'])))
user(b,'select public.dm_mark_read(%s,%s)',(a,first['id']));ok('read cursor persisted',threads(b)[0]['unread']==0)
second=send(a,b,'Второе');user(b,'select public.dm_mark_read(%s,%s)',(a,second['id']));user(b,'select public.dm_mark_read(%s,%s)',(a,first['id']));ok('read marker never goes backwards',threads(b)[0]['unread']==0)
sql('delete from public.friendships where id=%s',(friend,))
ok('history remains after unfriend but send is disabled',threads(b)[0]['can_send'] is False and len(messages(b,a))==2)
denied('cannot send after unfriend',lambda:send(a,b))
sql("insert into public.friendships(id,requester_id,receiver_id,status) values(%s,%s,%s,'accepted')",(friend,a,b))
for i in range(18):send(a,b,'Лимит '+str(i))
denied('20 sends per minute rate limit',lambda:send(a,b))
ok('retry remains possible after rate limit',send(a,b,'<script>пример</script>',nonce)['id']==first['id'])
# Seed old messages only in the disposable fixture to exercise timestamp+UUID pagination.
for i in range(103):sql("insert into public.private_messages(sender_id,receiver_id,body,client_nonce,created_at) values(%s,%s,%s,%s,'2026-01-01')",(b,a,'Page '+str(i),str(uuid.uuid4())))
seen=[];page=messages(a,b)
while page:
 seen.extend(m['id'] for m in page);page=messages(a,b,page[0]['created_at'],page[0]['id'])
ok('all 123 messages paginated without duplicates or skips',len(seen)==123 and len(set(seen))==123)
ok('soon games have no activity',activity(a)=={'playing':None,'history':[]})
denied('Soon cannot start even for creator',lambda:start(a))
denied('helper cannot be called by client',lambda:user(a,"select public.activity_allowed(%s,'fantazia')",(a,)))
sql("update public.activity_catalog set enabled=true where game_id='fantazia'")
denied('enabled beta still needs approved entitlement',lambda:start(b))
launch=str(uuid.uuid4());s=start(a,nonce=launch)
ok('creator tracked session uses server timestamps',s['platform']=='android' and s['game_id']=='fantazia' and 'user_id' not in s and 'client_session' not in s)
ok('duplicate launch does not add history',start(a,nonce=launch)['id']==s['id'] and len(activity(a)['history'])==1)
ok('other verified player sees live status',activity(b,a)['playing']['id']==s['id'])
ok('other player cannot stop session',user(b,'select public.activity_stop(%s)',(s['id'],))[0][0] is False)
ok('other player cannot heartbeat',user(b,'select public.activity_touch(%s)',(s['id'],))[0][0] is False)
ok('owner heartbeat',user(a,'select public.activity_touch(%s)',(s['id'],))[0][0] is True)
sql("update public.game_activity_sessions set last_seen_at=now()-interval '91 seconds' where id=%s",(s['id'],))
ok('stale lease disappears without cron or client stop',activity(a)['playing'] is None and activity(a)['history'][0]['ended_at'] is not None)
ok('stale heartbeat cannot resurrect old session',user(a,'select public.activity_touch(%s)',(s['id'],))[0][0] is False)
s2=start(a);ok('new launch works',activity(a)['playing']['id']==s2['id'])
s3=start(a);ok('only one active session across devices',activity(a)['playing']['id']==s3['id'] and activity(a)['history'][1]['ended_at'] is not None)
user(a,'select public.activity_stop(%s)',(s3['id'],));ok('close clears playing and keeps history',activity(a)['playing'] is None and len(activity(a)['history'])==3)
sql("update public.activity_catalog set requires_beta=false where game_id='fantazia'")
s4=start(b);ok('non-beta enabled game works for ordinary verified user',activity(b)['playing']['id']==s4['id'])
sql("update public.activity_catalog set enabled=false where game_id='fantazia'")
ok('disabling catalogue immediately removes playing',activity(b)['playing'] is None)
denied('unverified target activity hidden',lambda:activity(a,hidden))
ok('launcher sessions never write trusted game stats',sql('select count(*) from public.player_game_stats')[0][0]==0)
sql(text);ok('migration preserves messages and sessions on rerun',sql('select count(*) from public.private_messages')[0][0]==123 and sql('select count(*) from public.game_activity_sessions')[0][0]==4)

sql("update public.activity_catalog set enabled=true,requires_beta=true where game_id='fantazia'")
code=user(a,"select public.beta_admin_issue('fantazia',false,1,72)")[0][0]
user(b,"select public.beta_redeem('fantazia',%s)",(code['code'],));approved=start(b)
ok('approved beta starts for ordinary friend',activity(b)['playing']['id']==approved['id'])
sql("update public.beta_access set state='revoked' where user_id=%s",(b,))
ok('revoking entitlement removes live status',activity(b)['playing'] is None)
ok('revoked session heartbeat denied',user(b,'select public.activity_touch(%s)',(approved['id'],))[0][0] is False)
denied('revoked beta cannot launch again',lambda:start(b))
for platform in ['web','macos',None]:denied('invalid platform',lambda platform=platform:start(a,platform=platform))
denied('unknown game',lambda:start(a,game='other'))
# Three earlier creator launches plus three new starts reach the per-minute maximum.
for i in range(3):start(a)
denied('six starts per minute limit',lambda:start(a))
# Concurrency shares a nonce: exactly one row, even with simultaneous requests.
import concurrent.futures
concurrent_nonce=str(uuid.uuid4())
sql("update public.private_messages set created_at=now()-interval '5 minutes' where sender_id=%s",(a,))
def parallel_send(i):
 with psycopg2.connect(dbname=os.environ['TEMKA_TEST_DB']) as cx:
  with cx.cursor() as q:
   q.execute('set local role authenticated');q.execute("select set_config('request.jwt.claim.sub',%s,true)",(a,));q.execute('select public.dm_send(%s,%s,%s)',(b,'Concurrent',concurrent_nonce));return q.fetchone()[0]['id']
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:ids=list(pool.map(parallel_send,range(5)))
ok('simultaneous nonce retries yield exactly one message',len(set(ids))==1 and sql('select count(*) from public.private_messages where client_nonce=%s',(concurrent_nonce,))[0][0]==1)
sql((base/'online-1.9.0.sql').read_text());ok('complete delivered migration preserves chat, activity, beta and creator',sql('select count(*) from public.private_messages')[0][0]==124 and sql('select count(*) from public.game_activity_sessions')[0][0]==8 and sql("select state from public.beta_access where user_id=%s",(b,))[0][0]=='revoked' and sql('select count(*) from public.creator_roles')[0][0]==1)
print('ALL',count,'CHAT / ACTIVITY SQL CHECKS PASSED')
