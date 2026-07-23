import "server-only";
import { setPlatformEnvSource } from "@edgepress/core/platform";

/**
 * Registers Cloudflare Workers bindings (KV, AI, …) as the platform-env source
 * for @edgepress/core and @edgepress/ai. Imported (for its side effect) by
 * every shim that leads into package code, so registration always precedes the
 * first storage/AI call. Off Workers the dynamic import or context lookup
 * throws and the packages fall back to fs/SQLite/Postgres mode.
 */
setPlatformEnvSource(async () => {
  try {
    const mod = await import("@opennextjs/cloudflare");
    return mod.getCloudflareContext().env as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
});
