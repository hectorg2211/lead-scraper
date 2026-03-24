import type { LeadStatus } from "@/lib/saved-leads-types";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  no_whatsapp: "Sin WhatsApp",
  contacted: "Contactado",
  qualified: "Cualificado",
  lost: "Descartado",
  won: "Ganado",
};

/** Pill/badge (compact list, chips) */
export const STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  no_whatsapp:
    "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  contacted:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200",
  qualified:
    "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  lost: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};

/** Tinted border/background for status `<select>` and shadcn `SelectTrigger` */
export const STATUS_FIELD_CLASSES: Record<LeadStatus, string> = {
  new: "border-sky-300/80 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-50",
  no_whatsapp:
    "border-zinc-400/80 bg-zinc-100 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-50",
  contacted:
    "border-indigo-300/80 bg-indigo-50 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-50",
  qualified:
    "border-amber-300/80 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50",
  lost: "border-rose-300/80 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-50",
  won: "border-emerald-300/80 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-50",
};

/** Small dot next to status in menus */
export const STATUS_DOT_CLASSES: Record<LeadStatus, string> = {
  new: "bg-sky-500",
  no_whatsapp: "bg-zinc-500",
  contacted: "bg-indigo-500",
  qualified: "bg-amber-500",
  lost: "bg-rose-500",
  won: "bg-emerald-500",
};

export const LEAD_STATUSES_ORDER: LeadStatus[] = [
  "new",
  "no_whatsapp",
  "contacted",
  "qualified",
  "lost",
  "won",
];
