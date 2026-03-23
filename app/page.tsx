"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlaceLead } from "@/lib/places";

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

function websiteLabel(url: string): string {
  const host = url.replace(/^https?:\/\//, "").trim();
  return host.length > 32 ? `${host.slice(0, 32)}…` : host;
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
  const [maxResults, setMaxResults] = useState(20);
  const [regionCode, setRegionCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryUsed, setQueryUsed] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [places, setPlaces] = useState<PlaceLead[]>([]);
  const [csvUrl, setCsvUrl] = useState<string | null>(null);
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
      return;
    }
    const csv = toCsv(places);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setCsvUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [places]);

  const runSearch = useCallback(async () => {
    setError(null);
    setLoading(true);
    setPlaces([]);
    setQueryUsed(null);
    setTruncated(false);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          location: location.trim(),
          maxResults,
          regionCode: regionCode.trim() || undefined,
          languageCode: "es",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        query?: string;
        truncated?: boolean;
        places?: PlaceLead[];
      };
      if (!res.ok) {
        setError(data.error ?? `Error en la petición (${res.status})`);
        return;
      }
      setQueryUsed(data.query ?? null);
      setTruncated(Boolean(data.truncated));
      setPlaces(data.places ?? []);
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [niche, location, maxResults, regionCode]);

  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-8 dark:border-zinc-800">
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Prospección B2B
          </p>
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
                    Math.min(60, Math.max(1, Number(e.target.value) || 20))
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
                onClick={() => void runSearch()}
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
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              Consulta enviada a Google:{" "}
              <span className="font-mono text-zinc-700 dark:text-zinc-400">
                {queryUsed}
              </span>
              {truncated &&
                " — hay más resultados (sube el máximo o vuelve a buscar)."}
            </p>
          )}
        </section>

        {places.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {places.length}{" "}
                {places.length === 1 ? "prospecto" : "prospectos"}
              </h2>
              {csvUrl && (
                <a
                  href={csvUrl}
                  download={`prospectos-${niche.replace(/\s+/g, "-").slice(0, 24)}.csv`}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Descargar CSV
                </a>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <table className="min-w-[1100px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <tr>
                    <th className="min-w-[140px] px-4 py-3 font-medium">
                      Nombre
                    </th>
                    <th className="min-w-[100px] px-4 py-3 font-medium">
                      Web
                    </th>
                    <th className="min-w-[110px] px-4 py-3 font-medium">
                      Teléfono
                    </th>
                    <th className="min-w-[120px] px-4 py-3 font-medium">
                      Categoría
                    </th>
                    <th className="min-w-[72px] px-4 py-3 font-medium">
                      Nota
                    </th>
                    <th className="min-w-[220px] max-w-72 px-4 py-3 font-medium">
                      Resumen
                    </th>
                    <th className="min-w-[90px] px-4 py-3 font-medium">
                      Precio
                    </th>
                    <th className="min-w-[180px] max-w-xs px-4 py-3 font-medium">
                      Horario
                    </th>
                    <th className="min-w-[200px] px-4 py-3 font-medium">
                      Dirección
                    </th>
                    <th className="min-w-[64px] px-4 py-3 font-medium">
                      Maps
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {places.map((p) => (
                    <tr key={p.id || p.name + p.address} className="align-top">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">
                        {p.website ? (
                          <a
                            href={websiteHref(p.website)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 dark:text-emerald-400"
                          >
                            {websiteLabel(p.website)}
                          </a>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {p.phone || "—"}
                      </td>
                      <td className="max-w-[140px] px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        <span className="line-clamp-3" title={p.primaryType ?? ""}>
                          {p.primaryTypeLabel ?? p.primaryType ?? "—"}
                        </span>
                        {p.types.length > 0 && (
                          <p
                            className="mt-1 text-xs text-zinc-500 dark:text-zinc-500"
                            title={p.types.join(", ")}
                          >
                            {p.types.slice(0, 3).join(", ")}
                            {p.types.length > 3 ? "…" : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                        {p.rating != null ? (
                          <>
                            {p.rating.toFixed(1)}
                            {p.reviewCount != null ? (
                              <span className="text-xs text-zinc-500">
                                {" "}
                                ({p.reviewCount})
                              </span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-72 px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {p.summary ? (
                          <p className="line-clamp-4 text-xs" title={p.summary}>
                            {p.summary}
                          </p>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                        {p.priceLevelLabel ?? p.priceLevel ?? "—"}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {p.openingHoursText ? (
                          <p
                            className="line-clamp-3"
                            title={p.openingHoursText}
                          >
                            {p.openingHoursText}
                          </p>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {p.address || "—"}
                      </td>
                      <td className="px-4 py-3">
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
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
