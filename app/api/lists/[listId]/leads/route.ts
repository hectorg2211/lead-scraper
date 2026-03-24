import { NextResponse } from "next/server";
import type { PlaceLead } from "@/lib/places";
import {
  addLead,
  addLeadsBulk,
  ensureIndexes,
  getListById,
  listLeads,
} from "@/lib/saved-leads-db";
import type {
  LeadPriority,
  LeadStatus,
} from "@/lib/saved-leads-types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ listId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { listId } = await ctx.params;
  try {
    await ensureIndexes();
    const list = await getListById(listId);
    if (!list) {
      return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
    }
    const url = new URL(req.url);
    const tag = url.searchParams.get("tag") ?? undefined;
    const leads = await listLeads(listId, { tag });
    return NextResponse.json({ list, leads });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudieron cargar los prospectos";
    const status = message.includes("MONGODB_URI") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

type SingleBody = {
  place: PlaceLead;
  tags?: string[];
  notes?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  followUpAt?: string | null;
  nextStep?: string | null;
  sourceQuery?: string | null;
  outreachMessage?: string;
};

type BulkBody = {
  places: PlaceLead[];
  sourceQuery?: string | null;
};

export async function POST(req: Request, ctx: Ctx) {
  const { listId } = await ctx.params;
  try {
    await ensureIndexes();
    const list = await getListById(listId);
    if (!list) {
      return NextResponse.json({ error: "Lista no encontrada" }, { status: 404 });
    }

    let body: SingleBody | BulkBody;
    try {
      body = (await req.json()) as SingleBody | BulkBody;
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON no válido" },
        { status: 400 }
      );
    }

    if (Array.isArray((body as BulkBody).places)) {
      const b = body as BulkBody;
      const result = await addLeadsBulk(
        listId,
        b.places ?? [],
        b.sourceQuery
      );
      return NextResponse.json(result);
    }

    const s = body as SingleBody;
    if (!s.place || typeof s.place !== "object") {
      return NextResponse.json(
        { error: "Falta el objeto place" },
        { status: 400 }
      );
    }

    const { lead, created } = await addLead(listId, {
      place: s.place,
      tags: s.tags,
      notes: s.notes,
      status: s.status,
      priority: s.priority,
      followUpAt: s.followUpAt,
      nextStep: s.nextStep,
      sourceQuery: s.sourceQuery,
      outreachMessage: s.outreachMessage,
    });
    return NextResponse.json({ lead, created });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo guardar el prospecto";
    const status = message.includes("MONGODB_URI") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
