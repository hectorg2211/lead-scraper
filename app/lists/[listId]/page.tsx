"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteLeadApi,
  fetchListLeads,
  generateOutreachWithAi,
  listLeadsQueryKey,
  listsQueryKey,
  updateLeadApi,
} from "@/lib/leads-api";
import {
  STATUS_BADGE_CLASSES,
  STATUS_FIELD_CLASSES,
  STATUS_LABELS,
} from "@/lib/lead-status-i18n";
import { cn } from "@/lib/utils";
import { generateOutreachMessage } from "@/lib/outreach-message";
import type {
  LeadPriority,
  LeadStatus,
  SavedLead,
} from "@/lib/saved-leads-types";

const PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

function truncateDetail(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function LeadRow({
  lead,
  onSelect,
}: {
  lead: SavedLead;
  onSelect: () => void;
}) {
  const phone = lead.place.phone?.trim() ?? "";
  const address = lead.place.address?.trim() ?? "";
  const detailParts: string[] = [];
  if (phone) detailParts.push(phone);
  if (address) detailParts.push(truncateDetail(address, 40));
  const secondary =
    detailParts.join(" · ") ||
    lead.place.primaryTypeLabel ||
    (lead.tags[0] ? `#${lead.tags[0]}` : null) ||
    "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
          {lead.place.name}
        </p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {secondary}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        <span
          className={cn(
            "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
            STATUS_BADGE_CLASSES[lead.status]
          )}
        >
          {STATUS_LABELS[lead.status]}
        </span>
        <span
          className={
            lead.priority === "high"
              ? "whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/60 dark:text-red-200"
              : lead.priority === "medium"
                ? "whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                : "whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }
        >
          {PRIORITY_LABELS[lead.priority]}
        </span>
      </div>
    </button>
  );
}

function waDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function LeadEditor({
  lead,
  onUpdated,
  onDeleted,
  variant = "card",
}: {
  lead: SavedLead;
  onUpdated: () => void;
  onDeleted: () => void;
  /** `plain` = no inner frame; use inside modal/dialog */
  variant?: "card" | "plain";
}) {
  const [tags, setTags] = useState(lead.tags.join(", "));
  const [notes, setNotes] = useState(lead.notes);
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [priority, setPriority] = useState<LeadPriority>(lead.priority);
  const [followUpAt, setFollowUpAt] = useState(
    lead.followUpAt ? lead.followUpAt.slice(0, 16) : ""
  );
  const [nextStep, setNextStep] = useState(lead.nextStep ?? "");
  const [outreachMessage, setOutreachMessage] = useState(
    lead.outreachMessage ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setOutreachMessage(lead.outreachMessage ?? "");
  }, [lead.id, lead.outreachMessage]);

  const phone = lead.place.phone?.trim() ?? "";
  const digits = waDigits(phone);
  const waUrl =
    digits.length >= 8
      ? `https://wa.me/${digits}`
      : null;
  const waWithMessage =
    waUrl && outreachMessage.trim()
      ? `${waUrl}?text=${encodeURIComponent(outreachMessage.trim())}`
      : waUrl;

  const save = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const tagList = tags
        .split(/[,;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      await updateLeadApi(lead.id, {
        tags: tagList,
        notes,
        status,
        priority,
        followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
        nextStep: nextStep.trim() || null,
        outreachMessage,
      });
      onUpdated();
      setMsg("Guardado");
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }, [
    lead.id,
    tags,
    notes,
    status,
    priority,
    followUpAt,
    nextStep,
    outreachMessage,
    onUpdated,
  ]);

  const generateOutreach = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      let text: string;
      let usedFallback = false;
      let fallbackReason = "";
      try {
        text = await generateOutreachWithAi(lead.place);
      } catch (aiErr) {
        usedFallback = true;
        text = generateOutreachMessage(lead.place);
        fallbackReason =
          aiErr instanceof Error ? aiErr.message : "IA no disponible";
      }
      setOutreachMessage(text);
      await updateLeadApi(lead.id, { outreachMessage: text });
      onUpdated();
      if (usedFallback) {
        setMsg(`Guardado con plantilla — ${fallbackReason}`);
        setTimeout(() => setMsg(null), 6000);
      } else {
        setMsg("Mensaje generado y guardado (IA)");
        setTimeout(() => setMsg(null), 2500);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al generar");
    } finally {
      setBusy(false);
    }
  }, [lead.id, lead.place, onUpdated]);

  const remove = useCallback(async () => {
    if (!confirm("¿Quitar este prospecto de la lista?")) return;
    setBusy(true);
    try {
      await deleteLeadApi(lead.id);
      onDeleted();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setBusy(false);
    }
  }, [lead.id, onDeleted]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${label} copiado`);
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg("No se pudo copiar");
    }
  };

  return (
    <article
      className={
        variant === "plain"
          ? "min-w-0"
          : "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold leading-tight">
            {lead.place.name}
          </h3>
          {lead.place.address && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {lead.place.address}
            </p>
          )}
          {lead.sourceQuery && (
            <p className="mt-1 text-xs text-zinc-500">
              Búsqueda: {lead.sourceQuery}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.place.mapsUrl && (
            <a
              href={lead.place.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
            >
              Maps
            </a>
          )}
          {lead.place.website && (
            <a
              href={
                lead.place.website.startsWith("http")
                  ? lead.place.website
                  : `https://${lead.place.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-600"
            >
              Web
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        {phone ? (
          <>
            <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
              {phone}
            </span>
            <button
              type="button"
              onClick={() => void copy(phone, "Teléfono")}
              className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              Copiar teléfono
            </button>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
              >
                WhatsApp
              </a>
            )}
          </>
        ) : (
          <span className="text-sm text-zinc-500">Sin teléfono</span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Mensaje de contacto (WhatsApp)</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void generateOutreach()}
            className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
          >
            Generar con IA
          </button>
        </div>
        <textarea
          value={outreachMessage}
          onChange={(e) => setOutreachMessage(e.target.value)}
          rows={12}
          placeholder="Pulsa «Generar con IA» (requiere OPENAI_API_KEY) o escribe tu texto. Sin clave se usa una plantilla. «Guardar cambios» persiste todo."
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed dark:border-zinc-600 dark:bg-zinc-950"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!outreachMessage.trim()}
            onClick={() => void copy(outreachMessage.trim(), "Mensaje")}
            className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400 disabled:opacity-40"
          >
            Copiar mensaje
          </button>
          {waWithMessage && (
            <a
              href={waWithMessage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              Abrir WhatsApp con este texto
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Etiquetas (separadas por coma)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="frio, llamar, vip"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Estado</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className={cn(
                "rounded-lg border px-3 py-2",
                STATUS_FIELD_CLASSES[status]
              )}
            >
              {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Prioridad</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as LeadPriority)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
            >
              {(Object.keys(PRIORITY_LABELS) as LeadPriority[]).map((k) => (
                <option key={k} value={k}>
                  {PRIORITY_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <label className="mt-4 flex flex-col gap-1 text-sm">
        <span className="font-medium">Notas</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Quién llamó, objeciones, próximo paso…"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Seguimiento (recordatorio)</span>
          <input
            type="datetime-local"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Siguiente paso</span>
          <input
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="Llamar el martes, enviar propuesta…"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="text-sm text-red-700 underline dark:text-red-400"
        >
          Quitar de la lista
        </button>
        {msg && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</span>
        )}
      </div>
    </article>
  );
}

export default function ListDetailPage() {
  const params = useParams();
  const listId = useMemo(() => {
    const raw = params.listId;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  }, [params.listId]);

  const qc = useQueryClient();
  const [tagFilter, setTagFilter] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: listLeadsQueryKey(listId || null, tagFilter),
    queryFn: () => fetchListLeads(listId, tagFilter || undefined),
    enabled: Boolean(listId),
  });

  const selectedLead = useMemo(
    () => query.data?.leads.find((l) => l.id === openLeadId) ?? null,
    [query.data?.leads, openLeadId]
  );

  useEffect(() => {
    if (openLeadId && !selectedLead) setOpenLeadId(null);
  }, [openLeadId, selectedLead]);

  const refetch = useCallback(() => {
    void qc.invalidateQueries({ queryKey: listsQueryKey });
    void query.refetch();
  }, [qc, query]);

  const err =
    query.isError && query.error instanceof Error
      ? query.error.message
      : null;

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/lists"
              className="text-sm font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 dark:text-emerald-400"
            >
              ← Todas las listas
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
            >
              Buscador
            </Link>
          </div>
          {query.data?.list && (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {query.data.list.name}
            </h1>
          )}
          {query.isLoading && (
            <p className="text-sm text-zinc-500">Cargando…</p>
          )}
        </header>

        {err && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {err.includes("MONGODB_URI")
              ? "Configura MONGODB_URI en .env.local."
              : err}
          </p>
        )}

        {query.data && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {query.data.leads.length}{" "}
                {query.data.leads.length === 1 ? "prospecto" : "prospectos"}
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Filtrar por etiqueta</span>
                <input
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="Exacto, sin distinguir mayúsculas"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              {query.data.leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onSelect={() => setOpenLeadId(lead.id)}
                />
              ))}
            </div>

            <Dialog
              open={Boolean(selectedLead)}
              onOpenChange={(open) => {
                if (!open) setOpenLeadId(null);
              }}
            >
              <DialogContent className="max-h-[min(90vh,56rem)] w-full gap-0 overflow-y-auto p-0 sm:max-w-3xl">
                {selectedLead && (
                  <>
                    <DialogHeader className="sr-only">
                      <DialogTitle>{selectedLead.place.name}</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 pt-12 sm:p-6 sm:pt-14">
                      <LeadEditor
                        key={selectedLead.id}
                        variant="plain"
                        lead={selectedLead}
                        onUpdated={refetch}
                        onDeleted={() => {
                          setOpenLeadId(null);
                          refetch();
                        }}
                      />
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {query.data.leads.length === 0 && (
              <p className="text-sm text-zinc-500">
                {tagFilter.trim()
                  ? "Ningún prospecto con esa etiqueta."
                  : "Esta lista está vacía. Guarda desde el buscador."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
