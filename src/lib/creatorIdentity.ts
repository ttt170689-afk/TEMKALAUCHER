/** Display-only signature requested by the project owner.
 * NEVER use this function for authorization, database policies or verified badges.
 * The local username is editable and does NOT prove ownership of an online account.
 * Online roles remain provisioned by UUID in creator_roles on the server.
 */
export function hasLocalCreatorSignature(username: string | undefined): boolean {
  return typeof username === 'string' && username.trim().toLowerCase() === 'temka_play_official';
}
export const LOCAL_CREATOR_SIGNATURE_NOTE = 'Локальная подпись автора, не подтверждение онлайн-прав. Значок администратора в сети назначается сервером после подтверждения аккаунта.';
