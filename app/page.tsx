"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { PlaceLead } from "@/lib/places";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createListApi,
  fetchLists,
  listsQueryKey,
  savePlaceToList,
  savePlacesBulk,
} from "@/lib/leads-api";
import {
  fetchPlacesSearch,
  placesSearchQueryKey,
  type PlacesSearchParams,
} from "@/lib/places-search";
import { toLeadsSvg } from "@/lib/export-leads-svg";

const ResultsMap = dynamic(() => import("@/components/results-map"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[min(420px,55vh)] min-h-[240px] w-full animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
      aria-hidden
    />
  ),
});

type GeocodePayload = { label: string; countryCode?: string };

let didRunAutoLocation = false;

const NICHE_PRESETS = [
  "Clínica dental",
  "Clínica médica",
  "Spa",
  "Salón de belleza",
  "Inmobiliaria",
  "Fontanero",
  "Electricista",
  "Taller mecánico",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function websiteHref(url: string): string {
  const u = url.trim();
  return u.startsWith("http") ? u : `https://${u}`;
}

function parseCsvTags(s: string): string[] | undefined {
  const parts = s.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function toCsv(rows: PlaceLead[]): string {
  const header = [
    "Nombre",
    "Dirección",
    "Teléfono",
    "Sitio web",
    "Categoría principal",
    "Tipos (Google)",
    "Resumen",
    "Nivel de precio",
    "Horario",
    "Valoración",
    "Reseñas",
    "Google Maps",
    "Estado negocio",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        escapeCsvCell(r.name),
        escapeCsvCell(r.address),
        escapeCsvCell(r.phone),
        escapeCsvCell(r.website),
        escapeCsvCell(r.primaryTypeLabel ?? r.primaryType ?? ""),
        escapeCsvCell(r.types.join("; ")),
        escapeCsvCell(r.summary ?? ""),
        escapeCsvCell(r.priceLevelLabel ?? r.priceLevel ?? ""),
        escapeCsvCell(r.openingHoursText ?? ""),
        r.rating != null ? String(r.rating) : "",
        r.reviewCount != null ? String(r.reviewCount) : "",
        escapeCsvCell(r.mapsUrl),
        escapeCsvCell(r.businessStatus ?? ""),
      ].join(",")
    ),
  ];
  return lines.join("\r\n");
}

