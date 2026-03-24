/**
 * Digits for https://wa.me/{digits} (sin + ni espacios).
 * Si el número viene sin país (típico nationalPhoneNumber de Google en México: 10 dígitos),
 * WhatsApp puede interpretar mal el prefijo (p. ej. 66… como +66 Tailandia).
 * Aquí se asume México (+52) cuando falta el código.
 */
export function whatsappMeDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (!d) return "";

  if (d.startsWith("52")) {
    return d;
  }

  if (d.length === 10) {
    return `52${d}`;
  }

  if (d.length === 11 && d.startsWith("1")) {
    return `52${d}`;
  }

  return d;
}
