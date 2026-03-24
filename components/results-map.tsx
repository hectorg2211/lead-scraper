"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from "@react-google-maps/api";
import type { PlaceLead } from "@/lib/places";

type Props = {
  places: PlaceLead[];
};

const defaultCenter = { lat: 40.416775, lng: -3.70379 };
const defaultZoom = 6;

const mapContainerClassName =
  "h-[min(420px,55vh)] w-full min-h-[240px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900";

function resolveMapsApiKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ??
    undefined
  );
}

function ResultsMapGoogle({ places }: Props) {
  const apiKey = resolveMapsApiKey()!;
  const { isLoaded, loadError } = useJsApiLoader({
    id: "results-map-script",
    googleMapsApiKey: apiKey,
  });

  const mappable = useMemo(
    () =>
      places.filter(
        (p): p is PlaceLead & { lat: number; lng: number } =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          !Number.isNaN(p.lat) &&
          !Number.isNaN(p.lng)
      ),
    [places]
  );

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const onLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (mappable.length === 0) {
      map.setCenter(defaultCenter);
      map.setZoom(defaultZoom);
      return;
    }
    if (mappable.length === 1) {
      const p = mappable[0];
      map.setCenter({ lat: p.lat, lng: p.lng });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of mappable) {
      bounds.extend({ lat: p.lat, lng: p.lng });
    }
    map.fitBounds(bounds, 28);
  }, [map, isLoaded, mappable]);

  useEffect(() => {
    setActiveId(null);
  }, [mappable]);

  if (loadError) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className={`${mapContainerClassName} flex items-center justify-center px-4 text-center text-sm text-red-600 dark:text-red-400`}
        >
          No se pudo cargar Google Maps. Comprueba la clave y que Maps JavaScript API esté activa.
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className={`${mapContainerClassName} flex items-center justify-center text-sm text-zinc-500`}
          aria-busy
        >
          Cargando mapa…
        </div>
      </div>
    );
  }

  const missing = places.length - mappable.length;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative"
        role="region"
        aria-label="Mapa de ubicaciones de los resultados"
      >
        <GoogleMap
          mapContainerClassName={mapContainerClassName}
          center={defaultCenter}
          zoom={defaultZoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={() => setActiveId(null)}
          options={{
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          }}
        >
          {mappable.map((p) => (
            <Marker
              key={p.id}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.name}
              onClick={() => setActiveId(p.id)}
            >
              {activeId === p.id && (
                <InfoWindow onCloseClick={() => setActiveId(null)}>
                  <div className="max-w-[240px] text-sm text-zinc-900">
                    <strong>{p.name}</strong>
                    {p.address ? (
                      <>
                        <br />
                        {p.address}
                      </>
                    ) : null}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          ))}
        </GoogleMap>
      </div>
      {missing > 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          {missing}{" "}
          {missing === 1
            ? "resultado sin coordenadas en la respuesta de Google."
            : "resultados sin coordenadas en la respuesta de Google."}
        </p>
      )}
    </div>
  );
}

export default function ResultsMap({ places }: Props) {
  const key = resolveMapsApiKey();
  const mappableCount = useMemo(
    () =>
      places.filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          !Number.isNaN(p.lat) &&
          !Number.isNaN(p.lng)
      ).length,
    [places]
  );
  const missing = places.length - mappableCount;

  if (!key) {
    return (
      <div className="flex flex-col gap-2">
        <div
          className={`${mapContainerClassName} flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-amber-800 dark:text-amber-200`}
        >
          <span>
            Añade{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/40">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            </code>{" "}
            en{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/40">
              .env.local
            </code>{" "}
            (puede ser la misma clave que Places; activa Maps JavaScript API en Google Cloud).
          </span>
        </div>
        {missing > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {missing}{" "}
            {missing === 1
              ? "resultado sin coordenadas en la respuesta de Google."
              : "resultados sin coordenadas en la respuesta de Google."}
          </p>
        )}
      </div>
    );
  }

  return <ResultsMapGoogle places={places} />;
}
