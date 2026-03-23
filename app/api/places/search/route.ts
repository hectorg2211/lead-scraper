import { NextResponse } from "next/server";
import { buildLeadQuery, searchTextPlaces } from "@/lib/places";

export const runtime = "nodejs";

type Body = {
  niche?: string;
  location?: string;
  maxResults?: number;
  regionCode?: string;
  languageCode?: string;
};

export async function POST(req: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Falta GOOGLE_PLACES_API_KEY. Añádela en .env.local y activa Places API (New) en Google Cloud.",
      },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo JSON no válido" },
      { status: 400 }
    );
  }

  const niche = (body.niche ?? "").trim();
  const location = (body.location ?? "").trim();
  if (!niche || !location) {
    return NextResponse.json(
      { error: "El nicho y la ubicación son obligatorios." },
      { status: 400 }
    );
  }

  const maxResults = Math.min(
    60,
    Math.max(1, Number(body.maxResults) || 20)
  );
  const textQuery = buildLeadQuery(niche, location);

  try {
    const { places, truncated } = await searchTextPlaces(key, textQuery, {
      maxTotal: maxResults,
      regionCode: body.regionCode?.trim() || undefined,
      languageCode: body.languageCode?.trim() || undefined,
    });

    return NextResponse.json({
      query: textQuery,
      count: places.length,
      truncated,
      places,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "La búsqueda ha fallado";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
