import type { PlaceLead } from "@/lib/places";

/** Pipeline stages for outbound / CRM-style tracking */
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "lost"
  | "won";

export type LeadPriority = "low" | "medium" | "high";

export type SavedLead = {
  id: string;
  listId: string;
  placeId: string;
  place: PlaceLead;
  tags: string[];
  notes: string;
  status: LeadStatus;
  priority: LeadPriority;
  /** ISO date or null */
  followUpAt: string | null;
  /** Next action reminder, e.g. "Call Tuesday 10am" */
  nextStep: string | null;
  /** Search query that produced this lead, if saved from search */
  sourceQuery: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadList = {
  id: string;
  name: string;
  leadCount?: number;
  createdAt: string;
  updatedAt: string;
};
