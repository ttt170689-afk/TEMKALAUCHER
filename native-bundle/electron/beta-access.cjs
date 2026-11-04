'use strict';
const URL='https://jubsgthkahxxexmibdwn.supabase.co/rest/v1/rpc/beta_status';
const KEY='sb_publishable_OMO42E66umWFmfOic4QD3w_T64EWPXS';
function validToken(token){return typeof token==='string'&&token.length<16384&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);}
function validApproval(d){return !!d&&d.game_id==='fantazia'&&d.state==='approved'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(d.request_id||'')&&Number.isFinite(Date.parse(d.updated_at||''));}
async function requireBeta(token,fetchImpl=global.fetch){
 if(!validToken(token))throw Error('Войди в подтверждённый онлайн-аккаунт и отправь заявку на бета-тест.');
 let response;try{response=await fetchImpl(URL,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_game:'fantazia'}),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('Не удалось проверить бета-доступ на сервере. Повтори подключение.');}
 if(!response.ok){await response.body?.cancel();throw Error('Сервер не подтвердил бета-доступ. Войди заново и проверь статус заявки в свойствах игры.');}
 if(!response.body)throw Error('Сервер не вернул статус бета-доступа.');
 const reader=response.body.getReader();let length=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16384)throw Error('Некорректный ответ бета-сервера.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 let d;try{d=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Некорректный ответ бета-сервера.');}
 if(!validApproval(d))throw Error('Нужен действующий бета-доступ Fantazia. Отправь заявку и дождись одобрения: ⋯ → Свойства → Бета-тест.');
 return d;
}
module.exports={requireBeta,validToken,validApproval};
