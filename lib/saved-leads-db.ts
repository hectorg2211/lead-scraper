import { ObjectId, type Collection, type Filter } from "mongodb";
import type { PlaceLead } from "@/lib/places";
import { getDb } from "@/lib/mongodb";
import type {
  LeadList,
  LeadPriority,
  LeadStatus,
  SavedLead,
} from "@/lib/saved-leads-types";

const LISTS = "lead_lists";
const LEADS = "saved_leads";

type ListDoc = {
  _id: ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

type LeadDoc = {
  _id: ObjectId;
  listId: ObjectId;
  placeId: string;
  place: PlaceLead;
  tags: string[];
  notes: string;
  status: LeadStatus;
  priority: LeadPriority;
  followUpAt: Date | null;
  nextStep: string | null;
  sourceQuery: string | null;
  /** Present on new docs; older rows may omit until next save */
  outreachMessage?: string;
  createdAt: Date;
  updatedAt: Date;
};

function toIso(d: Date): string {
  return d.toISOString();
}

function mapList(d: ListDoc, leadCount?: number): LeadList {
  return {
    id: d._id.toHexString(),
    name: d.name,
    leadCount,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

function mapLead(d: LeadDoc): SavedLead {
  return {
    id: d._id.toHexString(),
    listId: d.listId.toHexString(),
    placeId: d.placeId,
    place: d.place,
    tags: d.tags,
    notes: d.notes,
    status: d.status,
    priority: d.priority,
    followUpAt: d.followUpAt ? toIso(d.followUpAt) : null,
    nextStep: d.nextStep,
    sourceQuery: d.sourceQuery,
    outreachMessage: d.outreachMessage ?? "",
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

async function listsCol(): Promise<Collection<ListDoc>> {
  const db = await getDb();
  return db.collection<ListDoc>(LISTS);
}

async function leadsCol(): Promise<Collection<LeadDoc>> {
  const db = await getDb();
  return db.collection<LeadDoc>(LEADS);
}

export async function ensureIndexes(): Promise<void> {
  const leads = await leadsCol();
  await leads.createIndex({ listId: 1, placeId: 1 }, { unique: true });
  await leads.createIndex({ listId: 1, updatedAt: -1 });
  const lists = await listsCol();
  await lists.createIndex({ updatedAt: -1 });
}

function parseListId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error("ID de lista no válido");
  }
  return new ObjectId(id);
}

function parseLeadId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error("ID de prospecto no válido");
  }
  return new ObjectId(id);
}

export async function findListsWithCounts(): Promise<LeadList[]> {
  const db = await getDb();
  const pipeline = [
    { $sort: { updatedAt: -1 as const } },
    {
      $lookup: {
        from: LEADS,
        localField: "_id",
        foreignField: "listId",
        as: "leads",
      },
    },
    {
      $addFields: { leadCount: { $size: "$leads" } },
    },
    { $project: { leads: 0 } },
  ];
  const rows = await db
    .collection<ListDoc>(LISTS)
    .aggregate<{ _id: ObjectId; name: string; createdAt: Date; updatedAt: Date; leadCount: number }>(
      pipeline
    )
    .toArray();
  return rows.map((r) =>
    mapList(
      {
        _id: r._id,
        name: r.name,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
      r.leadCount
    )
  );
}

export async function createList(name: string): Promise<LeadList> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre de la lista es obligatorio");
  }
  const col = await listsCol();
  const now = new Date();
  const doc: Omit<ListDoc, "_id"> = {
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await col.insertOne(doc as ListDoc);
  return mapList({
    _id: insertedId,
    ...doc,
  });
}

export async function updateList(
  listId: string,
  name: string
): Promise<LeadList | null> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre de la lista es obligatorio");
  }
  const id = parseListId(listId);
  const col = await listsCol();
  const now = new Date();
  const res = await col.findOneAndUpdate(
    { _id: id },
    { $set: { name: trimmed, updatedAt: now } },
    { returnDocument: "after" }
  );
  return res ? mapList(res) : null;
}

export async function deleteList(listId: string): Promise<boolean> {
  const id = parseListId(listId);
  const l = await listsCol();
  const leads = await leadsCol();
  await leads.deleteMany({ listId: id });
  const res = await l.deleteOne({ _id: id });
  return res.deletedCount === 1;
}

export async function getListById(listId: string): Promise<LeadList | null> {
  const id = parseListId(listId);
  const col = await listsCol();
  const doc = await col.findOne({ _id: id });
  return doc ? mapList(doc) : null;
}

