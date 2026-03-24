import type { PlaceLead } from "@/lib/places";

/**
 * Borrador tipo WhatsApp: prototipo hecho para ellos + prueba gratuita 1 mes.
 * Español de México. Tono en primera persona (sin “equipo”).
 * Sin mencionar pagos ni auditorías.
 */
export function generateOutreachMessage(place: PlaceLead): string {
  const business = place.name?.trim() || "";
  const greeting = business ? `Hola, ${business},` : "Hola,";
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

Por cierto, si aún no tienes página web, suele valer la pena una presencia en línea sencilla. Da confianza a quien te encuentra en Maps antes de escribir y va muy bien con el WhatsApp bien atendido. También te preparé un prototipo de página pensado para tu negocio si quieres verlo en la misma llamada.`;

  const protoFor =
    business ||
    "tu negocio";

  return `${greeting}

Te escribí hace un rato por una consulta o reserva y aún no había respuesta. Entiendo que andes muy ocupado.

También sé que si el WhatsApp queda sin contestar, mucha gente le marca al siguiente en Google Maps.

Te armé un prototipo en específico para ${protoFor}. Es automatización con IA en WhatsApp pensada para negocios de ${category.toLowerCase()}. Responde preguntas frecuentes y agenda citas para que no se te escapen clientes mientras atiendes.

La prueba gratuita es de un mes para que lo pruebes sin compromiso.${onlinePresenceLine}

¿Te parece bien una llamada de 10 minutos? Te muestro cómo quedó el prototipo pensado para ti. ${locality}

Gracias,
[Tu nombre]`;
}
