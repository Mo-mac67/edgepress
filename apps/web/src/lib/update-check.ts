import "server-only";
import { readJsonDoc, writeJsonDoc } from "./storage";
import pkg from "../../package.json";

/**
 * Update notifications: every install checks the upstream repo's latest
 * GitHub Release (public API, no token) at most once per day and surfaces a
 * quiet banner in the admin. Self-hosters can point EDGEPRESS_UPDATE_REPO at
 * their own fork, or set it to "off" to disable checking entirely.
 */

export const APP_VERSION: string = pkg.version;
const REPO = () => process.env.EDGEPRESS_UPDATE_REPO ?? "Mo-mac67/edgepress";
const CACHE_KEY = "update-check.json";
const TTL_MS = 24 * 3600_000;

export interface UpdateInfo {
  current: string;
  latest: string | null;
  url: string | null;
  updateAvailable: boolean;
  checkedAt: string;
}

/** True when `latest` is a strictly newer semver than `current`. Pure. */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const [lM, lm, lp] = parse(latest);
  const [cM, cm, cp] = parse(current);
  if (lM !== cM) return lM > cM;
  if (lm !== cm) return lm > cm;
  return lp > cp;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const off: UpdateInfo = { current: APP_VERSION, latest: null, url: null, updateAvailable: false, checkedAt: new Date().toISOString() };
  if (REPO() === "off") return off;

  const cached = await readJsonDoc<UpdateInfo | null>(CACHE_KEY, null);
  if (cached && Date.now() - new Date(cached.checkedAt).getTime() < TTL_MS) {
    // Re-derive against the RUNNING version (the install may have upgraded).
    return { ...cached, current: APP_VERSION, updateAvailable: !!cached.latest && isNewerVersion(cached.latest, APP_VERSION) };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO()}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "edgepress-update-check" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return cached ?? off;
    const rel = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = rel.tag_name ?? null;
    const info: UpdateInfo = {
      current: APP_VERSION,
      latest,
      url: rel.html_url ?? null,
      updateAvailable: !!latest && isNewerVersion(latest, APP_VERSION),
      checkedAt: new Date().toISOString(),
    };
    await writeJsonDoc(CACHE_KEY, info);
    return info;
  } catch {
    return cached ?? off; // offline installs just never see the banner
  }
}
