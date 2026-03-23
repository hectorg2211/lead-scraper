"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  deleteLeadApi,
  fetchListLeads,
  listLeadsQueryKey,
  listsQueryKey,
  updateLeadApi,
} from "@/lib/leads-api";
import type {
  LeadPriority,
  LeadStatus,
  SavedLead,
} from "@/lib/saved-leads-types";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Cualificado",
  lost: "Descartado",
  won: "Ganado",
};

const PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

function waDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function LeadEditor({
  lead,
  onUpdated,
  onDeleted,
}: {
  lead: SavedLead;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [tags, setTags] = useState(lead.tags.join(", "));
  const [notes, setNotes] = useState(lead.notes);
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [priority, setPriority] = useState<LeadPriority>(lead.priority);
  const [followUpAt, setFollowUpAt] = useState(
    lead.followUpAt ? lead.followUpAt.slice(0, 16) : ""
  );
  const [nextStep, setNextStep] = useState(lead.nextStep ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const phone = lead.place.phone?.trim() ?? "";
  const digits = waDigits(phone);
  const waUrl =
    digits.length >= 8
      ? `https://wa.me/${digits}`
      : null;

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
    onUpdated,
  ]);

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
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
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

  const query = useQuery({
    queryKey: listLeadsQueryKey(listId || null, tagFilter),
    queryFn: () => fetchListLeads(listId, tagFilter || undefined),
    enabled: Boolean(listId),
  });

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

            <div className="flex flex-col gap-6">
              {query.data.leads.map((lead) => (
                <LeadEditor
                  key={lead.id}
                  lead={lead}
                  onUpdated={refetch}
                  onDeleted={refetch}
                />
              ))}
            </div>

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
