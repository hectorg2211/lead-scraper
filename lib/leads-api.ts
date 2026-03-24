import type { PlaceLead } from "@/lib/places";

/** Genera mensaje de contacto con IA (requiere OPENAI_API_KEY en el servidor). */
export async function generateOutreachWithAi(
  place: PlaceLead
): Promise<string> {
  const res = await fetch("/api/outreach/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place }),
  });
  const data = (await res.json()) as { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  if (!data.message?.trim()) {
    throw new Error("Respuesta inválida del servidor");
  }
  return data.message.trim();
}
import type {
  LeadList,
  LeadPriority,
  LeadStatus,
  SavedLead,
} from "@/lib/saved-leads-types";

export const listsQueryKey = ["saved-lists"] as const;

export async function fetchLists(): Promise<LeadList[]> {
  const res = await fetch("/api/lists");
  const data = (await res.json()) as { lists?: LeadList[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  return data.lists ?? [];
}

export async function createListApi(name: string): Promise<LeadList> {
  const res = await fetch("/api/lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = (await res.json()) as { list?: LeadList; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  if (!data.list) throw new Error("Respuesta inválida");
  return data.list;
}

export async function updateListApi(
  listId: string,
  name: string
): Promise<LeadList> {
  const res = await fetch(`/api/lists/${listId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = (await res.json()) as { list?: LeadList; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  if (!data.list) throw new Error("Respuesta inválida");
  return data.list;
}

export async function deleteListApi(listId: string): Promise<void> {
  const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
}

export function listLeadsQueryKey(
  listId: string | null,
  tag?: string,
  status?: LeadStatus | ""
) {
  return ["saved-leads", listId, tag ?? "", status ?? ""] as const;
}

export async function fetchListLeads(
  listId: string,
  tag?: string,
  status?: LeadStatus | ""
): Promise<{ list: LeadList; leads: SavedLead[] }> {
  const params = new URLSearchParams();
  if (tag?.trim()) params.set("tag", tag.trim());
  if (status) params.set("status", status);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`/api/lists/${listId}/leads${q}`);
  const data = (await res.json()) as {
    list?: LeadList;
    leads?: SavedLead[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  return {
    list: data.list!,
    leads: data.leads ?? [],
  };
}

export async function savePlaceToList(
  listId: string,
  place: PlaceLead,
  options?: {
    tags?: string[];
    sourceQuery?: string | null;
    status?: LeadStatus;
    priority?: LeadPriority;
  }
): Promise<{ lead: SavedLead; created: boolean }> {
  const res = await fetch(`/api/lists/${listId}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      place,
      tags: options?.tags,
      sourceQuery: options?.sourceQuery ?? null,
      status: options?.status,
      priority: options?.priority,
    }),
  });
  const data = (await res.json()) as {
    lead?: SavedLead;
    created?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  if (!data.lead) throw new Error("Respuesta inválida");
  return { lead: data.lead, created: Boolean(data.created) };
}

export async function savePlacesBulk(
  listId: string,
  places: PlaceLead[],
  sourceQuery?: string | null
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const res = await fetch(`/api/lists/${listId}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ places, sourceQuery: sourceQuery ?? null }),
  });
  const data = (await res.json()) as {
    inserted?: number;
    updated?: number;
    errors?: string[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  return {
    inserted: data.inserted ?? 0,
    updated: data.updated ?? 0,
    errors: data.errors ?? [],
  };
}

export async function updateLeadApi(
  leadId: string,
  patch: {
    tags?: string[];
    notes?: string;
    status?: LeadStatus;
    priority?: LeadPriority;
    followUpAt?: string | null;
    nextStep?: string | null;
    outreachMessage?: string;
  }
): Promise<SavedLead> {
  const res = await fetch(`/api/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as { lead?: SavedLead; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
  if (!data.lead) throw new Error("Respuesta inválida");
  return data.lead;
}

export async function deleteLeadApi(leadId: string): Promise<void> {
  const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Error ${res.status}`);
  }
}
