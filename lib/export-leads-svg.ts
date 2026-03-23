import type { PlaceLead } from "@/lib/places";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function trunc(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

type Col = { w: number; header: string; max: number; cell: (r: PlaceLead) => string };

const COLS: Col[] = [
  { w: 150, max: 42, header: "Nombre", cell: (r) => r.name },
  { w: 92, max: 18, header: "Teléfono", cell: (r) => r.phone },
  { w: 168, max: 36, header: "Sitio web", cell: (r) => r.website },
  { w: 200, max: 48, header: "Dirección", cell: (r) => r.address },
  {
    w: 132,
    max: 36,
    header: "Categoría",
    cell: (r) => r.primaryTypeLabel ?? r.primaryType ?? "",
  },
  { w: 240, max: 72, header: "Resumen", cell: (r) => r.summary ?? "" },
  { w: 88, max: 24, header: "Precio", cell: (r) => r.priceLevelLabel ?? r.priceLevel ?? "" },
  { w: 180, max: 48, header: "Horario", cell: (r) => r.openingHoursText ?? "" },
  {
    w: 56,
    max: 14,
    header: "Nota",
    cell: (r) =>
      r.rating != null
        ? `${r.rating}${r.reviewCount != null ? ` (${r.reviewCount})` : ""}`
        : "",
  },
  { w: 200, max: 48, header: "Maps", cell: (r) => r.mapsUrl },
  { w: 96, max: 20, header: "Estado", cell: (r) => r.businessStatus ?? "" },
];

const PAD = 16;
const ROW_H = 24;
const HEADER_H = 28;
const FONT =
  'font-family="ui-sans-serif,system-ui,-apple-system,sans-serif"';

export function toLeadsSvg(
  rows: PlaceLead[],
  meta: { niche: string; location: string; query?: string }
): string {
  const innerW = COLS.reduce((acc, c) => acc + c.w + PAD, 0) + PAD;
  const title = `Prospectos — ${meta.niche} · ${meta.location}`;
  const subtitle = meta.query?.trim() ?? "";

  const titleBlockH = subtitle ? 72 : 56;
  const headerTop = titleBlockH;
  const dataTop = headerTop + HEADER_H;
  const height = dataTop + rows.length * ROW_H + 32;

  const colLeft: number[] = [];
  let x = PAD;
  for (const c of COLS) {
    colLeft.push(x);
    x += c.w + PAD;
  }

  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xml:lang="es" width="${innerW}" height="${height}" viewBox="0 0 ${innerW} ${height}">`
  );
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);
  parts.push(
    `<text x="${PAD}" y="28" ${FONT} font-size="16" font-weight="600" fill="#171717">${escapeXml(title)}</text>`
  );
  if (subtitle) {
    parts.push(
      `<text x="${PAD}" y="52" ${FONT} font-size="11" fill="#52525b">${escapeXml(subtitle)}</text>`
    );
  }

  parts.push(
    `<rect x="0" y="${headerTop}" width="${innerW}" height="${HEADER_H}" fill="#f4f4f5" stroke="#e4e4e7"/>`
  );
  const headerTextY = headerTop + 18;
  for (let i = 0; i < COLS.length; i++) {
    parts.push(
      `<text x="${colLeft[i]}" y="${headerTextY}" ${FONT} font-size="11" font-weight="600" fill="#18181b">${escapeXml(COLS[i].header)}</text>`
    );
  }

  for (let r = 0; r < rows.length; r++) {
    const rowTop = dataTop + r * ROW_H;
    const fill = r % 2 === 0 ? "#ffffff" : "#fafafa";
    parts.push(
      `<rect x="0" y="${rowTop}" width="${innerW}" height="${ROW_H}" fill="${fill}" stroke="#f4f4f5"/>`
    );
    const textY = rowTop + 16;
    const row = rows[r];
    for (let i = 0; i < COLS.length; i++) {
      const c = COLS[i];
      const raw = c.cell(row);
      const text = escapeXml(trunc(raw, c.max));
      parts.push(
        `<text x="${colLeft[i]}" y="${textY}" ${FONT} font-size="10" fill="#3f3f46">${text}</text>`
      );
    }
  }

  parts.push(
    `<text x="${PAD}" y="${height - 12}" ${FONT} font-size="9" fill="#a1a1aa">${escapeXml(`Generado · ${new Date().toISOString().slice(0, 10)}`)}</text>`
  );
  parts.push(`</svg>`);

  return parts.join("\n");
}
