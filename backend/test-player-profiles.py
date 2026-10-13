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
rows=user(a,"select username from public.search_players('aLpHa')");ok('case-insensitive partial search, exact result first, hides unverified',rows==[('Alpha',),('Alpha_Brother',)])
ok('underscore is literal, not wildcard',user(a,"select username from public.search_players('_B')")==[('Alpha_Brother',)])
for q in ['','a','%','a%','x'*26]:denied('invalid search '+repr(q),lambda q=q:user(a,'select * from public.search_players(%s)',(q,)))
denied('anonymous cannot search',lambda:user(None,"select * from public.search_players('Alpha')",role='anon'))
denied('unverified cannot search',lambda:user(hidden,"select * from public.search_players('Alpha')"))
card=user(b,'select public.get_player_card(%s)',(a,))[0][0];ok('nonfriend verified player can open card; trusted creator role',card['id']==a and card['is_creator'] is True and card['games']==[])
ok('no email/auth fields exposed',set(card)=={'id','username','display_name','bio','has_avatar','avatar_version','avatar_style','avatar_color','is_creator','games'})
ok('unverified target is hidden',user(a,'select public.get_player_card(%s)',(hidden,))[0][0] is None)
denied('unverified viewer cannot read card',lambda:user(hidden,'select public.get_player_card(%s)',(a,)))
denied('anonymous viewer cannot read card',lambda:user(None,'select public.get_player_card(%s)',(a,),role='anon'))
card=user(a,"select public.save_player_card('Автор','Обо мне')")[0][0];ok('own display name and bio saved',card['display_name']=='Автор' and card['bio']=='Обо мне')
denied('reserved public display name cannot impersonate creator',lambda:user(b,"select public.save_player_card('temka_play_official','')"))
ok('creator may use reserved public display name',user(a,"select public.save_player_card('temka_play_official','Обо мне')")[0][0]['is_creator'] is True)
ok('other account unchanged',user(a,'select public.get_player_card(%s)',(b,))[0][0]['bio']=='')
denied('oversized bio rejected',lambda:user(a,'select public.save_player_card(%s,%s)',('Имя','x'*161)))
denied('cannot forge someone else metadata by table access',lambda:user(b,"update public.player_profiles set bio='fake' where id=%s",(a,)))
denied('cannot self-grant creator role',lambda:user(b,"insert into public.creator_roles values(%s,'creator_admin')",(b,)))
user(a,"select public.set_player_avatar_style('mage','#aabbcc')");card=user(b,'select public.get_player_card(%s)',(a,))[0][0];ok('built-in avatar shared via card',card['avatar_style']=='mage' and card['avatar_color']=='#aabbcc' and card['has_avatar'] is False)
denied('invalid avatar style rejected',lambda:user(a,"select public.set_player_avatar_style('other','red')"))
denied('client cannot insert game stats',lambda:user(a,"insert into public.player_game_stats(user_id,game_id,level) values(%s,'fantazia',999)",(a,)))
denied('client cannot select raw game stats',lambda:user(a,'select * from public.player_game_stats'))
ach=[{'id':'first','title':'Первый шаг','earned_at':'2026-10-13T00:00:00Z'}]
user(None,"insert into public.player_game_stats(user_id,game_id,level,play_seconds,achievements,achievements_total) values(%s,'fantazia',4,7260,%s::jsonb,3)",(a,json.dumps(ach)),role='service_role')
card=user(b,'select public.get_player_card(%s)',(a,))[0][0];g=card['games'][0];ok('trusted backend stats visible to another player',g['level']==4 and g['play_seconds']==7260 and g['achievements'][0]['title']=='Первый шаг')
denied('client cannot overwrite stats',lambda:user(a,'update public.player_game_stats set level=999'))
denied('client cannot delete stats',lambda:user(a,'delete from public.player_game_stats'))
for n in range(23):
 uid=str(uuid.uuid4());sql('insert into auth.users values(%s,now())',(uid,));user(uid,'select public.set_username(%s)',('Group_'+str(n),))
ok('search is capped at20',len(user(a,"select * from public.search_players('Group')"))==20)
print('ALL',count,'PLAYER PROFILE SQL CHECKS PASSED')
