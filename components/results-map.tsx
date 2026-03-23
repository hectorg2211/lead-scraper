"use client";

import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { PlaceLead } from "@/lib/places";

type Props = {
  places: PlaceLead[];
};

function fixLeafletDefaultIcons(L: typeof import("leaflet")) {
  type IconProto = { _getIconUrl?: string };
  const proto = L.Icon.Default.prototype as IconProto;
  delete proto._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
}

export default function ResultsMap({ places }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").LayerGroup | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = await import("leaflet");

      if (cancelled || !containerRef.current) return;
      fixLeafletDefaultIcons(L);

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          scrollWheelZoom: true,
        }).setView([40.416775, -3.70379], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(mapRef.current);
        markersRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const map = mapRef.current;
      const layer = markersRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

      if (mappable.length === 0) {
        map.setView([40.416775, -3.70379], 6);
        return;
      }

      const bounds = L.latLngBounds(
        mappable.map((p) => [p.lat, p.lng] as [number, number])
      );

      for (const p of mappable) {
        L.marker([p.lat, p.lng])
          .bindPopup(`<div class="text-sm"><strong>${escapeHtml(p.name)}</strong>${p.address ? `<br/>${escapeHtml(p.address)}` : ""}</div>`)
          .addTo(layer);
      }

      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      map.invalidateSize();
    })();

    return () => {
      cancelled = true;
    };
  }, [mappable]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  const missing = places.length - mappable.length;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-[min(420px,55vh)] w-full min-h-[240px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        aria-label="Mapa de ubicaciones de los resultados"
      />
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
