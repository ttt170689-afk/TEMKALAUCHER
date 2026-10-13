export interface PublicOnlineConfig { url: string; publishableKey: string; }
export function validPublicKey(key: string): boolean {
  if (/^sb_publishable_[\w-]+$/.test(key)) return true;
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; }
  catch { return false; }
}
// Select the whole pair, never combine one project's URL with another project's key.
export function resolveOnlineConfig(env: Record<string, unknown>, defaults: PublicOnlineConfig) {
  const envUrl=String(env.VITE_TEMKA_SUPABASE_URL || '').trim();
  const envKey=String(env.VITE_TEMKA_SUPABASE_ANON_KEY || '').trim();
  const override=Boolean(envUrl || envKey);
  const url=String(override?envUrl:defaults.url).trim().replace(/\/+$/, '');
  const publishableKey=String(override?envKey:defaults.publishableKey).trim();
  const enabled=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && validPublicKey(publishableKey);
  return {url,publishableKey,enabled};
}
