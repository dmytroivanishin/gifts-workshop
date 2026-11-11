
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Every dependency (dev ones included: the build and the migrator need them), installed once.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Only public NEXT_PUBLIC_* values are passed as build args (they end up in the browser bundle anyway).
# Secrets never reach a build stage: they are injected at container start from config/.env.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPPORTED_LOCALES
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_DEFAULT_LOCALE_PUBLIC
ARG NEXT_PUBLIC_MAX_FILE_SIZE_MB
ARG NEXT_PUBLIC_MAX_FILES_PER_UPLOAD
ARG NEXT_PUBLIC_DEV_MODE
# Base64, not JSON: build-args mangle quotes and commas (see the workflow). Decoded right here.
ARG NEXT_PUBLIC_SOCIAL_LINKS_B64
RUN NEXT_PUBLIC_SOCIAL_LINKS="$(printf '%s' "$NEXT_PUBLIC_SOCIAL_LINKS_B64" | base64 -d)" npm run build

# One-off job run by the deploy script: `docker compose run --rm migrate`.
# Separate target because the runner has no tsx, src/ or devDependencies, which the migration needs.
FROM builder AS migrator
CMD ["npm", "run", "migrate"]

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN mkdir -p /app/.next && chown node:node /app/.next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
