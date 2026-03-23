import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Geocodificación inversa vía Nominatim (OSM).
 * Política: https://operations.osmfoundation.org/policies/nominatim/
 */

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
};

type NominatimReverse = {
  display_name?: string;
  address?: NominatimAddress;
};

function buildLabel(data: NominatimReverse): string {
  const a = data.address;
  if (!a) return (data.display_name ?? "").trim();

  const place =
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.county ||
    a.state ||
    "";
  const country = a.country ?? "";
  if (place && country) return `${place}, ${country}`;
  if (country) return country;
  return (data.display_name ?? "").trim();
}

export async function POST(req: Request) {
  let body: { lat?: number; lng?: number };
  try {
    body = (await req.json()) as { lat?: number; lng?: number };
  } catch {
    return NextResponse.json({ error: "JSON no válido" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat y lng numéricos son obligatorios" },
      { status: 400 }
    );
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: "Coordenadas fuera de rango" },
      { status: 400 }
    );
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("accept-language", "es");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "lead-scraper/1.0 (Next.js; prospección local)",
    },
  });

  const text = await res.text();
  let data: NominatimReverse;
  try {
    data = JSON.parse(text) as NominatimReverse;
  } catch {
    return NextResponse.json(
      { error: "Respuesta de geocodificación no válida" },
      { status: 502 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: `Geocodificación (${res.status})` },
      { status: 502 }
    );
  }

  const label = buildLabel(data);
  if (!label) {
    return NextResponse.json(
      { error: "No se pudo obtener una ciudad para esas coordenadas" },
      { status: 404 }
    );
  }

  const cc = data.address?.country_code?.toUpperCase();

  return NextResponse.json({
    label,
    countryCode: cc && cc.length === 2 ? cc : undefined,
  });
}
