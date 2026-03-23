import type { PlaceLead } from "@/lib/places";

export type PlacesSearchParams = {
  niche: string;
  location: string;
  maxResults: number;
  regionCode?: string;
  languageCode: string;
};

export type PlacesSearchSuccess = {
  query: string;
  truncated: boolean;
  places: PlaceLead[];
};

export function placesSearchQueryKey(params: PlacesSearchParams) {
  return ["places-search", params] as const;
}

export async function fetchPlacesSearch(
  params: PlacesSearchParams
): Promise<PlacesSearchSuccess> {
  const res = await fetch("/api/places/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      niche: params.niche,
      location: params.location,
      maxResults: params.maxResults,
      regionCode: params.regionCode,
      languageCode: params.languageCode,
    }),
  });
  const data = (await res.json()) as {
    error?: string;
    query?: string;
    truncated?: boolean;
    places?: PlaceLead[];
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Error en la petición (${res.status})`);
  }
  return {
    query: data.query ?? "",
    truncated: Boolean(data.truncated),
    places: data.places ?? [],
  };
}
