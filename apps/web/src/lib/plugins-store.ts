import "server-only";
import { readJsonDoc, writeJsonDoc } from "./storage";
import { deleteSnippet, getSnippets, saveSnippet } from "./snippets-store";
import { slugify } from "./content-store";

/**
 * Extensions v2 — declarative plugins. A plugin is a JSON manifest that bundles
 * things EdgePress already renders safely: reusable snippets, a settings bag,
 * and an optional SKILL.md that teaches an AI agent (via MCP) how to use it.
 *
 * WHY declarative: the Workers runtime can't load third-party JS at request
 * time, so a "plugin" can't be arbitrary code. Instead it composes existing,
 * sandboxed capabilities — which is safe (no code execution), portable, and
 * still covers the real need (drop-in content blocks + agent skills). Runtime
 * behaviour that needs real code is done via webhooks/Content API (a plugin's
 * manifest can point at the owner's own endpoint).
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  /** Reusable snippets the plugin installs (usable as [snippet name]). */
  snippets?: { name: string; html: string }[];
  /** Free-form settings the plugin declares (shown read-only in the panel). */
  settings?: Record<string, string | number | boolean>;
  /** Markdown that teaches an AI agent how to use this plugin (exposed via MCP). */
  skill?: string;
}

export interface InstalledPlugin extends PluginManifest {
  installedAt: string;
  /** snippet names this plugin owns, so uninstall removes exactly them. */
  ownedSnippets: string[];
}

const KEY = "plugins.json";
const MAX = 50;
const SKILL_MAX = 20_000;

/** Validate + normalize an untrusted manifest. Pure — unit-tested. */
export function validatePluginManifest(raw: unknown): PluginManifest | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Manifest must be a JSON object" };
  const m = raw as Record<string, unknown>;
  const id = slugify(String(m.id ?? m.name ?? ""));
  const name = String(m.name ?? "").trim().slice(0, 80);
  if (!id) return { error: "Plugin needs an id or name" };
  if (!name) return { error: "Plugin needs a name" };
  const version = /^\d+\.\d+\.\d+/.test(String(m.version)) ? String(m.version) : "0.0.0";

  const out: PluginManifest = { id, name, version };
  if (m.description) out.description = String(m.description).slice(0, 300);
  if (m.author) out.author = String(m.author).slice(0, 80);
  if (m.homepage && /^https?:\/\//.test(String(m.homepage))) out.homepage = String(m.homepage).slice(0, 300);

  if (Array.isArray(m.snippets)) {
    const seen = new Set<string>();
    out.snippets = [];
    for (const s of m.snippets.slice(0, 40)) {
      const sn = slugify(String((s as { name?: string })?.name ?? ""));
      const html = String((s as { html?: string })?.html ?? "");
      if (!sn || seen.has(sn) || !html) continue;
      seen.add(sn);
      out.snippets.push({ name: `${id}-${sn}`, html: html.slice(0, 50_000) });
    }
  }
  if (m.settings && typeof m.settings === "object" && !Array.isArray(m.settings)) {
    const s: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(m.settings).slice(0, 40)) {
      if (["string", "number", "boolean"].includes(typeof v)) s[k.slice(0, 60)] = v as string | number | boolean;
    }
    out.settings = s;
  }
  if (typeof m.skill === "string" && m.skill.trim()) out.skill = m.skill.slice(0, SKILL_MAX);
  return out;
}

export async function getPlugins(): Promise<InstalledPlugin[]> {
  return readJsonDoc<InstalledPlugin[]>(KEY, []);
}

export async function installPlugin(raw: unknown): Promise<InstalledPlugin | { error: string }> {
  const manifest = validatePluginManifest(raw);
  if ("error" in manifest) return manifest;
  const list = await getPlugins();
  if (list.length >= MAX && !list.some((p) => p.id === manifest.id)) return { error: `Limit of ${MAX} plugins reached` };

  // Register the plugin's snippets so [snippet …] works site-wide immediately.
  const ownedSnippets: string[] = [];
  for (const sn of manifest.snippets ?? []) {
    const r = await saveSnippet({ name: sn.name, html: sn.html });
    if (!("error" in r)) ownedSnippets.push(sn.name);
  }

  const installed: InstalledPlugin = { ...manifest, installedAt: new Date().toISOString(), ownedSnippets };
  const next = list.filter((p) => p.id !== manifest.id).concat(installed);
  await writeJsonDoc(KEY, next);
  return installed;
}

export async function uninstallPlugin(id: string): Promise<boolean> {
  const list = await getPlugins();
  const plugin = list.find((p) => p.id === id);
  if (!plugin) return false;
  // Remove exactly the snippets this plugin installed.
  const snippets = await getSnippets();
  for (const name of plugin.ownedSnippets) {
    const s = snippets.find((x) => x.name === name);
    if (s) await deleteSnippet(s.id);
  }
  await writeJsonDoc(KEY, list.filter((p) => p.id !== id));
  return true;
}

/** Skills of installed plugins — surfaced to AI agents via the MCP server. */
export async function getPluginSkills(): Promise<{ id: string; name: string; skill: string }[]> {
  return (await getPlugins()).filter((p) => p.skill).map((p) => ({ id: p.id, name: p.name, skill: p.skill! }));
}
