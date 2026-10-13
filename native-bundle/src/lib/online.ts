/// <reference types="vite/client" />
import {readMessages,readThreads,readActivity,readActivitySession,isUUID} from './messaging';
import type {DirectMessage} from './messaging';
import {readPlayerCard} from './playerCard';
import type {PlayerCard} from './playerCard';
import { readFriendships, readOnlineProfiles } from './friendContract';
import { isCustomAvatar } from './avatar';
import {readBetaStatus,readBetaResult,validateBetaCode,isGame} from './betaContract';

import publicConfig from '../config/online.public.json';
import { resolveOnlineConfig } from './onlineConfig';
const config = resolveOnlineConfig(import.meta.env, publicConfig);
const base = config.url;
export const onlineProject = base;
const publicKey = config.publishableKey;
export const onlineEnabled = config.enabled;
export interface OnlineProfile {id: string; username: string; has_avatar: boolean; avatar_version: number; is_creator: boolean;}
export interface Friendship {request_id: string; requester_id: string; receiver_id: string; status: 'pending'|'accepted'; other_id: string; username: string; has_avatar: boolean; avatar_version: number; is_creator: boolean;}
export interface Session {access_token: string; refresh_token: string; expires_at: number; user: {id: string; email?: string};}
export const onlineAvatar = (id: string, version: number) => `${base}/storage/v1/object/public/avatars/${encodeURIComponent(id)}/avatar.webp?v=${Number(version) || 0}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ONLINE_CHANGED = 'temka-online-changed';
export function notifyOnline(localId: string) {
  if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent(ONLINE_CHANGED,{detail:{localId}}));
}
export const onlineSessionKey = (localId: string) => `temka-online-v1:${base}:${localId}`;
export class CloudClient {
  session: Session | null = null;
  private readonly key: string;
  private refreshing: Promise<void> | null = null;
  private sessionGeneration = 0;
  constructor(private readonly localId: string, private readonly transient = false) {
    this.key = onlineSessionKey(localId);
    if (transient) return;
    try {const saved = JSON.parse(localStorage.getItem(this.key) || 'null'); if (saved && UUID.test(saved.user?.id) && typeof saved.access_token === 'string' && typeof saved.refresh_token === 'string' && Number.isFinite(saved.expires_at)) this.session = saved;} catch { /* no saved session */ }
  }
  private saveSession(value: Session | null) {
    try {if(this.transient) { /* Entry credentials stay in memory until identity is confirmed. */ } else if(value) localStorage.setItem(this.key, JSON.stringify(value)); else localStorage.removeItem(this.key);}
    catch {throw new Error('Браузер не разрешил сохранить онлайн-сессию. Освободи место или разреши хранение данных.');}
    this.sessionGeneration++;this.session = value;notifyOnline(this.localId);
  }
  clearTransient() {
    if(!this.transient) throw Error("Not an entry client");
    this.sessionGeneration++; this.session=null;
  }
  reloadSession() {
    if(this.transient) {this.clearTransient();return;}
    this.sessionGeneration++;
    try{const saved=JSON.parse(localStorage.getItem(this.key)||'null');this.session=saved&&UUID.test(saved.user?.id)&&typeof saved.access_token==='string'&&typeof saved.refresh_token==='string'&&Number.isFinite(saved.expires_at)?saved:null;}catch{this.session=null;}
  }
  async emailVerified(): Promise<boolean> {
    const expected=this.session?.user.id;if(!expected)return false;
    const user=await this.request('/auth/v1/user');
    if(this.session?.user.id!==expected)throw Error('Онлайн-аккаунт изменился. Повтори действие.');
    if(user?.id!==expected)throw Error('Сервер не подтвердил онлайн-аккаунт.');
    return typeof user.email_confirmed_at==='string'&&Number.isFinite(Date.parse(user.email_confirmed_at));
  }
  async confirmedIdentity(): Promise<{id:string;email:string}> {
    const expected=this.session?.user.id;if(!expected)throw Error('Сначала подтверди почту.');
    const user=await this.request('/auth/v1/user');
    if(this.session?.user.id!==expected || user?.id!==expected || typeof user.email!=='string' ||
      typeof user.email_confirmed_at!=='string' || !Number.isFinite(Date.parse(user.email_confirmed_at)))
      throw Error('Сервер не подтвердил почту и аккаунт.');
    return {id:expected,email:user.email};
  }
  private async requireVerified() {if(!await this.emailVerified())throw Error('Сначала подтверди почту в онлайн-профиле.');}
  private async fetchJson(path: string, init: RequestInit = {}, token?: string) {
    if (!onlineEnabled) throw new Error('Сервер друзей ещё не подключён владельцем лаунчера.');
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const headers = new Headers(init.headers); headers.set('apikey', publicKey);
      if(token) headers.set('Authorization', `Bearer ${token}`);
      if(init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
      const response = await fetch(base + path, {...init, headers, signal: controller.signal, redirect: 'error'});
      const text = await response.text();
      let data; try {data = text ? JSON.parse(text) : null;} catch {throw new Error('Сервер вернул некорректный ответ.');}
      if (!response.ok) {
        if(response.status===409)throw Error(path.endsWith('/set_username')?'Этот юзернейм уже занят на сервере. Выбери другой.':'Запись уже существует. Обнови список перед повтором.');
        if (response.status === 429) throw new Error('Слишком много запросов. Подожди перед повторной попыткой.');
        const message = String(data?.msg || data?.message || data?.error_description || data?.error || `Ошибка сервера ${response.status}`).slice(0, 300);
        throw new Error(message);
      }
      return data;
    } catch(error) {
      if(error instanceof DOMException && error.name === 'AbortError') throw new Error('Сервер не ответил вовремя. Проверь интернет и повтори.');
      throw error;
    } finally {clearTimeout(timeout);}
  }
  private acceptSession(data: Session & {expires_in?: number}) {
    if(!data?.access_token || !data?.refresh_token || !UUID.test(data?.user?.id || '')) throw new Error('Сервер не подтвердил аккаунт.');
    if(!this.transient) {
      let bound:string|undefined;
      try {bound=JSON.parse(localStorage.getItem('temka-accounts-v1')||'null')?.users?.find((u:{id:string;onlineUserId?:string})=>u.id===this.localId)?.onlineUserId;} catch { /* legacy storage */ }
      if(bound && bound!==data.user.id)throw Error('Это другой аккаунт. Сначала выйди из лаунчера и войди с нужной почтой на первом экране.');
    }
    this.saveSession({...data, expires_at: Number(data.expires_at) || Math.floor(Date.now()/1000) + Number(data.expires_in || 3600)});
  }
  async sendCode(email: string, createUser = true) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Введи корректную почту.');
    await this.fetchJson('/auth/v1/otp', {method:'POST',body:JSON.stringify({email,create_user:createUser})});
  }
  async verifyCode(email: string, code: string) {
    if(!/^\d{6,10}$/.test(code)) throw new Error('Введи код из письма (6–10 цифр).');
    const generation=this.sessionGeneration;
    const data = await this.fetchJson('/auth/v1/verify', {method:'POST',body:JSON.stringify({email,token:code,type:'email'})});
    if(generation!==this.sessionGeneration)throw Error('Вход отменён. Повтори действие.');
    this.acceptSession(data);
  }
  private async token() {
    if(!this.session) throw new Error('Сначала подтверди почту.');
    if(this.session.expires_at < Date.now()/1000 + 60) {
      if(!this.refreshing) {const generation=this.sessionGeneration;const refreshToken=this.session.refresh_token;this.refreshing = (async () => {
        const data = await this.fetchJson('/auth/v1/token?grant_type=refresh_token', {method:'POST',body:JSON.stringify({refresh_token:refreshToken})});
        if(generation!==this.sessionGeneration||!this.session)throw Error('Онлайн-сессия изменилась. Повтори вход.');
        this.acceptSession(data);
      })().finally(() => {this.refreshing = null;});}
      await this.refreshing;
    }
    if(!this.session)throw Error('Онлайн-сессия изменилась. Повтори вход.');
    return this.session.access_token;
  }
  private async request(path: string, init: RequestInit = {}) {
    const me=this.session?.user.id,token=await this.token();
    if(this.session?.user.id!==me)throw Error('Онлайн-аккаунт изменился.');
    const result=await this.fetchJson(path,init,token);
    if(this.session?.user.id!==me)throw Error('Онлайн-аккаунт изменился.');
    return result;
  }
  async betaStatus(game:string) {if(!isGame(game))throw Error('Неизвестная игра.');return readBetaStatus(await this.request('/rest/v1/rpc/beta_status',{method:'POST',body:JSON.stringify({p_game:game})}),game);}
  async redeemBeta(game:string,code:string) {if(!isGame(game))throw Error('Неизвестная игра.');return readBetaResult(await this.request('/rest/v1/rpc/beta_redeem',{method:'POST',body:JSON.stringify({p_game:game,p_code:validateBetaCode(code)})}),game);}
  async messageThreads(){const me=this.session?.user.id;if(!me)throw Error('Сначала войди в онлайн-профиль.');return readThreads(await this.request('/rest/v1/rpc/dm_threads',{method:'POST',body:'{}'}),me);}
  async messages(peer:string,before?:DirectMessage){const me=this.session?.user.id;if(!me||!isUUID(peer)||peer===me)throw Error('Некорректный диалог.');return readMessages(await this.request('/rest/v1/rpc/dm_messages',{method:'POST',body:JSON.stringify({peer_id:peer,before_time:before?.created_at??null,before_id:before?.id??null})}),me,peer);}
  async sendMessage(peer:string,text:string,nonce:string){const me=this.session?.user.id;if(!me||!isUUID(peer)||peer===me||!isUUID(nonce)||!text.trim()||text.length>2000)throw Error('Сообщение: 1–2000 символов.');return readMessages([await this.request('/rest/v1/rpc/dm_send',{method:'POST',body:JSON.stringify({peer_id:peer,message_text:text.trim(),nonce})})],me,peer)[0];}
  async markMessagesRead(peer:string,message:string){if(!isUUID(peer)||!isUUID(message))throw Error('Некорректное сообщение.');await this.request('/rest/v1/rpc/dm_mark_read',{method:'POST',body:JSON.stringify({peer_id:peer,message_id:message})});}
  async playerActivity(id:string){if(!isUUID(id))throw Error('Некорректный игрок.');return readActivity(await this.request('/rest/v1/rpc/get_player_activity',{method:'POST',body:JSON.stringify({player_id:id})}));}
  async startActivity(game:string,platform:string,launchId:string){if(!['fantazia','temkaworld'].includes(game)||!isUUID(launchId))throw Error('Некорректный запуск.');return readActivitySession(await this.request('/rest/v1/rpc/activity_start',{method:'POST',body:JSON.stringify({game,device_platform:platform,launch_id:launchId})}));}
  async touchActivity(id:string){if(!isUUID(id))throw Error('Некорректная сессия.');const r=await this.request('/rest/v1/rpc/activity_touch',{method:'POST',body:JSON.stringify({session_id:id})});if(typeof r!=='boolean')throw Error('Сервер не подтвердил активность.');return r;}
  async stopActivity(id:string){if(!isUUID(id))return;await this.request('/rest/v1/rpc/activity_stop',{method:'POST',body:JSON.stringify({session_id:id})});}
  async searchPlayers(query:string):Promise<OnlineProfile[]>{
    const name=query.trim().replace(/^@/,'');
    if(!/^[a-zа-яё0-9_]{2,25}$/i.test(name))throw Error('Введи минимум 2 символа юзернейма.');
    await this.requireVerified();
    return readOnlineProfiles(await this.request('/rest/v1/rpc/search_players',{method:'POST',body:JSON.stringify({query_text:name})}),20);
  }
  async playerCard(id:string):Promise<PlayerCard>{
    if(!UUID.test(id))throw Error('Некорректный игрок.');
    return readPlayerCard(await this.request('/rest/v1/rpc/get_player_card',{method:'POST',body:JSON.stringify({player_id:id})}),id);
  }
  async savePlayerCard(name:string,bio:string):Promise<PlayerCard>{
    const id=this.session?.user.id;if(!id)throw Error('Сначала подтверди почту.');
    return readPlayerCard(await this.request('/rest/v1/rpc/save_player_card',{method:'POST',body:JSON.stringify({new_display_name:name.trim(),new_bio:bio.trim()})}),id);
  }
  async saveAvatarStyle(style:string,color:string){
    await this.request('/rest/v1/rpc/set_player_avatar_style',{method:'POST',body:JSON.stringify({new_style:style,new_color:color})});notifyOnline(this.localId);
  }
  async ownProfile(): Promise<OnlineProfile | null> {
    const me=this.session?.user.id;
    const rows=readOnlineProfiles(await this.request('/rest/v1/rpc/my_profile',{method:'POST',body:'{}'}));
    if(rows[0]&&rows[0].id!==me)throw Error('Сервер вернул профиль другого аккаунта.');
    return rows[0]||null;
  }
  async saveUsername(username: string) {
    const name = username.trim(); if(!/^[a-zа-яё0-9_]{3,25}$/i.test(name)) throw new Error('Юзернейм: 3–25 букв, цифр или подчёркиваний.');
    await this.requireVerified();
    await this.request('/rest/v1/rpc/set_username', {method:'POST',body:JSON.stringify({new_username:name})});notifyOnline(this.localId);
  }
  async search(username: string): Promise<OnlineProfile[]> {
    const name = username.trim().replace(/^@/, ''); if(!/^[a-zа-яё0-9_]{3,25}$/i.test(name)) throw new Error('Введи полный юзернейм: 3–25 букв, цифр или подчёркиваний.');
    await this.requireVerified();
    return readOnlineProfiles(await this.request('/rest/v1/rpc/find_player', {method:'POST',body:JSON.stringify({exact_username:name})}));
  }
  async friends(): Promise<Friendship[]> {
    const me=this.session?.user.id;if(!me)throw Error('Сначала подтверди почту.');
    const rows=await this.request('/rest/v1/rpc/list_my_friends',{method:'POST',body:'{}'});
    if(this.session?.user.id!==me)throw Error('Онлайн-аккаунт изменился. Обнови список.');
    return readFriendships(rows,me);
  }
  async invite(receiver: string) {
    if(!UUID.test(receiver))throw Error('Некорректный игрок.');
    await this.requireVerified();
    if(receiver===this.session!.user.id)throw Error('Нельзя добавить в друзья себя.');
    const me=this.session!.user.id;
    const rows=await this.request('/rest/v1/friendships',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({requester_id:me,receiver_id:receiver,status:'pending'})});
    if(!Array.isArray(rows)||rows.length!==1||!UUID.test(rows[0].id)||rows[0].requester_id!==me||rows[0].receiver_id!==receiver||rows[0].status!=='pending')throw Error('Сервер не подтвердил отправку заявки. Обнови список.');
    notifyOnline(this.localId);
  }
  async accept(id: string) {
    if(!UUID.test(id))throw Error('Некорректная заявка.');await this.requireVerified();
    const rows=await this.request(`/rest/v1/friendships?id=eq.${id}&status=eq.pending&receiver_id=eq.${this.session!.user.id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:'{"status":"accepted"}'});
    if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==id||rows[0].status!=='accepted')throw Error('Заявка уже недоступна. Обнови список.');notifyOnline(this.localId);
  }
  async remove(id: string, pendingOnly=false) {
    if(!UUID.test(id))throw Error('Некорректная заявка.');await this.requireVerified();
    const rows=await this.request(`/rest/v1/friendships?id=eq.${id}${pendingOnly?'&status=eq.pending':''}`,{method:'DELETE',headers:{Prefer:'return=representation'}});
    if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==id)throw Error('Заявка уже изменена или удалена. Обнови список.');notifyOnline(this.localId);
  }
  async publishAvatar(data: string) {
    if(!isCustomAvatar(data)) throw new Error('Сначала загрузи своё изображение в блоке «Аватар игрока».');
    const decoded = atob(data.split(',')[1]); const bytes = Uint8Array.from(decoded, c=>c.charCodeAt(0));
    // prepareAvatar uses WebP in Chromium; never label other formats as WebP.
    if(!data.startsWith('data:image/webp;')) throw new Error('Загрузи картинку заново для преобразования в WebP.');
    await this.requireVerified();
    const id = this.session!.user.id;
    await this.request(`/storage/v1/object/avatars/${id}/avatar.webp`, {method:'POST',headers:{'Content-Type':'image/webp','x-upsert':'true'},body:new Blob([bytes],{type:'image/webp'})});
    if(this.session?.user.id!==id)throw Error('Онлайн-аккаунт изменился. Повтори действие.');
    await this.request('/rest/v1/rpc/set_avatar_visible', {method:'POST',body:'{"visible":true}'});notifyOnline(this.localId);
  }
  async removePublishedAvatar() {
    await this.requireVerified();
    const id=this.session!.user.id;
    await this.request('/rest/v1/rpc/set_avatar_visible', {method:'POST',body:'{"visible":false}'});
    if(this.session?.user.id!==id)throw Error('Онлайн-аккаунт изменился.');
    await this.request('/storage/v1/object/avatars', {method:'DELETE',body:JSON.stringify({prefixes:[`${id}/avatar.webp`]})});notifyOnline(this.localId);
  }
  async logout() {
    const session=this.session;this.saveSession(null);
    if(session)await this.fetchJson('/auth/v1/logout?scope=local',{method:'POST'},session.access_token);
  }
}

// Share refresh-token rotation between the profile, beta dialog and notifications.
const clients=new Map<string,CloudClient>();
export function getCloudClient(localId: string): CloudClient {
  let client=clients.get(localId);if(!client){client=new CloudClient(localId);clients.set(localId,client);}return client;
}
if(typeof window!=='undefined'&&typeof window.addEventListener==='function')window.addEventListener('storage',event=>{
  for(const [id,client] of clients)if(event.key===null||event.key===`temka-online-v1:${base}:${id}`){client.reloadSession();notifyOnline(id);}
});
