export type BetaState='none'|'pending'|'approved'|'rejected'|'revoked';
export interface BetaStatus {game_id:string;state:BetaState;request_id:string|null;updated_at:string|null;}
export interface BetaRequest {id:string;game_id:string;user_id:string;username:string;state:Exclude<BetaState,'none'>;created_at:string;updated_at:string;}
export interface BetaCode {id:string;game_id:string;require_approval:boolean;max_uses:number;uses:number;expires_at:string;revoked:boolean;}
export interface IssuedBetaCode {id:string;code:string;game_id:string;require_approval:boolean;max_uses:number;expires_at:string;}
export const BETA_LABELS:Record<BetaState,string>={none:'Доступ не активирован',pending:'Ожидает одобрения автора',approved:'Доступ к бета-тесту одобрен',rejected:'Заявка отклонена автором',revoked:'Доступ отозван автором'};
export const isGame=(game:string)=>['temkaworld','fantazia'].includes(game);
export const normalizeBetaCode=(code:string)=>code.toUpperCase().replace(/[\s-]/g,'');
export function validateBetaCode(code:string){if(code.length>100||!/^[A-Z0-9]{16,64}$/.test(normalizeBetaCode(code)))throw Error('Введи полный бета-код автора: латинские буквы и цифры. Дефисы и пробелы допустимы.');return code.trim();}
export function readBetaStatus(data:unknown,game:string):BetaStatus{
 const d=data as BetaStatus;
 if(!d||d.game_id!==game||!Object.prototype.hasOwnProperty.call(BETA_LABELS,d.state)||(d.state!=='none'&&(!/^[0-9a-f-]{36}$/i.test(d.request_id||'')||!Number.isFinite(Date.parse(d.updated_at||'')))))throw Error('Сервер не подтвердил статус бета-доступа. Повтори проверку.');
 return d;
}
export function readBetaResult(data:unknown,game:string):BetaStatus{
 const d=data as {ok?:boolean;error?:string;status?:unknown};
 if(!d||d.ok!==true){if(d?.error==='rate_limited')throw Error('Слишком много попыток. Подожди 10 минут.');if(d?.error==='invalid_code')throw Error('Код недействителен для этой игры, истёк или больше не доступен.');throw Error('Сервер не подтвердил активацию. Повтори проверку статуса.');}
 return readBetaStatus(d.status,game);
}
