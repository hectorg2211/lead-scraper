import { NextResponse } from "next/server";
import { createList, ensureIndexes, findListsWithCounts } from "@/lib/saved-leads-db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureIndexes();
    const lists = await findListsWithCounts();
    return NextResponse.json({ lists });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudieron cargar las listas";
    const status = message.includes("MONGODB_URI") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();
    let body: { name?: string };
    try {
      body = (await req.json()) as { name?: string };
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON no válido" },
        { status: 400 }
      );
    }
    const list = await createList(body.name ?? "");
    return NextResponse.json({ list });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo crear la lista";
    const status = message.includes("MONGODB_URI") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
