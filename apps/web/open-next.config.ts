import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import incrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Serve prerendered/static pages straight from the assets cache and intercept
// cacheable requests early — keeps per-request CPU low on the free plan.
const config = defineCloudflareConfig({
  incrementalCache,
  enableCacheInterception: true,
});

// Build Next directly instead of through `npm run build`. Next 16 defaults to
// the Turbopack builder, which can't resolve EdgePress's aliased source packages
// (@edgepress/core, @edgepress/ai), so the build must use webpack. Invoking the
// local `next` binary also avoids a class of `npm exec`/`npm run` spawn failures
// seen on some Windows shells, where the wrapper exits non-zero with no output.
config.buildCommand = "node node_modules/next/dist/bin/next build --webpack";

export default config;
