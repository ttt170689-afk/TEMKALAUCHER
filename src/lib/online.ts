/// <reference types="vite/client" />
import { isCustomAvatar } from './avatar';
import {readBetaStatus,readBetaResult,validateBetaCode,isGame} from './betaContract';
import type {BetaRequest,BetaCode,IssuedBetaCode} from './betaContract';

const base = String(import.meta.env.VITE_TEMKA_SUPABASE_URL || '').replace(/\/$/, '');
const publicKey = String(import.meta.env.VITE_TEMKA_SUPABASE_ANON_KEY || '');
function validPublicKey(key: string): boolean {
  if (/^sb_publishable_[\w-]+$/.test(key)) return true;
  try {const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return payload.role === 'anon';} catch {return false;}
}
export const onlineEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) && validPublicKey(publicKey);
export interface OnlineProfile {id: string; username: string; has_avatar: boolean; avatar_version: number; is_creator: boolean;}
export interface Friendship {request_id: string; requester_id: string; receiver_id: string; status: 'pending'|'accepted'; other_id: string; username: string; has_avatar: boolean; avatar_version: number; is_creator: boolean;}
interface Session {access_token: string; refresh_token: string; expires_at: number; user: {id: string; email?: string};}
export const onlineAvatar = (id: string, version: number) => `${base}/storage/v1/object/public/avatars/${encodeURIComponent(id)}/avatar.webp?v=${Number(version) || 0}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class CloudClient {
  session: Session | null = null;
  private readonly key: string;
  private refreshing: Promise<void> | null = null;
  constructor(localId: string) {
    this.key = `temka-online-v1:${base}:${localId}`;
    try {const saved = JSON.parse(localStorage.getItem(this.key) || 'null'); if (saved && UUID.test(saved.user?.id) && typeof saved.access_token === 'string' && typeof saved.refresh_token === 'string' && Number.isFinite(saved.expires_at)) this.session = saved;} catch { /* no saved session */ }
  }
  private saveSession(value: Session | null) {
    try {if(value) localStorage.setItem(this.key, JSON.stringify(value)); else localStorage.removeItem(this.key);}
    catch {throw new Error('Браузер не разрешил сохранить онлайн-сессию. Освободи место или разреши хранение данных.');}
    this.session = value;
  }
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
    this.saveSession({...data, expires_at: Number(data.expires_at) || Math.floor(Date.now()/1000) + Number(data.expires_in || 3600)});
  }
  async sendCode(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Введи корректную почту.');
    await this.fetchJson('/auth/v1/otp', {method:'POST',body:JSON.stringify({email,create_user:true})});
  }
  async verifyCode(email: string, code: string) {
    if(!/^\d{6,10}$/.test(code)) throw new Error('Введи код из письма (6–10 цифр).');
    const data = await this.fetchJson('/auth/v1/verify', {method:'POST',body:JSON.stringify({email,token:code,type:'email'})});
    this.acceptSession(data);
  }
  private async token() {
    if(!this.session) throw new Error('Сначала подтверди почту.');
    if(this.session.expires_at < Date.now()/1000 + 60) {
      if(!this.refreshing) this.refreshing = (async () => {
        const data = await this.fetchJson('/auth/v1/token?grant_type=refresh_token', {method:'POST',body:JSON.stringify({refresh_token:this.session!.refresh_token})});
        this.acceptSession(data);
      })().finally(() => {this.refreshing = null;});
      await this.refreshing;
    }
    return this.session!.access_token;
  }
  private async request(path: string, init: RequestInit = {}) {return this.fetchJson(path, init, await this.token());}
  async betaStatus(game:string) {if(!isGame(game))throw Error('Неизвестная игра.');return readBetaStatus(await this.request('/rest/v1/rpc/beta_status',{method:'POST',body:JSON.stringify({p_game:game})}),game);}
  async redeemBeta(game:string,code:string) {if(!isGame(game))throw Error('Неизвестная игра.');return readBetaResult(await this.request('/rest/v1/rpc/beta_redeem',{method:'POST',body:JSON.stringify({p_game:game,p_code:validateBetaCode(code)})}),game);}
  async betaRequests(game:string):Promise<BetaRequest[]> {const rows=await this.request('/rest/v1/rpc/beta_admin_requests',{method:'POST',body:JSON.stringify({p_game:game})});if(!Array.isArray(rows))throw Error('Неполный список заявок.');return rows;}
  async betaCodes(game:string):Promise<BetaCode[]> {const rows=await this.request('/rest/v1/rpc/beta_admin_codes',{method:'POST',body:JSON.stringify({p_game:game})});if(!Array.isArray(rows))throw Error('Неполный список кодов.');return rows;}
  async issueBeta(game:string,approval:boolean,limit:number,hours:number):Promise<IssuedBetaCode> {const r=await this.request('/rest/v1/rpc/beta_admin_issue',{method:'POST',body:JSON.stringify({p_game:game,p_approval:approval,p_limit:limit,p_hours:hours})});if(!r||r.game_id!==game||!UUID.test(r.id||'')||typeof r.code!=='string')throw Error('Сервер не подтвердил создание кода.');return r;}
  async decideBeta(id:string,state:'approved'|'rejected'|'revoked') {if(!UUID.test(id))throw Error('Некорректная заявка.');const r=await this.request('/rest/v1/rpc/beta_admin_decide',{method:'POST',body:JSON.stringify({p_request:id,p_state:state})});if(r?.id!==id||r?.state!==state)throw Error('Сервер не подтвердил решение.');}
  async revokeBetaCode(id:string) {if(!UUID.test(id))throw Error('Некорректный код.');await this.request('/rest/v1/rpc/beta_admin_revoke_code',{method:'POST',body:JSON.stringify({p_id:id})});}
  async ownProfile(): Promise<OnlineProfile | null> {const rows = await this.request('/rest/v1/rpc/my_profile', {method:'POST',body:'{}'}); return rows?.[0] || null;}
  async saveUsername(username: string) {
    const name = username.trim(); if(!/^[a-zа-яё0-9_]{3,25}$/i.test(name)) throw new Error('Юзернейм: 3–25 букв, цифр или подчёркиваний.');
    await this.request('/rest/v1/rpc/set_username', {method:'POST',body:JSON.stringify({new_username:name})});
  }
  async search(username: string): Promise<OnlineProfile[]> {
    const name = username.trim().replace(/^@/, ''); if(!/^[a-zа-яё0-9_]{3,25}$/i.test(name)) throw new Error('Введи полный юзернейм: 3–25 букв, цифр или подчёркиваний.');
    return await this.request('/rest/v1/rpc/find_player', {method:'POST',body:JSON.stringify({exact_username:name})});
  }
  async friends(): Promise<Friendship[]> {return await this.request('/rest/v1/rpc/list_my_friends', {method:'POST',body:'{}'});}
  async invite(receiver: string) {
    if(!UUID.test(receiver)) throw new Error('Некорректный игрок.');
    await this.request('/rest/v1/friendships', {method:'POST',body:JSON.stringify({requester_id:this.session!.user.id,receiver_id:receiver,status:'pending'})});
  }
  async accept(id: string) {if(!UUID.test(id)) throw new Error('Некорректная заявка.'); await this.request(`/rest/v1/friendships?id=eq.${id}`, {method:'PATCH',headers:{Prefer:'return=representation'},body:'{"status":"accepted"}'}).then(rows=>{if(!rows?.length) throw new Error('Заявка уже недоступна. Обнови список.');});}
  async remove(id: string) {if(!UUID.test(id)) throw new Error('Некорректная заявка.'); await this.request(`/rest/v1/friendships?id=eq.${id}`, {method:'DELETE'});}
  async publishAvatar(data: string) {
    if(!isCustomAvatar(data)) throw new Error('Сначала загрузи своё изображение в блоке «Аватар игрока».');
    const decoded = atob(data.split(',')[1]); const bytes = Uint8Array.from(decoded, c=>c.charCodeAt(0));
    // prepareAvatar uses WebP in Chromium; never label other formats as WebP.
    if(!data.startsWith('data:image/webp;')) throw new Error('Загрузи картинку заново для преобразования в WebP.');
    const id = this.session!.user.id;
    await this.request(`/storage/v1/object/avatars/${id}/avatar.webp`, {method:'POST',headers:{'Content-Type':'image/webp','x-upsert':'true'},body:new Blob([bytes],{type:'image/webp'})});
    await this.request('/rest/v1/rpc/set_avatar_visible', {method:'POST',body:'{"visible":true}'});
  }
  async removePublishedAvatar() {
    await this.request('/rest/v1/rpc/set_avatar_visible', {method:'POST',body:'{"visible":false}'});
    await this.request('/storage/v1/object/avatars', {method:'DELETE',body:JSON.stringify({prefixes:[`${this.session!.user.id}/avatar.webp`]})});
  }
  async logout() {
    const session = this.session;
    if(session) {try {await this.fetchJson('/auth/v1/logout?scope=local',{method:'POST'},session.access_token);} finally {this.saveSession(null);}}
  }
}
