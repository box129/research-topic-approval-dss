FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# This target is used only by the explicit Compose maintenance service. It
# retains the pinned Prisma CLI so database migrations never rely on npx
# downloading a package at deployment time.
FROM dependencies AS migration

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --no-create-home app

COPY --chown=app:app package*.json ./
COPY --chown=app:app prisma ./prisma
RUN chown -R app:app /app

ENV NODE_ENV=production
USER app

ENTRYPOINT ["/app/node_modules/.bin/prisma"]
CMD ["migrate", "deploy"]

FROM dependencies AS production-dependencies

RUN npm prune --omit=dev

FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --no-create-home app

COPY --from=production-dependencies --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app package*.json ./
COPY --chown=app:app prisma ./prisma
COPY --chown=app:app src ./src
RUN mkdir -p /app/logs /app/tmp/imports \
    && chown -R app:app /app

ENV NODE_ENV=production
EXPOSE 3000

USER app

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
    CMD curl -fsS http://localhost:3000/api/v1/health || exit 1

CMD ["npm", "start"]
