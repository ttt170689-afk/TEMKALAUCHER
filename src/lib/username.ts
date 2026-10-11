/** Shared by registration, profile editing and validation. */
export const USERNAME_MAX_LENGTH = 25;
export function validateUsernameLength(name: string): string | null {
  return name.length < 3 || name.length > USERNAME_MAX_LENGTH
    ? `Ник должен быть от 3 до ${USERNAME_MAX_LENGTH} символов.`
    : null;
}
