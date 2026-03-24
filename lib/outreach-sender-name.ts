/**
 * Nombre del remitente para la firma de mensajes de outreach (WhatsApp).
 * - `USER_NAME`: servidor (API de IA, etc.)
 * - `NEXT_PUBLIC_USER_NAME`: cliente (plantilla al generar sin pasar por API)
 * Puedes definir solo NEXT_PUBLIC si quieres un único valor en .env.local
 */
export function getOutreachSenderName(): string {
  const server = process.env.USER_NAME?.trim();
  const publicName = process.env.NEXT_PUBLIC_USER_NAME?.trim();
  return server || publicName || "";
}
