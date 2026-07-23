import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @edgepress/core + @edgepress/ai are consumed as SOURCE from ../../packages
  // via tsconfig paths — let the compiler pick up files outside the app dir.
  // externalDir covers the webpack production build; Turbopack (next dev)
  // needs the same mapping spelled out explicitly.
  experimental: { externalDir: true },
  turbopack: {
    resolveAlias: {
      "@edgepress/core": "../../packages/core/src/index.ts",
      "@edgepress/core/*": "../../packages/core/src/*.ts",
      "@edgepress/ai": "../../packages/ai/src/index.ts",
      "@edgepress/ai/*": "../../packages/ai/src/*.ts",
    },
  },
  allowedDevOrigins: ["100.76.177.98", ...(process.env.DEV_ORIGINS?.split(",").map((s) => s.trim()) ?? [])],
  // Pin file tracing to this app so a stray parent lockfile can't make Next
  // infer the wrong workspace root (which stalls the build).
  outputFileTracingRoot: process.cwd(),
  // Images are served as static assets (no Worker-side optimization).
  images: { unoptimized: true },
  // Locale entry: send "/" to /fr for French-primary browsers, else /en.
  // Handled here (not Proxy/middleware) — that can't run on Workers via OpenNext.
  // Next matches `has` header values as a full-string regex, so "fr.*" means the
  // Accept-Language header must START with "fr".
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "header", key: "accept-language", value: "fr.*" }],
        destination: "/fr",
        permanent: false,
      },
      { source: "/", destination: "/en", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Same-origin framing only. The admin's own live-preview iframes are
          // same-origin, so 'self' is sufficient; site owners can widen this in
          // their own deployment if they embed the site elsewhere.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Enable getCloudflareContext() (KV bindings) during `next dev` only. Guarded by
// NODE_ENV so `next build` never spins up the local Workers runtime (miniflare/
// workerd), which can crash the production build on some platforms.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
