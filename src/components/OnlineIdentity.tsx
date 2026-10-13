import {useOnlineAccount} from '../lib/onlineAccount';
export default function OnlineIdentity(){
 const {profile,mode}=useOnlineAccount();
 const text=profile?`@${profile.username}`:mode==='checking'?'Проверяем аккаунт…':mode==='verified'?'Выбери @юзернейм':mode==='error'?'Нет связи с аккаунтом':'Локальный профиль';
 return <span className="online-identity" data-online-handle={profile?.username||undefined} title={text}>{text}</span>;
}
