// Desktop/browser transport. Android supplies its native HTTPS adapter in the mobile project.
export const onlineFetch = (url:string,init:RequestInit):Promise<Pick<Response,'ok'|'status'|'text'>> => fetch(url,init);
