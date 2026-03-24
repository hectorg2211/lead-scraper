import type { PlaceLead } from "@/lib/places";

/**
 * Borrador tipo WhatsApp: piloto sin riesgo + ángulo de mensajes perdidos (B2B / automatización).
 * Texto en español.
 */
export function generateOutreachMessage(place: PlaceLead): string {
  const business = place.name?.trim() || "";
  const greeting = business ? `Hola, ${business}:` : "Hola,";
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
      : "Me adapto al horario que te venga bien.";

  return `${greeting}

Te escribí hace un rato por una consulta / reserva y aún no había respuesta: entiendo que estés a tope. También sé que si el WhatsApp queda sin contestar, mucha gente llama al siguiente en Google Maps.

Estoy probando un asistente de WhatsApp automatizado para negocios de ${category.toLowerCase()}: responde preguntas frecuentes y gestiona citas para que no se te escapen clientes mientras atiendes.

Para los primeros pilotos ofrezco una puesta en marcha de 14 días. Si no te ahorra tiempo de verdad o no reserva citas, no pagas.

¿Te encaja una llamada de 10 minutos? Puedo enseñarte una auditoría rápida de cuántas consultas se pierden — ${locality}

Gracias,
[Tu nombre]`;
}
