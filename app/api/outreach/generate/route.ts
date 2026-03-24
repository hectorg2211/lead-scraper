import OpenAI from "openai";
import { NextResponse } from "next/server";
import { OUTREACH_AI_SYSTEM_PROMPT } from "@/lib/outreach-ai-prompt";
import type { PlaceLead } from "@/lib/places";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gpt-4o-mini";

function summarizePlaceForModel(p: PlaceLead): Record<string, string | null> {
  return {
    name: p.name || null,
    category: p.primaryTypeLabel || p.primaryType || null,
    address: p.address || null,
    summary: p.summary || null,
    phone: p.phone || null,
    website: p.website || null,
    area: p.address?.trim()
      ? p.address.split(",").slice(-2).join(",").trim() || p.address
      : null,
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Configura OPENAI_API_KEY en .env.local para generar con IA.",
      },
      { status: 503 }
    );
  }

  let body: { place?: PlaceLead };
  try {
    body = (await req.json()) as { place?: PlaceLead };
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const place = body.place;
  if (!place || typeof place !== "object") {
    return NextResponse.json({ error: "Falta el objeto place" }, { status: 400 });
  }

  const model =
    process.env.OPENAI_OUTREACH_MODEL?.trim() || DEFAULT_MODEL;

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: OUTREACH_AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Datos del negocio (JSON):\n${JSON.stringify(summarizePlaceForModel(place), null, 2)}`,
        },
      ],
      temperature: 0.65,
      max_tokens: 900,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json(
        { error: "El modelo no devolvió texto" },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: text });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al llamar a OpenAI";
    const status = message.includes("API key") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
