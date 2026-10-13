export type EntryIntent='login'|'register';
export interface EntryOtp {email:string;intent:EntryIntent;sentAt:number;retryAt:number}
export const ENTRY_OTP_KEY='temka-entry-otp-v1';
export const validEmail=(email:string)=>email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export function readEntryOtp(raw:string|null,now=Date.now()):EntryOtp|null {
  try {
    const value=JSON.parse(raw||'null');
    if(!value || !validEmail(value.email||'') || !['login','register'].includes(value.intent) ||
      !Number.isFinite(value.sentAt) || value.sentAt>now || now-value.sentAt>3600000 ||
      value.retryAt!==value.sentAt+60000)return null;
    return {email:value.email,intent:value.intent,sentAt:value.sentAt,retryAt:value.retryAt};
  }catch{return null;}
}
export function entryError(error:unknown):string {
  const text=error instanceof Error?error.message:'Не удалось войти. Повтори попытку.';
  if(/signups? not allowed|user not found|not registered/i.test(text))return 'Общий аккаунт с этой почтой не найден. Выбери «Создать аккаунт». Старый локальный профиль сам по себе не создаёт общий аккаунт.';
  if(/expired|invalid.*(token|otp)|token.*invalid|otp.*invalid/i.test(text))return 'Код неверный или устарел. Проверь последнее письмо или запроси новый код.';
  if(/duplicate|username.*(taken|exists)|юзернейм.*занят|ник.*занят|unique constraint/i.test(text))return 'Этот юзернейм уже занят на сервере. Выбери другой.';
  if(/failed to fetch|networkerror|network request failed|load failed/i.test(text))return 'Нет связи с сервером. Проверь интернет и повтори — локальная регистрация не нужна.';
  return text;
}
