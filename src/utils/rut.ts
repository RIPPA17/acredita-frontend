export function isValidRut(rut: string): boolean {
  const clean = rut.replace(/[.\s]/g, '').toUpperCase();
  if (!/^\d{7,8}-[0-9K]$/.test(clean)) return false;

  const [num, dv] = clean.split('-');
  let sum = 0;
  let multiplier = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    sum += parseInt(num[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const computedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return computedDv === dv;
}
