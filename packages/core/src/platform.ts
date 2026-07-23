/**
 * Host-platform bindings, injected — core never imports a specific host SDK.
 * The app registers a source once (e.g. OpenNext's getCloudflareContext on
 * Workers); self-hosted Node/Docker simply never registers one and every
 * lookup returns undefined, which selects the filesystem/SQLite/Postgres path.
 */
export type PlatformEnv = Record<string, unknown>;
export type PlatformEnvSource = () => Promise<PlatformEnv | undefined> | PlatformEnv | undefined;

let source: PlatformEnvSource | null = null;

/** Idempotent — the last registered source wins. */
export function setPlatformEnvSource(fn: PlatformEnvSource): void {
  source = fn;
}

/** The host env (Workers bindings object) or undefined off-platform. */
export async function getPlatformEnv(): Promise<PlatformEnv | undefined> {
  try {
    return source ? await source() : undefined;
  } catch {
    return undefined;
  }
}
