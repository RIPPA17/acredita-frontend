export const PASSWORD_MIN_LENGTH = 12;

export function passwordValidationError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (!/[a-záéíóúñ]/i.test(password) || !/[a-záéíóúñ]/.test(password)) return 'La contraseña debe incluir al menos una letra minúscula.';
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula.';
  if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(password)) return 'La contraseña debe incluir al menos un símbolo.';
  return null;
}

export function isStrongPassword(password: string): boolean {
  return passwordValidationError(password) === null;
}
