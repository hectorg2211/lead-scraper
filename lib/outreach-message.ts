import type { PlaceLead } from "@/lib/places";
import { getOutreachSenderName } from "@/lib/outreach-sender-name";

/**
 * Borrador tipo WhatsApp: prototipo hecho para el negocio del prospecto (no confundir con la empresa del remitente).
 * Español de México.
 */
export function generateOutreachMessage(place: PlaceLead): string {
  const business = place.name?.trim() || "";
  const category =
    place.primaryTypeLabel?.trim() ||
    place.primaryType?.replace(/^_|_$/g, "").replace(/_/g, " ") ||
    "servicios locales";
  const areaHint = place.address?.trim()
    ? place.address.split(",").slice(-2).join(",").trim() || place.address
    : null;

  const locality =
    areaHint && !/^tu zona$/i.test(areaHint)
      ? `Me adapto a tu horario en ${areaHint}.`
      : "Me adapto al horario que te quede mejor.";

  const hasWebsite = Boolean(place.website?.trim());
  const onlinePresenceLine = hasWebsite
    ? ""
    : `

🌐 También tengo ideas para mejorar la presencia online del negocio, para que más gente te encuentre. Si aún no tienes página web, suele valer la pena algo sencillo en línea. Puedo mostrarte un prototipo de página pensado para ti en la misma llamada.`;

  const trialLine = hasWebsite
    ? "🎁 La prueba es gratis: un mes completo, sin compromiso, para que lo pruebes y veas el impacto."
    : "La prueba es gratis: un mes completo, sin compromiso, para que lo pruebes y veas el impacto.";

  const sender = getOutreachSenderName();
  const signOff = sender || "[Tu nombre]";
  const intro = sender
    ? `Hola, ¿qué tal? Soy ${sender}.`
    : "Hola, ¿qué tal?";

  const paraNegocio = business
    ? `pensado para ${business} (${category.toLowerCase()})`
    : `pensado para negocios de ${category.toLowerCase()}`;

  return `${intro}

Te escribo porque armé un prototipo de automatización con IA para WhatsApp, específicamente ${paraNegocio}. Sé que muchas veces se pueden perder clientes si no se responden mensajes a tiempo 😬

📱 Google Maps empuja a que la gente llame o escriba al siguiente en la categoría, y eso puede afectar el negocio.

🤖 Con el prototipo se pueden atender preguntas frecuentes y gestionar citas de forma más eficiente mientras atienden.

${trialLine}${onlinePresenceLine}

📞 ¿Qué te parece una llamada corta o videollamada para mostrarte cómo quedó el prototipo? ${locality}

Saludos,
${signOff}`;
}
