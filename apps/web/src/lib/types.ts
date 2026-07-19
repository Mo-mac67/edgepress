export type Locale = "en" | "fr";

export interface LocalizedText {
  en: string;
  fr: string;
}

/** The kind of build/renovation a prospect is enquiring about. */
export type ProjectType =
  | "custom_home"
  | "home_addition"
  | "renovation"
  | "kitchen_bath"
  | "basement"
  | "commercial"
  | "design_build"
  | "other";

export const PROJECT_TYPES: ProjectType[] = [
  "custom_home",
  "home_addition",
  "renovation",
  "kitchen_bath",
  "basement",
  "commercial",
  "design_build",
  "other",
];

export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export const LEAD_STATUSES: LeadStatus[] = ["new", "contacted", "quoted", "won", "lost"];

export interface Lead {
  id: string;
  createdAt: string;
  locale: Locale;
  name: string;
  email: string;
  phone: string;
  /** City / area within the GTA the project is in. */
  city: string;
  projectType: ProjectType;
  /** Budget band the visitor selected (free text label). */
  budget?: string;
  /** Desired start timeline label. */
  timeline?: string;
  message?: string;
  /** Visitor-selected windows when they're available for a call. */
  preferredTimes?: string[];
  status: LeadStatus;
  notes?: string;
  /** false until an admin opens the lead — drives the "unread" indicator. */
  read?: boolean;
  /** ISO timestamp of the last follow-up email sent (for automation). */
  lastFollowUpAt?: string;
}
