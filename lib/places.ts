/**
 * Google Places API (New) — Text Search.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */

const PLACES_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  // Must be listed or the API omits it and pagination stops at 20 (first page).
  "nextPageToken",
  "places.id",
  "places.displayName",
  "places.location",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.editorialSummary",
  "places.priceLevel",
  "places.regularOpeningHours",
].join(",");

export type PlaceLead = {
  id: string;
  name: string;
  /** WGS84, when returned by Places API */
  lat: number | null;
  lng: number | null;
  address: string;
  phone: string;
  website: string;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string;
  businessStatus: string | null;
  types: string[];
  primaryType: string | null;
  primaryTypeLabel: string | null;
  summary: string | null;
  priceLevel: string | null;
  priceLevelLabel: string | null;
  openingHoursText: string | null;
};

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
  priceLevel?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
};

function labelPriceLevel(code: string | undefined): string | null {
  if (!code || code === "PRICE_LEVEL_UNSPECIFIED") return null;
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Gratis",
    PRICE_LEVEL_INEXPENSIVE: "Económico (€)",
    PRICE_LEVEL_MODERATE: "Moderado (€€)",
    PRICE_LEVEL_EXPENSIVE: "Caro (€€€)",
    PRICE_LEVEL_VERY_EXPENSIVE: "Muy caro (€€€€)",
  };
  return map[code] ?? code.replace(/^PRICE_LEVEL_/, "").replace(/_/g, " ");
}

type SearchTextResponse = {
  places?: RawPlace[];
  nextPageToken?: string;
};

function mapPlace(p: RawPlace): PlaceLead {
  const phone =
    p.nationalPhoneNumber?.trim() ||
    p.internationalPhoneNumber?.trim() ||
    "";
  const weekday = p.regularOpeningHours?.weekdayDescriptions;
  const openingHoursText =
    weekday && weekday.length > 0 ? weekday.join(" · ") : null;

  const lat =
    typeof p.location?.latitude === "number" ? p.location.latitude : null;
  const lng =
    typeof p.location?.longitude === "number" ? p.location.longitude : null;

  return {
    id: p.id ?? "",
    name: p.displayName?.text?.trim() ?? "Desconocido",
    lat,
    lng,
    address: p.formattedAddress?.trim() ?? "",
    phone,
    website: p.websiteUri?.trim() ?? "",
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    mapsUrl: p.googleMapsUri?.trim() ?? "",
    businessStatus: p.businessStatus ?? null,
    types: Array.isArray(p.types) ? p.types : [],
    primaryType: p.primaryType?.trim() ?? null,
    primaryTypeLabel: p.primaryTypeDisplayName?.text?.trim() ?? null,
    summary: p.editorialSummary?.text?.trim() ?? null,
    priceLevel: p.priceLevel ?? null,
    priceLevelLabel: labelPriceLevel(p.priceLevel),
    openingHoursText,
  };
}

export async function searchTextPlaces(
  apiKey: string,
  textQuery: string,
  options: {
    maxTotal: number;
    regionCode?: string;
    languageCode?: string;
  }
): Promise<{ places: PlaceLead[]; truncated: boolean }> {
  const maxTotal = Math.min(Math.max(1, options.maxTotal), 60);
  const collected: PlaceLead[] = [];
  let pageToken: string | undefined;
  let truncated = false;

  while (collected.length < maxTotal) {
    const perPage = Math.min(20, maxTotal - collected.length);
    const body: Record<string, unknown> = {
      textQuery,
      pageSize: perPage,
    };
    if (pageToken) {
      body.pageToken = pageToken;
    }
    if (options.regionCode) {
      body.regionCode = options.regionCode;
    }
    if (options.languageCode) {
      body.languageCode = options.languageCode;
    }

    const res = await fetch(PLACES_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    const rawText = await res.text();
    let data: SearchTextResponse;
    try {
      data = JSON.parse(rawText) as SearchTextResponse;
    } catch {
      throw new Error(
        res.ok
          ? "Respuesta JSON inválida de Places API"
          : `Error de Places API (${res.status}): ${rawText.slice(0, 500)}`
      );
    }

    if (!res.ok) {
      const msg =
        (data as unknown as { error?: { message?: string } }).error
          ?.message || rawText.slice(0, 500);
      throw new Error(`Places API (${res.status}): ${msg}`);
    }

    const batch = (data.places ?? []).map(mapPlace);
    for (const place of batch) {
      if (!collected.some((c) => c.id && c.id === place.id)) {
        collected.push(place);
      }
      if (collected.length >= maxTotal) break;
    }

    pageToken = data.nextPageToken;
    if (!pageToken || batch.length === 0) break;

    if (collected.length >= maxTotal) {
      truncated = !!pageToken;
      break;
    }

    // Next page token often needs a short delay (Google recommendation for legacy; safe here too)
    await new Promise((r) => setTimeout(r, 2000));
  }

  return { places: collected.slice(0, maxTotal), truncated };
}

export function buildLeadQuery(niche: string, location: string): string {
  const n = niche.trim();
  const l = location.trim();
  if (!n || !l) return `${n} ${l}`.trim();
  return `${n} en ${l}`;
}
