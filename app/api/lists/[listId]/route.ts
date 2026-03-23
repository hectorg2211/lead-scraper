import { NextResponse } from "next/server";
import { deleteList, getListById, updateList } from "@/lib/saved-leads-db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { listId } = await ctx.params;
  try {
    const list = await getListById(listId);
    if (!list) {
      return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ list });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al cargar la lista";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { listId } = await ctx.params;
  try {
    let body: { name?: string };
    try {
      body = (await req.json()) as { name?: string };
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON no válido" },
        { status: 400 }
      );
    }
    const list = await updateList(listId, body.name ?? "");
    if (!list) {
      return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ list });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo actualizar la lista";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { listId } = await ctx.params;
  try {
    const ok = await deleteList(listId);
    if (!ok) {
      return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo eliminar la lista";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
