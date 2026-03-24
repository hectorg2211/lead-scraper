import { NextResponse } from "next/server";
import {
  deleteLead,
  getLeadById,
  updateLead,
} from "@/lib/saved-leads-db";
import type {
  LeadPriority,
  LeadStatus,
} from "@/lib/saved-leads-types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ leadId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { leadId } = await ctx.params;
  try {
    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: "Prospecto no encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json({ lead });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error al cargar el prospecto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  tags?: string[];
  notes?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  followUpAt?: string | null;
  nextStep?: string | null;
  outreachMessage?: string;
};

export async function PATCH(req: Request, ctx: Ctx) {
  const { leadId } = await ctx.params;
  try {
    let body: PatchBody;
    try {
      body = (await req.json()) as PatchBody;
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON no válido" },
        { status: 400 }
      );
    }
    const lead = await updateLead(leadId, body);
    if (!lead) {
      return NextResponse.json(
        { error: "Prospecto no encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json({ lead });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo actualizar el prospecto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { leadId } = await ctx.params;
  try {
    const ok = await deleteLead(leadId);
    if (!ok) {
      return NextResponse.json(
        { error: "Prospecto no encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "No se pudo eliminar el prospecto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
