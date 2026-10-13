export interface OtpState{email:string;retryAt:number;sentAt:number;}
export function readOtp(value:string|null,now=Date.now()):OtpState|null{
 try{const r=JSON.parse(value||'null');return r&&typeof r.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)&&r.email.length<=254&&Number.isFinite(r.retryAt)&&Number.isFinite(r.sentAt)&&r.sentAt<=now&&now-r.sentAt<3600000&&r.retryAt===r.sentAt+60000?r:null;}catch{return null;}
}
export function secondsLeft(retryAt:number,now=Date.now()){return Math.max(0,Math.ceil((retryAt-now)/1000));}
