import "server-only";
import type { Locale } from "./config";
import en from "./dictionaries/en.json";
import fr from "./dictionaries/fr.json";

const dictionaries: Record<Locale, typeof en> = { en, fr: fr as typeof en };

export type Dictionary = typeof en;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}
