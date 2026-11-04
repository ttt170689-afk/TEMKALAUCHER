import type {CloudClient} from './online';
export async function gameBetaToken(client:CloudClient){
 const uid=client.session?.user.id;if(!uid)throw Error('Войди в подтверждённый аккаунт и отправь заявку на бета-тест.');
 const status=await client.betaStatus('fantazia');
 if(client.session?.user.id!==uid)throw Error('Аккаунт изменился. Открой бета-тест снова.');
 if(status.state!=='approved')throw Error('Нужен одобренный доступ Fantazia: ⋯ → Свойства → Бета-тест. Ожидающие, отклонённые и отозванные заявки доступа не дают.');
 const token=client.session?.access_token;if(!token)throw Error('Войди в аккаунт снова.');return token;
}
