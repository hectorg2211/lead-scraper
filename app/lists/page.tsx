"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  createListApi,
  deleteListApi,
  fetchLists,
  listsQueryKey,
} from "@/lib/leads-api";

export default function ListsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data: lists, isLoading, error, isError } = useQuery({
    queryKey: listsQueryKey,
    queryFn: fetchLists,
  });

  const createMut = useMutation({
    mutationFn: () => createListApi(name),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: listsQueryKey });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteListApi(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: listsQueryKey }),
  });

  const err =
    isError && error instanceof Error
      ? error.message
      : isError
        ? "Error"
        : null;

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Prospección B2B
            </p>
            <Link
              href="/"
              className="text-sm font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 dark:text-emerald-400"
            >
              ← Volver al buscador
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Listas guardadas
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Cada lista agrupa prospectos de Maps. Añade etiquetas, notas y
            seguimiento desde el detalle de la lista.
          </p>
        </header>

        {err && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {err.includes("MONGODB_URI")
              ? "Configura MONGODB_URI en .env.local para usar el almacenamiento."
              : err}
          </p>
        )}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Nueva lista
          </h2>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMut.mutate();
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Dentales Madrid — enero"
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-950"
            />
            <button
              type="submit"
              disabled={!name.trim() || createMut.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMut.isPending ? "Creando…" : "Crear lista"}
            </button>
          </form>
          {createMut.isError && createMut.error instanceof Error && (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              {createMut.error.message}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Tus listas</h2>
          {isLoading && (
            <p className="text-sm text-zinc-500">Cargando…</p>
          )}
          {!isLoading && lists?.length === 0 && (
            <p className="text-sm text-zinc-500">
              Aún no hay listas. Crea una arriba o guarda desde el buscador.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {lists?.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Link
                  href={`/lists/${l.id}`}
                  className="font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 dark:text-emerald-400"
                >
                  {l.name}
                </Link>
                <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                  <span>
                    {l.leadCount ?? 0}{" "}
                    {l.leadCount === 1 ? "prospecto" : "prospectos"}
                  </span>
                  <button
                    type="button"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `¿Eliminar la lista «${l.name}» y todos sus prospectos?`
                        )
                      ) {
                        deleteMut.mutate(l.id);
                      }
                    }}
                    className="text-red-700 underline decoration-red-700/30 underline-offset-2 hover:decoration-red-700 dark:text-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