export default function Home() {
  const [niche, setNiche] = useState("Clínica dental");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(60);
  const [regionCode, setRegionCode] = useState("");
  const [committedSearch, setCommittedSearch] =
    useState<PlacesSearchParams | null>(null);

  const {
    data: searchData,
    isFetching: searchFetching,
    isError: searchIsError,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery({
    queryKey: committedSearch
      ? placesSearchQueryKey(committedSearch)
      : (["places-search", "idle"] as const),
    queryFn: () => fetchPlacesSearch(committedSearch!),
    enabled: committedSearch !== null,
  });

  const loading = committedSearch !== null && searchFetching;
  const error =
    committedSearch !== null && searchIsError
      ? searchError instanceof Error
        ? searchError.message
        : "Error de red. Inténtalo de nuevo."
      : null;
  const queryUsed = searchData?.query ? searchData.query : null;
  const truncated = Boolean(searchData?.truncated);
  const places = searchData?.places ?? [];
  const [csvUrl, setCsvUrl] = useState<string | null>(null);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [locDetecting, setLocDetecting] = useState(false);
  const [locHint, setLocHint] = useState<string | null>(null);

  const canSearch = niche.trim().length > 0 && location.trim().length > 0;

  const applyGeocode = useCallback((data: GeocodePayload, force: boolean) => {
    if (force) {
      setLocation(data.label);
      if (data.countryCode) setRegionCode(data.countryCode);
    } else {
      setLocation((prev) => (prev.trim() === "" ? data.label : prev));
      setRegionCode((prev) =>
        prev.trim() === "" && data.countryCode ? data.countryCode : prev
      );
    }
    setLocHint(null);
  }, []);

  const requestMyLocation = useCallback(
    (force: boolean) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setLocHint("Tu navegador no permite geolocalización.");
        return;
      }
      setLocDetecting(true);
      setLocHint(null);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch("/api/geocode/reverse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }),
            });
            const data = (await res.json()) as {
              error?: string;
              label?: string;
              countryCode?: string;
            };
            if (!res.ok || !data.label) {
              setLocHint(data.error ?? "No se pudo obtener la ciudad.");
              return;
            }
            applyGeocode(
              { label: data.label, countryCode: data.countryCode },
              force
            );
          } catch {
            setLocHint("Error de red al geocodificar.");
          } finally {
            setLocDetecting(false);
          }
        },
        (err) => {
          setLocDetecting(false);
          if (err.code === err.PERMISSION_DENIED) {
            setLocHint(
              "Ubicación denegada. Escribe la ciudad o pulsa de nuevo y permite el permiso."
            );
          } else {
            setLocHint("No se pudo leer tu ubicación.");
          }
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
      );
    },
    [applyGeocode]
  );

  useEffect(() => {
    if (didRunAutoLocation) return;
    didRunAutoLocation = true;
    requestMyLocation(false);
  }, [requestMyLocation]);

  useEffect(() => {
    if (places.length === 0) {
      setCsvUrl(null);
      setSvgUrl(null);
      return;
    }
    const csv = toCsv(places);
    const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const csvObjectUrl = URL.createObjectURL(csvBlob);
    setCsvUrl(csvObjectUrl);

    const svg = toLeadsSvg(places, {
      niche: niche.trim(),
      location: location.trim(),
      query: queryUsed ?? undefined,
    });
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const svgObjectUrl = URL.createObjectURL(svgBlob);
    setSvgUrl(svgObjectUrl);

    return () => {
      URL.revokeObjectURL(csvObjectUrl);
      URL.revokeObjectURL(svgObjectUrl);
    };
  }, [places, niche, location, queryUsed]);

  const runSearch = useCallback(() => {
    setCommittedSearch({
      niche: niche.trim(),
      location: location.trim(),
      maxResults,
      regionCode: regionCode.trim() || undefined,
      languageCode: "es",
    });
  }, [niche, location, maxResults, regionCode]);

  const qc = useQueryClient();
  const { data: listsData, isError: listsLoadError } = useQuery({
    queryKey: listsQueryKey,
    queryFn: fetchLists,
    retry: false,
  });
  const lists = listsData ?? [];
  const [selectedListId, setSelectedListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [saveHint, setSaveHint] = useState<string | null>(null);

  useEffect(() => {
    if (!lists.length) return;
    setSelectedListId((prev) =>
      prev && lists.some((l) => l.id === prev) ? prev : lists[0]!.id
    );
  }, [lists]);

  const createListMut = useMutation({
    mutationFn: () => createListApi(newListName),
    onSuccess: (list) => {
      setNewListName("");
      setSelectedListId(list.id);
      void qc.invalidateQueries({ queryKey: listsQueryKey });
      setSaveHint(`Lista «${list.name}» creada.`);
      setTimeout(() => setSaveHint(null), 3000);
    },
    onError: (e) => {
      setSaveHint(e instanceof Error ? e.message : "Error al crear lista");
    },
  });

  const saveOneMut = useMutation({
    mutationFn: (p: PlaceLead) =>
      savePlaceToList(selectedListId, p, {
        tags: parseCsvTags(saveTags),
        sourceQuery: queryUsed,
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: listsQueryKey });
      setSaveHint(
        res.created ? "Guardado en la lista." : "Ya existía; datos actualizados."
      );
      setTimeout(() => setSaveHint(null), 2500);
    },
    onError: (e) => {
      setSaveHint(e instanceof Error ? e.message : "Error al guardar");
    },
  });

  const saveBulkMut = useMutation({
    mutationFn: () => savePlacesBulk(selectedListId, places, queryUsed),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: listsQueryKey });
      const parts = [
        `${res.inserted} nuevos`,
        res.updated > 0 ? `${res.updated} actualizados` : null,
      ].filter(Boolean);
      setSaveHint(`Listo: ${parts.join(", ")}.`);
      if (res.errors.length > 0) {
        setSaveHint(
          `Parcial: ${parts.join(", ")}. ${res.errors.length} con error (sin ID de Google).`
        );
      }
      setTimeout(() => setSaveHint(null), 5000);
    },
    onError: (e) => {
      setSaveHint(e instanceof Error ? e.message : "Error al guardar");
    },
  });

  const canSaveToMongo =
    Boolean(selectedListId) && !listsLoadError && lists.length > 0;

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Prospección B2B
            </p>
            <Link
              href="/lists"
              className="text-sm font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 dark:text-emerald-400"
            >
              Mis listas guardadas
            </Link>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Buscador de prospectos
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Obtén negocios locales desde Google Maps (Places API oficial) por
            nicho y ciudad. Exporta a CSV para auditorías por WhatsApp,
            mensajes de venta o listas piloto, sin hacer clic manual en el mapa.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Nichos rápidos (alto coste por mensaje perdido)
            </span>
            <div className="flex flex-wrap gap-2">
              {NICHE_PRESETS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setNiche(label)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Nicho / tipo de negocio
              </span>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="p. ej. Clínica dental"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none ring-emerald-500/0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Ubicación
                </span>
                <button
                  type="button"
                  disabled={locDetecting}
                  onClick={() => requestMyLocation(true)}
                  className="text-xs font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 disabled:cursor-wait disabled:opacity-60 dark:text-emerald-400"
                >
                  {locDetecting ? "Detectando…" : "Usar mi ubicación"}
                </button>
              </div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="p. ej. Madrid, España"
                autoComplete="address-level2"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none ring-emerald-500/0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-950"
              />
              {locDetecting && (
                <p className="text-xs text-zinc-500">
                  Obteniendo tu ciudad automáticamente…
                </p>
              )}
              {locHint && !locDetecting && (
                <p className="text-xs text-amber-800 dark:text-amber-200/90">
                  {locHint}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-1">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Máximo de resultados
              </span>
              <input
                type="number"
                min={1}
                max={60}
                value={maxResults}
                onChange={(e) =>
                  setMaxResults(
                    Math.min(60, Math.max(1, Number(e.target.value) || 60))
                  )
                }
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-1">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Región (ISO, opcional)
              </span>
              <input
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value.toUpperCase())}
                placeholder="ES, MX, US…"
                maxLength={2}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <div className="flex items-end sm:col-span-1">
              <button
                type="button"
                disabled={!canSearch || loading}
                onClick={() => runSearch()}
                className="h-[42px] w-full rounded-lg bg-emerald-600 px-4 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Buscando en Maps…" : "Buscar prospectos"}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </p>
          )}

          {queryUsed && (
            <div className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-500">
              <p>
                Consulta enviada a Google:{" "}
                <span className="font-mono text-zinc-700 dark:text-zinc-400">
                  {queryUsed}
                </span>
                {truncated &&
                  " — hay más resultados (sube el máximo o vuelve a buscar)."}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                Las búsquedas idénticas se reutilizan unos 30 minutos en este
                navegador para reducir llamadas a la API.
              </p>
            </div>
          )}
        </section>

        {places.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {places.length}{" "}
                {places.length === 1 ? "prospecto" : "prospectos"}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void refetchSearch()}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  {loading ? "Actualizando…" : "Actualizar desde Google"}
                </button>
                {csvUrl && (
                  <a
                    href={csvUrl}
                    download={`prospectos-${niche.replace(/\s+/g, "-").slice(0, 24)}.csv`}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    Descargar CSV
                  </a>
                )}
                {svgUrl && (
                  <a
                    href={svgUrl}
                    download={`prospectos-${niche.replace(/\s+/g, "-").slice(0, 24)}.svg`}
                    className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    Descargar SVG
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Guardar en MongoDB
              </p>
              {listsLoadError ? (
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">
                  No hay conexión a la base de datos. Añade{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                    MONGODB_URI
                  </code>{" "}
                  en{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                    .env.local
                  </code>{" "}
                  y reinicia el servidor.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-zinc-500">
                    Etiquetas opcionales (coma) se aplican al guardar desde esta
                    tabla. En «Mis listas» puedes afinar notas, estado y
                    seguimiento.
                  </p>
                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                    <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        Lista destino
                      </span>
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                      >
                        {lists.length === 0 ? (
                          <option value="">— Crea una lista —</option>
                        ) : (
                          lists.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                    <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        Etiquetas (opcional)
                      </span>
                      <input
                        value={saveTags}
                        onChange={(e) => setSaveTags(e.target.value)}
                        placeholder="frio, seguimiento"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                      />
                    </label>
                    <div className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        Nueva lista
                      </span>
                      <form
                        className="flex flex-wrap gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (newListName.trim()) createListMut.mutate();
                        }}
                      >
                        <input
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          placeholder="Nombre"
                          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
                        />
                        <button
                          type="submit"
                          disabled={!newListName.trim() || createListMut.isPending}
                          className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-800"
                        >
                          {createListMut.isPending ? "…" : "Crear"}
                        </button>
                      </form>
                    </div>
                    <button
                      type="button"
                      disabled={
                        !canSaveToMongo ||
                        saveBulkMut.isPending ||
                        places.length === 0
                      }
                      onClick={() => {
                        if (!selectedListId) {
                          setSaveHint("Selecciona o crea una lista.");
                          return;
                        }
                        saveBulkMut.mutate();
                      }}
                      className="h-[42px] rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saveBulkMut.isPending
                        ? "Guardando…"
                        : "Guardar todos en la lista"}
                    </button>
                  </div>
                  {saveHint && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {saveHint}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Mapa de ubicaciones
              </h3>
              <ResultsMap places={places} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <Table className="min-w-[720px]">
                <TableHeader className="[&_tr]:border-zinc-200 dark:[&_tr]:border-zinc-800">
                  <TableRow className="border-zinc-200 bg-zinc-50/90 hover:!bg-zinc-50/90 dark:border-zinc-800 dark:bg-zinc-800/50 dark:hover:!bg-zinc-800/50">
                    <TableHead className="min-w-[160px] max-w-[200px] px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Nombre
                    </TableHead>
                    <TableHead className="w-[88px] min-w-[88px] px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Web
                    </TableHead>
                    <TableHead className="min-w-[110px] max-w-[130px] px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Teléfono
                    </TableHead>
                    <TableHead className="min-w-[130px] max-w-[160px] px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Categoría
                    </TableHead>
                    <TableHead className="min-w-[72px] max-w-[90px] px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Nota
                    </TableHead>
                    <TableHead className="min-w-[160px] max-w-[200px] px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Horario
                    </TableHead>
                    <TableHead className="w-16 min-w-16 px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Maps
                    </TableHead>
                    <TableHead className="min-w-[100px] px-3 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Lista
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {places.map((p) => {
                    const web = p.website ? websiteHref(p.website) : "";
                    return (
                      <TableRow
                        key={p.id || p.name + p.address}
                        className="border-zinc-200 hover:!bg-zinc-50/80 data-[state=selected]:bg-zinc-100 dark:border-zinc-800 dark:hover:!bg-zinc-800/35 dark:data-[state=selected]:bg-zinc-800"
                      >
                        <TableCell className="min-w-0 align-top py-3">
                          <span
                            className="block max-w-full truncate font-medium"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 align-top py-3">
                          {p.website ? (
                            <a
                              href={web}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block whitespace-nowrap text-sm font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 dark:text-emerald-400"
                              title={web}
                            >
                              Visitar
                            </a>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "min-w-0 align-top py-3 tabular-nums",
                            "whitespace-nowrap"
                          )}
                          title={p.phone || undefined}
                        >
                          <span className="block max-w-full truncate">
                            {p.phone || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal align-top py-3">
                          <div
                            className="line-clamp-2 text-sm leading-snug"
                            title={
                              [p.primaryTypeLabel, p.primaryType]
                                .filter(Boolean)
                                .join(" — ") || undefined
                            }
                          >
                            {p.primaryTypeLabel ?? p.primaryType ?? "—"}
                          </div>
                          {p.types.length > 0 && (
                            <p
                              className="mt-1 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400"
                              title={p.types.join(", ")}
                            >
                              {p.types.join(", ")}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="min-w-0 align-top py-3 tabular-nums text-sm">
                          {p.rating != null ? (
                            <span
                              className="block max-w-full truncate"
                              title={`${p.rating}${p.reviewCount != null ? ` · ${p.reviewCount} reseñas` : ""}`}
                            >
                              {p.rating.toFixed(1)}
                              {p.reviewCount != null ? (
                                <span className="text-zinc-500 dark:text-zinc-400">
                                  {" "}
                                  ({p.reviewCount})
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="min-w-0 whitespace-normal align-top py-3">
                          {p.openingHoursText ? (
                            <p
                              className="line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400"
                              title={p.openingHoursText}
                            >
                              {p.openingHoursText}
                            </p>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="align-top py-3 whitespace-nowrap">
                          {p.mapsUrl ? (
                            <a
                              href={p.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 dark:text-emerald-400"
                            >
                              Abrir
                            </a>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="align-top py-3">
                          <button
                            type="button"
                            disabled={
                              !canSaveToMongo ||
                              saveOneMut.isPending ||
                              !p.id
                            }
                            onClick={() => {
                              if (!selectedListId || !p.id) {
                                setSaveHint(
                                  "Este resultado no tiene ID de Google; no se puede deduplicar."
                                );
                                return;
                              }
                              saveOneMut.mutate(p);
                            }}
                            className="text-sm font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
                          >
                            {saveOneMut.isPending &&
                            saveOneMut.variables?.id === p.id
                              ? "…"
                              : "Guardar"}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Consejo: usa el enlace de Maps para comprobar el negocio y luego
              escríbeles por WhatsApp para tu auditoría tipo «cliente
              misterioso». Respeta el opt-out y la normativa local de
              prospección.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
