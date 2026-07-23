# EdgePress — self-host anywhere with Docker.
# Uses the filesystem storage adapter (data persisted to a mounted volume),
# so no Cloudflare/KV/R2 is required. For the $0 edge deploy use Cloudflare
# Workers instead (see the Deploy-to-Cloudflare button in the README).
#
# Build from the REPO ROOT (the app consumes packages/core + packages/ai as
# source from ../../packages):   docker build -f apps/web/Dockerfile .

# ---- build ----
FROM node:22-slim AS build
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci
COPY packages /repo/packages
COPY apps/web .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- run ----
FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    EDGEPRESS_STORAGE=fs \
    EDGEPRESS_MEDIA=fs \
    DATA_DIR=/data \
    PORT=3000
COPY --from=build /repo/apps/web/node_modules ./node_modules
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/package.json ./package.json
COPY --from=build /repo/apps/web/next.config.ts ./next.config.ts
# All CMS documents + uploaded media live here — mount a volume to persist them.
VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "run", "start"]
