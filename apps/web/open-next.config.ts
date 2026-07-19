import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import incrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Serve prerendered/static pages straight from the assets cache and intercept
// cacheable requests early — keeps per-request CPU low on the free plan.
export default defineCloudflareConfig({
  incrementalCache,
  enableCacheInterception: true,
});