export async function listLeads(
  listId: string,
  options?: { tag?: string }
): Promise<SavedLead[]> {
  const lid = parseListId(listId);
  const col = await leadsCol();
  const filter: Filter<LeadDoc> = { listId: lid };
  if (options?.tag?.trim()) {
    const t = options.tag.trim();
    filter.tags = new RegExp(`^${escapeRegex(t)}$`, "i");
  }
  const docs = await col
    .find(filter)
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => mapLead(d));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type AddLeadInput = {
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

export async function addLead(
  listId: string,
  input: AddLeadInput
): Promise<{ lead: SavedLead; created: boolean }> {
  const lid = parseListId(listId);
  const place = input.place;
  const placeId = place.id?.trim();
  if (!placeId) {
    throw new Error("El lugar no tiene ID de Google; no se puede deduplicar.");
  }
  const col = await leadsCol();
  const now = new Date();
  const tags = normalizeTags(input.tags);

  const existing = await col.findOne({ listId: lid, placeId });
  if (existing) {
    const patch: Partial<LeadDoc> = {
      place,
      updatedAt: now,
    };
    if (tags.length > 0) {
      patch.tags = mergeTags(existing.tags, tags);
    }
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status) patch.status = input.status;
    if (input.priority) patch.priority = input.priority;
    if (input.followUpAt !== undefined) {
      patch.followUpAt = input.followUpAt
        ? new Date(input.followUpAt)
        : null;
    }
    if (input.nextStep !== undefined) patch.nextStep = input.nextStep;
    if (input.sourceQuery !== undefined) patch.sourceQuery = input.sourceQuery;
    if (input.outreachMessage !== undefined) {
      patch.outreachMessage = input.outreachMessage;
    }

    await col.updateOne({ _id: existing._id }, { $set: patch });
    const updated = await col.findOne({ _id: existing._id });
    if (!updated) throw new Error("No se pudo actualizar el prospecto");
    await touchList(lid);
    return { lead: mapLead(updated), created: false };
  }

  const doc: Omit<LeadDoc, "_id"> = {
    listId: lid,
    placeId,
    place,
    tags,
    notes: input.notes?.trim() ?? "",
    status: input.status ?? "new",
    priority: input.priority ?? "medium",
    followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
    nextStep: input.nextStep?.trim() ?? null,
    sourceQuery: input.sourceQuery?.trim() ?? null,
    outreachMessage: input.outreachMessage?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await col.insertOne(doc as LeadDoc);
  await touchList(lid);
  return {
    lead: mapLead({ _id: insertedId, ...doc }),
    created: true,
  };
}

async function touchList(listId: ObjectId): Promise<void> {
  const col = await listsCol();
  await col.updateOne(
    { _id: listId },
    { $set: { updatedAt: new Date() } }
  );
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const n = t.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function mergeTags(existing: string[], add: string[]): string[] {
  return normalizeTags([...existing, ...add]);
}

export async function addLeadsBulk(
  listId: string,
  places: PlaceLead[],
  sourceQuery?: string | null
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const place of places) {
    try {
      const { created } = await addLead(listId, {
        place,
        sourceQuery: sourceQuery ?? null,
      });
      if (created) inserted += 1;
      else updated += 1;
    } catch (e) {
      const name = place.name || "sin nombre";
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${name}: ${msg}`);
    }
  }
  return { inserted, updated, errors };
}

export async function updateLead(
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
): Promise<SavedLead | null> {
  const id = parseLeadId(leadId);
  const col = await leadsCol();
  const existing = await col.findOne({ _id: id });
  if (!existing) return null;

  const $set: Partial<LeadDoc> = { updatedAt: new Date() };
  if (patch.tags !== undefined) {
    $set.tags = normalizeTags(patch.tags);
  }
  if (patch.notes !== undefined) $set.notes = patch.notes;
  if (patch.status !== undefined) $set.status = patch.status;
  if (patch.priority !== undefined) $set.priority = patch.priority;
  if (patch.followUpAt !== undefined) {
    $set.followUpAt = patch.followUpAt ? new Date(patch.followUpAt) : null;
  }
  if (patch.nextStep !== undefined) {
    $set.nextStep = patch.nextStep?.trim() ?? null;
  }
  if (patch.outreachMessage !== undefined) {
    $set.outreachMessage = patch.outreachMessage;
  }

  await col.updateOne({ _id: id }, { $set });
  const doc = await col.findOne({ _id: id });
  if (!doc) return null;
  await touchList(doc.listId);
  return mapLead(doc);
}

export async function deleteLead(leadId: string): Promise<boolean> {
  const id = parseLeadId(leadId);
  const col = await leadsCol();
  const doc = await col.findOneAndDelete({ _id: id });
  if (!doc) return false;
  await touchList(doc.listId);
  return true;
}

export async function getLeadById(leadId: string): Promise<SavedLead | null> {
  const id = parseLeadId(leadId);
  const col = await leadsCol();
  const doc = await col.findOne({ _id: id });
  return doc ? mapLead(doc) : null;
}
