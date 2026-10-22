# syntax=docker/dockerfile:1

# NOTE ON STAGE ORDER: `web` must be the LAST stage. Docker builds the final
# stage when no --target is given, which is what Render does — if `worker`
# came last, Render would start `pnpm worker`, a process that binds no port,
# and fail with "No open ports detected". docker-compose.yml pins
# target: web explicitly, which is why this only breaks on Render.
# To build the worker image instead: docker build -f Dockerfile --target worker .

FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Prisma ships a native engine (libquery_engine-debian-openssl-3.0.x.so.node)
# that dlopens libssl.so.3 / libcrypto.so.3. Node links OpenSSL statically, so
# node:24-slim ships neither the libraries nor the `openssl` CLI Prisma runs to
# detect its platform — without this, `pnpm install` fails with
# "Please manually install OpenSSL". Installing in `base` covers the deps
# stage (engine download), the builder stage (prisma generate) and the web
# runtime, which loads the same engine at query time.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Build (Next.js standalone)
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm next build

# ---------------------------------------------------------------------------
# Worker runtime (BullMQ + scheduled publisher)
# Built only via an explicit --target; must stay above `web`.
# ---------------------------------------------------------------------------
FROM base AS worker
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
CMD ["pnpm", "worker"]

# ---------------------------------------------------------------------------
# Web runtime — LAST STAGE: this is what an untargeted `docker build` produces.
# ---------------------------------------------------------------------------
FROM base AS web
ENV NODE_ENV=production
# Docker sets HOSTNAME to the container ID, and Next's standalone server.js does
# `hostname = process.env.HOSTNAME || '0.0.0.0'` — the fallback never applies, so
# it tries to bind to the container ID and dies with
# "getaddrinfo ENOTFOUND <container-id>" before listening, which surfaces as a
# 502 Bad Gateway. Force all interfaces.
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# No COPY of node_modules/.prisma or node_modules/@prisma here: with pnpm's
# isolated layout neither path exists at the top level. The generated client
# (plus libquery_engine-*.so.node) lives in node_modules/.pnpm/... and is
# already traced into .next/standalone/node_modules by output: "standalone",
# which is what `node server.js` resolves against.
EXPOSE 3000
CMD ["node", "server.js"]
